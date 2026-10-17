// Package update notices new releases of wallpy: at most one check a day,
// in the background, against GitHub's latest release. The result is kept
// in state.json, so a command never waits on the network.
package update

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	"golang.org/x/mod/semver"

	"github.com/siphyshu/wallpy/cli/internal/state"
)

// LatestURL is where the newest release is published. Tests replace it.
var LatestURL = "https://api.github.com/repos/siphyshu/wallpy/releases/latest"

// ReleasesURL is the page people download releases from.
const ReleasesURL = "https://github.com/siphyshu/wallpy/releases/latest"

// Every is how often to look.
const Every = 24 * time.Hour

// Refresh checks for a new release if the last check is older than a day,
// saving what it finds. It returns a channel closed when done.
func Refresh(ctx context.Context, current string) <-chan struct{} {
	done := make(chan struct{})
	st, err := state.Load()
	if err != nil || time.Since(st.UpdateChecked) < Every {
		close(done)
		return done
	}
	go func() {
		defer close(done)
		latest, err := fetch(ctx, current)
		if ctx.Err() != nil {
			return // interrupted: try again next time
		}
		// Any answer counts as today's look, even a failure (offline, or no
		// release yet), so a broken network never means a request per command.
		state.Update(func(s *state.State) {
			s.UpdateChecked = time.Now()
			if err == nil {
				s.UpdateLatest = latest
			}
		})
	}()
	return done
}

func fetch(ctx context.Context, current string) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, LatestURL, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", fmt.Sprintf("wallpy/%s (%s/%s)", current, runtime.GOOS, runtime.GOARCH))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("%s", res.Status)
	}
	var release struct {
		Tag string `json:"tag_name"`
	}
	if err := json.NewDecoder(res.Body).Decode(&release); err != nil {
		return "", err
	}
	return strings.TrimPrefix(release.Tag, "v"), nil
}

// Newer is the latest known version when it's newer than current, else "".
func Newer(current string) string {
	st, err := state.Load()
	if err != nil || st.UpdateLatest == "" {
		return ""
	}
	if semver.Compare("v"+st.UpdateLatest, "v"+strings.TrimPrefix(current, "v")) > 0 {
		return st.UpdateLatest
	}
	return ""
}
