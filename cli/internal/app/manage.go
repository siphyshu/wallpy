package app

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"charm.land/huh/v2"
	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
	"github.com/siphyshu/wallpy/cli/internal/wallpaper"
)

func newList() *cobra.Command {
	return &cobra.Command{
		Use:     "list",
		Aliases: []string{"ls"},
		Short:   "Show installed packs",
		Args:    cobra.NoArgs,
		RunE: func(cmd *cobra.Command, _ []string) error {
			lib, err := library.Open()
			if err != nil {
				return err
			}
			st, _ := state.Load()
			packs, err := lib.List()
			if err != nil {
				return err
			}
			p := printerAt(time.Now(), st.Location())
			p.Blank()
			if len(packs) == 0 {
				p.Raw(p.Muted("No packs installed yet."))
				p.Hints([2]string{"wallpy use <pack>", "install one from the gallery and start"})
				p.Blank()
				return nil
			}
			var total int64
			type row struct{ mark, title, slug, kind, size, url string }
			var rows []row
			for _, pk := range packs {
				size := pk.Size()
				total += size
				kind := "?"
				if s, err := pk.Schedule(); err == nil {
					kind = engine.Kind(s)
				} else {
					kind = "broken"
				}
				mark := " "
				if pk.Slug == st.Active {
					mark = "●"
				}
				rows = append(rows, row{mark, pk.Title(), pk.Slug, kind, ui.Bytes(size), pk.GalleryURL()})
			}
			p.Heading("Installed packs", fmt.Sprintf("%d · %s", len(packs), ui.Bytes(total)))
			p.Blank()
			wt, ws, wk := 0, 0, 0
			for _, r := range rows {
				wt, ws, wk = max(wt, len([]rune(r.title))), max(ws, len(r.slug)), max(wk, len(r.kind))
			}
			pad := func(s string, w int) string { return s + strings.Repeat(" ", w-len([]rune(s))) }
			for _, r := range rows {
				gap := strings.Repeat(" ", wt-len([]rune(r.title)))
				title := p.Link(p.Plain(r.title), r.url) + gap
				if r.mark != " " {
					title = p.Link(p.Strong(r.title), r.url) + gap
				}
				p.Raw(p.Accent(r.mark) + " " + title + "  " + p.Muted(pad(r.slug, ws)) + "  " + p.Faint(pad(r.kind, wk)+"  "+r.size))
			}
			p.Blank()
			if st.Active == "" {
				p.Hints([2]string{"wallpy use " + packs[0].Slug, "make one your wallpaper"})
				p.Blank()
			}
			return nil
		},
	}
}

