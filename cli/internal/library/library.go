// Package library is the packs installed on this computer.
//
//	<home>/packs/<slug>/schedule.toml   the spec's pack layout
//	<home>/packs/<slug>/images/…
//	<home>/packs/<slug>/wallpy.json     where it came from (Installed)
package library

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/remote"
)

// Home is where Wallpy keeps its data: WALLPY_HOME if set, else the
// platform's place for application data.
func Home() (string, error) {
	if h := os.Getenv("WALLPY_HOME"); h != "" {
		return h, nil
	}
	switch runtime.GOOS {
	case "darwin":
		dir, err := os.UserHomeDir()
		return filepath.Join(dir, "Library", "Application Support", "Wallpy"), err
	case "windows":
		if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
			return filepath.Join(dir, "Wallpy"), nil
		}
		dir, err := os.UserConfigDir()
		return filepath.Join(dir, "Wallpy"), err
	default: // XDG
		if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
			return filepath.Join(dir, "wallpy"), nil
		}
		dir, err := os.UserHomeDir()
		return filepath.Join(dir, ".local", "share", "wallpy"), err
	}
}

// Library is the packs folder.
type Library struct{ Dir string }

// Open is the library in Home, created if needed.
func Open() (*Library, error) {
	home, err := Home()
	if err != nil {
		return nil, fmt.Errorf("can't find a folder for Wallpy's data: %w", err)
	}
	dir := filepath.Join(home, "packs")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Library{Dir: dir}, nil
}

// Installed is wallpy.json: the manifest a pack was installed from.
type Installed struct {
	Source      string          `json:"source"` // site origin
	InstalledAt time.Time       `json:"installedAt"`
	Manifest    remote.Manifest `json:"manifest"`
}

// Pack is one installed pack.
type Pack struct {
	Slug string
	Dir  string
	Info *Installed // nil for packs not from the site
}

const infoFile = "wallpy.json"

// Get is the installed pack with this slug, or fs.ErrNotExist.
func (l *Library) Get(slug string) (*Pack, error) {
	dir := filepath.Join(l.Dir, slug)
	if _, err := os.Stat(filepath.Join(dir, "schedule.toml")); err != nil {
		return nil, err
	}
	p := &Pack{Slug: slug, Dir: dir}
	data, err := os.ReadFile(filepath.Join(dir, infoFile))
	if err == nil {
		var info Installed
		if err := json.Unmarshal(data, &info); err == nil {
			p.Info = &info
		}
	} else if !errors.Is(err, fs.ErrNotExist) {
		return nil, err
	}
	return p, nil
}

// List is every installed pack, by slug.
func (l *Library) List() ([]*Pack, error) {
	entries, err := os.ReadDir(l.Dir)
	if err != nil {
		return nil, err
	}
	var packs []*Pack
	for _, e := range entries {
		if !e.IsDir() || e.Name()[0] == '.' {
			continue
		}
		if p, err := l.Get(e.Name()); err == nil {
			packs = append(packs, p)
		}
	}
	sort.Slice(packs, func(i, j int) bool { return packs[i].Slug < packs[j].Slug })
	return packs, nil
}
