package spec

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// The shared spec folder at the repo root.
var specDir = filepath.Join("..", "..", "..", "spec")

func TestSchemaIsACopyOfTheSpec(t *testing.T) {
	want, err := os.ReadFile(filepath.Join(specDir, "schedule.schema.json"))
	if err != nil {
		t.Fatal(err)
	}
	if string(schemaJSON) != string(want) {
		t.Fatal("internal/spec/schedule.schema.json differs from spec/schedule.schema.json: copy it over")
	}
}

func TestVectors(t *testing.T) {
	data, err := os.ReadFile(filepath.Join(specDir, "vectors", "vectors.json"))
	if err != nil {
		t.Fatal(err)
	}
	var file struct {
		Vectors []struct {
			Name     string
			Schedule Schedule
			Location *Location
			Timezone string
			At       string
			Expect   struct {
				Image     string
				Slot      int
				SlotStart string `json:"slot_start"`
				SlotEnd   string `json:"slot_end"`
			}
		}
	}
	if err := json.Unmarshal(data, &file); err != nil {
		t.Fatal(err)
	}
	if len(file.Vectors) == 0 {
		t.Fatal("no vectors")
	}
	for _, v := range file.Vectors {
		t.Run(v.Name, func(t *testing.T) {
			tz, err := time.LoadLocation(v.Timezone)
			if err != nil {
				t.Fatal(err)
			}
			now, err := time.ParseInLocation("2006-01-02T15:04", v.At, tz)
			if err != nil {
				t.Fatal(err)
			}
			got, err := v.Schedule.Active(now, v.Location)
			if err != nil {
				t.Fatal(err)
			}
			format := func(w time.Time) string { return Instant(w, tz).Format("2006-01-02T15:04-07:00") }
			if got.Image != v.Expect.Image || got.Slot != v.Expect.Slot ||
				format(got.SlotStart) != v.Expect.SlotStart || format(got.SlotEnd) != v.Expect.SlotEnd {
				t.Errorf("got %s (slot %d, %s to %s), want %s (slot %d, %s to %s)",
					got.Image, got.Slot, format(got.SlotStart), format(got.SlotEnd),
					v.Expect.Image, v.Expect.Slot, v.Expect.SlotStart, v.Expect.SlotEnd)
			}
		})
	}
}

func TestGalleryExamplesAreValid(t *testing.T) {
	paths, _ := filepath.Glob(filepath.Join(specDir, "examples", "*.toml"))
	if len(paths) == 0 {
		t.Fatal("no examples")
	}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		if _, problems, err := ParseTOML(data, nil); err != nil || len(problems) > 0 {
			t.Errorf("%s: %v %v", filepath.Base(p), err, problems)
		}
	}
}

// The templates and rejected cases mirror spec/tests/test_v2_rules.py.
const (
	daypack = `{"spec": 2, "name": "Test", "slot": [
		{"label": "dawn", "at": "dawn", "images": ["dawn.jpg"]},
		{"at": "sunrise+1h30m", "images": ["day1.jpg", "day2.jpg"]},
		{"at": "sunset-30m", "images": ["dusk.jpg"]},
		{"at": "dusk+1h", "images": ["night.jpg"], "rotate": "every 20m", "shuffle": true}]}`
	weekpack = `{"spec": 2, "name": "Test", "slot": [
		{"days": ["mon", "tue", "wed", "thu", "fri"], "images": ["weekday.jpg"]},
		{"days": ["sat", "sun"], "images": ["weekend-am.jpg"]},
		{"days": ["sat", "sun"], "at": "noon", "images": ["weekend-pm.jpg"]}]}`
	album = `{"spec": 2, "name": "Test", "slot": [{"images": ["a.jpg", "b.jpg", "c.jpg"], "rotate": "every 1d"}]}`
)

type doc = map[string]any

// edit returns a changed copy of a template.
func edit(template string, change func(d doc, slot func(int) doc)) string {
	var d doc
	if err := json.Unmarshal([]byte(template), &d); err != nil {
		panic(err)
	}
	change(d, func(i int) doc { return d["slot"].([]any)[i].(doc) })
	out, _ := json.Marshal(d)
	return string(out)
}

