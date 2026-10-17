package app

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"
	"github.com/spf13/cobra"
	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"

	"github.com/siphyshu/wallpy/cli/internal/library"
	"github.com/siphyshu/wallpy/cli/internal/remote"
	"github.com/siphyshu/wallpy/cli/internal/state"
	"github.com/siphyshu/wallpy/cli/internal/ui"
)

func newBrowse(version string) *cobra.Command {
	return &cobra.Command{
		Use:   "browse [search]",
		Short: "Browse the gallery and pick a pack",
		Long: "Browse the gallery with previews of each pack's wallpapers. Enter makes\n" +
			"the selected pack your wallpaper.",
		RunE: func(cmd *cobra.Command, args []string) error {
			return browse(cmd.Context(), version, strings.Join(args, " "))
		},
	}
}

// browse shows the gallery and, when a pack is picked, uses it.
func browse(ctx context.Context, version, search string) error {
	c := remote.New(version)
	packs, total, err := c.Gallery(ctx, search)
	if err != nil {
		return explainNetwork(c, "", err)
	}
	st, _ := state.Load()
	p := printerAt(time.Now(), st.Location())
	if len(packs) == 0 {
		p.Blank()
		if search != "" {
			p.Raw(p.Muted(fmt.Sprintf("No packs match %q.", search)))
		} else {
			p.Raw(p.Muted("The gallery is empty."))
		}
		p.Blank()
		return nil
	}
	if !p.Styled() { // piped: a plain list
		for _, pk := range packs {
			fmt.Printf("%s\t%s\t%s\tby %s\n", pk.Slug, pk.Name, pk.Kind, pk.Author)
		}
		return nil
	}
	lib, _ := library.Open()
	m := &browser{ctx: ctx, c: c, p: p, packs: packs, total: total, search: search,
		pictures: map[string]image.Image{}, loading: map[string]bool{}, active: st.Active,
		graphics: ui.DetectGraphics(), blocks: map[string]string{}, sent: map[string]string{},
		sending: map[string]bool{}, ids: map[string]int{}}
	if lib != nil {
		m.installed = map[string]bool{}
		if list, err := lib.List(); err == nil {
			for _, pk := range list {
				m.installed[pk.Slug] = true
			}
		}
	}
	final, err := tea.NewProgram(m, tea.WithContext(ctx)).Run()
	if err != nil {
		return err
	}
	if pick := final.(*browser).picked; pick != "" {
		return use(ctx, version, pick)
	}
	return nil
}

// browser is the gallery screen: a list on the left, the selected pack's
// wallpaper and credit on the right.
type browser struct {
	ctx       context.Context
	c         *remote.Client
	p         *ui.Printer
	packs     []remote.Listing
	total     int
	search    string
	installed map[string]bool
	active    string

	cursor        int
	filter        string
	filtering     bool
	width, height int

	pictures map[string]image.Image // previews, already shrunk
	loading  map[string]bool
	picked   string
	status   string // a passing note in the footer ("Opened … in your browser")

	graphics ui.Graphics
	blocks   map[string]string // rendered half-block previews, by slug and size
	sent     map[string]string // Kitty: slug -> the size its image was sent for
	sending  map[string]bool
	ids      map[string]int // Kitty image IDs, by slug
}

// kittyMsg carries a prepared Kitty transmission; kittySentMsg says it's out.
type kittyMsg struct{ slug, size, seq string }
type kittySentMsg struct{ slug, size string }
type statusMsg string

type pictureMsg struct {
	slug string
	img  image.Image
}

func (b *browser) Init() tea.Cmd { return b.load() }

// visible is the packs matching the filter.
func (b *browser) visible() []remote.Listing {
	if b.filter == "" {
		return b.packs
	}
	var out []remote.Listing
	f := strings.ToLower(b.filter)
	for _, pk := range b.packs {
		if strings.Contains(strings.ToLower(pk.Name+" "+pk.Author+" "+pk.Slug), f) {
			out = append(out, pk)
		}
	}
	return out
}

func (b *browser) selected() (remote.Listing, bool) {
	v := b.visible()
	if len(v) == 0 {
		return remote.Listing{}, false
	}
	return v[min(b.cursor, len(v)-1)], true
}

