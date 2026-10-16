package ui

import (
	"bytes"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/charmbracelet/x/ansi"
)

func at(hour, minute int) time.Time { return time.Date(2026, 10, 17, hour, minute, 0, 0, time.UTC) }

func TestPhases(t *testing.T) {
	for _, c := range []struct {
		h, m int
		want Phase
	}{
		{0, 0, Night}, {4, 59, Night}, {5, 0, Dawn}, {6, 29, Dawn}, {6, 30, Day},
		{18, 29, Day}, {18, 30, Dusk}, {19, 29, Dusk}, {19, 30, Night}, {23, 59, Night},
	} {
		if got := FallbackSun.PhaseAt(c.h*60 + c.m); got != c.want {
			t.Errorf("%02d:%02d: got %s, want %s", c.h, c.m, got, c.want)
		}
	}
}

// printer writes to a buffer, which colorprofile treats as "not a terminal".
func printer(now time.Time) (*Printer, *bytes.Buffer) {
	var buf bytes.Buffer
	return New(&buf, Look{Theme: ThemeFor(true), Now: now, Sun: FallbackSun}), &buf
}

func TestPlainWhenNotATerminal(t *testing.T) {
	p, buf := printer(at(10, 24))
	p.Success("Installed")
	p.Fail("No such pack", p.Muted("Check the name"))
	p.Hints([2]string{"wallpy --help", "commands"})
	if strings.Contains(buf.String(), "\x1b[") {
		t.Errorf("escape codes in plain output: %q", buf.String())
	}
	if p.Rich() || p.Styled() {
		t.Error("a buffer reported as a colour terminal")
	}
	want := "  ✓ Installed\n  ✗ No such pack\n    Check the name\n  › wallpy --help   commands\n"
	if buf.String() != want {
		t.Errorf("got\n%s\nwant\n%s", buf.String(), want)
	}
}

func TestSkyStrip(t *testing.T) {
	for _, c := range []struct {
		now    time.Time
		marker string
	}{
		{at(10, 24), strings.Repeat(" ", 20) + "▲ 10:24  day"},
		{at(0, 0), "▲ 00:00  night"},
		{at(23, 50), strings.Repeat(" ", 47-len("23:50  night")-1) + "23:50  night ▲"},
	} {
		p, _ := printer(c.now)
		lines := strings.Split(ansi.Strip(p.SkyStrip()), "\n")
		if len(lines) != 3 {
			t.Fatalf("%d lines", len(lines))
		}
		if n := utf8.RuneCountInString(lines[0]); n != StripWidth {
			t.Errorf("bar is %d cells", n)
		}
		if lines[1] != c.marker {
			t.Errorf("%s: marker %q, want %q", c.now.Format("15:04"), lines[1], c.marker)
		}
		if lines[2] != "00          06          12          18        24" {
			t.Errorf("axis %q", lines[2])
		}
	}
}

func TestSkyBlendsAndSurvivesThePolarCircle(t *testing.T) {
	if FallbackSun.skyAt(12*60) != skyPaint[Day] || FallbackSun.skyAt(2*60) != skyPaint[Night] {
		t.Error("solid phases aren't solid")
	}
	// Tromsø in June: dawn and dusk crowd around midnight; frames overlap.
	crowded := Sun{Dawn: 0, Sunrise: 30, Sunset: 1420, Dusk: 1439}
	for m := range 24 * 60 {
		crowded.skyAt(m)
	}
}
