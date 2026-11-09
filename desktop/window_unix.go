//go:build !windows

package main

import (
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

func openWindow(url string) error {
	release, locked, err := lockApp()
	if err != nil {
		return err
	}
	if !locked {
		return fmt.Errorf("Simple Budget is already open.")
	}
	defer release()

	bin := findBrowser()
	if bin == "" {
		return openLoose(url)
	}
	config, err := os.UserConfigDir()
	if err != nil {
		return err
	}
	profile := filepath.Join(config, "Simple Budget", "browser")
	if err := os.MkdirAll(profile, 0o700); err != nil {
		return err
	}
	cmd := exec.Command(bin,
		"--app="+url,
		"--user-data-dir="+profile,
		"--no-first-run",
		"--no-default-browser-check",
		"--disable-sync",
		"--window-size=920,880",
		"--class=simple-budget",
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()
	select {
	case err := <-done:
		if err != nil {
			return err
		}
		return waitSignal()
	case <-time.After(2 * time.Second):
		return <-done
	}
}

func openLoose(url string) error {
	name := "xdg-open"
	if runtime.GOOS == "darwin" {
		name = "open"
	}
	cmd := exec.Command(name, url)
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("Open %s in a browser. Chrome, Chromium, Edge, or Brave gives Simple Budget its own window.", url)
	}
	fmt.Fprintf(os.Stderr, "Simple Budget is open at %s\n", url)
	return waitSignal()
}

func waitSignal() error {
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt, syscall.SIGTERM)
	<-ch
	return nil
}

func lockApp() (func(), bool, error) {
	config, err := os.UserConfigDir()
	if err != nil {
		return nil, false, err
	}
	dir := filepath.Join(config, "Simple Budget")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, false, err
	}
	file, err := os.OpenFile(filepath.Join(dir, "app.lock"), os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, false, err
	}
	err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	if err == syscall.EWOULDBLOCK || err == syscall.EAGAIN {
		file.Close()
		return nil, false, nil
	}
	if err != nil {
		file.Close()
		return nil, false, err
	}
	return func() { file.Close() }, true, nil
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err.Error())
	os.Exit(1)
}