// load fetches the selected pack's preview, once.
func (b *browser) load() tea.Cmd {
	pk, ok := b.selected()
	if !ok || pk.Preview == "" || b.loading[pk.Slug] {
		return nil
	}
	b.loading[pk.Slug] = true
	ctx, c := b.ctx, b.c
	return func() tea.Msg {
		data, err := c.Fetch(ctx, pk.Preview)
		if err != nil {
			return pictureMsg{pk.Slug, nil}
		}
		img, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return pictureMsg{pk.Slug, nil}
		}
		return pictureMsg{pk.Slug, shrink(img, 1600)}
	}
}

func (b *browser) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	model, cmd := b.update(msg)
	return model, tea.Batch(cmd, b.sendPreview())
}

func (b *browser) update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case kittyMsg:
		return b, tea.Sequence(tea.Raw(msg.seq), func() tea.Msg { return kittySentMsg{msg.slug, msg.size} })
	case kittySentMsg:
		b.sent[msg.slug] = msg.size
		delete(b.sending, msg.slug+msg.size)
	case statusMsg:
		b.status = string(msg)
	case tea.WindowSizeMsg:
		b.width, b.height = msg.Width, msg.Height
	case pictureMsg:
		b.pictures[msg.slug] = msg.img
	case tea.KeyPressMsg:
		key := msg.String()
		if b.filtering {
			switch key {
			case "enter", "esc":
				b.filtering = false
				if key == "esc" {
					b.filter = ""
				}
			case "backspace":
				if r := []rune(b.filter); len(r) > 0 {
					b.filter = string(r[:len(r)-1])
				}
			case "ctrl+c":
				return b, b.quit()
			default:
				if t := msg.Text; t != "" {
					b.filter += t
				}
			}
			b.cursor = 0
			return b, b.load()
		}
		b.status = ""
		switch key {
		case "q", "esc", "ctrl+c":
			return b, b.quit()
		case "o":
			if pk, ok := b.selected(); ok {
				url := b.c.PackURL(pk.Slug)
				name := pk.Name
				return b, func() tea.Msg {
					if err := openURL(url); err != nil {
						return statusMsg("Couldn't open a browser: " + url)
					}
					return statusMsg("Opened " + name + " in your browser")
				}
			}
		case "up", "k":
			b.cursor = max(b.cursor-1, 0)
		case "down", "j":
			b.cursor = min(b.cursor+1, max(len(b.visible())-1, 0))
		case "/":
			b.filtering = true
		case "enter":
			if pk, ok := b.selected(); ok {
				b.picked = pk.Slug
				return b, b.quit()
			}
		}
		return b, b.load()
	}
	return b, nil
}

func (b *browser) View() tea.View {
	v := tea.NewView(b.render())
	v.AltScreen = true
	return v
}

func (b *browser) render() string {
	p := b.p
	if b.width == 0 {
		return ""
	}
	h := b.height
	listW, picW, picH := b.box()

	// Header.
	header := p.Strong("wallpy browse") + "  " + p.Faint(fmt.Sprintf("%s · most downloaded", plural(b.total, "pack")))
	if b.search != "" {
		header += p.Faint(fmt.Sprintf(" · %q", b.search))
	}
	if b.filtering || b.filter != "" {
		header += "   " + p.Accent("/") + p.Plain(b.filter)
		if b.filtering {
			header += p.Accent("▏")
		}
	}

	// List.
	var list []string
	vis := b.visible()
	start := max(0, min(b.cursor-(h-8)/2, len(vis)-(h-6)))
	for i := start; i < len(vis) && len(list) < h-6; i++ {
		pk := vis[i]
		name := truncate(pk.Name, listW-4)
		mark := " "
		switch {
		case pk.Slug == b.active:
			mark = p.Accent("●")
		case b.installed[pk.Slug]:
			mark = p.Faint("✓")
		}
		if i == b.cursor {
			list = append(list, p.Accent(ui.SymHint)+mark+" "+p.Strong(name))
		} else {
			list = append(list, " "+mark+" "+p.Muted(name))
		}
	}
	if len(vis) == 0 {
		list = append(list, p.Faint("  nothing matches"))
	}

	// Detail: the picture, then the credit.
	var detail []string
	if pk, ok := b.selected(); ok {
		img, done := b.pictures[pk.Slug]
		switch {
		case done && img != nil:
			detail = append(detail, strings.Split(b.preview(pk.Slug, img, picW, picH), "\n")...)
		case done:
			detail = append(detail, p.Faint("(no preview)"))
			for range picH - 1 {
				detail = append(detail, "")
			}
		default:
			detail = append(detail, p.Faint("loading preview…"))
			for range picH - 1 {
				detail = append(detail, "")
			}
		}
		detail = append(detail, "", p.Strong(pk.Name)+"  "+p.Faint(pk.Kind))
		line := "by " + pk.Author
		if l := aiUse[pk.AIUse]; l != "" {
			line += " · " + l
		}
		line += " · " + plural(pk.Downloads, "download")
		detail = append(detail, p.Muted(line))
		state := ""
		switch {
		case pk.Slug == b.active:
			state = "your wallpaper now"
		case b.installed[pk.Slug]:
			state = "installed"
		}
		if state != "" {
			detail = append(detail, p.Faint(state))
		}
	}

	left := lipgloss.NewStyle().Width(listW).Render(strings.Join(list, "\n"))
	right := strings.Join(detail, "\n")
	body := lipgloss.JoinHorizontal(lipgloss.Top, left, "  ", right)
	footer := p.Faint("↑↓ move · enter use · o open in gallery · / filter · q quit")
	if b.status != "" {
		footer = p.Accent(ui.SymSuccess) + " " + p.Muted(b.status)
	}
	return "\n " + header + "\n\n" + indent(body, " ") + "\n\n " + footer
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:max(n-1, 0)]) + "…"
}

