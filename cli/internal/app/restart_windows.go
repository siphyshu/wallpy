//go:build windows

package app

import (
	"os"
	"os/exec"

	"golang.org/x/sys/windows"
)

// restartSelf starts the new wallpy agent and lets this one end. Windows
// has no exec; the new agent waits up to 10 s for this one's lock.
func restartSelf(exe string) error {
	cmd := exec.Command(exe, os.Args[1:]...)
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &windows.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW | windows.DETACHED_PROCESS}
	return cmd.Start()
}
