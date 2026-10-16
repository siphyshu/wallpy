package wallpaper

import (
	"fmt"
	"image"
	"image/png"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func init() { runtime.LockOSThread() } // TestMain then runs on the main thread

// TestMain can check the real desktop, which changes it, so only when asked:
//
//	WALLPY_TEST_DESKTOP=1 go test ./internal/wallpaper
//
// It runs here, on the main thread, because AppKit requires that (tests run
// on other threads). It sets a test image, checks it, and puts the
// original wallpaper back.
func TestMain(m *testing.M) {
	if os.Getenv("WALLPY_TEST_DESKTOP") == "1" {
		if err := setAndRestore(); err != nil {
			fmt.Fprintln(os.Stderr, "desktop check:", err)
			os.Exit(1)
		}
		fmt.Println("desktop check: set, verified and restored")
	}
	os.Exit(m.Run())
}

func setAndRestore() (err error) {
	original, err := Get()
	if err != nil {
		return err
	}
	if original != "" {
		if _, statErr := os.Stat(original); statErr != nil {
			return fmt.Errorf("the current wallpaper %s can't be found, so it couldn't be restored; not testing", original)
		}
		defer func() {
			if rerr := Set(original); rerr != nil {
				err = fmt.Errorf("RESTORE FAILED (original: %s): %w", original, rerr)
			}
		}()
	}
	dir, err := os.MkdirTemp("", "wallpy-desktop-test")
	if err != nil {
		return err
	}
	defer os.RemoveAll(dir)
	img := image.NewRGBA(image.Rect(0, 0, 64, 64))
	for i := range img.Pix {
		img.Pix[i] = []uint8{0x7C, 0xC4, 0xF2, 0xFF}[i%4]
	}
	path := filepath.Join(dir, "wallpy-test.png")
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	png.Encode(f, img)
	f.Close()
	if err := Set(path); err != nil {
		return err
	}
	if got, _ := Get(); got != "" && got != path {
		return fmt.Errorf("after Set, the wallpaper is %s", got)
	}
	return nil
}

func TestOffMainThreadIsAnErrorNotACrash(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS only")
	}
	if _, err := Get(); err == nil {
		t.Error("Get on a test goroutine (not the main thread) should refuse")
	}
}
