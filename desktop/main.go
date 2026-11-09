package main

import (
	"fmt"
	"os"
)

func main() {
	url, err := startServer()
	if err != nil {
		fail(err)
	}
	if os.Getenv("SIMPLE_BUDGET_SERVE_ONLY") == "1" {
		fmt.Println(url)
		select {}
	}
	if err := openWindow(url); err != nil {
		fail(err)
	}
}
