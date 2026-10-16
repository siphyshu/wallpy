package ui

import (
	"fmt"
	"image"
	"strings"
)

// Picture draws an image in w×h terminal cells with half blocks: each "▀"
// shows two pixels, the top as its colour and the bottom as its
// background. It fills the box like a wallpaper does (cropping the
// edges), and works in any terminal with colour.
func Picture(img image.Image, w, h int) string {
	b := img.Bounds()
	if w <= 0 || h <= 0 || b.Empty() {
		return ""
	}
	// Crop to the box's shape (cells are about twice as tall as wide, and
	// each holds two pixels, so a cell is roughly square in pixels).
	srcW, srcH := float64(b.Dx()), float64(b.Dy())
	boxW, boxH := float64(w), float64(h*2)
	scale := max(boxW/srcW, boxH/srcH)
	cropW, cropH := boxW/scale, boxH/scale
	x0 := float64(b.Min.X) + (srcW-cropW)/2
	y0 := float64(b.Min.Y) + (srcH-cropH)/2

	// Average a few samples per pixel: smooth, and fast even for big photos.
	const samples = 3
	px := func(tx, ty int) (r, g, bl uint32) {
		var sr, sg, sb uint32
		for sy := range samples {
			for sx := range samples {
				x := int(x0 + (float64(tx)+(float64(sx)+.5)/samples)*cropW/boxW)
				y := int(y0 + (float64(ty)+(float64(sy)+.5)/samples)*cropH/boxH)
				cr, cg, cb, _ := img.At(x, y).RGBA()
				sr, sg, sb = sr+cr>>8, sg+cg>>8, sb+cb>>8
			}
		}
		n := uint32(samples * samples)
		return sr / n, sg / n, sb / n
	}

	var out strings.Builder
	for row := range h {
		for col := range w {
			tr, tg, tb := px(col, row*2)
			br, bg, bb := px(col, row*2+1)
			fmt.Fprintf(&out, "\x1b[38;2;%d;%d;%dm\x1b[48;2;%d;%d;%dm▀", tr, tg, tb, br, bg, bb)
		}
		out.WriteString("\x1b[0m")
		if row < h-1 {
			out.WriteByte('\n')
		}
	}
	return out.String()
}
