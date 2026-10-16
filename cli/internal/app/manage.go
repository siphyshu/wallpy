package app

import (
	"errors"
	"fmt"
	"io/fs"
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
			type row struct{ mark, title, slug, kind, size string }
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
				rows = append(rows, row{mark, pk.Title(), pk.Slug, kind, ui.Bytes(size)})
			}
			p.Heading("Installed packs", fmt.Sprintf("%d · %s", len(packs), ui.Bytes(total)))
			p.Blank()
			wt, ws, wk := 0, 0, 0
			for _, r := range rows {
				wt, ws, wk = max(wt, len([]rune(r.title))), max(ws, len(r.slug)), max(wk, len(r.kind))
			}
			pad := func(s string, w int) string { return s + strings.Repeat(" ", w-len([]rune(s))) }
			for _, r := range rows {
				title := p.Plain(pad(r.title, wt))
				if r.mark != " " {
					title = p.Strong(pad(r.title, wt))
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
	cmd := &cobra.Command{
		Use:   "show <pack>",
		Short: "Show a pack's details and schedule",
		Long: "Show a pack's credit, licence and schedule. Works for installed packs and,\n" +
			"without installing anything, for packs in the gallery. --at shows what\n" +
			"would be on screen at another time.",
		Example: "wallpy show zelda-wind-waker\nwallpy show zelda-wind-waker --at 18:45\nwallpy show ocean-hours --at \"2026-12-24 08:00\"",
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
			if pk, err := lib.Get(args[0]); err == nil {
				pack = pk
				if sched, err = pk.Schedule(); err != nil {
					return &problem{msg: sentence(err.Error()), fix: run("Check it with ", "wallpy check "+pk.Dir, ""), err: err}
				}
				if pk.Info != nil {
					m = &pk.Info.Manifest
				}
			} else {
				c := remote.New(version)
				slug, err := c.Resolve(args[0])
				if err != nil {
					return &problem{msg: sentence(err.Error()), err: err}
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

			p := printerAt(when, st.Location())
			p.Blank()
			title := sched.Name
			if m != nil {
				title = m.Title
			}
			head := p.Strong(title)
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
			if p.Rich() {
				p.Blank()
				p.Raw(p.SkyStrip())
			}
			p.Blank()
			a, err := sched.Active(when, st.Location())
			if err != nil {
				return err
			}
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
		Use:     "remove <pack>",
		Aliases: []string{"rm"},
		Short:   "Delete an installed pack",
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
				if err := huh.NewConfirm().Title(question).Affirmative("Delete").Negative("Keep").Value(&confirm).Run(); err != nil || !confirm {
					p.Blank()
					p.Raw(p.Muted("Kept."))
					p.Blank()
					return nil
				}
			}
			title := pack.Title()
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
		Use:   "check <folder>",
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
