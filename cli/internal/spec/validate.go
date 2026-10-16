package spec

// Parsing and validation: the JSON Schema plus spec/README.md "Rules beyond
// the JSON Schema".

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
	"github.com/santhosh-tekuri/jsonschema/v6"
	"golang.org/x/text/language"
	"golang.org/x/text/message"
)

// A copy of spec/schedule.schema.json (go:embed can't reach outside the
// module); spec_test.go checks they're identical.
//
//go:embed schedule.schema.json
var schemaJSON []byte

var schema = func() *jsonschema.Schema {
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(schemaJSON))
	if err != nil {
		panic(err)
	}
	c := jsonschema.NewCompiler()
	if err := c.AddResource("schedule.schema.json", doc); err != nil {
		panic(err)
	}
	return c.MustCompile("schedule.schema.json")
}()

// Schedule is a pack's schedule.toml.
type Schedule struct {
	Spec        int    `json:"spec"`
	Name        string `json:"name"`
	Author      string `json:"author,omitempty"`
	Description string `json:"description,omitempty"`
	Slot        []Slot `json:"slot"`
}

type Slot struct {
	Label   string   `json:"label,omitempty"`
	At      string   `json:"at,omitempty"`
	Days    []string `json:"days,omitempty"`
	Images  []string `json:"images"`
	Rotate  string   `json:"rotate,omitempty"`
	Shuffle bool     `json:"shuffle,omitempty"`
}

func (s Slot) at() string {
	if s.At == "" {
		return "00:00"
	}
	return s.At
}

func (s Slot) days() []string {
	if s.Days == nil {
		return Weekdays
	}
	return s.Days
}

func (s Slot) rotate() string {
	if s.Rotate == "" {
		return "spread"
	}
	return s.Rotate
}

// ParseTOML reads a schedule.toml and validates it. problems lists what's
// wrong with a schedule that parsed; err is for one that didn't.
// packFiles, when not nil, are the files in the pack's images/ folder.
func ParseTOML(data []byte, packFiles []string) (s *Schedule, problems []string, err error) {
	var doc map[string]any
	if _, err := toml.Decode(string(data), &doc); err != nil {
		return nil, nil, err
	}
	asJSON, err := json.Marshal(doc)
	if err != nil {
		return nil, nil, err
	}
	return ParseJSON(asJSON, packFiles)
}

// ParseJSON is ParseTOML for a schedule as JSON (as the site's API serves it).
func ParseJSON(data []byte, packFiles []string) (s *Schedule, problems []string, err error) {
	doc, err := jsonschema.UnmarshalJSON(bytes.NewReader(data))
	if err != nil {
		return nil, nil, err
	}
	if err := schema.Validate(doc); err != nil {
		verr, ok := err.(*jsonschema.ValidationError)
		if !ok {
			return nil, nil, err
		}
		return nil, schemaProblems(verr), nil
	}
	s = &Schedule{}
	if err := json.Unmarshal(data, s); err != nil {
		return nil, nil, err
	}
	return s, s.check(packFiles), nil
}

var printer = message.NewPrinter(language.English)

func schemaProblems(e *jsonschema.ValidationError) []string {
	if len(e.Causes) == 0 {
		path := "/" + strings.Join(e.InstanceLocation, "/")
		return []string{fmt.Sprintf("%s: %s", path, e.ErrorKind.LocalizedString(printer))}
	}
	var out []string
	for _, c := range e.Causes {
		out = append(out, schemaProblems(c)...)
	}
	return out
}

// check is README "Rules beyond the JSON Schema", on a schedule that passed
// the schema.
func (s *Schedule) check(packFiles []string) []string {
	var errs []string
	add := func(format string, args ...any) {
		if msg := fmt.Sprintf(format, args...); !slices.Contains(errs, msg) {
			errs = append(errs, msg)
		}
	}

	for i, slot := range s.Slot {
		if every := Every(slot.rotate()); every != 0 && (every < 5*time.Minute || every > 7*24*time.Hour) {
			add("slot %d: rotation interval must be between 5 minutes and 7 days", i+1)
		}
		if p, _ := ParseAt(slot.at()); p.Event != "" && (p.Minute > 12*60 || p.Minute < -12*60) {
			add("slot %d: offset must be at most 12 hours", i+1)
		}
	}

	for _, day := range Weekdays {
		seen := map[string]int{}
		previous, previousMinutes, found := 0, 0, false
		for i, slot := range s.Slot {
			if !slices.Contains(slot.days(), day) {
				continue
			}
			at := slot.at()
			if j, ok := seen[at]; ok {
				add("slot %d starts at %q on %s, like slot %d", i+1, at, day, j+1)
			}
			seen[at] = i
			minutes, _ := FallbackMinutes(at)
			if found && minutes < previousMinutes {
				add("slot %d (%q) is listed after slot %d but starts earlier on %s; keep slots in time order",
					i+1, at, previous+1, day)
			}
			previous, previousMinutes, found = i, minutes, true
		}
		if !found {
			add("no slot applies on %s", day)
		}
	}

	if packFiles != nil {
		named := map[string]bool{}
		for _, slot := range s.Slot {
			for _, img := range slot.Images {
				named[img] = true
				if !slices.Contains(packFiles, img) {
					add("image %q is not in the pack", img)
				}
			}
		}
		lower := map[string]int{}
		for _, f := range packFiles {
			lower[strings.ToLower(f)]++
		}
		for _, f := range packFiles {
			if !named[f] {
				add("image %q is in the pack but not used", f)
			}
			if lower[strings.ToLower(f)] > 1 {
				add("filenames differ only by case: %q", f)
			}
		}
	}
	return errs
}