func newShow(version string) *cobra.Command {
	var at string
	var web bool
	cmd := &cobra.Command{
		Use:   "show <pack>",
		Short: "Show a pack's details and schedule",
		Long: "Show a pack's credit, licence and schedule. Works for installed packs and,\n" +
			"without installing anything, for packs in the gallery. --at shows what\n" +
			"would be on screen at another time.",
		ValidArgsFunction: completeInstalled,
		Example:           "wallpy show zelda-wind-waker\nwallpy show zelda-wind-waker --web\nwallpy show zelda-wind-waker --at 18:45\nwallpy show ocean-hours --at \"2026-12-24 08:00\"",
		Args: func(_ *cobra.Command, args []string) error {
			if len(args) != 1 {
				return &problem{msg: "Which pack?", fix: run("For example: ", "wallpy show zelda-wind-waker", "")}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			st, _ := state.Load()
			when, err := parseWhen(at, time.Now())
			if err != nil {
				return err
			}
			lib, err := library.Open()
			if err != nil {
				return err
			}
			var sched *spec.Schedule
			var m *remote.Manifest
			var pack *library.Pack
			var gallery string
			var client *remote.Client
			if pk, err := lib.Get(args[0]); err == nil {
				pack = pk
				gallery = pk.GalleryURL()
				if sched, err = pk.Schedule(); err != nil {
					return &problem{msg: sentence(err.Error()), fix: run("Check it with ", "wallpy check "+pk.Dir, ""), err: err}
				}
				if pk.Info != nil {
					m = &pk.Info.Manifest
				}
			} else {
				c := remote.New(version)
				client = c
				slug, err := c.Resolve(args[0])
				if err != nil {
					return &problem{msg: sentence(err.Error()), err: err}
				}
				gallery = c.PackURL(slug)
				if web {
					return openGallery(gallery, args[0])
				}
				if m, err = c.Manifest(cmd.Context(), slug); err != nil {
					return explainNetwork(c, slug, err)
				}
				s, problems, err := spec.ParseJSON(m.Schedule, nil)
				if err != nil || len(problems) > 0 {
					return fmt.Errorf("the site sent a schedule that breaks the spec")
				}
				sched = s
			}

			if web {
				return openGallery(gallery, args[0])
			}
			p := printerAt(when, st.Location())
			p.Blank()
			title := sched.Name
			if m != nil {
				title = m.Title
			}
			head := p.Link(p.Strong(title), gallery)
			if m != nil {
				head += "  " + p.Faint(fmt.Sprintf("v%d", m.Version))
			}
			p.Raw(head + "  " + p.Faint(engine.Kind(sched)))
			if m != nil {
				p.Raw(p.Muted(credit(m)))
			} else if sched.Author != "" {
				p.Raw(p.Muted("by " + sched.Author))
			}
			if sched.Description != "" {
				p.Blank()
				p.Raw(p.Plain(wrap(sched.Description, 66)))
			}
			a, err := sched.Active(when, st.Location())
			if err != nil {
				return err
			}
			if p.Rich() {
				w, h := pictureSize()
				if img := showImage(cmd.Context(), pack, m, client, a.Image); img != nil {
					p.Blank()
					p.PrintImage(img, w, h)
					p.Raw(p.Faint(a.Image))
				}
				p.Blank()
				p.Raw(p.SkyStrip())
			}
			p.Blank()
			if err := dayList(p, sched, when, st.Location(), &a); err != nil {
				return err
			}
			p.Blank()
			label := "Now"
			if at != "" {
				label = "At " + when.Format("Mon 2 Jan 15:04")
			}
			p.Raw(p.Muted(label+": ") + p.Plain(a.Image) + p.Faint(" until "+a.Until.Format("15:04")))
			switch {
			case pack != nil:
				p.Raw(p.Faint(tilde(pack.Dir)))
			case m != nil:
				p.Blank()
				p.Hints([2]string{"wallpy use " + m.Slug, fmt.Sprintf("install (%s) and use it", ui.Bytes(m.Size()))})
			}
			p.Blank()
			return nil
		},
	}
	cmd.Flags().StringVar(&at, "at", "", `a time ("18:45") or date and time ("2026-12-24 08:00")`)
	cmd.Flags().BoolVar(&web, "web", false, "open the pack's page in the gallery")
	return cmd
}

// parseWhen reads --at: a time today, or a date and time, in local time.
func parseWhen(at string, now time.Time) (time.Time, error) {
	if at == "" {
		return now, nil
	}
	for _, layout := range []string{"15:04", "2006-01-02 15:04", "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.ParseInLocation(layout, at, time.Local); err == nil {
			if layout == "15:04" {
				t = time.Date(now.Year(), now.Month(), now.Day(), t.Hour(), t.Minute(), 0, 0, time.Local)
			}
			return t, nil
		}
	}
	return time.Time{}, &problem{msg: fmt.Sprintf("%q isn't a time wallpy understands.", at),
		fix: say(`Use "18:45" for today, or "2026-12-24 08:00".`)}
}

func wrap(s string, width int) string {
	var lines []string
	line := ""
	for _, w := range strings.Fields(s) {
		if line != "" && len(line)+1+len(w) > width {
			lines = append(lines, line)
			line = w
			continue
		}
		if line != "" {
			line += " "
		}
		line += w
	}
	return strings.Join(append(lines, line), "\n")
}

