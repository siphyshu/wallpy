package library

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/spec"
)

// site is a fake Wallpy site serving one album pack.
type site struct {
	*httptest.Server
	blobs    map[string][]byte // sha256 -> bytes served
	manifest remote.Manifest
	hits     atomic.Int64 // blob requests
}

func newSite(t *testing.T, images map[string]string) *site {
	s := &site{blobs: map[string][]byte{}}
	var names []string
	for name, content := range images {
		sum := sha256.Sum256([]byte(content))
		hash := hex.EncodeToString(sum[:])
		s.blobs[hash] = []byte(content)
		s.manifest.Files = append(s.manifest.Files, remote.File{Path: name, SHA256: hash, Size: int64(len(content))})
		names = append(names, name)
	}
	schedule, _ := json.Marshal(map[string]any{"spec": 2, "name": "Test Album",
		"slot": []any{map[string]any{"images": names, "rotate": "every 1d"}}})
	s.manifest = remote.Manifest{Manifest: 1, Slug: "test-album", Version: 1, Title: "Test Album",
		Credit: remote.Credit{Name: "Tester"}, License: "cc0", Schedule: schedule, Files: s.manifest.Files}
	s.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/blobs/") {
			s.hits.Add(1)
			w.Write(s.blobs[strings.TrimPrefix(r.URL.Path, "/blobs/")])
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(s.Close)
	for i := range s.manifest.Files {
		s.manifest.Files[i].URL = s.URL + "/blobs/" + s.manifest.Files[i].SHA256
	}
	return s
}

func (s *site) client() *remote.Client {
	return &remote.Client{Site: s.URL, HTTP: s.Client(), UserAgent: "test"}
}

func newLibrary(t *testing.T) *Library {
	t.Setenv("WALLPY_HOME", t.TempDir())
	l, err := Open()
	if err != nil {
		t.Fatal(err)
	}
	return l
}

// leftovers are hidden working folders an install should never leave behind.
func leftovers(t *testing.T, l *Library) []string {
	entries, _ := os.ReadDir(l.Dir)
	var out []string
	for _, e := range entries {
		if strings.HasPrefix(e.Name(), ".") {
			out = append(out, e.Name())
		}
	}
	return out
}

var images = map[string]string{"a.jpg": "first image", "b.jpg": "second image"}

func TestInstall(t *testing.T) {
	s, l := newSite(t, images), newLibrary(t)
	var mu sync.Mutex
	var last, total int64
	p, err := l.Install(context.Background(), s.client(), &s.manifest, func(d, t int64) {
		mu.Lock()
		defer mu.Unlock()
		last, total = max(last, d), t
	})
	if err != nil {
		t.Fatal(err)
	}
	if last != total || total != int64(len("first image")+len("second image")) {
		t.Errorf("progress ended at %d of %d", last, total)
	}
	for name, content := range images {
		got, _ := os.ReadFile(filepath.Join(p.Dir, "images", name))
		if string(got) != content {
			t.Errorf("%s: %q", name, got)
		}
	}
	// The schedule on disk is valid spec 2 that names exactly the images.
	data, _ := os.ReadFile(filepath.Join(p.Dir, "schedule.toml"))
	if _, problems, err := spec.ParseTOML(data, []string{"a.jpg", "b.jpg"}); err != nil || len(problems) > 0 {
		t.Errorf("schedule.toml: %v %v\n%s", err, problems, data)
	}
	if p.Info == nil || p.Info.Manifest.Version != 1 || p.Info.Source != s.URL {
		t.Errorf("wallpy.json: %+v", p.Info)
	}
	if packs, _ := l.List(); len(packs) != 1 || packs[0].Slug != "test-album" {
		t.Errorf("list: %v", packs)
	}
	if left := leftovers(t, l); len(left) > 0 {
		t.Errorf("left behind %v", left)
	}
}

