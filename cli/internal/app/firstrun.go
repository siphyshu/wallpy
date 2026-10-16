package app

import (
	"context"
	"errors"
	"time"

	"charm.land/huh/v2"

	"github.com/siphyshu/wallpy/cli/internal/geo"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

// firstRun is what a new user sees the first time they type `wallpy` in a
// terminal: where are you (for the sun), then the gallery. It's offered
// once; everything in it can be done later with location and browse.
func firstRun(ctx context.Context, p *ui.Printer, version string) error {
	state.Update(func(s *state.State) { s.Welcomed = true })
	p.Blank()
	p.Raw(p.Strong("Welcome to wallpy.") + "  " + p.Muted(tagline))
	p.Raw(p.Muted("Two quick questions, then you're set."))
	p.Blank()

	// 1. Where are you? The time-zone guess first: offline and one keypress.
	const (
		guess = iota
		search
		skip
	)
	var guessed *state.Place
	if zone := geo.SystemZone(); zone != "" {
		guessed, _ = geo.FromZone(zone)
	}
	var options []huh.Option[int]
	if guessed != nil {
		options = append(options, huh.NewOption("Near "+guessed.Name+" (from your time zone)", guess))
	}
	options = append(options,
		huh.NewOption("Somewhere else…", search),
		huh.NewOption("Skip: use standard times (sunrise 06:30, sunset 18:30)", skip))
	choice := options[0].Value
	if err := p.Ask(huh.NewSelect[int]().
		Title("Where are you?").
		Description("Packs follow your real sunrise and sunset.").
		Options(options...).Value(&choice)); err != nil {
		return quitIfAborted(err)
	}
	var place *state.Place
	switch choice {
	case guess:
		place = guessed
	case search:
		var city string
		if err := p.Ask(huh.NewInput().Title("Which city?").Placeholder("New Delhi").Value(&city)); err != nil {
			return quitIfAborted(err)
		}
		results, err := geo.Search(ctx, city)
		if err != nil {
			p.Notice("Couldn't find that place, so standard times for now. Set it later with wallpy location.")
			break
		}
		place = &results[0]
		if len(results) > 1 {
			opts := make([]huh.Option[int], len(results))
			for i, r := range results {
				opts[i] = huh.NewOption(r.Name, i)
			}
			pick := 0
			if err := p.Ask(huh.NewSelect[int]().Title("Which one?").Options(opts...).Value(&pick)); err != nil {
				return quitIfAborted(err)
			}
			place = &results[pick]
		}
	}
	if place != nil {
		state.Update(func(s *state.State) { s.Place = place })
		p.Success(p.Muted("Location set to ") + p.Plain(place.Name))
		p.Raw("  " + p.Faint(sunLine(time.Now(), &place.Location)))
	}

	// 2. Pick a pack.
	p.Blank()
	pickNow := true
	if err := p.Ask(huh.NewConfirm().Title("Pick your first pack from the gallery?").
		Affirmative("Browse").Negative("Later").Value(&pickNow)); err != nil {
		return quitIfAborted(err)
	}
	if !pickNow {
		p.Blank()
		p.Hints([2]string{"wallpy browse", "when you're ready"})
		p.Blank()
		return nil
	}
	return browse(ctx, version, "")
}

func quitIfAborted(err error) error {
	if errors.Is(err, huh.ErrUserAborted) {
		return errQuiet
	}
	return err
}
