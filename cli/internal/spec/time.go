// Package spec implements the Wallpy pack format, spec 2 (spec/README.md):
// parsing, validation and "which image is shown". Ported from
// spec/reference/wallpy_ref.py and checked against spec/vectors/vectors.json.
//
// All scheduling happens in local wall-clock time, represented as a "wall"
// time.Time: a UTC time whose fields read the same as the local clock. Sub,
// Add and comparisons on walls are wall-clock arithmetic, as the spec requires.
package spec

import (
	"fmt"
	"regexp"
	"strconv"
	"time"
)

// Location is where the user is, for solar events.
type Location struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Timezone  string  `json:"timezone"`
}

var Weekdays = []string{"mon", "tue", "wed", "thu", "fri", "sat", "sun"}

// Fallbacks are used without a location, or when an event doesn't happen
// that day (polar day/night). Minutes after midnight.
var Fallbacks = map[string]int{
	"midnight": 0, "dawn": 5 * 60, "sunrise": 6*60 + 30,
	"noon": 12 * 60, "sunset": 18*60 + 30, "dusk": 19*60 + 30,
}

// anchor is the wall time "every X" rotation counts from.
var anchor = time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)

var (
	clockRe = regexp.MustCompile(`^([01][0-9]|2[0-3]):([0-5][0-9])$`)
	solarRe = regexp.MustCompile(`^(midnight|dawn|sunrise|noon|sunset|dusk)(?:([+-])(?:(\d+)h)?(?:(\d+)m)?)?$`)
	everyRe = regexp.MustCompile(`^every ([1-9][0-9]{0,4})([mhd])$`)
)

// At is a parsed `at`: a clock time, or a solar event plus an offset.
type At struct {
	Event  string // "" for a clock time
	Minute int    // clock: minutes after midnight; solar: offset in minutes
}

func ParseAt(at string) (At, error) {
	if m := clockRe.FindStringSubmatch(at); m != nil {
		h, _ := strconv.Atoi(m[1])
		mi, _ := strconv.Atoi(m[2])
		return At{Minute: h*60 + mi}, nil
	}
	if m := solarRe.FindStringSubmatch(at); m != nil {
		h, _ := strconv.Atoi(m[3])
		mi, _ := strconv.Atoi(m[4])
		offset := h*60 + mi
		if m[2] == "-" {
			offset = -offset
		}
		return At{Event: m[1], Minute: offset}, nil
	}
	return At{}, fmt.Errorf("invalid time %q", at)
}

// FallbackMinutes is minutes after midnight at the fallback times (no location).
func FallbackMinutes(at string) (int, error) {
	p, err := ParseAt(at)
	if err != nil || p.Event == "" {
		return p.Minute, err
	}
	return Fallbacks[p.Event] + p.Minute, nil
}

// Every is the interval of `rotate = "every X"`, or 0 for "spread".
func Every(rotate string) time.Duration {
	m := everyRe.FindStringSubmatch(rotate)
	if m == nil {
		return 0
	}
	n, _ := strconv.Atoi(m[1])
	unit := map[string]time.Duration{"m": time.Minute, "h": time.Hour, "d": 24 * time.Hour}[m[2]]
	return time.Duration(n) * unit
}

// Wall is the wall-clock reading of t, as a wall time.
func Wall(t time.Time) time.Time {
	y, mo, d := t.Date()
	h, mi, s := t.Clock()
	return time.Date(y, mo, d, h, mi, s, t.Nanosecond(), time.UTC)
}

// Instant is the real time at which loc's clocks show the wall time w.
func Instant(w time.Time, loc *time.Location) time.Time {
	return time.Date(w.Year(), w.Month(), w.Day(), w.Hour(), w.Minute(), w.Second(), w.Nanosecond(), loc)
}

// wallDay is midnight (wall) of the day containing w.
func wallDay(w time.Time) time.Time {
	return time.Date(w.Year(), w.Month(), w.Day(), 0, 0, 0, 0, time.UTC)
}

func weekday(day time.Time) string {
	return Weekdays[(int(day.Weekday())+6)%7]
}

// resolve is the wall start of `at` on the wall day `day`.
func resolve(at string, day time.Time, loc *Location) time.Time {
	p, err := ParseAt(at)
	if err != nil {
		panic(err) // schedules are validated before they're scheduled
	}
	if p.Event == "" {
		return day.Add(time.Duration(p.Minute) * time.Minute)
	}
	return solarWall(p.Event, day, loc).Add(time.Duration(p.Minute) * time.Minute)
}
