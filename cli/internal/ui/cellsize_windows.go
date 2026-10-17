//go:build windows

package ui

// CellPixels is the size of one character cell in pixels. Windows consoles
// don't report it; 10×20 is close for the usual fonts.
func CellPixels() (w, h int) { return 10, 20 }
