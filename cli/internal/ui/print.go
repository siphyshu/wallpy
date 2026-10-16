package ui

import (
	"fmt"
	"image/color"
	"io"
	"os"
	"strings"
	"time"

	"charm.land/lipgloss/v2"
	"github.com/charmbracelet/colorprofile"
)

// Symbols. One meaning each, used nowhere else.
const (
	SymSuccess = "✓"
	SymError   = "✗"
	SymNotice  = "!"
	SymHint    = "›"
	SymNow     = "▲"
)

// margin is the left edge of everything the CLI prints.
const margin = "  "

// Printer writes styled output. Colour is reduced to what the destination
// supports, and removed entirely when it isn't a terminal or NO_COLOR is set.
type Printer struct {
	look Look
	w    *colorprofile.Writer
}

// New is a Printer for w. Pass the Look so tests can fix the time and theme.
func New(w io.Writer, look Look) *Printer {
	return &Printer{look: look, w: colorprofile.NewWriter(w, os.Environ())}
}

// Stdout is a Printer for the terminal, detecting its background.
func Stdout() *Printer {
	return New(os.Stdout, Look{Theme: ThemeFor(DetectDark()), Now: time.Now(), Sun: FallbackSun})
}

// Rich reports whether the destination shows enough colour for pictures
// (the sky strip). Plain text otherwise.
func (p *Printer) Rich() bool { return p.w.Profile >= colorprofile.ANSI256 }

// Styled reports whether the destination shows any colour or emphasis.
func (p *Printer) Styled() bool { return p.w.Profile >= colorprofile.ANSI }

func (p *Printer) line(s string) {
	if s == "" {
		fmt.Fprintln(p.w)
		return
	}
	for _, l := range strings.Split(s, "\n") {
		fmt.Fprintln(p.w, margin+l)
	}
}

// Blank prints an empty line. Screens start and end with one.
func (p *Printer) Blank() { p.line("") }

// Raw prints already-styled lines at the margin.
func (p *Printer) Raw(s string) { p.line(s) }

// Look is the palette and time this Printer draws with.
func (p *Printer) Look() Look { return p.look }

func (p *Printer) fg(c color.Color) lipgloss.Style { return lipgloss.NewStyle().Foreground(c) }

// Text styles, for composing a line from parts.
func (p *Printer) Strong(s string) string { return p.fg(p.look.Text).Bold(true).Render(s) }
func (p *Printer) Plain(s string) string  { return p.fg(p.look.Text).Render(s) }
func (p *Printer) Muted(s string) string  { return p.fg(p.look.Muted).Render(s) }
func (p *Printer) Faint(s string) string  { return p.fg(p.look.Faint).Render(s) }
func (p *Printer) Accent(s string) string { return p.fg(p.look.Sky()).Render(s) }
func (p *Printer) Code(s string) string   { return p.fg(p.look.Sky()).Render(s) }

// Heading is a section title: bold, with an optional muted note after it.
func (p *Printer) Heading(title, note string) {
	if note != "" {
		p.line(p.Strong(title) + "  " + p.Muted(note))
		return
	}
	p.line(p.Strong(title))
}

// Success reports something that worked.
func (p *Printer) Success(msg string) {
	p.line(p.fg(p.look.Success).Render(SymSuccess) + " " + p.Plain(msg))
}

// Notice is something to know that isn't a failure.
func (p *Printer) Notice(msg string) {
	p.line(p.fg(p.look.Notice).Render(SymNotice) + " " + p.Plain(msg))
}

// Fail reports what went wrong and, when there is one, what to do about
// it. fix is composed by the caller (Muted, with commands as Code).
func (p *Printer) Fail(msg, fix string) {
	p.line(p.fg(p.look.Error).Render(SymError) + " " + p.Plain(msg))
	if fix != "" {
		p.line("  " + fix)
	}
}

// Hints is a list of commands to try, their descriptions aligned.
func (p *Printer) Hints(pairs ...[2]string) {
	width := 0
	for _, h := range pairs {
		width = max(width, len([]rune(h[0])))
	}
	for _, h := range pairs {
		pad := strings.Repeat(" ", width-len([]rune(h[0]))+3)
		p.line(p.Faint(SymHint) + " " + p.Code(h[0]) + pad + p.Muted(h[1]))
	}
}
