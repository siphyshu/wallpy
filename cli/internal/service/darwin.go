//go:build darwin

package service

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

func plistPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, "Library", "LaunchAgents", Label+".plist")
}

func domain() string { return fmt.Sprintf("gui/%d", os.Getuid()) }

func installed() (Status, error) {
	_, err := os.Stat(plistPath())
	return Status{Installed: err == nil, Where: plistPath()}, nil
}

func esc(s string) string {
	var b bytes.Buffer
	xml.EscapeText(&b, []byte(s))
	return b.String()
}

// plist is the LaunchAgent: run at login, restart if it crashes (not when
// it exits cleanly, e.g. because another agent is already running).
func plist(exe string) string {
	var env bytes.Buffer
	for k, v := range envFor() {
		fmt.Fprintf(&env, "\t\t<key>%s</key><string>%s</string>\n", esc(k), esc(v))
	}
	return fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key><string>%s</string>
	<key>ProgramArguments</key>
	<array><string>%s</string><string>run</string></array>
	<key>RunAtLoad</key><true/>
	<key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
	<key>StandardOutPath</key><string>%s</string>
	<key>StandardErrorPath</key><string>%s</string>
	<key>EnvironmentVariables</key>
	<dict>
%s	</dict>
</dict>
</plist>
`, Label, esc(exe), esc(LogPath()), esc(LogPath()), env.String())
}

func install(exe string) error {
	if err := os.MkdirAll(filepath.Dir(plistPath()), 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(plistPath(), []byte(plist(exe)), 0o644); err != nil {
		return err
	}
	exec.Command("launchctl", "bootout", domain()+"/"+Label).Run() // replace a loaded one
	return run("launchctl", "bootstrap", domain(), plistPath())
}

func uninstall() error {
	exec.Command("launchctl", "bootout", domain()+"/"+Label).Run()
	if err := os.Remove(plistPath()); err != nil && !os.IsNotExist(err) {
		return err
	}
	return nil
}
