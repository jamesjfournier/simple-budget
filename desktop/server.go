package main

import (
	"embed"
	"fmt"
	"io/fs"
	"net"
	"net/http"
	"os"
	"path"
	"strings"
)

//go:embed all:assets
var embedded embed.FS

func startServer() (string, error) {
	port := os.Getenv("SIMPLE_BUDGET_PORT")
	if port == "" {
		port = "47321"
	}
	ln, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		return "", fmt.Errorf("Simple Budget could not start. Port %s is already in use.", port)
	}
	go http.Serve(ln, newHandler())
	return "http://" + ln.Addr().String() + "/", nil
}

func newHandler() http.Handler {
	root, err := fs.Sub(embedded, "assets")
	if err != nil {
		panic(err)
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		name := path.Clean("/" + r.URL.Path)
		if name == "/" {
			name = "/index.html"
		}
		name = strings.TrimPrefix(name, "/")
		if name == "" || strings.Contains(name, "..") {
			http.NotFound(w, r)
			return
		}
		body, err := fs.ReadFile(root, name)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		if name == "index.html" {
			body = injectDesktopFlag(body)
		}
		w.Header().Set("Content-Type", contentType(name))
		w.Header().Set("Cache-Control", "no-store")
		w.Write(body)
	})
}

func injectDesktopFlag(body []byte) []byte {
	const flag = "<script>window.simpleBudgetDesktop=true</script>"
	html := string(body)
	if strings.Contains(html, "simpleBudgetDesktop") {
		return body
	}
	return []byte(strings.Replace(html, "</head>", flag+"\n</head>", 1))
}

func contentType(name string) string {
	switch path.Ext(name) {
	case ".html":
		return "text/html; charset=utf-8"
	case ".css":
		return "text/css; charset=utf-8"
	case ".js":
		return "text/javascript; charset=utf-8"
	case ".png":
		return "image/png"
	case ".ico":
		return "image/x-icon"
	default:
		return "application/octet-stream"
	}
}
