package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDesktopPageAndAssets(t *testing.T) {
	handler := newHandler()

	index := httptest.NewRecorder()
	handler.ServeHTTP(index, httptest.NewRequest(http.MethodGet, "/", nil))
	if index.Code != http.StatusOK {
		t.Fatalf("index status %d", index.Code)
	}
	if !strings.Contains(index.Body.String(), "window.simpleBudgetDesktop=true") {
		t.Fatal("desktop flag was not added to the page")
	}
	if !strings.Contains(index.Body.String(), "js/main.js") {
		t.Fatal("page is missing the app script")
	}

	script := httptest.NewRecorder()
	handler.ServeHTTP(script, httptest.NewRequest(http.MethodGet, "/js/main.js", nil))
	if script.Code != http.StatusOK {
		t.Fatalf("script status %d", script.Code)
	}
	if !strings.Contains(script.Header().Get("Content-Type"), "javascript") {
		t.Fatalf("script type %q", script.Header().Get("Content-Type"))
	}
	if !strings.Contains(script.Body.String(), "backupBudgetFile") {
		t.Fatal("desktop backup code is missing from the script")
	}

	style := httptest.NewRecorder()
	handler.ServeHTTP(style, httptest.NewRequest(http.MethodGet, "/css/styles.css", nil))
	if style.Code != http.StatusOK || !strings.Contains(style.Body.String(), ".file-menu") {
		t.Fatalf("stylesheet status %d", style.Code)
	}
}

func TestRejectsPathsOutsideTheApp(t *testing.T) {
	handler := newHandler()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.URL.Path = "/../server.go"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d", rec.Code)
	}
}
