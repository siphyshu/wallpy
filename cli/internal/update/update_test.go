package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/state"
)

func TestRefreshAndNewer(t *testing.T) {
	t.Setenv("WALLPY_HOME", t.TempDir())
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"tag_name":"v0.3.0"}`))
	}))
	defer srv.Close()
	LatestURL = srv.URL

	<-Refresh(context.Background(), "0.2.1")
	if got := Newer("0.2.1"); got != "0.3.0" {
		t.Errorf("Newer(0.2.1) = %q", got)
	}
	if got := Newer("0.3.0"); got != "" {
		t.Errorf("Newer(0.3.0) = %q, want nothing", got)
	}
	if got := Newer("0.10.0"); got != "" {
		t.Errorf("Newer(0.10.0) = %q: versions must compare as numbers", got)
	}
	<-Refresh(context.Background(), "0.2.1") // within a day: no second request
	if calls != 1 {
		t.Errorf("%d requests, want 1 a day", calls)
	}
	state.Update(func(s *state.State) { s.UpdateChecked = time.Now().Add(-25 * time.Hour) })
	<-Refresh(context.Background(), "0.2.1")
	if calls != 2 {
		t.Errorf("%d requests after a day, want 2", calls)
	}
}

func TestFailedCheckStillCountsForTheDay(t *testing.T) {
	t.Setenv("WALLPY_HOME", t.TempDir())
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		http.NotFound(w, r) // no release yet
	}))
	defer srv.Close()
	LatestURL = srv.URL
	<-Refresh(context.Background(), "0.1.0")
	<-Refresh(context.Background(), "0.1.0")
	if calls != 1 {
		t.Errorf("%d requests, want 1", calls)
	}
	if got := Newer("0.1.0"); got != "" {
		t.Errorf("Newer = %q after a failed check", got)
	}
}
