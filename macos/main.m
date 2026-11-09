#import <Cocoa/Cocoa.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <WebKit/WebKit.h>

#include <arpa/inet.h>
#include <limits.h>
#include <netinet/in.h>
#include <pthread.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

static const int kBudgetPort = 47321;
static NSString *gResourceRoot = nil;
static char gRootReal[PATH_MAX];

@interface AppDelegate : NSObject <NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate>
@property (nonatomic, strong) NSWindow *window;
@property (nonatomic, strong) WKWebView *webView;
@end

static void writeAll(int fd, const void *bytes, size_t length) {
    const char *cursor = bytes;
    while (length > 0) {
        ssize_t sent = send(fd, cursor, length, 0);
        if (sent <= 0) return;
        cursor += sent;
        length -= (size_t)sent;
    }
}

static void sendResponse(int client, int status, NSData *body, NSString *type, BOOL includeBody) {
    NSString *reason = status == 200 ? @"OK" : (status == 404 ? @"Not Found" : @"Error");
    NSString *header = [NSString stringWithFormat:
        @"HTTP/1.1 %d %@\r\nContent-Type: %@\r\nContent-Length: %lu\r\nConnection: close\r\nCache-Control: no-cache\r\n\r\n",
        status, reason, type, (unsigned long)body.length];
    NSData *headerData = [header dataUsingEncoding:NSUTF8StringEncoding];
    writeAll(client, headerData.bytes, headerData.length);
    if (includeBody && body.length > 0) writeAll(client, body.bytes, body.length);
}

static NSString *mimeType(NSString *extension) {
    NSString *ext = extension.lowercaseString;
    if ([ext isEqualToString:@"html"]) return @"text/html; charset=utf-8";
    if ([ext isEqualToString:@"css"]) return @"text/css; charset=utf-8";
    if ([ext isEqualToString:@"js"]) return @"text/javascript; charset=utf-8";
    if ([ext isEqualToString:@"svg"]) return @"image/svg+xml";
    if ([ext isEqualToString:@"png"]) return @"image/png";
    if ([ext isEqualToString:@"ico"]) return @"image/x-icon";
    return @"application/octet-stream";
}

static void respond(int client, const char *raw) {
    NSString *text = [NSString stringWithUTF8String:raw] ?: @"";
    NSString *line = [text componentsSeparatedByString:@"\r\n"].firstObject ?: @"";
    NSArray<NSString *> *parts = [line componentsSeparatedByString:@" "];
    if (parts.count < 2) {
        sendResponse(client, 400, [NSData data], @"text/plain; charset=utf-8", YES);
        return;
    }
    NSString *method = parts[0];
    BOOL head = [method isEqualToString:@"HEAD"];
    if (![method isEqualToString:@"GET"] && !head) {
        sendResponse(client, 405, [NSData data], @"text/plain; charset=utf-8", YES);
        return;
    }

    NSString *path = parts[1];
    NSRange query = [path rangeOfString:@"?"];
    if (query.location != NSNotFound) path = [path substringToIndex:query.location];
    path = [path stringByRemovingPercentEncoding] ?: path;
    if ([path isEqualToString:@"/"]) path = @"/index.html";
    if (path.length == 0 || [path characterAtIndex:0] != '/' || [path containsString:@"\0"]) {
        sendResponse(client, 400, [NSData data], @"text/plain; charset=utf-8", YES);
        return;
    }

    NSString *candidate = [gResourceRoot stringByAppendingPathComponent:[path substringFromIndex:1]];
    char resolved[PATH_MAX];
    if (!realpath(candidate.fileSystemRepresentation, resolved)) {
        sendResponse(client, 404, [@"Not found" dataUsingEncoding:NSUTF8StringEncoding], @"text/plain; charset=utf-8", !head);
        return;
    }
    size_t rootLength = strlen(gRootReal);
    if (strncmp(resolved, gRootReal, rootLength) != 0 || (resolved[rootLength] != '/' && resolved[rootLength] != '\0')) {
        sendResponse(client, 403, [NSData data], @"text/plain; charset=utf-8", !head);
        return;
    }

    BOOL isDirectory = NO;
    NSString *file = [NSString stringWithUTF8String:resolved];
    if (![[NSFileManager defaultManager] fileExistsAtPath:file isDirectory:&isDirectory] || isDirectory) {
        sendResponse(client, 404, [@"Not found" dataUsingEncoding:NSUTF8StringEncoding], @"text/plain; charset=utf-8", !head);
        return;
    }
    NSData *body = [NSData dataWithContentsOfFile:file] ?: [NSData data];
    sendResponse(client, 200, body, mimeType(file.pathExtension), !head);
}

