//go:build !darwin && !windows

package wallpaper

// Linux and the BSDs: each desktop has its own way. The desktop is read
// from the environment (XDG_CURRENT_DESKTOP, compositor sockets) and the
// matching tool is run; `plan` decides, so it can be tested anywhere.

import (
	"fmt"
	"net/url"
	"os"
	"os/exec"
	"strings"
)

func has(tool string) bool { _, err := exec.LookPath(tool); return err == nil }

func set(path string) error {
	s, err := plan(os.Getenv, has)
	if err != nil {
		return err
	}
	if s.cmds == nil {
		return setXfce(path)
	}
	for i, c := range s.cmds(path) {
		out, err := exec.Command(c[0], c[1:]...).CombinedOutput()
		// GNOME before 42 has no picture-uri-dark; that one may fail.
		if err != nil && !(s.name == "GNOME" && i == 1) {
			return fmt.Errorf("%s: %s: %v %s", s.name, strings.Join(c, " "), err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

// setXfce sets every monitor and workspace Xfce knows about.
func setXfce(path string) error {
	out, err := exec.Command("xfconf-query", "-c", "xfce4-desktop", "-l").Output()
	if err != nil {
		return fmt.Errorf("Xfce: %w", err)
	}
	n := 0
	for _, prop := range strings.Fields(string(out)) {
		if strings.HasSuffix(prop, "/last-image") {
			if err := exec.Command("xfconf-query", "-c", "xfce4-desktop", "-p", prop, "-s", path).Run(); err != nil {
				return fmt.Errorf("Xfce: %w", err)
			}
			n++
		}
	}
	if n == 0 {
		return fmt.Errorf("Xfce: no monitors found in xfce4-desktop")
	}
	return nil
}

func get() (string, error) {
	s, err := plan(os.Getenv, has)
	if err != nil || s.name != "GNOME" {
		return "", err
	}
	out, err := exec.Command("gsettings", "get", "org.gnome.desktop.background", "picture-uri").Output()
	if err != nil {
		return "", err
	}
	u, err := url.Parse(strings.Trim(strings.TrimSpace(string(out)), "'"))
	if err != nil {
		return "", nil
	}
	return u.Path, nil
}

func method() (string, error) {
	s, err := plan(os.Getenv, has)
	if err != nil {
		return "", err
	}
	return s.name, nil
}
