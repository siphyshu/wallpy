package ui

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"image"
	"image/jpeg"
	"os"
	"strings"
	"time"

	"github.com/charmbracelet/colorprofile"
	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/ansi/iterm2"
	"github.com/charmbracelet/x/ansi/kitty"
	"github.com/charmbracelet/x/ansi/sixel"
	"github.com/charmbracelet/x/term"
	"golang.org/x/image/draw"
)

// Graphics is how this terminal can show pictures.
type Graphics int

const (
	Blocks Graphics = iota // half blocks: two pixels per cell, any colour terminal
	Kitty                  // Kitty graphics with Unicode placeholders: real pixels, part of the text
	ITerm2                 // iTerm2 inline images: real pixels, painted over the text
	Sixel                  // Sixel: real pixels, painted over the text
)

// Overlay reports whether pictures are painted over the text grid rather
// than living in it, so a full-screen app has to place them itself.
func (g Graphics) Overlay() bool { return g == ITerm2 || g == Sixel }

// DetectGraphics picks the best way to show pictures here, from what the
// terminal says it is. tmux hides the terminal, so it gets blocks.
// WALLPY_IMAGES=kitty, iterm2, sixel or blocks overrides.
func DetectGraphics() Graphics {
	switch os.Getenv("WALLPY_IMAGES") {
	case "kitty":
		return Kitty
	case "iterm2":
		return ITerm2
	case "sixel":
		return Sixel
	case "blocks":
		return Blocks
	}
	env := os.Getenv
	switch {
	case env("TMUX") != "":
		return Blocks
	case env("TERM_PROGRAM") == "ghostty" || env("TERM") == "xterm-kitty" || env("KITTY_WINDOW_ID") != "":
		return Kitty
	case env("TERM_PROGRAM") == "iTerm.app" || env("LC_TERMINAL") == "iTerm2" || env("TERM_PROGRAM") == "WezTerm":
		return ITerm2
	case strings.HasPrefix(env("TERM"), "foot") || env("TERM") == "mlterm" || env("WT_SESSION") != "" || env("KONSOLE_VERSION") != "":
		return Sixel // foot, mlterm, Windows Terminal, Konsole
	}
	return Blocks
}

// fill crops img to the shape of a w×h pixel box (like a wallpaper on a
// screen of that shape) and resamples it to exactly that size.
func fill(img image.Image, w, h int) *image.RGBA {
	b := img.Bounds()
	scale := max(float64(w)/float64(b.Dx()), float64(h)/float64(b.Dy()))
	cw, ch := int(float64(w)/scale), int(float64(h)/scale)
	crop := image.Rect(0, 0, cw, ch).Add(b.Min).Add(image.Pt((b.Dx()-cw)/2, (b.Dy()-ch)/2))
	out := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.CatmullRom.Scale(out, out.Bounds(), img, crop, draw.Src, nil)
	return out
}

// Picture draws an image in w×h cells with half blocks: each "▀" shows two
// pixels, the top as its colour and the bottom as its background.
func Picture(img image.Image, w, h int) string {
	if w <= 0 || h <= 0 || img.Bounds().Empty() {
		return ""
	}
	px := fill(img, w, h*2) // a cell holds two roughly square pixels
	var out strings.Builder
	for row := range h {
		for col := range w {
			t := px.RGBAAt(col, row*2)
			b := px.RGBAAt(col, row*2+1)
			fmt.Fprintf(&out, "\x1b[38;2;%d;%d;%dm\x1b[48;2;%d;%d;%dm▀", t.R, t.G, t.B, b.R, b.G, b.B)
		}
		out.WriteString("\x1b[0m")
		if row < h-1 {
			out.WriteByte('\n')
		}
	}
	return out.String()
}

// KittyImage is the escape sequence that sends img to the terminal as image
// `id`, to be shown in a cols×rows box of placeholder cells (KittyCells).
// The picture is cropped to the box's shape and kept to a sensible size.
func KittyImage(img image.Image, id, cols, rows int) (string, error) {
	w := min(cols*10, 1600) // about 10 pixels per cell across, 20 down
	h := w * rows * 2 / cols
	var buf bytes.Buffer
	err := kitty.EncodeGraphics(&buf, fill(img, w, h), &kitty.Options{
		Action:           kitty.TransmitAndPut,
		Transmission:     kitty.Direct,
		Format:           kitty.PNG,
		ID:               id,
		Columns:          cols,
		Rows:             rows,
		VirtualPlacement: true, // shown wherever its placeholder cells are
		Quiet:            2,    // no replies to parse
		Chunk:            true,
	})
	return buf.String(), err
}

