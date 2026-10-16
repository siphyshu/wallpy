package app

import (
	"bufio"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/service"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
	"github.com/siphyshu/wallpy/cli/internal/wallpaper"
)

// check is one line of `wallpy doctor`.
type check struct {
	name   string
	status int // 0 ok, 1 notice, 2 problem
	detail string
	fix    [2]string // command, what it does
}

func newDoctor(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "doctor",
		Short: "Check that everything is working, and how to fix what isn't",
		Args:  cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			st, _ := state.Load()
			lib, err := library.Open()
			if err != nil {
				return err
			}
			checks := []check{wallpaperCheck(), agentCheck(), packCheck(lib, st), locationCheck(st)}
			if st.Paused {
				checks = append(checks, check{"Paused", 1, "the wallpaper isn't changing", [2]string{"wallpy resume", "start again"}})
			}
			if c, ok := logCheck(); ok {
				checks = append(checks, c)
			}

			p := printerAt(time.Now(), st.Location())
			p.Blank()
			v := version
			if v == "" {
				v = "dev"
			}
			home, _ := library.Home()
			p.Heading("Wallpy doctor", v+" · "+runtime.GOOS+"/"+runtime.GOARCH)
			p.Raw(p.Faint(tilde(home)))
			p.Blank()
			width := 0
			for _, c := range checks {
				width = max(width, len(c.name))
			}
			worst := 0
			for _, c := range checks {
				worst = max(worst, c.status)
				name := c.name + strings.Repeat(" ", width-len(c.name)) + "  "
				switch c.status {
				case 0:
					p.Success(p.Plain(name) + p.Muted(c.detail))
				case 1:
					p.Notice(p.Plain(name) + p.Muted(c.detail))
				default:
					p.Fail(p.Plain(name)+p.Muted(c.detail), "")
				}
				if c.fix[0] != "" && c.status > 0 {
					p.Raw("  " + strings.Repeat(" ", width+2) + p.Faint(ui.SymHint+" ") + p.Code(c.fix[0]) + p.Faint("  "+c.fix[1]))
				}
			}
			p.Blank()
			switch worst {
			case 0:
				p.Raw(p.Muted("Everything looks right."))
			case 1:
				p.Raw(p.Muted("Working, with a note or two above."))
			default:
				p.Raw(p.Muted("Something needs fixing; see above."))
			}
			p.Blank()
			if worst == 2 {
				return errQuiet
			}
			return nil
		},
	}
}

func wallpaperCheck() check {
	m, err := wallpaper.Method()
	if err != nil {
		return check{"Wallpaper", 2, err.Error(), [2]string{}}
	}
	return check{"Wallpaper", 0, "set through " + m, [2]string{}}
}

func agentCheck() check {
	st, err := service.Get()
	if err != nil {
		return check{"Agent", 2, err.Error(), [2]string{"wallpy resume", "start it"}}
	}
	if st.Installed && !service.Current() {
		return check{"Agent", 2, "set up for a different copy of wallpy", [2]string{"wallpy resume", "point it at this one"}}
	}
	switch {
	case st.Running && st.Installed:
		return check{"Agent", 0, fmt.Sprintf("running (pid %d), starts at login", st.PID), [2]string{}}
	case st.Running:
		return check{"Agent", 1, fmt.Sprintf("running (pid %d), but won't start at login", st.PID), [2]string{"wallpy resume", "start it at login too"}}
	case st.Installed:
		return check{"Agent", 2, "set to start at login, but not running", [2]string{"wallpy resume", "start it now"}}
	}
	return check{"Agent", 1, "not set up, so the wallpaper won't change on its own", [2]string{"wallpy use <pack>", "pick a pack and start"}}
}

func packCheck(lib *library.Library, st *state.State) check {
	if st.Active == "" {
		return check{"Pack", 1, "none chosen yet", [2]string{"wallpy use <pack>", "pick one"}}
	}
	cur, err := engine.Current(lib, st, time.Now())
	if err != nil {
		return check{"Pack", 2, err.Error(), [2]string{"wallpy use <pack>", "pick a pack again"}}
	}
	name := cur.Pack.Title()
	if cur.Pack.Info == nil {
		return check{"Pack", 0, name + ", a local pack (follows the spec)", [2]string{}}
	}
	// Re-hash every image against the manifest.
	bad := 0
	for _, f := range cur.Pack.Info.Manifest.Files {
		if sum, err := hashFile(cur.Pack.Image(f.Path)); err != nil || sum != f.SHA256 {
			bad++
		}
	}
	if bad > 0 {
		return check{"Pack", 2, fmt.Sprintf("%s: %s damaged or missing", name, plural(bad, "image")),
			[2]string{"wallpy get " + cur.Pack.Slug + " --force", "repair it"}}
	}
	return check{"Pack", 0, fmt.Sprintf("%s: %s, all verified", name, plural(len(cur.Pack.Info.Manifest.Files), "image")), [2]string{}}
}

func hashFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func locationCheck(st *state.State) check {
	if st.Place == nil {
		return check{"Location", 1, "not set, so standard sun times (sunrise 06:30)", [2]string{"wallpy location <city>", "use your real sunrise"}}
	}
	_, sunrise, sunset, _ := spec.SunTimes(time.Now(), st.Location())
	return check{"Location", 0, fmt.Sprintf("%s (sunrise %s, sunset %s)", st.Place.Name, sunrise.Format("15:04"), sunset.Format("15:04")), [2]string{}}
}

// logCheck reports the agent's most recent error, if its last word was one.
func logCheck() (check, bool) {
	f, err := os.Open(service.LogPath())
	if err != nil {
		return check{}, false
	}
	defer f.Close()
	last := ""
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		last = sc.Text()
	}
	if _, msg, ok := strings.Cut(last, "error: "); ok {
		return check{"Last error", 2, msg, [2]string{"wallpy doctor", "after fixing, run again"}}, true
	}
	return check{}, false
}