func indent(s, pad string) string {
	return pad + strings.ReplaceAll(s, "\n", "\n"+pad)
}

// box is the layout: the list's width and the preview's size in cells.
func (b *browser) box() (listW, picW, picH int) {
	listW = min(34, b.width/3)
	picW = max(b.width-listW-6, 10)
	picH = min(max(b.height-9, 4), picW*9/32) // about 16:9
	return
}

// preview is the selected pack's picture: real pixels once the Kitty image
// has arrived, half blocks until then (and in other terminals).
func (b *browser) preview(slug string, img image.Image, w, h int) string {
	size := fmt.Sprintf("%dx%d", w, h)
	if b.graphics == ui.Kitty && b.sent[slug] == size {
		return ui.KittyCells(b.id(slug), w, h)
	}
	key := slug + "@" + size
	if s, ok := b.blocks[key]; ok {
		return s
	}
	s := ui.Picture(img, w, h)
	b.blocks[key] = s
	return s
}

// sendPreview prepares the selected preview's Kitty image, off the UI
// thread, when it hasn't been sent at the current size.
func (b *browser) sendPreview() tea.Cmd {
	if b.graphics != ui.Kitty || b.width == 0 {
		return nil
	}
	pk, ok := b.selected()
	if !ok {
		return nil
	}
	img := b.pictures[pk.Slug]
	_, w, h := b.box()
	size := fmt.Sprintf("%dx%d", w, h)
	if img == nil || b.sent[pk.Slug] == size || b.sending[pk.Slug+size] {
		return nil
	}
	b.sending[pk.Slug+size] = true
	id, slug := b.id(pk.Slug), pk.Slug
	return func() tea.Msg {
		seq, err := ui.KittyImage(img, id, w, h)
		if err != nil {
			return nil
		}
		return kittyMsg{slug, size, seq}
	}
}

// id is a pack's Kitty image ID: unique to this run (so another app's
// images in the same terminal aren't touched), never zero.
func (b *browser) id(slug string) int {
	if id, ok := b.ids[slug]; ok {
		return id
	}
	id := (os.Getpid()%2048+1)<<12 | (len(b.ids) + 1)
	b.ids[slug] = id
	return id
}

// quit frees the images sent to the terminal, then ends the program.
func (b *browser) quit() tea.Cmd {
	if b.graphics != ui.Kitty || len(b.ids) == 0 {
		return tea.Quit
	}
	var forget strings.Builder
	for _, id := range b.ids {
		forget.WriteString(ui.KittyForget(id))
	}
	return tea.Sequence(tea.Raw(forget.String()), tea.Quit)
}

// shrink scales big photos down once, so redraws stay fast.
func shrink(img image.Image, maxW int) image.Image {
	b := img.Bounds()
	if b.Dx() <= maxW {
		return img
	}
	h := b.Dy() * maxW / b.Dx()
	out := image.NewRGBA(image.Rect(0, 0, maxW, h))
	draw.ApproxBiLinear.Scale(out, out.Bounds(), img, b, draw.Src, nil)
	return out
}
