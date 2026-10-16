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
