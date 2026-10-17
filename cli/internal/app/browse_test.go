package app

import (
	"context"
	"fmt"
	"image"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"
	"github.com/charmbracelet/x/ansi"

	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newTestBrowser(g ui.Graphics) *browser {
	packs := []remote.Listing{{Slug: "a", Name: "A"}, {Slug: "b", Name: "B"}, {Slug: "c", Name: "C"}}
	return &browser{ctx: context.Background(), c: &remote.Client{Site: "http://x"}, p: ui.New(&strings.Builder{}, ui.Look{Theme: ui.ThemeFor(true), Sun: ui.FallbackSun}),
		packs: packs, total: 3, pictures: map[string]image.Image{}, loading: map[string]bool{},
		graphics: g, blocks: map[string]string{}, sent: map[string]string{}, sending: map[string]bool{}, ids: map[string]int{}, overlays: map[string]string{}}
}

// drive feeds messages through Update and View, running quick commands.
func drive(t *testing.T, b *browser, msgs ...tea.Msg) {
	t.Helper()
	for _, m := range msgs {
		b.Update(m)
		_ = b.View()
	}
}

func TestBrowseKeys(t *testing.T) {
	for _, g := range []ui.Graphics{ui.Blocks, ui.Kitty} {
		b := newTestBrowser(g)
		img := image.NewRGBA(image.Rect(0, 0, 800, 450))
		drive(t, b,
			tea.WindowSizeMsg{Width: 130, Height: 40},
			pictureMsg{"a", img},
			tea.KeyPressMsg{Code: tea.KeyDown},
			pictureMsg{"b", img},
			tea.KeyPressMsg{Code: tea.KeyDown},
			tea.KeyPressMsg{Code: tea.KeyUp},
			tea.KeyPressMsg{Code: '/', Text: "/"},
			tea.KeyPressMsg{Code: 'b', Text: "b"},
			tea.KeyPressMsg{Code: tea.KeyEnter},
		)
		if b.cursor != 0 || b.filter != "b" {
			t.Errorf("graphics %d: cursor %d filter %q", g, b.cursor, b.filter)
		}
	}
}

// run executes a command and the commands it batches, returning messages.
func runCmd(cmd tea.Cmd) []tea.Msg {
	if cmd == nil {
		return nil
	}
	switch msg := cmd().(type) {
	case nil:
		return nil
	case tea.BatchMsg:
		var out []tea.Msg
		for _, c := range msg {
			out = append(out, runCmd(c)...)
		}
		return out
	default:
		return []tea.Msg{msg}
	}
}

// settle feeds messages back until nothing new happens, collecting what
// would be written to the terminal raw.
func settle(b *browser, msgs ...tea.Msg) (raw []string) {
	for len(msgs) > 0 {
		m := msgs[0]
		msgs = msgs[1:]
		if r, ok := m.(tea.RawMsg); ok {
			raw = append(raw, r.Msg.(string))
			continue
		}
		_, cmd := b.Update(m)
		_ = b.View()
		msgs = append(msgs, runCmd(cmd)...)
	}
	return raw
}

func TestOverlayPreviewIsPaintedIntoABlankBox(t *testing.T) {
	b := newTestBrowser(ui.Sixel)
	img := image.NewRGBA(image.Rect(0, 0, 800, 450))
	raw := settle(b, tea.WindowSizeMsg{Width: 130, Height: 40}, pictureMsg{"a", img})

	listW, w, h := b.box()
	key := fmt.Sprintf("a@%dx%d", w, h)
	if b.onScreen != key {
		t.Fatalf("onScreen %q, want %q", b.onScreen, key)
	}
	if len(raw) != 1 || !strings.HasPrefix(raw[0], "\x1b7"+fmt.Sprintf("\x1b[%d;%dH", 4, listW+4)+"\x1bP") {
		t.Fatalf("painted %d times: %.40q", len(raw), raw)
	}
	// The box under the image is blank, so the screen never draws over it.
	lines := strings.Split(ansi.Strip(b.View().Content), "\n")
	if row := lines[3]; len(row) < listW+3+w || strings.TrimSpace(row[listW+3:listW+3+w]) != "" {
		t.Errorf("box not blank: %q", row)
	}

	// Another pack: the old image is drawn over, and the new one painted.
	raw = settle(b, tea.KeyPressMsg{Code: tea.KeyDown}, pictureMsg{"b", img})
	if b.onScreen != fmt.Sprintf("b@%dx%d", w, h) || len(raw) != 1 {
		t.Errorf("after moving: onScreen %q, %d paints", b.onScreen, len(raw))
	}
}
