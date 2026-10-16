// Package wallpaper sets the desktop picture on macOS, Windows and Linux.
//
//	Set(path)  make an image the wallpaper on every display
//	Get()      the current wallpaper, where the platform can say
//	Method()   how this computer's wallpaper gets set, for `wallpy doctor`
package wallpaper

import "errors"

// ErrUnsupported means Wallpy doesn't know how to set the wallpaper on this
// desktop. The message says what it looked for.
var ErrUnsupported = errors.New("no supported way to set the wallpaper on this desktop")

// Set makes the image at path (absolute) the wallpaper on every display.
func Set(path string) error { return set(path) }

// Get is the current wallpaper's path, or "" when the platform can't say.
func Get() (string, error) { return get() }

// Method describes how the wallpaper is set here ("macOS AppKit",
// "GNOME (gsettings)"), or an error when there's no way.
func Method() (string, error) { return method() }
