// Command wallpy installs and runs dynamic wallpaper packs.
package main

import (
	"context"
	"os"
	"runtime"
	_ "time/tzdata" // time zones on systems without a zone database (Windows)

	"github.com/siphyshu/wallpy/cli/internal/app"
)

// version is set at release time: -ldflags "-X main.version=1.2.3".
var version = ""

// AppKit (the macOS wallpaper) expects the main thread; keep the main
// goroutine, where commands run, on it.
func init() { runtime.LockOSThread() }

func main() {
	if err := app.Execute(context.Background(), version); err != nil {
		os.Exit(1)
	}
}
