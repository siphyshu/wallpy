package app

import (
	"bytes"
	"errors"
	"testing"
	"time"

	"github.com/charmbracelet/x/ansi"

	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func TestExplain(t *testing.T) {
	var buf bytes.Buffer
	p := ui.New(&buf, ui.Look{Theme: ui.ThemeFor(true), Now: time.Now(), Sun: ui.FallbackSun})
	for _, c := range []struct{ err, msg, fix string }{
		{"unknown command \"complet\" for \"wallpy\"\n\nDid you mean this?\n\tcompletion\n",
			`wallpy has no "complet" command.`, "Did you mean wallpy completion?"},
		{`unknown command "xyzzy" for "wallpy"`, `wallpy has no "xyzzy" command.`, "Run wallpy --help to see what's available."},
		{"unknown flag: --nope", "Unknown flag: --nope.", "Run wallpy --help to see what's available."},
		{"couldn't reach wallpy.siphyshu.me", "Couldn't reach wallpy.siphyshu.me.", ""},
	} {
		msg, fix := explain(p, errors.New(c.err))
		fix = ansi.Strip(fix)
		if msg != c.msg || fix != c.fix {
			t.Errorf("%q: got (%q, %q), want (%q, %q)", c.err, msg, fix, c.msg, c.fix)
		}
	}
}

func TestParseWhen(t *testing.T) {
	now := time.Date(2026, 10, 17, 9, 30, 0, 0, time.Local)
	for in, want := range map[string]string{
		"":                 "2026-10-17 09:30",
		"18:45":            "2026-10-17 18:45",
		"2026-12-24 08:00": "2026-12-24 08:00",
		"2026-12-24":       "2026-12-24 00:00",
	} {
		got, err := parseWhen(in, now)
		if err != nil || got.Format("2006-01-02 15:04") != want {
			t.Errorf("%q: %v %v", in, got, err)
		}
	}
	if _, err := parseWhen("teatime", now); err == nil {
		t.Error("teatime parsed")
	}
}

func TestUntil(t *testing.T) {
	base := time.Date(2026, 10, 17, 9, 0, 0, 0, time.UTC)
	for d, want := range map[time.Duration]string{
		20 * time.Second:            "in under a minute",
		12 * time.Minute:            "in 12 min",
		2*time.Hour + 5*time.Minute: "in 2h 05m",
		50 * time.Hour:              "in 2 days",
	} {
		if got := until(base, base.Add(d)); got != want {
			t.Errorf("%v: %q, want %q", d, got, want)
		}
	}
}
