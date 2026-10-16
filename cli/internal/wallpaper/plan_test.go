package wallpaper

import (
	"errors"
	"strings"
	"testing"
)

func TestPlan(t *testing.T) {
	all := func(string) bool { return true }
	for _, c := range []struct {
		env  map[string]string
		has  func(string) bool
		want string
	}{
		{map[string]string{"XDG_CURRENT_DESKTOP": "ubuntu:GNOME"}, all, "GNOME"},
		{map[string]string{"XDG_CURRENT_DESKTOP": "KDE"}, all, "KDE Plasma"},
		{map[string]string{"XDG_CURRENT_DESKTOP": "X-Cinnamon"}, all, "Cinnamon"},
		{map[string]string{"XDG_CURRENT_DESKTOP": "XFCE"}, all, "Xfce"},
		{map[string]string{"SWAYSOCK": "/run/sway.sock", "XDG_CURRENT_DESKTOP": "sway"}, all, "sway"},
		{map[string]string{"HYPRLAND_INSTANCE_SIGNATURE": "x"}, func(t string) bool { return t == "hyprctl" }, "Hyprland (hyprpaper)"},
		{map[string]string{"DISPLAY": ":0"}, all, "feh"},
	} {
		s, err := plan(func(k string) string { return c.env[k] }, c.has)
		if err != nil || s.name != c.want {
			t.Errorf("%v: got %v %v, want %s", c.env, s, err, c.want)
		}
	}
	_, err := plan(func(k string) string { return map[string]string{"XDG_CURRENT_DESKTOP": "KDE"}[k] }, func(string) bool { return false })
	if !errors.Is(err, ErrUnsupported) || !strings.Contains(err.Error(), "plasma-apply-wallpaperimage") {
		t.Errorf("missing tool: %v", err)
	}
}

func TestGnomeURI(t *testing.T) {
	cmds := gnomeLike("org.gnome.desktop.background")("/home/a b/x.jpg")
	if cmds[0][4] != "file:///home/a%20b/x.jpg" {
		t.Errorf("uri %q", cmds[0][4])
	}
}
