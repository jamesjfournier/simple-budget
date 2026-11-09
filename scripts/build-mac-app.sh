#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/Simple Budget.app"
ICONSET="$ROOT/build/AppIcon.iconset"
STAGE="$ROOT/build/dmg"
DMG="$ROOT/dist/Simple Budget 1.0.dmg"

rm -rf "$APP" "$ICONSET" "$STAGE"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources" "$ICONSET" "$STAGE"

clang -arch x86_64 -arch arm64 \
  -fobjc-arc -O2 -mmacosx-version-min=13.0 \
  -framework Cocoa \
  -framework WebKit \
  -framework UniformTypeIdentifiers \
  -o "$APP/Contents/MacOS/Budget" \
  "$ROOT/macos/main.m"

cp "$ROOT/macos/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/index.html" "$APP/Contents/Resources/index.html"
cp -R "$ROOT/css" "$ROOT/js" "$APP/Contents/Resources/"

sips -z 1024 1024 "$ROOT/icon.png" --out "$ROOT/build/icon-1024.png" >/dev/null
sips -z 16 16 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_16x16.png" >/dev/null
sips -z 32 32 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_16x16@2x.png" >/dev/null
sips -z 32 32 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_32x32.png" >/dev/null
sips -z 64 64 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_32x32@2x.png" >/dev/null
sips -z 128 128 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_128x128.png" >/dev/null
sips -z 256 256 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_128x128@2x.png" >/dev/null
sips -z 256 256 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_256x256.png" >/dev/null
sips -z 512 512 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_256x256@2x.png" >/dev/null
sips -z 512 512 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_512x512.png" >/dev/null
sips -z 1024 1024 "$ROOT/build/icon-1024.png" --out "$ICONSET/icon_512x512@2x.png" >/dev/null
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

codesign --force --sign - "$APP"
lipo -info "$APP/Contents/MacOS/Budget"

cp -R "$APP" "$STAGE/Simple Budget.app"
ln -s /Applications "$STAGE/Applications"
hdiutil create -volname "Simple Budget" -srcfolder "$STAGE" -ov -format UDZO "$DMG"
echo "Built $DMG"