static void handleClient(int client) {
    char buffer[16384];
    size_t used = 0;
    while (used < sizeof(buffer) - 1) {
        ssize_t count = read(client, buffer + used, sizeof(buffer) - 1 - used);
        if (count <= 0) break;
        used += (size_t)count;
        buffer[used] = '\0';
        if (strstr(buffer, "\r\n\r\n")) break;
    }
    if (used > 0) respond(client, buffer);
    close(client);
}

static void *acceptLoop(void *argument) {
    int server = (int)(intptr_t)argument;
    for (;;) {
        int client = accept(server, NULL, NULL);
        if (client < 0) continue;
        struct timeval timeout = { .tv_sec = 5, .tv_usec = 0 };
        setsockopt(client, SOL_SOCKET, SO_RCVTIMEO, &timeout, sizeof(timeout));
        handleClient(client);
    }
    return NULL;
}

static BOOL startServer(NSString **error) {
    NSString *root = NSBundle.mainBundle.resourceURL.path;
    if (root.length == 0 || !realpath(root.fileSystemRepresentation, gRootReal)) {
        *error = @"Simple Budget couldn’t find its files.";
        return NO;
    }
    gResourceRoot = root;

    int server = socket(AF_INET, SOCK_STREAM, 0);
    if (server < 0) {
        *error = @"Simple Budget couldn’t open a local connection.";
        return NO;
    }
    int yes = 1;
    setsockopt(server, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
    struct sockaddr_in address;
    memset(&address, 0, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons(kBudgetPort);
    inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
    if (bind(server, (struct sockaddr *)&address, sizeof(address)) != 0 || listen(server, 16) != 0) {
        close(server);
        *error = [NSString stringWithFormat:@"Something else is already using port %d. Quit that app, then open Simple Budget again.", kBudgetPort];
        return NO;
    }

    pthread_t thread;
    pthread_create(&thread, NULL, acceptLoop, (void *)(intptr_t)server);
    pthread_detach(thread);
    return YES;
}

@implementation AppDelegate

- (void)applicationWillFinishLaunching:(NSNotification *)notification {
    [self buildMenu];
}

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    for (NSRunningApplication *running in [NSRunningApplication runningApplicationsWithBundleIdentifier:@"com.jamesfournier.budget"]) {
        if (running.processIdentifier != NSProcessInfo.processInfo.processIdentifier) {
            [running activateWithOptions:NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps];
            [NSApp terminate:nil];
            return;
        }
    }

    NSString *error = nil;
    if (!startServer(&error)) {
        NSAlert *alert = [NSAlert new];
        alert.messageText = @"Simple Budget couldn’t open";
        alert.informativeText = error;
        [alert runModal];
        [NSApp terminate:nil];
        return;
    }

    WKWebView *web = [[WKWebView alloc] initWithFrame:NSZeroRect];
    web.navigationDelegate = self;
    web.UIDelegate = self;
    NSColor *paper = [NSColor colorWithSRGBRed:239.0 / 255.0 green:236.0 / 255.0 blue:230.0 / 255.0 alpha:1];
    web.underPageBackgroundColor = paper;

    NSWindow *window = [[NSWindow alloc] initWithContentRect:NSMakeRect(0, 0, 920, 880)
                                                    styleMask:NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable
                                                      backing:NSBackingStoreBuffered
                                                        defer:NO];
    window.title = @"Simple Budget";
    window.minSize = NSMakeSize(480, 640);
    window.backgroundColor = paper;
    window.contentView = web;
    self.webView = web;
    [window center];
    window.frameAutosaveName = @"BudgetMainWindow";
    [window makeKeyAndOrderFront:nil];
    self.window = window;

    NSURL *url = [NSURL URLWithString:[NSString stringWithFormat:@"http://127.0.0.1:%d/", kBudgetPort]];
    [web loadRequest:[NSURLRequest requestWithURL:url]];
    [NSApp activateIgnoringOtherApps:YES];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)webView:(WKWebView *)webView runJavaScriptAlertPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(void))completionHandler {
    NSAlert *alert = [NSAlert new];
    alert.messageText = message;
    [alert addButtonWithTitle:@"OK"];
    [alert beginSheetModalForWindow:webView.window completionHandler:^(NSModalResponse response) {
        (void)response;
        completionHandler();
    }];
}

