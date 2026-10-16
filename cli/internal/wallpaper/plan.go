package wallpaper

// Which tool sets the wallpaper on a Linux or BSD desktop. Pure logic with
// no build tag, so it's tested on every platform; unix.go runs the result.

import (
	"fmt"
	"net/url"
	"strings"
)

// A setter is one desktop's way of setting the wallpaper.
type setter struct {
	name string
	cmds func(path string) [][]string // commands to run, in order
	tool string                       // must be on PATH
}

func gnomeLike(schema string) func(string) [][]string {
	return func(path string) [][]string {
		uri := (&url.URL{Scheme: "file", Path: path}).String()
		return [][]string{
			{"gsettings", "set", schema, "picture-uri", uri},
			{"gsettings", "set", schema, "picture-uri-dark", uri}, // GNOME 42+; harmless error before
			{"gsettings", "set", schema, "picture-options", "zoom"},
		}
	}
}

// plan picks the setter for this session. getenv and has are injected so
// tests can describe any desktop.
func plan(getenv func(string) string, has func(tool string) bool) (*setter, error) {
	desktops := strings.Split(strings.ToLower(getenv("XDG_CURRENT_DESKTOP")), ":")
	is := func(names ...string) bool {
		for _, d := range desktops {
			for _, n := range names {
				if d == n {
					return true
				}
			}
		}
		return false
	}
	candidates := []setter{}
	switch {
	case getenv("SWAYSOCK") != "":
		candidates = append(candidates, setter{"sway", func(p string) [][]string {
			return [][]string{{"swaymsg", "output", "*", "bg", p, "fill"}}
		}, "swaymsg"})
	case getenv("HYPRLAND_INSTANCE_SIGNATURE") != "":
		candidates = append(candidates,
			setter{"Hyprland (swww)", func(p string) [][]string {
				return [][]string{{"swww", "img", p, "--transition-type", "fade"}}
			}, "swww"},
			setter{"Hyprland (hyprpaper)", func(p string) [][]string {
				return [][]string{{"hyprctl", "hyprpaper", "reload", "," + p}}
			}, "hyprctl"})
	case is("kde"):
		candidates = append(candidates, setter{"KDE Plasma", func(p string) [][]string {
			return [][]string{{"plasma-apply-wallpaperimage", p}}
		}, "plasma-apply-wallpaperimage"})
	case is("x-cinnamon", "cinnamon"):
		candidates = append(candidates, setter{"Cinnamon", gnomeLike("org.cinnamon.desktop.background"), "gsettings"})
	case is("mate"):
		candidates = append(candidates, setter{"MATE", func(p string) [][]string {
			return [][]string{{"gsettings", "set", "org.mate.background", "picture-filename", p}}
		}, "gsettings"})
	case is("xfce"):
		candidates = append(candidates, setter{"Xfce", nil, "xfconf-query"}) // per-monitor; see setXfce
	case is("lxqt"):
		candidates = append(candidates, setter{"LXQt", func(p string) [][]string {
			return [][]string{{"pcmanfm-qt", "--set-wallpaper", p, "--wallpaper-mode", "zoom"}}
		}, "pcmanfm-qt"})
	case is("gnome", "unity", "budgie", "pantheon", "ubuntu", "pop", "cosmic", "deepin"):
		candidates = append(candidates, setter{"GNOME", gnomeLike("org.gnome.desktop.background"), "gsettings"})
	}
	// Window managers without a desktop: feh (X11) or swaybg can't be driven
	// remotely, so only feh is a fallback.
	if getenv("DISPLAY") != "" {
		candidates = append(candidates, setter{"feh", func(p string) [][]string {
			return [][]string{{"feh", "--no-fehbg", "--bg-fill", p}}
		}, "feh"})
	}
	for i := range candidates {
		if has(candidates[i].tool) {
			return &candidates[i], nil
		}
	}
	desktop := getenv("XDG_CURRENT_DESKTOP")
	if desktop == "" {
		desktop = "unknown"
	}
	if len(candidates) > 0 {
		return nil, fmt.Errorf("%w (desktop %q: install %s)", ErrUnsupported, desktop, candidates[0].tool)
	}
	return nil, fmt.Errorf("%w (desktop %q)", ErrUnsupported, desktop)
}
