package ui

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"regexp"
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/ansi/kitty"
)

func photo(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.Set(x, y, color.RGBA{uint8(x), uint8(y), 128, 255})
		}
	}
	return img
}

func TestPictureSize(t *testing.T) {
	lines := strings.Split(Picture(photo(4000, 3000), 40, 12), "\n")
	if len(lines) != 12 {
		t.Fatalf("%d rows", len(lines))
	}
	for _, l := range lines {
		if w := ansi.StringWidth(l); w != 40 {
			t.Fatalf("row is %d cells", w)
		}
	}
}

// TestKittyImage checks the transmission against the protocol
// (sw.kovidgoyal.net/kitty/graphics-protocol): the first chunk carries the
// settings, every chunk but the last says m=1, and the payloads join into
// a PNG of the expected size.
func TestKittyImage(t *testing.T) {
	seq, err := KittyImage(photo(4000, 3000), 4242, 60, 18)
	if err != nil {
		t.Fatal(err)
	}
	chunks := regexp.MustCompile(`\x1b_G([^;]*);([^\x1b]*)\x1b\\`).FindAllStringSubmatch(seq, -1)
	if len(chunks) < 2 {
		t.Fatalf("%d chunks; a 600 px PNG should need several", len(chunks))
	}
	first := "," + chunks[0][1] + ","
	for _, want := range []string{"a=T", "f=100", "i=4242", "c=60", "r=18", "U=1", "q=2", "m=1"} {
		if !strings.Contains(first, ","+want+",") {
			t.Errorf("first chunk %q lacks %s", chunks[0][1], want)
		}
	}
	var data []byte
	for i, c := range chunks {
		last := i == len(chunks)-1
		if i > 0 && strings.Contains(c[1], "a=") {
			t.Errorf("chunk %d repeats settings: %q", i, c[1])
		}
		if wantM := map[bool]string{true: "m=0", false: "m=1"}[last]; !strings.Contains(c[1], wantM) {
			t.Errorf("chunk %d: %q, want %s", i, c[1], wantM)
		}
		if len(c[2]) > kitty.MaxChunkSize {
			t.Errorf("chunk %d is %d bytes", i, len(c[2]))
		}
		b, err := base64.StdEncoding.DecodeString(c[2])
		if err != nil {
			t.Fatalf("chunk %d: %v", i, err)
		}
		data = append(data, b...)
	}
	img, err := png.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if b := img.Bounds(); b.Dx() != 600 || b.Dy() != 360 {
		t.Errorf("sent %v, want 600x360 (10x20 px per cell)", b)
	}
}

func TestKittyCells(t *testing.T) {
	cells := KittyCells(0x01_02_03, 5, 3)
	rows := strings.Split(cells, "\n")
	if len(rows) != 3 {
		t.Fatalf("%d rows", len(rows))
	}
	for r, row := range rows {
		if !strings.HasPrefix(row, "\x1b[38;2;1;2;3m") {
			t.Errorf("row %d: image ID not in the colour: %q", r, row)
		}
		want := string(kitty.Placeholder) + string(kitty.Diacritic(r)) + string(kitty.Diacritic(0)) + strings.Repeat(string(kitty.Placeholder), 4)
		if !strings.Contains(row, want) {
			t.Errorf("row %d: placeholders %q", r, row)
		}
		if w := ansi.StringWidth(row); w != 5 {
			t.Errorf("row %d is %d cells wide, want 5", r, w)
		}
	}
}