func problems(t *testing.T, schedule string, packFiles []string) []string {
	t.Helper()
	_, problems, err := ParseJSON([]byte(schedule), packFiles)
	if err != nil {
		t.Fatal(err)
	}
	return problems
}

func TestTemplatesAreValid(t *testing.T) {
	for name, s := range map[string]string{"daypack": daypack, "weekpack": weekpack, "album": album} {
		if p := problems(t, s, nil); len(p) > 0 {
			t.Errorf("%s: %v", name, p)
		}
	}
}

func TestRejected(t *testing.T) {
	cases := map[string]string{
		// JSON Schema
		"wrong spec version":  edit(album, func(d doc, _ func(int) doc) { d["spec"] = 1 }),
		"no slots":            edit(album, func(d doc, _ func(int) doc) { d["slot"] = []any{} }),
		"blank name":          edit(album, func(d doc, _ func(int) doc) { d["name"] = "" }),
		"unknown slot key":    edit(album, func(_ doc, s func(int) doc) { s(0)["colour"] = "red" }),
		"path traversal":      edit(album, func(_ doc, s func(int) doc) { s(0)["images"] = []any{"../../x.jpg"} }),
		"subfolder":           edit(album, func(_ doc, s func(int) doc) { s(0)["images"] = []any{"sub/x.jpg"} }),
		"non-image file":      edit(album, func(_ doc, s func(int) doc) { s(0)["images"] = []any{"evil.html"} }),
		"empty image list":    edit(album, func(_ doc, s func(int) doc) { s(0)["images"] = []any{} }),
		"unknown weekday":     edit(weekpack, func(_ doc, s func(int) doc) { s(0)["days"] = []any{"monday"} }),
		"repeated weekday":    edit(weekpack, func(_ doc, s func(int) doc) { s(1)["days"] = []any{"sat", "sat"} }),
		"invalid clock time":  edit(daypack, func(_ doc, s func(int) doc) { s(0)["at"] = "25:00" }),
		"AM/PM time":          edit(daypack, func(_ doc, s func(int) doc) { s(0)["at"] = "8:00 am" }),
		"unknown solar event": edit(daypack, func(_ doc, s func(int) doc) { s(0)["at"] = "moonrise" }),
		"seconds in rotate":   edit(album, func(_ doc, s func(int) doc) { s(0)["rotate"] = "every 30s" }),
		"pinned location":     edit(album, func(d doc, _ func(int) doc) { d["location"] = doc{"latitude": 1} }),
		// README rules
		"interval under 5m": edit(album, func(_ doc, s func(int) doc) { s(0)["rotate"] = "every 4m" }),
		"interval over 7d":  edit(album, func(_ doc, s func(int) doc) { s(0)["rotate"] = "every 8d" }),
		"offset over 12h":   edit(daypack, func(_ doc, s func(int) doc) { s(3)["at"] = "dusk+13h" }),
		"slots out of time order": edit(daypack, func(d doc, _ func(int) doc) {
			slots := d["slot"].([]any)
			for i, j := 0, len(slots)-1; i < j; i, j = i+1, j-1 {
				slots[i], slots[j] = slots[j], slots[i]
			}
		}),
		"two slots start together": edit(daypack, func(_ doc, s func(int) doc) { s(2)["at"] = "sunrise+1h30m" }),
		"a weekday has no slot":    edit(weekpack, func(_ doc, s func(int) doc) { s(0)["days"] = []any{"mon", "tue"} }),
	}
	for name, s := range cases {
		if len(problems(t, s, nil)) == 0 {
			t.Errorf("%s: accepted", name)
		}
	}
}

func TestSameStartOnDifferentDaysIsFine(t *testing.T) {
	s := edit(weekpack, func(d doc, _ func(int) doc) {
		d["slot"] = append(d["slot"].([]any), doc{"days": []any{"mon"}, "at": "noon", "images": []any{"x.jpg"}})
	})
	if p := problems(t, s, nil); len(p) > 0 {
		t.Error(p)
	}
}

