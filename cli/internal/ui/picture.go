package ui

import (
	"bytes"
	"fmt"
	"image"
	"os"
	"strings"

	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/ansi/kitty"
	"golang.org/x/image/draw"
)

// Graphics is how this terminal can show pictures.
type Graphics int

const (
	Blocks Graphics = iota // half blocks: two pixels per cell, any colour terminal
	Kitty                  // the Kitty graphics protocol: real pixels
)

// DetectGraphics picks the best way to show pictures here. Kitty graphics
// need Unicode placeholders (so they live in the text and redraw with it),
// which Kitty and Ghostty support; tmux hides the terminal, so it gets
// blocks. WALLPY_IMAGES=kitty or blocks overrides.
func DetectGraphics() Graphics {
	switch os.Getenv("WALLPY_IMAGES") {
	case "kitty":
		return Kitty
	case "blocks":
		return Blocks
	}
	if os.Getenv("TMUX") != "" {
		return Blocks
	}
	if os.Getenv("TERM_PROGRAM") == "ghostty" || os.Getenv("TERM") == "xterm-kitty" || os.Getenv("KITTY_WINDOW_ID") != "" {
		return Kitty
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
