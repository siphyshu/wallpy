//go:build windows

package service

import (
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

// Lock is the agent's hold on agent.lock.
type Lock struct{ f *os.File }

// TryLock takes agent.lock without waiting, recording our PID in it.
func TryLock() (*Lock, error) {
	if err := os.MkdirAll(filepath.Dir(lockPath()), 0o755); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(lockPath(), os.O_RDWR|os.O_CREATE, 0o644)
	if err != nil {
		return nil, err
	}
	ol := new(windows.Overlapped)
	// Lock a byte past the PID so other processes can still read the file.
	ol.Offset = 1 << 20
	if err := windows.LockFileEx(windows.Handle(f.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, ol); err != nil {
		f.Close()
		return nil, ErrRunning
	}
	f.Truncate(0)
	fmt.Fprintf(f, "%d\n", os.Getpid())
	return &Lock{f}, nil
}

// Release lets go of the lock.
func (l *Lock) Release() {
	ol := new(windows.Overlapped)
	ol.Offset = 1 << 20
	windows.UnlockFileEx(windows.Handle(l.f.Fd()), 0, 1, 0, ol)
	l.f.Close()
}
