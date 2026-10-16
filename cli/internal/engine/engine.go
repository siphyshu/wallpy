// Package engine decides what the wallpaper should be and makes it so. It
// is shared by `wallpy use`, `wallpy resume` and the background agent, so
// all three behave the same.
package engine

import (
	"errors"
	"fmt"
	"io/fs"
	"strings"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/wallpaper"
)

// ErrNoActive means no pack has been chosen yet.
var ErrNoActive = errors.New("no pack is active")

// Now is what should be on screen.
type Now struct {
	Pack     *library.Pack
	Schedule *spec.Schedule
	Active   spec.Active
	Image    string // absolute path
}

// Current works out what should be showing at `at`, changing nothing.
func Current(lib *library.Library, st *state.State, at time.Time) (*Now, error) {
	if st.Active == "" {
		return nil, ErrNoActive
	}
	pack, err := lib.Get(st.Active)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("the active pack %q isn't installed any more", st.Active)
	}
	if err != nil {
		return nil, err
	}
	sched, err := pack.Schedule()
	if err != nil {
		return nil, err
	}
	a, err := sched.Active(at, st.Location())
	if err != nil {
		return nil, err
	}
	return &Now{Pack: pack, Schedule: sched, Active: a, Image: pack.Image(a.Image)}, nil
}

// Apply sets the wallpaper to what should be showing, if it isn't already
// (or always, with force). It does nothing while paused unless forced.
// changed reports whether the wallpaper was set.
func Apply(lib *library.Library, at time.Time, force bool) (now *Now, changed bool, err error) {
	st, err := state.Load()
	if err != nil {
		return nil, false, err
	}
	now, err = Current(lib, st, at)
	if err != nil {
		return nil, false, err
	}
	if (st.Paused || now.Image == st.LastSet) && !force {
		return now, false, nil
	}
	if err := wallpaper.Set(now.Image); err != nil {
		return now, false, err
	}
	_, err = state.Update(func(s *state.State) {
		s.LastSet, s.LastTime = now.Image, at
	})
	return now, true, err
}

// SlotName is how a slot is called in lists: its label, else its start.
func SlotName(s *spec.Schedule, i int) string {
	slot := s.Slot[i]
	switch {
	case slot.Label != "":
		return slot.Label
	case slot.At != "":
		return slot.At
	case len(slot.Days) > 0 && len(slot.Days) < 7:
		return days(slot.Days)
	}
	return fmt.Sprintf("slot %d", i+1)
}

// days names a set of weekdays: "weekdays", "weekend", "mon, wed".
func days(d []string) string {
	set := strings.Join(d, ",")
	switch set {
	case "mon,tue,wed,thu,fri":
		return "weekdays"
	case "sat,sun":
		return "weekend"
	}
	return strings.Join(d, ", ")
}

// Kind is the pack's template, as the site names it.
func Kind(s *spec.Schedule) string {
	switch {
	case len(s.Slot) == 1 && spec.Every(s.Slot[0].Rotate) > 0:
		return "Album"
	case func() bool {
		for _, sl := range s.Slot {
			if len(sl.Days) > 0 {
				return true
			}
		}
		return false
	}():
		return "Weekpack"
	}
	return "Daypack"
}
