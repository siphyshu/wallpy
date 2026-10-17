package app

import (
	"context"
	"image"
	"strings"
	"testing"

	tea "charm.land/bubbletea/v2"

	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newTestBrowser(g ui.Graphics) *browser {
	packs := []remote.Listing{{Slug: "a", Name: "A"}, {Slug: "b", Name: "B"}, {Slug: "c", Name: "C"}}
	return &browser{ctx: context.Background(), c: &remote.Client{Site: "http://x"}, p: ui.New(&strings.Builder{}, ui.Look{Theme: ui.ThemeFor(true), Sun: ui.FallbackSun}),
		packs: packs, total: 3, pictures: map[string]image.Image{}, loading: map[string]bool{},
		graphics: g, blocks: map[string]string{}, sent: map[string]string{}, sending: map[string]bool{}, ids: map[string]int{}}
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
