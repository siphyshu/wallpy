// Package ui is Wallpy's terminal design system: every colour, symbol and
// spacing rule the CLI prints with. Commands never style text themselves.
//
// The look follows the site: monochrome text whose hierarchy comes from
// brightness, and colour only where it means something. The one accent is
// the colour of the sky right now (dawn, day, dusk or night), so the CLI
// quietly changes through the day, like the wallpapers it runs.
package ui

import (
	"image/color"
	"os"
	"time"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/x/term"

	"github.com/siphyshu/wallpy/cli/internal/spec"
)

// Phase is a part of the day, as the spec's solar events divide it.
type Phase int

const (
	Night Phase = iota // dusk to dawn
	Dawn               // dawn to sunrise
	Day                // sunrise to sunset
	Dusk               // sunset to dusk
)

func (p Phase) String() string {
	return [...]string{"night", "dawn", "day", "dusk"}[p]
}

// Sun is when a day's phases begin, in minutes after midnight.
type Sun struct{ Dawn, Sunrise, Sunset, Dusk int }

// FallbackSun is the spec's fallback times, used without a location.
var FallbackSun = Sun{spec.Fallbacks["dawn"], spec.Fallbacks["sunrise"], spec.Fallbacks["sunset"], spec.Fallbacks["dusk"]}

// SunOf is a Sun from a day's wall times (spec.SunTimes).
func SunOf(dawn, sunrise, sunset, dusk time.Time) Sun {
	m := func(t time.Time) int { return t.Hour()*60 + t.Minute() }
	return Sun{m(dawn), m(sunrise), m(sunset), m(dusk)}
}

// PhaseAt is the phase at `minute` after midnight.
func (s Sun) PhaseAt(minute int) Phase {
	switch {
	case minute < s.Dawn || minute >= s.Dusk:
		return Night
	case minute < s.Sunrise:
		return Dawn
	case minute < s.Sunset:
		return Day
	default:
		return Dusk
	}
}

func hex(s string) color.Color { return lipgloss.Color(s) }

// Theme is the palette for one terminal background.
type Theme struct {
	Text    color.Color // primary: names, values
	Muted   color.Color // secondary: descriptions
	Faint   color.Color // tertiary: labels, rules, hints
	Success color.Color
	Error   color.Color
	Notice  color.Color
	Surface color.Color // code blocks
	sky     [4]color.Color
}

// Accent is the sky colour of a phase, tuned to read on this background.
func (t Theme) Accent(p Phase) color.Color { return t.sky[p] }

// The site's whites at 100/60/40% opacity on #111, and its red-400,
// green-400 and amber-200 for meaning. Light terminals get darker twins.
var (
	darkTheme = Theme{
		Text: hex("#EDEDED"), Muted: hex("#A3A3A3"), Faint: hex("#6B6B6B"),
		Success: hex("#4ADE80"), Error: hex("#F87171"), Notice: hex("#FDE68A"),
		Surface: hex("#1C1C1C"),
		sky:     [4]color.Color{hex("#A5B4FC"), hex("#F9A8C0"), hex("#7DD3FC"), hex("#FDBA74")},
	}
	lightTheme = Theme{
		Text: hex("#171717"), Muted: hex("#525252"), Faint: hex("#8A8A8A"),
		Success: hex("#15803D"), Error: hex("#B91C1C"), Notice: hex("#A16207"),
		Surface: hex("#F2F2F2"),
		sky:     [4]color.Color{hex("#4338CA"), hex("#BE185D"), hex("#0369A1"), hex("#C2410C")},
	}
)

// ThemeFor is the palette for a dark or light background.
func ThemeFor(dark bool) Theme {
	if dark {
		return darkTheme
	}
	return lightTheme
}

// DetectDark asks the terminal for its background colour. It only asks a
// real terminal (the query waits briefly for a reply); otherwise it assumes
// dark, the common case and the site's own look.
func DetectDark() bool {
	if !term.IsTerminal(os.Stdout.Fd()) || !term.IsTerminal(os.Stdin.Fd()) {
		return true
	}
	return lipgloss.HasDarkBackground(os.Stdin, os.Stdout)
}

// Look is everything a screen needs to draw: a palette and the time it is.
type Look struct {
	Theme
	Now time.Time
	Sun Sun
}

// Phase is the current part of the day.
func (l Look) Phase() Phase {
	return l.Sun.PhaseAt(l.Now.Hour()*60 + l.Now.Minute())
}

// Sky is the accent colour right now.
func (l Look) Sky() color.Color { return l.Accent(l.Phase()) }
