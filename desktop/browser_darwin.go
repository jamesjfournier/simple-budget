//go:build darwin

package main

import "os"

func findBrowser() string {
	for _, path := range []string{
		"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
		"/Applications/Chromium.app/Contents/MacOS/Chromium",
		"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
		"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
	} {
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	return ""
}