func TestPackFilesMustMatchSchedule(t *testing.T) {
	names := []string{"a.jpg", "b.jpg", "c.jpg"}
	if p := problems(t, album, names); len(p) > 0 {
		t.Error(p)
	}
	for files, want := range map[*[]string]string{
		{"a.jpg", "b.jpg"}:                   "not in the pack",
		{"a.jpg", "b.jpg", "c.jpg", "d.jpg"}: "not used",
		{"a.jpg", "b.jpg", "c.jpg", "A.jpg"}: "only by case",
	} {
		if p := problems(t, album, *files); !strings.Contains(strings.Join(p, "\n"), want) {
			t.Errorf("%v: want %q, got %v", *files, want, p)
		}
	}
}

func TestParseTOML(t *testing.T) {
	s, p, err := ParseTOML([]byte(`
spec = 2
name = "Album"

[[slot]]
images = ["a.jpg", "b.jpg"]
rotate = "every 1d"
shuffle = true
`), []string{"a.jpg", "b.jpg"})
	if err != nil || len(p) > 0 {
		t.Fatal(err, p)
	}
	if !s.Slot[0].Shuffle || s.Slot[0].Rotate != "every 1d" || len(s.Slot[0].Images) != 2 {
		t.Errorf("parsed %+v", s)
	}
	if _, _, err := ParseTOML([]byte("spec = "), nil); err == nil {
		t.Error("broken TOML parsed")
	}
}

func mustParse(t *testing.T, s string) *Schedule {
	t.Helper()
	sched, p, err := ParseJSON([]byte(s), nil)
	if err != nil || len(p) > 0 {
		t.Fatal(err, p)
	}
	return sched
}

func TestUntil(t *testing.T) {
	at := func(h, m int) time.Time { return time.Date(2026, 6, 21, h, m, 0, 0, time.UTC) }
	for _, c := range []struct {
		schedule string
		now      time.Time
		want     string
	}{
		{daypack, at(12, 30), "13:00"}, // spread: day1 until the halfway split
		{daypack, at(13, 30), "18:00"}, // last part: until the slot ends
		{daypack, at(21, 5), "21:20"},  // every 20m, counted from the anchor
		{daypack, at(4, 50), "05:00"},  // every 20m, but the slot ends first
		{album, at(9, 0), "00:00"},     // every 1d: next midnight
	} {
		a, err := mustParse(t, c.schedule).Active(c.now, nil)
		if err != nil {
			t.Fatal(err)
		}
		if got := a.Until.Format("15:04"); got != c.want {
			t.Errorf("%s: until %s, want %s", c.now.Format("15:04"), got, c.want)
		}
	}
}

func TestDay(t *testing.T) {
	format := func(spans []Span) string {
		var parts []string
		for _, sp := range spans {
			parts = append(parts, fmt.Sprintf("%d %s-%s", sp.Slot, sp.Start.Format("15:04"), sp.End.Format("15:04")))
		}
		return strings.Join(parts, ", ")
	}
	for _, c := range []struct {
		schedule string
		date     time.Time
		want     string
	}{
		{daypack, time.Date(2026, 6, 21, 15, 0, 0, 0, time.UTC),
			"3 00:00-05:00, 0 05:00-08:00, 1 08:00-18:00, 2 18:00-20:30, 3 20:30-00:00"},
		{weekpack, time.Date(2026, 10, 17, 9, 0, 0, 0, time.UTC), "1 00:00-12:00, 2 12:00-00:00"}, // Saturday
		{weekpack, time.Date(2026, 10, 14, 9, 0, 0, 0, time.UTC), "0 00:00-00:00"},                // Wednesday
	} {
		spans, err := mustParse(t, c.schedule).Day(c.date, nil)
		if err != nil {
			t.Fatal(err)
		}
		if got := format(spans); got != c.want {
			t.Errorf("%s: %s, want %s", c.date.Format("Mon"), got, c.want)
		}
	}
}
