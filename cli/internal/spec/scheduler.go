package spec

// "Which image is shown" (spec/README.md).

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"slices"
	"strings"
	"time"
)

// Active is the image showing at a moment, and the slot it belongs to.
type Active struct {
	Slot       int // index into Schedule.Slot
	Image      string
	ImageIndex int // position of Image in the slot's images
	// Wall times (see package doc); Instant converts them to real times.
	SlotStart, SlotEnd time.Time
	// Until is when the image next changes (wall): the next part of a
	// spread, the next rotation, or the slot's end, whichever is first.
	Until time.Time
}

type start struct {
	slot int
	at   time.Time
}

// starts is rules 1 and 2: slots that apply on a wall day, with clamped starts.
func starts(s *Schedule, day time.Time, loc *Location) []start {
	wd := weekday(day)
	var out []start
	for i, slot := range s.Slot {
		if !slices.Contains(slot.days(), wd) {
			continue
		}
		at := resolve(slot.at(), day, loc)
		if len(out) > 0 && at.Before(out[len(out)-1].at) {
			at = out[len(out)-1].at
		}
		out = append(out, start{i, at})
	}
	return out
}

// shuffled is README "Shuffle order": indices sorted by sha256("<seed>/<index>").
func shuffled(n int, seed string) []int {
	keys := make([]string, n)
	order := make([]int, n)
	for i := range n {
		sum := sha256.Sum256([]byte(fmt.Sprintf("%s/%d", seed, i)))
		keys[i] = hex.EncodeToString(sum[:])
		order[i] = i
	}
	slices.SortFunc(order, func(a, b int) int { return strings.Compare(keys[a], keys[b]) })
	return order
}

// Active is which image shows at `now`, for a user in now's time zone. loc
// may be nil (no location: solar events use their fallback times). The
// schedule must be valid (Validate).
func (s *Schedule) Active(now time.Time, loc *Location) (Active, error) {
	if loc != nil {
		if _, err := time.LoadLocation(loc.Timezone); err != nil {
			return Active{}, fmt.Errorf("location: %w", err)
		}
	}
	wall := Wall(now)
	today := wallDay(wall)

	// Rule 3: last started slot today, else the previous day's last slot.
	var current *start
	for _, st := range starts(s, today, loc) {
		if !st.at.After(wall) {
			current = &st
		}
	}
	for back := 1; current == nil && back < 8; back++ {
		if earlier := starts(s, today.AddDate(0, 0, -back), loc); len(earlier) > 0 {
			current = &earlier[len(earlier)-1]
		}
	}
	if current == nil {
		return Active{}, fmt.Errorf("no slot applies on any day")
	}

	// Rule 4: the next applicable start after this one.
	var end time.Time
	for ahead := 0; end.IsZero() && ahead < 8; ahead++ {
		for _, st := range starts(s, wallDay(current.at).AddDate(0, 0, ahead), loc) {
			if st.at.After(current.at) {
				end = st.at
				break
			}
		}
	}
	if end.IsZero() {
		return Active{}, fmt.Errorf("slot %d never ends", current.slot)
	}

	// Rule 5: the image within the slot.
	slot := s.Slot[current.slot]
	n := len(slot.Images)
	var k int
	var order []int
	until := end
	if every := Every(slot.rotate()); every == 0 { // spread
		part := end.Sub(current.at).Seconds() / float64(n)
		k = min(int(wall.Sub(current.at).Seconds()/part), n-1)
		if k < n-1 {
			until = current.at.Add(time.Duration(part * float64(k+1) * float64(time.Second))).Truncate(time.Second)
		}
		if slot.Shuffle {
			order = shuffled(n, fmt.Sprintf("%d/%s", current.slot, current.at.Format(time.DateOnly)))
		}
	} else {
		cycle := floorDiv(int64(wall.Sub(anchor)), int64(every))
		k = int(cycle - floorDiv(cycle, int64(n))*int64(n))
		if next := anchor.Add(time.Duration(cycle+1) * every); next.Before(until) {
			until = next
		}
		if slot.Shuffle {
			order = shuffled(n, fmt.Sprintf("%d/%d", current.slot, floorDiv(cycle, int64(n))))
		}
	}
	index := k
	if order != nil {
		index = order[k]
	}
	return Active{current.slot, slot.Images[index], index, current.at, end, until}, nil
}

// Span is one slot's stretch of a day (wall times).
type Span struct {
	Slot       int
	Start, End time.Time
}

// Day is the slots that show on the wall day containing `date`, from 00:00
// to 24:00: the previous night's slot until the first start, then each
// slot until the next. Slots clamped to zero length are left out.
func (s *Schedule) Day(date time.Time, loc *Location) ([]Span, error) {
	day := wallDay(Wall(date))
	first, err := s.Active(Instant(day, time.UTC), loc)
	if err != nil {
		return nil, err
	}
	midnight := day.AddDate(0, 0, 1)
	spans := []Span{{Slot: first.Slot, Start: day}}
	for _, st := range starts(s, day, loc) {
		if !st.at.After(day) {
			spans[0].Slot = st.slot // starts at 00:00 exactly
			continue
		}
		spans[len(spans)-1].End = st.at
		spans = append(spans, Span{Slot: st.slot, Start: st.at})
	}
	spans[len(spans)-1].End = midnight
	out := spans[:0]
	for _, sp := range spans {
		if sp.End.After(sp.Start) {
			out = append(out, sp)
		}
	}
	return out, nil
}

// SunTimes is when dawn, sunrise, sunset and dusk happen on the wall day
// containing `date` (fallback times without a location or in polar day/night).
func SunTimes(date time.Time, loc *Location) (dawn, sunrise, sunset, dusk time.Time) {
	day := wallDay(Wall(date))
	return solarWall("dawn", day, loc), solarWall("sunrise", day, loc),
		solarWall("sunset", day, loc), solarWall("dusk", day, loc)
}

// floorDiv rounds towards negative infinity, like Python's //.
func floorDiv(a, b int64) int64 {
	q := a / b
	if (a%b != 0) && ((a < 0) != (b < 0)) {
		q--
	}
	return q
}