func newRemove() *cobra.Command {
	var yes bool
	cmd := &cobra.Command{
		Use:               "remove <pack>",
		ValidArgsFunction: completeInstalled,
		Aliases:           []string{"rm"},
		Short:             "Delete an installed pack",
		Args: func(_ *cobra.Command, args []string) error {
			if len(args) != 1 {
				return &problem{msg: "Which pack?", fix: run("See what's installed with ", "wallpy list", ".")}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			lib, err := library.Open()
			if err != nil {
				return err
			}
			pack, err := lib.Get(args[0])
			if errors.Is(err, fs.ErrNotExist) {
				return &problem{msg: fmt.Sprintf("No pack called %q is installed.", args[0]), fix: run("See what's installed with ", "wallpy list", ".")}
			}
			if err != nil {
				return err
			}
			st, _ := state.Load()
			p := ui.Stdout()
			if !yes {
				if !p.Styled() {
					return &problem{msg: "Removing needs a yes.", fix: run("Run it in a terminal, or add ", "--yes", ".")}
				}
				confirm := false
				question := fmt.Sprintf("Delete %s (%s)?", pack.Title(), ui.Bytes(pack.Size()))
				if err := p.Ask(huh.NewConfirm().Title(question).Affirmative("Delete").Negative("Keep").Value(&confirm)); err != nil || !confirm {
					p.Blank()
					p.Raw(p.Muted("Kept."))
					p.Blank()
					return nil
				}
			}
			title := pack.Title()
			if st.Active == pack.Slug {
				if home, err := library.Home(); err == nil {
					keepWallpaper(st, home, "last-wallpaper")
				}
			}
			if err := lib.Remove(pack.Slug); err != nil {
				return err
			}
			p.Blank()
			p.Success(p.Muted("Removed ") + p.Plain(title))
			if st.Active == pack.Slug {
				state.Update(func(s *state.State) { s.Active, s.LastSet = "", "" })
				p.Raw("  " + p.Muted("It was in use, so your wallpaper stays as it is until you pick another."))
				p.Hints([2]string{"wallpy list", "see what's left"})
			}
			p.Blank()
			return nil
		},
	}
	cmd.Flags().BoolVarP(&yes, "yes", "y", false, "don't ask first")
	return cmd
}

func newCheck() *cobra.Command {
	return &cobra.Command{
		Use: "check <folder>",
		ValidArgsFunction: func(*cobra.Command, []string, string) ([]string, cobra.ShellCompDirective) {
			return nil, cobra.ShellCompDirectiveFilterDirs
		},
		Short: "Check a pack folder against the pack spec",
		Long: "Check a pack folder (schedule.toml and images/) against the pack spec,\n" +
			"the same checks the site runs when you upload.",
		Example: "wallpy check ./my-pack",
		Args: func(_ *cobra.Command, args []string) error {
			if len(args) != 1 {
				return &problem{msg: "Which folder?", fix: run("For example: ", "wallpy check ./my-pack", "")}
			}
			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			s, files, problems, err := library.CheckFolder(args[0])
			if err != nil {
				return &problem{msg: sentence(err.Error()), fix: say("A pack is a folder with schedule.toml and an images folder."), err: err}
			}
			p := ui.Stdout()
			p.Blank()
			if len(problems) == 0 {
				p.Success(p.Strong(s.Name) + p.Muted(" follows the pack spec."))
				p.Raw("  " + p.Faint(fmt.Sprintf("%s · %d slots · %s", engine.Kind(s), len(s.Slot), plural(len(files), "image"))))
				p.Blank()
				p.Hints([2]string{"wallpy use " + args[0], "try it as your wallpaper"})
				p.Blank()
				return nil
			}
			p.Fail(fmt.Sprintf("%s has %s:", args[0], plural(len(problems), "problem")), "")
			for _, pr := range problems {
				p.Raw("  " + p.Faint("·") + " " + p.Plain(pr))
			}
			p.Blank()
			return errQuiet
		},
	}
}

// keepWallpaper copies the image on screen into dir, under name plus the
// image's extension, and points the desktop at the copy: for when the
// pack holding the original is about to be deleted. It returns the copy's
// path ("" if there was nothing to keep).
func keepWallpaper(st *state.State, dir, name string) string {
	if st.LastSet == "" {
		return ""
	}
	data, err := os.ReadFile(st.LastSet)
	if err != nil {
		return ""
	}
	keep := filepath.Join(dir, name+filepath.Ext(st.LastSet))
	if os.MkdirAll(dir, 0o755) != nil || os.WriteFile(keep, data, 0o644) != nil {
		return ""
	}
	if wallpaper.Set(keep) != nil {
		return ""
	}
	return keep
}

// openGallery opens a pack's gallery page in the browser.
func openGallery(url, name string) error {
	if url == "" {
		return &problem{msg: fmt.Sprintf("%s is a local pack, so it isn't in the gallery.", name)}
	}
	if err := openURL(url); err != nil {
		return &problem{msg: "Couldn't open a browser.", fix: run("The page is ", url, ""), err: err}
	}
	p := ui.Stdout()
	p.Blank()
	p.Success(p.Muted("Opened ") + p.Link(p.Plain(url), url))
	p.Blank()
	return nil
}

// pictureSize is how big `show` draws a picture: up to 72 cells wide, 16:9.
func pictureSize() (w, h int) {
	w = min(ui.Width()-4, 72)
	return w, w * 9 / 32
}

// showImage loads one of a pack's images: from disk when installed, else
// just that one file from the gallery. nil if it can't.
func showImage(ctx context.Context, pack *library.Pack, m *remote.Manifest, c *remote.Client, name string) image.Image {
	var data []byte
	var err error
	switch {
	case pack != nil:
		data, err = os.ReadFile(pack.Image(name))
	case m != nil && c != nil:
		for _, f := range m.Files {
			if f.Path == name {
				data, err = c.Fetch(ctx, f.URL)
			}
		}
	}
	if err != nil || data == nil {
		return nil
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil
	}
	return shrink(img, 1600)
}
