package ui

import (
	"image/color"
	"slices"
	"strings"

	"charm.land/lipgloss/v2"
)

// The sky itself, the same on light and dark terminals: it's a picture.
var skyPaint = [4]color.Color{
	Night: hex("#1E2756"),
	Dawn:  hex("#E58FA6"),
	Day:   hex("#7CC4F2"),
	Dusk:  hex("#F29A55"),
}

type keyframe struct {
	minute int
	c      color.Color
}

// skyAt blends the sky's colour at `minute` after midnight: solid in the
// middle of each phase, fading across sunrise and sunset.
func (s Sun) skyAt(minute int) color.Color {
	keys := []keyframe{
		{0, skyPaint[Night]},
		{s.Dawn, skyPaint[Night]},
		{(s.Dawn + s.Sunrise) / 2, skyPaint[Dawn]},
		{s.Sunrise + 60, skyPaint[Day]},
		{s.Sunset - 60, skyPaint[Day]},
		{(s.Sunset + s.Dusk) / 2, skyPaint[Dusk]},
		{s.Dusk + 45, skyPaint[Night]},
		{24 * 60, skyPaint[Night]},
	}
	// Far north the phases crowd together; keep the frames in time order.
	slices.SortStableFunc(keys, func(a, b keyframe) int { return a.minute - b.minute })
	for i := 1; i < len(keys); i++ {
		a, b := keys[i-1], keys[i]
		if minute <= b.minute {
			if b.minute == a.minute {
				return b.c
			}
			return blend(a.c, b.c, float64(minute-a.minute)/float64(b.minute-a.minute))
		}
	}
	return skyPaint[Night]
}

func blend(a, b color.Color, t float64) color.Color {
	ar, ag, ab, _ := a.RGBA()
	br, bg, bb, _ := b.RGBA()
	mix := func(x, y uint32) uint8 { return uint8((float64(x>>8)*(1-t) + float64(y>>8)*t) + .5) }
	return color.RGBA{mix(ar, br), mix(ag, bg), mix(ab, bb), 255}
}

// StripWidth is the sky strip's width in cells: one per half hour.
const StripWidth = 48

// SkyStrip draws today's sky: a band of colour from midnight to midnight,
// a marker under the current time, and the hours beneath.
//
//	████████████████████████████████████████████████
//	                    ▲ 10:24  day
//	00          06          12          18        24
func (p *Printer) SkyStrip() string {
	l := p.look
	var bar strings.Builder
	for i := range StripWidth {
		mid := i*30 + 15
		bar.WriteString(lipgloss.NewStyle().Foreground(l.Sun.skyAt(mid)).Render("█"))
	}

	minute := l.Now.Hour()*60 + l.Now.Minute()
	col := min(minute/30, StripWidth-1)
	label := l.Now.Format("15:04") + "  " + l.Phase().String()
	var marker string
	if col+2+len(label) <= StripWidth { // label to the right of the marker
		marker = strings.Repeat(" ", col) + p.Accent(SymNow) + " " + p.Plain(label)
	} else { // too close to midnight: label on the left
		marker = strings.Repeat(" ", col-len(label)-1) + p.Plain(label) + " " + p.Accent(SymNow)
	}

	axis := []rune(strings.Repeat(" ", StripWidth))
	for h := 0; h <= 24; h += 6 {
		at := min(h*2, StripWidth-2)
		copy(axis[at:], []rune(twoDigits(h)))
	}
	return bar.String() + "\n" + marker + "\n" + p.Faint(string(axis))
}

func twoDigits(n int) string { return string([]byte{byte('0' + n/10), byte('0' + n%10)}) }
