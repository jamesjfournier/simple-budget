#!/bin/bash
# Build the Windows exe and the Linux programs from this Mac.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP="$ROOT/desktop"
ASSETS="$DESKTOP/assets"

if [[ -x "$ROOT/build/toolchain/go/bin/go" ]]; then
  GO="$ROOT/build/toolchain/go/bin/go"
elif command -v go >/dev/null 2>&1; then
  GO="$(command -v go)"
else
  echo "Go is required. Install it from https://go.dev/dl/ and run this again." >&2
  exit 1
fi

rm -rf "$ASSETS"
mkdir -p "$ASSETS" "$ROOT/dist/windows" "$ROOT/dist/linux" "$ROOT/build"
cp "$ROOT/index.html" "$ASSETS/index.html"
cp -R "$ROOT/css" "$ROOT/js" "$ASSETS/"

(
  cd "$DESKTOP"
  "$GO" mod tidy
  "$GO" test .
)

if command -v sips >/dev/null 2>&1; then
  sips -z 256 256 "$ROOT/icon.png" --out "$ROOT/build/icon-256.png" >/dev/null
  python3 "$ROOT/scripts/png-to-ico.py" "$ROOT/build/icon-256.png" "$DESKTOP/icon.ico"
  (
    cd "$DESKTOP"
    "$GO" run github.com/akavel/rsrc@v0.10.2 -arch amd64 -ico icon.ico -manifest windows.manifest -o rsrc_windows_amd64.syso
  )
fi

(
  cd "$DESKTOP"
  CGO_ENABLED=0 GOOS=windows GOARCH=amd64 "$GO" build -trimpath -ldflags "-s -w -H windowsgui" -o "$ROOT/dist/windows/Simple Budget.exe" .
  CGO_ENABLED=0 GOOS=linux GOARCH=amd64 "$GO" build -trimpath -ldflags "-s -w" -o "$ROOT/dist/linux/simple-budget-amd64" .
  CGO_ENABLED=0 GOOS=linux GOARCH=arm64 "$GO" build -trimpath -ldflags "-s -w" -o "$ROOT/dist/linux/simple-budget-arm64" .
)

file "$ROOT/dist/windows/Simple Budget.exe" "$ROOT/dist/linux/simple-budget-amd64" "$ROOT/dist/linux/simple-budget-arm64"
