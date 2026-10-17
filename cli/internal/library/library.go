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
	"strings"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/spec"
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

// Schedule reads and validates the pack's schedule.toml against its images.
func (p *Pack) Schedule() (*spec.Schedule, error) {
	data, err := os.ReadFile(filepath.Join(p.Dir, "schedule.toml"))
	if err != nil {
		return nil, err
	}
	var files []string
	if entries, err := os.ReadDir(filepath.Join(p.Dir, "images")); err == nil {
		for _, e := range entries {
			if !e.IsDir() && e.Name()[0] != '.' {
				files = append(files, e.Name())
			}
		}
	}
	s, problems, err := spec.ParseTOML(data, files)
	if err != nil {
		return nil, fmt.Errorf("%s/schedule.toml: %w", p.Slug, err)
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("%s doesn't follow the pack spec: %s", p.Slug, problems[0])
	}
	return s, nil
}

// Image is the path of one of the pack's images.
func (p *Pack) Image(name string) string { return filepath.Join(p.Dir, "images", name) }

// Title is the pack's display name.
func (p *Pack) Title() string {
	if p.Info != nil && p.Info.Manifest.Title != "" {
		return p.Info.Manifest.Title
	}
	if s, err := p.Schedule(); err == nil {
		return s.Name
	}
	return p.Slug
}

// CheckFolder validates a pack folder on disk: schedule.toml and images/.
// problems lists what breaks the spec; err is for a folder that isn't a
// pack at all.
func CheckFolder(dir string) (s *spec.Schedule, files []string, problems []string, err error) {
	data, err := os.ReadFile(filepath.Join(dir, "schedule.toml"))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil, nil, fmt.Errorf("%s has no schedule.toml, so it isn't a pack", dir)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	entries, err := os.ReadDir(filepath.Join(dir, "images"))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil, nil, fmt.Errorf("%s has no images folder", dir)
	}
	if err != nil {
		return nil, nil, nil, err
	}
	for _, e := range entries {
		if !e.IsDir() && e.Name()[0] != '.' {
			files = append(files, e.Name())
		}
	}
	s, problems, err = spec.ParseTOML(data, files)
	if err != nil {
		return nil, files, nil, fmt.Errorf("schedule.toml isn't valid TOML: %w", err)
	}
	return s, files, problems, nil
}

// Import copies a valid pack folder into the library and returns it. Its
// slug comes from the pack's name.
func (l *Library) Import(dir string) (*Pack, error) {
	s, files, problems, err := CheckFolder(dir)
	if err != nil {
		return nil, err
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("the pack doesn't follow the spec: %s (wallpy check %s lists everything)", problems[0], dir)
	}
	slug := Slugify(s.Name)
	if existing, err := l.Get(slug); err == nil && existing.Info != nil {
		slug += "-local" // don't replace a pack from the site
	}
	tmp := filepath.Join(l.Dir, "."+slug+"-incoming")
	os.RemoveAll(tmp)
	if err := os.MkdirAll(filepath.Join(tmp, "images"), 0o755); err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmp)
	copyFile := func(src, dst string) error {
		data, err := os.ReadFile(src)
		if err != nil {
			return err
		}
		return os.WriteFile(dst, data, 0o644)
	}
	if err := copyFile(filepath.Join(dir, "schedule.toml"), filepath.Join(tmp, "schedule.toml")); err != nil {
		return nil, err
	}
	for _, f := range files {
		if err := copyFile(filepath.Join(dir, "images", f), filepath.Join(tmp, "images", f)); err != nil {
			return nil, err
		}
	}
	final := filepath.Join(l.Dir, slug)
	os.RemoveAll(final)
	if err := os.Rename(tmp, final); err != nil {
		return nil, err
	}
	return l.Get(slug)
}

// Slugify makes a pack name into a folder name: "Zelda Wind Waker" ->
// "zelda-wind-waker".
func Slugify(name string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' || r >= '0' && r <= '9' {
			b.WriteRune(r)
			dash = false
		} else if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	s := strings.TrimSuffix(b.String(), "-")
	if s == "" {
		s = "pack"
	}
	return s
}

// Remove deletes an installed pack.
func (l *Library) Remove(slug string) error {
	if _, err := l.Get(slug); err != nil {
		return err
	}
	// Move aside first so a half-deleted pack never looks installed.
	aside := filepath.Join(l.Dir, "."+slug+"-removing-"+randomSuffix())
	if err := os.Rename(filepath.Join(l.Dir, slug), aside); err != nil {
		return err
	}
	return os.RemoveAll(aside)
}

// Size is the bytes a pack's images take on disk.
func (p *Pack) Size() int64 {
	var n int64
	entries, _ := os.ReadDir(filepath.Join(p.Dir, "images"))
	for _, e := range entries {
		if info, err := e.Info(); err == nil {
			n += info.Size()
		}
	}
	return n
}

// GalleryURL is the pack's page on the site it came from ("" for local packs).
func (p *Pack) GalleryURL() string {
	if p.Info == nil || p.Info.Source == "" {
		return ""
	}
	return p.Info.Source + "/packs/" + p.Slug
}