- (void)webView:(WKWebView *)webView runJavaScriptConfirmPanelWithMessage:(NSString *)message initiatedByFrame:(WKFrameInfo *)frame completionHandler:(void (^)(BOOL result))completionHandler {
    NSString *proceed = @"OK";
    if ([message containsString:@"Replace"]) proceed = @"Replace";
    else if ([message containsString:@"Reset"] || [message containsString:@"Erase"]) proceed = @"Reset";
    else if ([message containsString:@"Discard"]) proceed = @"Discard";
    NSAlert *alert = [NSAlert new];
    alert.messageText = message;
    alert.alertStyle = NSAlertStyleWarning;
    [alert addButtonWithTitle:proceed];
    NSButton *cancel = [alert addButtonWithTitle:@"Cancel"];
    cancel.keyEquivalent = @"\033";
    [alert beginSheetModalForWindow:webView.window completionHandler:^(NSModalResponse response) {
        completionHandler(response == NSAlertFirstButtonReturn);
    }];
}

- (void)webView:(WKWebView *)webView decidePolicyForNavigationAction:(WKNavigationAction *)navigationAction decisionHandler:(void (^)(WKNavigationActionPolicy))decisionHandler {
    NSString *host = navigationAction.request.URL.host;
    NSString *scheme = navigationAction.request.URL.scheme;
    if ([host isEqualToString:@"127.0.0.1"] || [scheme isEqualToString:@"about"]) {
        decisionHandler(WKNavigationActionPolicyAllow);
    } else {
        decisionHandler(WKNavigationActionPolicyCancel);
    }
}

- (void)showMessage:(NSString *)message {
    NSAlert *alert = [NSAlert new];
    alert.messageText = message;
    [alert addButtonWithTitle:@"OK"];
    NSWindow *window = self.window;
    if (window) {
        [alert beginSheetModalForWindow:window completionHandler:nil];
    } else {
        [alert runModal];
    }
}

- (NSString *)backupFileName {
    NSDateFormatter *formatter = [NSDateFormatter new];
    formatter.locale = [NSLocale localeWithLocaleIdentifier:@"en_US_POSIX"];
    formatter.dateFormat = @"yyyy-MM-dd";
    return [NSString stringWithFormat:@"Simple Budget %@.json", [formatter stringFromDate:[NSDate date]]];
}

- (void)backupBudget:(id)sender {
    (void)sender;
    WKWebView *web = self.webView;
    if (!web) return;
    [web callAsyncJavaScript:@"return window.simpleBudgetExport ? window.simpleBudgetExport() : null"
                   arguments:@{}
                     inFrame:nil
              inContentWorld:WKContentWorld.pageWorld
           completionHandler:^(id result, NSError *error) {
        if (error || ![result isKindOfClass:[NSString class]] || [(NSString *)result length] == 0) {
            [self showMessage:@"There is no budget to back up yet."];
            return;
        }
        NSSavePanel *panel = [NSSavePanel savePanel];
        panel.allowedContentTypes = @[UTTypeJSON];
        panel.canCreateDirectories = YES;
        panel.title = @"Backup Budget";
        panel.prompt = @"Save";
        panel.nameFieldStringValue = [self backupFileName];
        [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
            if (response != NSModalResponseOK || !panel.URL) return;
            NSError *writeError = nil;
            BOOL wrote = [(NSString *)result writeToURL:panel.URL atomically:YES encoding:NSUTF8StringEncoding error:&writeError];
            if (!wrote) [self showMessage:writeError.localizedDescription ?: @"The backup could not be saved."];
        }];
    }];
}

- (void)importBudget:(id)sender {
    (void)sender;
    NSOpenPanel *panel = [NSOpenPanel openPanel];
    panel.allowedContentTypes = @[UTTypeJSON];
    panel.allowsMultipleSelection = NO;
    panel.canChooseDirectories = NO;
    panel.canChooseFiles = YES;
    panel.title = @"Import Budget";
    panel.prompt = @"Import";
    [panel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse response) {
        if (response != NSModalResponseOK || !panel.URL) return;
        NSError *readError = nil;
        NSString *text = [NSString stringWithContentsOfURL:panel.URL encoding:NSUTF8StringEncoding error:&readError];
        if (!text) {
            [self showMessage:@"That file could not be read."];
            return;
        }
        [self.webView callAsyncJavaScript:@"return window.simpleBudgetImport ? window.simpleBudgetImport(text) : 'Simple Budget is still opening.'"
                                arguments:@{ @"text": text }
                                  inFrame:nil
                           inContentWorld:WKContentWorld.pageWorld
                        completionHandler:^(id result, NSError *error) {
            if (error) {
                [self showMessage:@"That file could not be imported."];
                return;
            }
            if ([result isKindOfClass:[NSString class]] && [(NSString *)result length] > 0) {
                [self showMessage:result];
            }
        }];
    }];
}

