//go:build !darwin && !windows

package service

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// Linux and the BSDs: an XDG autostart entry, which every major desktop
// runs at login inside the graphical session (so the agent sees DISPLAY,
// WAYLAND_DISPLAY and XDG_CURRENT_DESKTOP). sway and Hyprland users add
// `exec wallpy run` to their config instead; `wallpy doctor` says so.

func autostartPath() string {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir == "" {
		home, _ := os.UserHomeDir()
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "autostart", "wallpy.desktop")
}

func installed() (Status, error) {
	_, err := os.Stat(autostartPath())
	return Status{Installed: err == nil, Where: autostartPath()}, nil
}

func desktopEntry(exe string) string {
	var env strings.Builder
	for k, v := range envFor() {
		fmt.Fprintf(&env, "%s=%q ", k, v)
	}
	execLine := fmt.Sprintf("%q run", exe)
	if env.Len() > 0 {
		execLine = "env " + env.String() + execLine
	}
	return "[Desktop Entry]\nType=Application\nName=Wallpy\nComment=Dynamic wallpapers for your desktop\n" +
		"Exec=" + execLine + "\nNoDisplay=true\nX-GNOME-Autostart-enabled=true\n"
}

func install(exe string) error {
	if err := os.MkdirAll(filepath.Dir(autostartPath()), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(autostartPath(), []byte(desktopEntry(exe)), 0o644); err != nil {
		return err
	}
	if _, running := holder(); running {
		return nil
	}
	// Start now, detached from this terminal.
	log, err := os.OpenFile(LogPath(), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	defer log.Close()
	cmd := exec.Command(exe, "run")
	cmd.Stdout, cmd.Stderr = log, log
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	return cmd.Start()
}

func uninstall() error {
	if err := os.Remove(autostartPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
