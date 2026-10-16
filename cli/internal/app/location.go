package app

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"charm.land/huh/v2"
	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/engine"
	"github.com/siphyshu/wallpy/cli/internal/geo"
	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newLocation() *cobra.Command {
	var clear bool
	cmd := &cobra.Command{
		Use:   "location [city | auto | lat,lon]",
		Short: "Set where you are, for real sunrise and sunset",
		Long: "Set where you are, so packs follow your real sunrise and sunset.\n\n" +
			"  auto       guess from your time zone (offline, approximate)\n" +
			"  <city>     search by name (asks Open-Meteo's free place search)\n" +
			"  <lat,lon>  exact coordinates\n\n" +
			"With nothing, shows the current location and today's sun times.",
		Example: "wallpy location auto\nwallpy location \"New Delhi\"\nwallpy location 52.52,13.40\nwallpy location --clear",
		RunE: func(cmd *cobra.Command, args []string) error {
			st, err := state.Load()
			if err != nil {
				return err
			}
			query := strings.TrimSpace(strings.Join(args, " "))
			switch {
			case clear:
				st, err = state.Update(func(s *state.State) { s.Place = nil })
				if err != nil {
					return err
				}
				p := printerAt(time.Now(), nil)
				p.Blank()
				p.Success("Location cleared. Packs use standard sun times (sunrise 06:30, sunset 18:30).")
				reapply(p)
				p.Blank()
				return nil
			case query == "":
				showLocation(st)
				return nil
			}

			var place *state.Place
			approximate := false
			switch {
			case query == "auto":
				zone := geo.SystemZone()
				if zone == "" {
					return &problem{msg: "Couldn't tell this computer's time zone.", fix: run("Name your city instead: ", "wallpy location <city>", "")}
				}
				if place, err = geo.FromZone(zone); err != nil {
					return &problem{msg: sentence(err.Error()), fix: run("Name your city instead: ", "wallpy location <city>", ""), err: err}
				}
				approximate = true
			default:
				if pl, ok := geo.ParseCoordinates(query); ok {
					place = pl
					break
				}
				results, err := geo.Search(cmd.Context(), query)
				if errors.Is(err, geo.ErrNoMatch) {
					return &problem{msg: fmt.Sprintf("No place called %q found.", query), fix: say("Try a nearby city, or coordinates like 52.52,13.40."), err: err}
				}
				if err != nil {
					return &problem{msg: sentence(err.Error()), fix: run("Without a connection, try ", "wallpy location auto", "."), err: err}
				}
				place = &results[0]
				if len(results) > 1 && ui.Stdout().Styled() {
					options := make([]huh.Option[int], len(results))
					for i, r := range results {
						options[i] = huh.NewOption(r.Name, i)
					}
					choice := 0
					if err := huh.NewSelect[int]().Title("Which " + query + "?").Options(options...).Value(&choice).Run(); err != nil {
						return errQuiet
					}
					place = &results[choice]
				}
			}

			if _, err := state.Update(func(s *state.State) { s.Place = place }); err != nil {
				return err
			}
			now := time.Now()
			p := printerAt(now, &place.Location)
			p.Blank()
			p.Success(p.Muted("Location set to ") + p.Strong(place.Name))
			p.Raw("  " + p.Faint(sunLine(now, &place.Location)))
			if approximate {
				p.Raw("  " + p.Muted("Guessed from your time zone ("+place.Timezone+"), so sun times may be off."))
				p.Hints([2]string{"wallpy location <your city>", "for exact times"})
			}
			reapply(p)
			p.Blank()
			return nil
		},
	}
	cmd.Flags().BoolVar(&clear, "clear", false, "forget the location and use standard sun times")
	return cmd
}

// sunLine is today's sun times: "Dawn 05:12 · Sunrise 05:36 · Sunset 18:51 · Dusk 19:15".
func sunLine(now time.Time, loc *spec.Location) string {
	dawn, sunrise, sunset, dusk := spec.SunTimes(now, loc)
	f := func(t time.Time) string { return t.Format("15:04") }
	return fmt.Sprintf("Today: dawn %s · sunrise %s · sunset %s · dusk %s", f(dawn), f(sunrise), f(sunset), f(dusk))
}

func showLocation(st *state.State) {
	now := time.Now()
	p := printerAt(now, st.Location())
	p.Blank()
	if st.Place == nil {
		p.Raw(p.Muted("No location set: packs use standard sun times."))
		p.Raw(p.Faint(sunLine(now, nil)))
		p.Blank()
		p.Hints(
			[2]string{"wallpy location <city>", "use your real sunrise and sunset"},
			[2]string{"wallpy location auto", "guess from your time zone"},
		)
		p.Blank()
		return
	}
	p.Raw(p.Strong(st.Place.Name) + "  " + p.Faint(fmt.Sprintf("%.2f, %.2f · %s", st.Place.Latitude, st.Place.Longitude, st.Place.Timezone)))
	p.Raw(p.Muted(sunLine(now, st.Location())))
	if p.Rich() {
		p.Blank()
		p.Raw(p.SkyStrip())
	}
	p.Blank()
}

// reapply updates the wallpaper after a settings change, if the right image
// is now a different one.
func reapply(p *ui.Printer) {
	lib, err := library.Open()
	if err != nil {
		return
	}
	cur, changed, err := engine.Apply(lib, time.Now(), false)
	if err == nil && changed {
		p.Raw("  " + p.Faint("Wallpaper updated to "+cur.Active.Image+"."))
	}
}