- (void)resetBudget:(id)sender {
    (void)sender;
    [self.webView evaluateJavaScript:@"window.simpleBudgetReset && window.simpleBudgetReset()" completionHandler:nil];
}

- (void)showAbout:(id)sender {
    (void)sender;
    [NSApp orderFrontStandardAboutPanelWithOptions:@{
        NSAboutPanelOptionApplicationName: @"Simple Budget",
        NSAboutPanelOptionApplicationVersion: @"1.0 Vibe Coded by Cursor AI & FornaTRON.",
    }];
}

- (void)buildMenu {
    NSMenu *mainMenu = [NSMenu new];

    NSMenuItem *appItem = [NSMenuItem new];
    [mainMenu addItem:appItem];
    NSMenu *appMenu = [NSMenu new];
    NSMenuItem *appAbout = [appMenu addItemWithTitle:@"About Simple Budget" action:@selector(showAbout:) keyEquivalent:@""];
    appAbout.target = self;
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Hide Simple Budget" action:@selector(hide:) keyEquivalent:@"h"];
    NSMenuItem *hideOthers = [appMenu addItemWithTitle:@"Hide Others" action:@selector(hideOtherApplications:) keyEquivalent:@"h"];
    hideOthers.keyEquivalentModifierMask = NSEventModifierFlagCommand | NSEventModifierFlagOption;
    [appMenu addItemWithTitle:@"Show All" action:@selector(unhideAllApplications:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Quit Simple Budget" action:@selector(terminate:) keyEquivalent:@"q"];
    appItem.submenu = appMenu;

    NSMenuItem *fileItem = [NSMenuItem new];
    [mainMenu addItem:fileItem];
    NSMenu *fileMenu = [[NSMenu alloc] initWithTitle:@"File"];
    [fileMenu addItemWithTitle:@"Close" action:@selector(performClose:) keyEquivalent:@"w"];
    [fileMenu addItem:[NSMenuItem separatorItem]];
    NSMenuItem *backupItem = [fileMenu addItemWithTitle:@"Backup Budget…" action:@selector(backupBudget:) keyEquivalent:@""];
    backupItem.target = self;
    NSMenuItem *importItem = [fileMenu addItemWithTitle:@"Import Budget…" action:@selector(importBudget:) keyEquivalent:@""];
    importItem.target = self;
    [fileMenu addItem:[NSMenuItem separatorItem]];
    NSMenuItem *resetItem = [fileMenu addItemWithTitle:@"Reset Budget" action:@selector(resetBudget:) keyEquivalent:@""];
    resetItem.target = self;
    fileItem.submenu = fileMenu;

    NSMenuItem *editItem = [NSMenuItem new];
    [mainMenu addItem:editItem];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];
    [editMenu addItemWithTitle:@"Undo" action:@selector(undo:) keyEquivalent:@"z"];
    [editMenu addItemWithTitle:@"Redo" action:@selector(redo:) keyEquivalent:@"Z"];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"Cut" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Copy" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Paste" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Select All" action:@selector(selectAll:) keyEquivalent:@"a"];
    editItem.submenu = editMenu;

    NSMenuItem *helpItem = [NSMenuItem new];
    [mainMenu addItem:helpItem];
    NSMenu *helpMenu = [[NSMenu alloc] initWithTitle:@"Help"];
    NSMenuItem *helpAbout = [helpMenu addItemWithTitle:@"About Simple Budget" action:@selector(showAbout:) keyEquivalent:@""];
    helpAbout.target = self;
    helpItem.submenu = helpMenu;
    NSApp.helpMenu = helpMenu;

    NSApp.mainMenu = mainMenu;
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        signal(SIGPIPE, SIG_IGN);
        NSApplication *app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        static AppDelegate *delegate = nil;
        delegate = [AppDelegate new];
        app.delegate = delegate;
        [app run];
    }
    return 0;
}
