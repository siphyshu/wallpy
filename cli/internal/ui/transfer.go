package ui

import (
	"fmt"
	"sync"
	"time"

	"charm.land/bubbles/v2/progress"
)

// Transfer is a live progress line for a download: the bar fills with the
// colours of a day passing, dawn to dusk. It only draws on a terminal;
// elsewhere it stays silent and the caller prints the result.
type Transfer struct {
	p     *Printer
	label string
	bar   progress.Model

	mu          sync.Mutex
	done, total int64

	stop chan struct{}
	wg   sync.WaitGroup
}

// Transfer starts a progress line labelled `label`.
func (p *Printer) Transfer(label string) *Transfer {
	bar := progress.New(
		progress.WithColors(skyPaint[Dawn], skyPaint[Day], skyPaint[Dusk]),
		progress.WithFillCharacters('━', '━'),
		progress.WithoutPercentage(),
		progress.WithWidth(28),
	)
	bar.EmptyColor = p.look.Faint
	t := &Transfer{p: p, label: label, bar: bar, stop: make(chan struct{})}
	if p.Styled() {
		fmt.Fprint(p.w, hideCursor)
		t.wg.Add(1)
		go t.run()
	}
	return t
}

// Update records progress; safe from any goroutine. Updates from parallel
// downloads can arrive out of order, so the bar only moves forward.
func (t *Transfer) Update(done, total int64) {
	t.mu.Lock()
	t.done, t.total = max(t.done, done), total
	t.mu.Unlock()
}

func (t *Transfer) run() {
	defer t.wg.Done()
	tick := time.NewTicker(80 * time.Millisecond)
	defer tick.Stop()
	for {
		t.draw()
		select {
		case <-t.stop:
			return
		case <-tick.C:
		}
	}
}

func (t *Transfer) draw() {
	t.mu.Lock()
	done, total := t.done, t.total
	t.mu.Unlock()
	pct := 0.0
	if total > 0 {
		pct = float64(done) / float64(total)
	}
	p := t.p
	line := p.Plain(t.label) + "  " + t.bar.ViewAs(pct) + "  " +
		p.Muted(fmt.Sprintf("%s / %s", Bytes(done), Bytes(total)))
	fmt.Fprint(p.w, "\r\x1b[2K"+margin+line)
}

// Done removes the progress line, leaving the cursor where it started.
func (t *Transfer) Done() {
	if !t.p.Styled() {
		return
	}
	close(t.stop)
	t.wg.Wait()
	fmt.Fprint(t.p.w, "\r\x1b[2K"+showCursor)
}

const (
	hideCursor = "\x1b[?25l"
	showCursor = "\x1b[?25h"
)

// Bytes is a size for people: 840 KB, 70.6 MB.
func Bytes(n int64) string {
	switch {
	case n < 1000:
		return fmt.Sprintf("%d B", n)
	case n < 1_000_000:
		return fmt.Sprintf("%.0f KB", float64(n)/1e3)
	case n < 1_000_000_000:
		return fmt.Sprintf("%.1f MB", float64(n)/1e6)
	default:
		return fmt.Sprintf("%.2f GB", float64(n)/1e9)
	}
}
