//go:build windows

package main

import (
	"os"
	"path/filepath"
	"unsafe"

	"github.com/jchv/go-webview2"
	"golang.org/x/sys/windows"
)

var instanceMutex windows.Handle

func openWindow(url string) error {
	if alreadyOpen() {
		messageBox("Simple Budget is already open.")
		return nil
	}
	data, err := webViewDataDir()
	if err != nil {
		return err
	}
	view := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true,
		DataPath:  data,
		WindowOptions: webview2.WindowOptions{
			Title:  "Simple Budget",
			Width:  920,
			Height: 880,
			IconId: 1,
			Center: true,
		},
	})
	if view == nil {
		messageBox("Simple Budget needs the Microsoft Edge WebView2 Runtime. Install it, then open Simple Budget again.\n\nhttps://developer.microsoft.com/microsoft-edge/webview2/")
		return nil
	}
	defer view.Destroy()
	view.Navigate(url)
	view.Run()
	return nil
}

func alreadyOpen() bool {
	name, err := windows.UTF16PtrFromString("Local\\SimpleBudgetSingleInstance")
	if err != nil {
		return false
	}
	kernel32 := windows.NewLazySystemDLL("kernel32.dll")
	handle, _, callErr := kernel32.NewProc("CreateMutexW").Call(0, 1, uintptr(unsafe.Pointer(name)))
	if handle == 0 {
		return false
	}
	instanceMutex = windows.Handle(handle)
	return callErr == windows.ERROR_ALREADY_EXISTS
}

func webViewDataDir() (string, error) {
	base := os.Getenv("AppData")
	if base == "" {
		var err error
		base, err = os.UserConfigDir()
		if err != nil {
			return "", err
		}
	}
	dir := filepath.Join(base, "Simple Budget", "WebView2")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	return dir, nil
}

func fail(err error) {
	messageBox(err.Error())
	os.Exit(1)
}

func messageBox(text string) {
	body, err := windows.UTF16PtrFromString(text)
	if err != nil {
		return
	}
	title, err := windows.UTF16PtrFromString("Simple Budget")
	if err != nil {
		return
	}
	user32 := windows.NewLazySystemDLL("user32.dll")
	_, _, _ = user32.NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x40)
}
