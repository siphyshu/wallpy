//go:build darwin

package wallpaper

// macOS: AppKit's NSWorkspace, called through purego (no cgo, no AppleScript,
// so no "wants to control System Events" permission prompt). macOS only
// lets apps change the current Space on each display; other Spaces catch up
// when the agent sets the next image.

import (
	"errors"
	"fmt"
	"sync"
	"time"
	"unsafe"

	"github.com/ebitengine/purego"
	"github.com/ebitengine/purego/objc"
)

var loadAppKit = sync.OnceValue(func() error {
	if _, err := purego.Dlopen("/System/Library/Frameworks/AppKit.framework/AppKit", purego.RTLD_GLOBAL|purego.RTLD_NOW); err != nil {
		return err
	}
	lib, err := purego.Dlopen("/usr/lib/libSystem.B.dylib", purego.RTLD_GLOBAL|purego.RTLD_NOW)
	if err != nil {
		return err
	}
	purego.RegisterLibFunc(&pthreadMainNP, lib, "pthread_main_np")
	return nil
})

var pthreadMainNP func() int32

// ready loads AppKit and checks we're on the main thread: AppKit crashes
// the whole process when called from any other (see cmd/wallpy/main.go).
func ready() error {
	if err := loadAppKit(); err != nil {
		return fmt.Errorf("loading AppKit: %w", err)
	}
	if pthreadMainNP() != 1 {
		return errors.New("the macOS wallpaper can only be set from the main thread")
	}
	return nil
}

var (
	selAlloc        = objc.RegisterName("alloc")
	selInit         = objc.RegisterName("init")
	selDrain        = objc.RegisterName("drain")
	selShared       = objc.RegisterName("sharedWorkspace")
	selScreens      = objc.RegisterName("screens")
	selCount        = objc.RegisterName("count")
	selObjectAt     = objc.RegisterName("objectAtIndex:")
	selFileURL      = objc.RegisterName("fileURLWithPath:")
	selString       = objc.RegisterName("stringWithUTF8String:")
	selUTF8         = objc.RegisterName("UTF8String")
	selPath         = objc.RegisterName("path")
	selDictionary   = objc.RegisterName("dictionary")
	selSetDesktop   = objc.RegisterName("setDesktopImageURL:forScreen:options:error:")
	selDesktopURL   = objc.RegisterName("desktopImageURLForScreen:")
	selMainScreen   = objc.RegisterName("mainScreen")
	selDescription  = objc.RegisterName("localizedDescription")
	classWorkspace  = func() objc.ID { return objc.ID(objc.GetClass("NSWorkspace")).Send(selShared) }
	classPool       = func() objc.ID { return objc.ID(objc.GetClass("NSAutoreleasePool")).Send(selAlloc).Send(selInit) }
	classScreen     = func() objc.ID { return objc.ID(objc.GetClass("NSScreen")) }
	classString     = func() objc.ID { return objc.ID(objc.GetClass("NSString")) }
	classURL        = func() objc.ID { return objc.ID(objc.GetClass("NSURL")) }
	classDictionary = func() objc.ID { return objc.ID(objc.GetClass("NSDictionary")) }
)

func nsString(s string) objc.ID {
	b := append([]byte(s), 0)
	return classString().Send(selString, unsafe.Pointer(&b[0]))
}

func goString(ns objc.ID) string {
	if ns == 0 {
		return ""
	}
	p := objc.Send[*byte](ns, selUTF8)
	if p == nil {
		return ""
	}
	var n int
	for *(*byte)(unsafe.Add(unsafe.Pointer(p), n)) != 0 {
		n++
	}
	return string(unsafe.Slice(p, n))
}

func set(path string) error {
	if err := ready(); err != nil {
		return err
	}
	pool := classPool()
	defer pool.Send(selDrain)

	url := classURL().Send(selFileURL, nsString(path))
	options := classDictionary().Send(selDictionary)
	screens := classScreen().Send(selScreens)
	n := objc.Send[uint](screens, selCount)
	if n == 0 {
		return errors.New("macOS reports no displays")
	}
	ws := classWorkspace()
	for i := range n {
		screen := screens.Send(selObjectAt, i)
		var nserr objc.ID
		if !objc.Send[bool](ws, selSetDesktop, url, screen, options, unsafe.Pointer(&nserr)) {
			return fmt.Errorf("macOS refused the wallpaper: %s", goString(nserr.Send(selDescription)))
		}
	}
	// macOS hands the change to its wallpaper service and returns at once;
	// a process that exits right away can lose it. Wait until it's applied.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if got, err := get(); err == nil && got == path {
			return nil
		}
		time.Sleep(50 * time.Millisecond)
	}
	return errors.New("macOS accepted the wallpaper but didn't apply it within 3 seconds")
}

func get() (string, error) {
	if err := ready(); err != nil {
		return "", err
	}
	pool := classPool()
	defer pool.Send(selDrain)
	screen := classScreen().Send(selMainScreen)
	if screen == 0 {
		return "", nil
	}
	url := classWorkspace().Send(selDesktopURL, screen)
	if url == 0 {
		return "", nil
	}
	return goString(url.Send(selPath)), nil
}

func method() (string, error) {
	if err := loadAppKit(); err != nil {
		return "", err
	}
	return "macOS (AppKit)", nil
}