func TestReinstallReusesVerifiedFiles(t *testing.T) {
	s, l := newSite(t, images), newLibrary(t)
	if _, err := l.Install(context.Background(), s.client(), &s.manifest, nil); err != nil {
		t.Fatal(err)
	}
	s.hits.Store(0)
	// Damage one installed file: it must be downloaded again, the other reused.
	p, _ := l.Get("test-album")
	os.WriteFile(filepath.Join(p.Dir, "images", "a.jpg"), []byte("damaged"), 0o644)
	if _, err := l.Install(context.Background(), s.client(), &s.manifest, nil); err != nil {
		t.Fatal(err)
	}
	if n := s.hits.Load(); n != 1 {
		t.Errorf("%d downloads, want 1 (only the damaged file)", n)
	}
	if got, _ := os.ReadFile(filepath.Join(p.Dir, "images", "a.jpg")); string(got) != "first image" {
		t.Errorf("a.jpg not repaired: %q", got)
	}
}

func TestBadChecksumInstallsNothing(t *testing.T) {
	s, l := newSite(t, images), newLibrary(t)
	if _, err := l.Install(context.Background(), s.client(), &s.manifest, nil); err != nil {
		t.Fatal(err)
	}
	// A new version whose b.jpg arrives tampered with.
	s.manifest.Version = 2
	for hash, content := range s.blobs {
		if string(content) == "second image" {
			s.blobs[hash] = []byte("second imagf")
		}
	}
	os.RemoveAll(filepath.Join(l.Dir, "test-album", "images", "b.jpg")) // force a download
	_, err := l.Install(context.Background(), s.client(), &s.manifest, nil)
	var checksum *ErrChecksum
	if !errors.As(err, &checksum) || checksum.Path != "b.jpg" {
		t.Fatalf("got %v, want a checksum error for b.jpg", err)
	}
	if p, _ := l.Get("test-album"); p == nil || p.Info.Manifest.Version != 1 {
		t.Error("the installed version was replaced")
	}
	if left := leftovers(t, l); len(left) > 0 {
		t.Errorf("left behind %v", left)
	}
}

func TestUnsafeManifestsAreRefused(t *testing.T) {
	for name, change := range map[string]func(m *remote.Manifest){
		"path traversal": func(m *remote.Manifest) {
			m.Files[0].Path = "../../escape.jpg"
			m.Schedule = json.RawMessage(`{"spec":2,"name":"x","slot":[{"images":["../../escape.jpg","b.jpg"]}]}`)
		},
		"file the schedule doesn't use": func(m *remote.Manifest) {
			m.Files = append(m.Files, remote.File{Path: "extra.jpg", SHA256: m.Files[0].SHA256, Size: m.Files[0].Size, URL: m.Files[0].URL})
		},
		"bad slug": func(m *remote.Manifest) { m.Slug = "../packs" },
	} {
		t.Run(name, func(t *testing.T) {
			s, l := newSite(t, map[string]string{"a.jpg": "x", "b.jpg": "y"}), newLibrary(t)
			m := s.manifest
			m.Files = append([]remote.File(nil), s.manifest.Files...)
			// Keep a.jpg first so the changes above hit a known file.
			if m.Files[0].Path != "a.jpg" {
				m.Files[0], m.Files[1] = m.Files[1], m.Files[0]
			}
			change(&m)
			if _, err := l.Install(context.Background(), s.client(), &m, nil); err == nil {
				t.Fatal("installed")
			}
			if n := s.hits.Load(); n != 0 {
				t.Errorf("downloaded %d files before refusing", n)
			}
			entries, _ := os.ReadDir(filepath.Dir(l.Dir))
			if len(entries) != 1 { // just packs/
				t.Errorf("wrote outside the library: %v", entries)
			}
		})
	}
}

func TestCancelledInstallLeavesNothing(t *testing.T) {
	s, l := newSite(t, images), newLibrary(t)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := l.Install(ctx, s.client(), &s.manifest, nil); !errors.Is(err, context.Canceled) {
		t.Fatalf("got %v", err)
	}
	if packs, _ := l.List(); len(packs) != 0 || len(leftovers(t, l)) != 0 {
		t.Error("a cancelled install left files")
	}
}
