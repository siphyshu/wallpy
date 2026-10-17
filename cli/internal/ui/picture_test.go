package ui

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"regexp"
	"strings"
	"testing"

	"github.com/charmbracelet/x/ansi"
	"github.com/charmbracelet/x/ansi/kitty"
	"github.com/charmbracelet/x/ansi/sixel"
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

func TestSixelImage(t *testing.T) {
	seq, err := OverlayImage(Sixel, photo(4000, 3000), 30, 9)
	if err != nil {
		t.Fatal(err)
	}
	// DCS p1;p2;p3 q <data> ST
	m := regexp.MustCompile(`^\x1bP0;1(?:;0)?q(.*)\x1b\\$`).FindStringSubmatch(seq)
	if m == nil {
		t.Fatalf("not a sixel sequence: %.40q", seq)
	}
	img, err := (&sixel.Decoder{}).Decode(strings.NewReader(m[1]))
	if err != nil {
		t.Fatal(err)
	}
	cw, ch := CellPixels() // 10×20 when the test's output isn't a terminal
	if b := img.Bounds(); b.Dx() != 30*cw || b.Dy() != 9*ch {
		t.Errorf("sixel image is %v, want %dx%d", b, 30*cw, 9*ch)
	}
}

func TestITerm2Image(t *testing.T) {
	seq, err := OverlayImage(ITerm2, photo(4000, 3000), 30, 9)
	if err != nil {
		t.Fatal(err)
	}
	m := regexp.MustCompile(`^\x1b\]1337;File=([^:]*):([A-Za-z0-9+/=]+)\x07$`).FindStringSubmatch(seq)
	if m == nil {
		t.Fatalf("not an iTerm2 image: %.60q", seq)
	}
	for _, want := range []string{"inline=1", "width=30", "height=9", "preserveAspectRatio=0"} {
		if !strings.Contains(";"+m[1]+";", ";"+want+";") {
			t.Errorf("options %q lack %s", m[1], want)
		}
	}
	data, _ := base64.StdEncoding.DecodeString(m[2])
	img, err := jpeg.Decode(bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	cw, ch := CellPixels()
	if b := img.Bounds(); b.Dx() != 30*cw || b.Dy() != 9*ch {
		t.Errorf("image is %v", b)
	}
}

func TestReserveAndPaint(t *testing.T) {
	got := ReserveAndPaint("IMG", 2, 3)
	want := "\n\n\n" + "\x1b[3A" + "\x1b[3G" + "\x1b7" + "IMG" + "\x1b8" + "\x1b[3B" + "\r"
	if got != want {
		t.Errorf("got %q\nwant %q", got, want)
	}
}
