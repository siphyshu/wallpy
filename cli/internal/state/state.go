// Package state is Wallpy's settings and memory: which pack is active,
// where the user is, whether changes are paused, and what was last set.
// One small JSON file in library.Home(), shared by commands and the
// background agent; every write replaces it atomically.
package state

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/spec"
)

// Place is the user's location, for solar events.
type Place struct {
	Name string `json:"name"` // "Berlin, Germany", for display
	spec.Location
}

// State is state.json.
type State struct {
	Active   string    `json:"active,omitempty"` // slug
	Place    *Place    `json:"place,omitempty"`
	Paused   bool      `json:"paused,omitempty"`
	LastSet  string    `json:"lastSet,omitempty"` // image path last made the wallpaper
	LastTime time.Time `json:"lastTime,omitzero"`
	Welcomed bool      `json:"welcomed,omitempty"` // the first-run setup has been offered
}

// Location is the spec location, or nil when none is set.
func (s *State) Location() *spec.Location {
	if s.Place == nil {
		return nil
	}
	return &s.Place.Location
}

func path() (string, error) {
	home, err := library.Home()
	return filepath.Join(home, "state.json"), err
}

// Load reads the state; a missing file is an empty state.
func Load() (*State, error) {
	p, err := path()
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(p)
	if errors.Is(err, fs.ErrNotExist) {
		return &State{}, nil
	}
	if err != nil {
		return nil, err
	}
	var s State
	if err := json.Unmarshal(data, &s); err != nil {
		return &State{}, nil // unreadable: start fresh rather than fail every command
	}
	return &s, nil
}

// Modified is when the state was last saved (zero if never).
func Modified() time.Time {
	p, err := path()
	if err != nil {
		return time.Time{}
	}
	info, err := os.Stat(p)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}

// Save writes the state atomically.
func (s *State) Save() error {
	p, err := path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	data, _ := json.MarshalIndent(s, "", "  ")
	tmp := fmt.Sprintf("%s.%d.tmp", p, os.Getpid()) // the agent and a command may save at once
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, p)
}

// Update loads, changes and saves the state.
func Update(change func(*State)) (*State, error) {
	s, err := Load()
	if err != nil {
		return nil, err
	}
	change(s)
	return s, s.Save()
}
