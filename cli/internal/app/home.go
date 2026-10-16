package app

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

// printerAt is a terminal printer whose sky follows the user's real sun.
func printerAt(now time.Time, loc *spec.Location) *ui.Printer {
	return ui.New(os.Stdout, ui.Look{
		Theme: ui.ThemeFor(ui.DetectDark()),
		Now:   now,
		Sun:   ui.SunOf(spec.SunTimes(now, loc)),
	})
}

// home is `wallpy` on its own: what's showing, today's slots, what's next.
func home(version string) error {
	lib, err := library.Open()
	if err != nil {
		return err
	}
	st, err := state.Load()
	if err != nil {
		return err
	}
	now := time.Now()
	p := printerAt(now, st.Location())

	cur, err := engine.Current(lib, st, now)
	if errors.Is(err, engine.ErrNoActive) {
		welcome(p, version, lib)
		return nil
	}
	if err != nil {
		return &problem{msg: sentence(err.Error()), fix: run("Pick a pack with ", "wallpy use <pack>", "."), err: err}
	}

	p.Blank()
	title := p.Strong(cur.Pack.Title())
	if cur.Pack.Info != nil {
		title += "  " + p.Faint(fmt.Sprintf("v%d", cur.Pack.Info.Manifest.Version))
	}
	p.Raw(title)
	if cur.Pack.Info != nil {
		p.Raw(p.Muted(credit(&cur.Pack.Info.Manifest)))
	} else if cur.Schedule.Author != "" {
		p.Raw(p.Muted("by " + cur.Schedule.Author))
	}
	if p.Rich() {
		p.Blank()
		p.Raw(p.SkyStrip())
	}
	p.Blank()
	if err := dayList(p, cur.Schedule, now, st.Location(), &cur.Active); err != nil {
		return err
	}
	p.Blank()
	switch {
	case st.Paused:
		p.Notice("Paused. Your wallpaper stays as it is.")
		p.Hints([2]string{"wallpy resume", "start changing again"})
	default:
		p.Raw(p.Muted("Next change ") + p.Plain(cur.Active.Until.Format("15:04")) + p.Faint("  "+until(spec.Wall(now), cur.Active.Until)))
	}
	if st.Place == nil {
		p.Blank()
		p.Notice("Using standard sun times (sunrise 06:30, sunset 18:30).")
		p.Hints([2]string{"wallpy location <city>", "use your real sunrise and sunset"})
	}
	p.Blank()
	return nil
}

// dayList prints the slots of `date`'s day, the current one marked.
func dayList(p *ui.Printer, s *spec.Schedule, date time.Time, loc *spec.Location, cur *spec.Active) error {
	spans, err := s.Day(date, loc)
	if err != nil {
		return err
	}
	width := 0
	for _, sp := range spans {
		width = max(width, len([]rune(engine.SlotName(s, sp.Slot))))
	}
	wall := spec.Wall(date)
	for _, sp := range spans {
		name := engine.SlotName(s, sp.Slot)
		pad := strings.Repeat(" ", width-len([]rune(name)))
		row := sp.Start.Format("15:04") + "  " + name + pad
		isNow := cur != nil && !wall.Before(sp.Start) && wall.Before(sp.End)
		if isNow {
			p.Raw(p.Accent(ui.SymHint) + " " + p.Strong(row) + "   " + p.Plain(cur.Image))
			continue
		}
		count := len(s.Slot[sp.Slot].Images)
		p.Raw("  " + p.Muted(row) + "   " + p.Faint(plural(count, "image")))
	}
	return nil
}

func plural(n int, word string) string {
	if n == 1 {
		return "1 " + word
	}
	return fmt.Sprintf("%d %ss", n, word)
}

// until is how long from now to then, for people: "in 12 min", "in 2h 05m".
func until(now, then time.Time) string {
	d := then.Sub(now).Round(time.Minute)
	switch {
	case d < time.Minute:
		return "in under a minute"
	case d < time.Hour:
		return fmt.Sprintf("in %d min", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("in %dh %02dm", int(d.Hours()), int(d.Minutes())%60)
	}
	return fmt.Sprintf("in %d days", int(d.Hours()/24+0.5))
}

// welcome is the home screen before any pack is active.
func welcome(p *ui.Printer, version string, lib *library.Library) {
	if version == "" {
		version = "dev"
	}
	p.Blank()
	p.Raw(p.Strong("wallpy") + "  " + p.Faint(version))
	p.Raw(p.Muted(tagline))
	if p.Rich() {
		p.Blank()
		p.Raw(p.SkyStrip())
	}
	p.Blank()
	packs, _ := lib.List()
	if len(packs) > 0 {
		p.Raw(p.Muted("Installed, not in use yet:"))
		for _, pk := range packs {
			p.Raw("  " + p.Plain(pk.Title()) + "  " + p.Faint(pk.Slug))
		}
		p.Blank()
		p.Hints([2]string{"wallpy use " + packs[0].Slug, "make it your wallpaper"})
	} else {
		p.Hints(
			[2]string{"wallpy use <pack>", "install a pack from the gallery and start"},
			[2]string{"wallpy --help", "everything else"},
		)
	}
	p.Blank()
}
