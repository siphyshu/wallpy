//go:build windows

package wallpaper

// Windows: SystemParametersInfo, with "Fill" as the fit (Windows' own
// default for photos). Applies to every monitor.

import (
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

const (
	spiGetDeskWallpaper = 0x0073
	spiSetDeskWallpaper = 0x0014
	spifUpdateINIFile   = 0x01
	spifSendChange      = 0x02
)

var systemParametersInfo = windows.NewLazySystemDLL("user32.dll").NewProc("SystemParametersInfoW")

func set(path string) error {
	if k, err := registry.OpenKey(registry.CURRENT_USER, `Control Panel\Desktop`, registry.SET_VALUE); err == nil {
		k.SetStringValue("WallpaperStyle", "10") // Fill
		k.SetStringValue("TileWallpaper", "0")
		k.Close()
	}
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return err
	}
	ok, _, callErr := systemParametersInfo.Call(spiSetDeskWallpaper, 0, uintptr(unsafe.Pointer(p)), spifUpdateINIFile|spifSendChange)
	if ok == 0 {
		return fmt.Errorf("Windows refused the wallpaper: %w", callErr)
	}
	return nil
}

func get() (string, error) {
	buf := make([]uint16, windows.MAX_PATH)
	ok, _, callErr := systemParametersInfo.Call(spiGetDeskWallpaper, uintptr(len(buf)), uintptr(unsafe.Pointer(&buf[0])), 0)
	if ok == 0 {
		return "", callErr
	}
	return windows.UTF16ToString(buf), nil
}

func method() (string, error) {
	if err := systemParametersInfo.Find(); err != nil {
		return "", err
	}
	return "Windows (SystemParametersInfo)", nil
}
