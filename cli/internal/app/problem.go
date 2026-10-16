package app

import (
	"context"
	"errors"
	"fmt"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

// problem is a failure explained for people: what went wrong, and what to
// do about it. Commands return these; handleError prints them.
type problem struct {
	msg string
	fix func(p *ui.Printer) string // nil when there's nothing to suggest
	err error                      // the cause, for errors.Is
}

func (e *problem) Error() string { return e.msg }
func (e *problem) Unwrap() error { return e.err }

// Fixes, composed in the design system.
func say(text string) func(*ui.Printer) string {
	return func(p *ui.Printer) string { return p.Muted(text) }
}

func run(before, cmd, after string) func(*ui.Printer) string {
	return func(p *ui.Printer) string { return p.Muted(before) + p.Code(cmd) + p.Muted(after) }
}

// explainNetwork turns what can go wrong talking to the site into problems.
func explainNetwork(c *remote.Client, slug string, err error) error {
	var unreachable *remote.Unreachable
	var checksum *library.ErrChecksum
	switch {
	case errors.Is(err, context.Canceled):
		return &problem{msg: "Stopped. Nothing was installed.", err: err}
	case errors.Is(err, remote.ErrNotFound):
		return &problem{
			msg: fmt.Sprintf("There's no pack called %q on %s.", slug, c.Host()),
			fix: run("Find one at ", c.Site+"/gallery", "."), err: err,
		}
	case errors.As(err, &unreachable):
		return &problem{
			msg: fmt.Sprintf("Couldn't reach %s.", unreachable.Host),
			fix: say("Check your connection. Packs you've installed keep working offline."), err: err,
		}
	case errors.As(err, &checksum):
		return &problem{
			msg: sentence(checksum.Error()),
			fix: say("Try again. If it keeps happening, the download is being altered on the way."), err: err,
		}
	}
	return err
}
