//go:build !windows

package service

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
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
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return nil, ErrRunning
	}
	f.Truncate(0)
	fmt.Fprintf(f, "%d\n", os.Getpid())
	return &Lock{f}, nil
}

// Release lets go of the lock.
func (l *Lock) Release() {
	syscall.Flock(int(l.f.Fd()), syscall.LOCK_UN)
	l.f.Close()
}