// KittyCells is the text that shows image `id` (sent by KittyImage): a
// cols×rows block of placeholder characters. Their colour carries the
// image ID; diacritics on each row's first cell carry its row and column.
func KittyCells(id, cols, rows int) string {
	color := fmt.Sprintf("\x1b[38;2;%d;%d;%dm", id>>16&0xff, id>>8&0xff, id&0xff)
	rest := strings.Repeat(string(kitty.Placeholder), cols-1)
	var out strings.Builder
	for r := range rows {
		out.WriteString(color)
		out.WriteRune(kitty.Placeholder)
		out.WriteRune(kitty.Diacritic(r))
		out.WriteRune(kitty.Diacritic(0))
		out.WriteString(rest)
		out.WriteString("\x1b[39m")
		if r < rows-1 {
			out.WriteByte('\n')
		}
	}
	return out.String()
}

// KittyForget is the escape sequence that frees image `id` in the terminal.
func KittyForget(id int) string {
	return ansi.KittyGraphics(nil, "a=d", "d=I", fmt.Sprintf("i=%d", id), "q=2")
}

// PrintImage prints a picture w×h cells big at the margin, for printed
// output (not a Bubble Tea screen): the real image in terminals that can
// show one, half blocks in other colour terminals, nothing when the output
// isn't a colour terminal (it returns false). Images stay in the
// terminal's scrollback, so they aren't freed.
func (p *Printer) PrintImage(img image.Image, w, h int) bool {
	if img == nil || !p.Rich() {
		return false
	}
	switch g := DetectGraphics(); {
	case g == Kitty && p.w.Profile == colorprofile.TrueColor: // the image ID rides on a 24-bit colour
		id := int(time.Now().UnixNano()&0x7fffff) | 1<<23
		if seq, err := KittyImage(img, id, w, h); err == nil {
			fmt.Fprint(p.w, seq)
			p.line(KittyCells(id, w, h))
			return true
		}
	case g.Overlay():
		if seq, err := OverlayImage(g, img, w, h); err == nil {
			fmt.Fprint(p.w, ReserveAndPaint(seq, len(margin), h))
			return true
		}
	}
	p.line(Picture(img, w, h))
	return true
}

// ReserveAndPaint paints an overlay image (iTerm2, Sixel) below the cursor
// without depending on where the terminal leaves the cursor afterwards
// (terminals differ): make room with h new lines, go back up, paint with
// the cursor saved and restored, then step down past the picture.
func ReserveAndPaint(seq string, col, h int) string {
	return strings.Repeat("\n", h) + ansi.CursorUp(h) + ansi.CursorHorizontalAbsolute(col+1) +
		ansi.SaveCursor + seq + ansi.RestoreCursor + ansi.CursorDown(h) + "\r"
}

// Width is the terminal's width in cells (80 if it can't tell).
func Width() int {
	if w, _, err := term.GetSize(os.Stdout.Fd()); err == nil && w > 0 {
		return w
	}
	return 80
}

// OverlayImage is the escape sequence that paints img over a cols×rows box
// of cells at the cursor, with ITerm2 or Sixel.
func OverlayImage(g Graphics, img image.Image, cols, rows int) (string, error) {
	cw, ch := CellPixels()
	px := fill(img, cols*cw, rows*ch)
	switch g {
	case ITerm2:
		var data bytes.Buffer
		if err := jpeg.Encode(&data, px, &jpeg.Options{Quality: 90}); err != nil {
			return "", err
		}
		return ansi.ITerm2(iterm2.File{
			Inline: true, Width: iterm2.Cells(cols), Height: iterm2.Cells(rows), IgnoreAspectRatio: true,
			Size: int64(data.Len()), Content: []byte(base64.StdEncoding.EncodeToString(data.Bytes())),
		}), nil
	case Sixel:
		var data bytes.Buffer
		if err := (&sixel.Encoder{}).Encode(&data, px); err != nil {
			return "", err
		}
		return ansi.SixelGraphics(0, 1, 0, data.Bytes()), nil
	}
	return "", fmt.Errorf("not an overlay protocol")
}
