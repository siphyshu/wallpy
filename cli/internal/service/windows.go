//go:build windows

package service

import (
	"os"
	"os/exec"

	"golang.org/x/sys/windows"
)

// Windows: a Task Scheduler task at logon. The agent hides its console
// window as it starts (app/run.go).

const taskName = "Wallpy"

func installed() (Status, error) {
	err := exec.Command("schtasks", "/Query", "/TN", taskName).Run()
	return Status{Installed: err == nil, Where: `Task Scheduler\` + taskName}, nil
}

func install(exe string) error {
	if err := run("schtasks", "/Create", "/F", "/TN", taskName, "/SC", "ONLOGON", "/RL", "LIMITED",
		"/TR", `"`+exe+`" run`); err != nil {
		return err
	}
	if _, running := holder(); running {
		return nil
	}
	cmd := exec.Command(exe, "run")
	cmd.Env = os.Environ()
	cmd.SysProcAttr = &windows.SysProcAttr{CreationFlags: windows.CREATE_NO_WINDOW | windows.DETACHED_PROCESS}
	return cmd.Start()
}

func uninstall() error {
	exec.Command("schtasks", "/Delete", "/F", "/TN", taskName).Run()
	return nil
}
