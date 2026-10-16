// Package app is the wallpy command: Cobra commands, run through Fang, drawn
// with internal/ui. Commands do their work through the other internal
// packages and only decide what to say.
package app

import (
	"context"
	"fmt"
	"image/color"
	"io"
	"os"
	"regexp"
	"strings"
	"time"
	"unicode"

	"charm.land/fang/v2"
	"charm.land/lipgloss/v2"
	"github.com/spf13/cobra"

	"github.com/siphyshu/wallpy/cli/internal/ui"
)

const tagline = "Dynamic wallpapers for your desktop."

// Execute runs the CLI. version is set at release time ("" in development).
func Execute(ctx context.Context, version string) error {
	opts := []fang.Option{
		fang.WithColorSchemeFunc(colorScheme),
		fang.WithErrorHandler(handleError),
		fang.WithNotifySignal(os.Interrupt),
	}
	if version != "" {
		opts = append(opts, fang.WithVersion(version))
	}
	return fang.Execute(ctx, newRoot(version), opts...)
}

func newRoot(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "wallpy",
		Short: tagline,
		Long:  tagline + "\n\nWallpaper packs that follow the sun, the week, or a schedule of their own.",
		RunE: func(cmd *cobra.Command, _ []string) error {
			welcome(ui.Stdout(), version)
			return nil
		},
	}
}

// welcome is `wallpy` on its own. Once packs can be installed it becomes
// the home screen (docs/ROADMAP.md).
func welcome(p *ui.Printer, version string) {
	if version == "" {
		version = "dev"
	}
	p.Blank()
	p.Raw(p.Strong("wallpy") + "  " + p.Faint(version))
	p.Raw(p.Muted(tagline))
	if p.Rich() {
		p.Blank()
		p.Raw(p.SkyStrip())
	}
	p.Blank()
	p.Hints([2]string{"wallpy --help", "commands and options"})
	p.Blank()
}

// colorScheme dresses Fang's help screens in the ui palette.
func colorScheme(c lipgloss.LightDarkFunc) fang.ColorScheme {
	light, dark := ui.ThemeFor(false), ui.ThemeFor(true)
	now := time.Now()
	phase := ui.FallbackSun.PhaseAt(now.Hour()*60 + now.Minute())
	return fang.ColorScheme{
		Base:           c(light.Text, dark.Text),
		Title:          c(light.Accent(phase), dark.Accent(phase)),
		Description:    c(light.Muted, dark.Muted),
		Codeblock:      c(light.Surface, dark.Surface),
		Program:        c(light.Text, dark.Text),
		Command:        c(light.Accent(phase), dark.Accent(phase)),
		Flag:           c(light.Text, dark.Text),
		FlagDefault:    c(light.Faint, dark.Faint),
		Argument:       c(light.Muted, dark.Muted),
		DimmedArgument: c(light.Faint, dark.Faint),
		Comment:        c(light.Faint, dark.Faint),
		QuotedString:   c(light.Notice, dark.Notice),
		Help:           c(light.Muted, dark.Muted),
		Dash:           c(light.Faint, dark.Faint),
		ErrorHeader:    [2]color.Color{c(light.Surface, dark.Surface), c(light.Error, dark.Error)},
		ErrorDetails:   c(light.Error, dark.Error),
	}
}

// handleError prints a failed command in the CLI's own voice. Fang passes a
// writer it has already wrapped; we print to stderr through ui instead, so
// errors look like every other message.
func handleError(_ io.Writer, _ fang.Styles, err error) {
	p := ui.New(os.Stderr, ui.Look{Theme: ui.ThemeFor(ui.DetectDark()), Now: time.Now(), Sun: ui.FallbackSun})
	msg, fix := explain(p, err)
	p.Blank()
	p.Fail(msg, fix)
	p.Blank()
}

// explain turns an error into a sentence and, for mistakes in the command
// line itself, a pointer to what would work.
func explain(p *ui.Printer, err error) (msg, fix string) {
	text := err.Error()
	help := p.Muted("Run ") + p.Code("wallpy --help") + p.Muted(" to see what's available.")

	// Cobra: `unknown command "x" for "wallpy"`, then maybe
	// "\n\nDid you mean this?\n\tdownload\n".
	if m := unknownCommand.FindStringSubmatch(text); m != nil {
		var suggestions []string
		if _, after, ok := strings.Cut(text, "Did you mean this?"); ok {
			suggestions = strings.Fields(after)
		}
		msg = fmt.Sprintf("wallpy has no %q command.", m[1])
		if len(suggestions) > 0 {
			return msg, p.Muted("Did you mean ") + p.Code("wallpy "+suggestions[0]) + p.Muted("?")
		}
		return msg, help
	}
	for _, prefix := range []string{"unknown flag", "unknown shorthand flag", "flag needs an argument",
		"invalid argument", "accepts ", "requires "} {
		if strings.HasPrefix(text, prefix) {
			return sentence(text), help
		}
	}
	return sentence(text), ""
}

var unknownCommand = regexp.MustCompile(`^unknown command "([^"]*)"`)

func sentence(s string) string {
	r := []rune(strings.TrimSpace(s))
	if len(r) > 0 {
		r[0] = unicode.ToUpper(r[0])
	}
	return strings.TrimSuffix(string(r), ".") + "."
}
