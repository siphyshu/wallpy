//go:build !windows

package app

import (
	"os"
	"syscall"
)

// restartSelf replaces this process with the new wallpy binary: same PID,
// so launchd and anything else watching sees no gap. The agent lock is
// released on exec (Go opens files close-on-exec) and taken again.
func restartSelf(exe string) error {
	return syscall.Exec(exe, os.Args, os.Environ())
}
