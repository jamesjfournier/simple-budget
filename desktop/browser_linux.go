//go:build linux

package main

import "os/exec"

func findBrowser() string {
	for _, name := range []string{
		"google-chrome",
		"google-chrome-stable",
		"chromium",
		"chromium-browser",
		"microsoft-edge",
		"microsoft-edge-stable",
		"brave-browser",
	} {
		if path, err := exec.LookPath(name); err == nil {
			return path
		}
	}
	return ""
}
