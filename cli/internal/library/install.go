package library

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/BurntSushi/toml"
	"golang.org/x/sync/errgroup"

	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/spec"
)

// Progress receives bytes as they're verified. Safe to call from several
// goroutines; implementations must be too.
type Progress func(done, total int64)

// parallel is how many files download at once.
const parallel = 4

// Install downloads a pack from its manifest and installs it, replacing any
// installed version. Nothing changes on disk unless every file arrives with
// the right size and SHA-256 and the schedule passes the spec.
func (l *Library) Install(ctx context.Context, c *remote.Client, m *remote.Manifest, progress Progress) (*Pack, error) {
	// The schedule must be valid and name exactly the pack's files. The spec's
	// image names have no "/" or "..", so no path can leave the pack folder.
	paths := make([]string, len(m.Files))
	for i, f := range m.Files {
		paths[i] = f.Path
	}
	schedule, problems, err := spec.ParseJSON(m.Schedule, paths)
	if err != nil {
		return nil, fmt.Errorf("the pack's schedule can't be read: %w", err)
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("the pack's schedule breaks the spec: %s", problems[0])
	}
	if !slugOK(m.Slug) {
		return nil, fmt.Errorf("the site sent an invalid pack name %q", m.Slug)
	}

	tmp := filepath.Join(l.Dir, "."+m.Slug+"-incoming-"+randomSuffix())
	if err := os.MkdirAll(filepath.Join(tmp, "images"), 0o755); err != nil {
		return nil, err
	}
	installed := false
	defer func() {
		if !installed {
			os.RemoveAll(tmp)
		}
	}()

	// Files the installed version already has (same hash) are copied, not downloaded.
	have := map[string]string{}
	if old, err := l.Get(m.Slug); err == nil && old.Info != nil {
		for _, f := range old.Info.Manifest.Files {
			have[f.SHA256] = filepath.Join(old.Dir, "images", f.Path)
		}
	}

	total := m.Size()
	var done atomic.Int64
	report := func(n int64) {
		if progress != nil {
			progress(done.Add(n), total)
		}
	}
	report(0)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(parallel)
	for _, f := range m.Files {
		g.Go(func() error {
			dest := filepath.Join(tmp, "images", f.Path)
			if src, ok := have[f.SHA256]; ok {
				if err := copyVerified(src, dest, f, report); err == nil {
					return nil
				}
			}
			body, err := c.Open(gctx, f)
			if err != nil {
				return err
			}
			defer body.Close()
			return writeVerified(body, dest, f, report)
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := encodeSchedule(&buf, schedule); err != nil {
		return nil, err
	}
	if err := os.WriteFile(filepath.Join(tmp, "schedule.toml"), buf.Bytes(), 0o644); err != nil {
		return nil, err
	}
	info, _ := json.MarshalIndent(Installed{Source: c.Site, InstalledAt: time.Now().UTC(), Manifest: *m}, "", "  ")
	if err := os.WriteFile(filepath.Join(tmp, infoFile), info, 0o644); err != nil {
		return nil, err
	}

	// Swap in: the old version moves aside, the new one takes its name.
	final := filepath.Join(l.Dir, m.Slug)
	aside := filepath.Join(l.Dir, "."+m.Slug+"-old-"+randomSuffix())
	if _, err := os.Stat(final); err == nil {
		if err := os.Rename(final, aside); err != nil {
			return nil, err
		}
	}
	if err := os.Rename(tmp, final); err != nil {
		os.Rename(aside, final) // put the old version back
		return nil, err
	}
	installed = true
	os.RemoveAll(aside)
	return l.Get(m.Slug)
}

// ErrChecksum means a file's bytes weren't what the manifest promised.
type ErrChecksum struct{ Path string }

func (e *ErrChecksum) Error() string {
	return fmt.Sprintf("%s didn't match its checksum, so nothing was installed", e.Path)
}

// writeVerified streams r into dest, failing unless it is exactly f.Size
// bytes with hash f.SHA256.
func writeVerified(r io.Reader, dest string, f remote.File, report func(int64)) error {
	out, err := os.Create(dest)
	if err != nil {
		return err
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(out, h, reporter(report)), io.LimitReader(r, f.Size+1))
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("downloading %s: %w", f.Path, err)
	}
	if n != f.Size || hex.EncodeToString(h.Sum(nil)) != f.SHA256 {
		return &ErrChecksum{Path: f.Path}
	}
	return nil
}

func copyVerified(src, dest string, f remote.File, report func(int64)) error {
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	var counted int64
	err = writeVerified(in, dest, f, func(n int64) { counted += n; report(n) })
	if err != nil {
		report(-counted) // it'll be downloaded instead
	}
	return err
}

type reporter func(int64)

func (r reporter) Write(p []byte) (int, error) {
	r(int64(len(p)))
	return len(p), nil
}

func encodeSchedule(w io.Writer, s *spec.Schedule) error {
	fmt.Fprintln(w, "# Wallpy pack schedule, spec 2: https://github.com/siphyshu/wallpy/tree/main/spec")
	enc := toml.NewEncoder(w)
	enc.Indent = "" // like spec/examples
	return enc.Encode(s)
}

func slugOK(s string) bool {
	if s == "" || len(s) > 100 {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '-') {
			return false
		}
	}
	return s[0] != '-'
}

func randomSuffix() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}
