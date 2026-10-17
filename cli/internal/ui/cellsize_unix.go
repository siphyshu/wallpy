//go:build !windows

package ui

import (
	"os"

	"golang.org/x/sys/unix"
)

// CellPixels is the size of one character cell in pixels, from the
// terminal's window size report, or 10×20 if it doesn't say.
func CellPixels() (w, h int) {
	ws, err := unix.IoctlGetWinsize(int(os.Stdout.Fd()), unix.TIOCGWINSZ)
	if err != nil || ws.Col == 0 || ws.Row == 0 || ws.Xpixel == 0 || ws.Ypixel == 0 {
		return 10, 20
	}
	return int(ws.Xpixel / ws.Col), int(ws.Ypixel / ws.Row)
}
