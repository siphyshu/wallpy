package geo

// Offline city search over GeoNames' cities of 15,000+ people, with the
// other names they're known by. Data: GeoNames (geonames.org), CC BY 4.0;
// regenerate with gen/main.go.

import (
	"bufio"
	"bytes"
	"compress/gzip"
	_ "embed"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"

	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
)

//go:embed cities.tsv.gz
var citiesGz []byte

type city struct {
	name                 string
	keys                 []string // normalized name and aliases
	admin, country, code string
	lat, lon             float64
	tz                   string
	pop                  int
}

func (c city) place() state.Place {
	name := c.name
	for _, part := range []string{c.admin, c.country} {
		if part != "" && !strings.HasPrefix(normalize(part), normalize(c.name)) { // "São Paulo, São Paulo" says it twice
			name += ", " + part
		}
	}
	return state.Place{Name: name, Location: spec.Location{Latitude: c.lat, Longitude: c.lon, Timezone: c.tz}}
}

var cities = sync.OnceValue(func() []city {
	zr, err := gzip.NewReader(bytes.NewReader(citiesGz))
	if err != nil {
		panic(err)
	}
	var out []city
	sc := bufio.NewScanner(zr)
	sc.Buffer(make([]byte, 1<<16), 1<<20)
	for sc.Scan() {
		f := strings.Split(sc.Text(), "\t")
		if len(f) < 9 || strings.HasPrefix(f[0], "#") {
			continue
		}
		c := city{name: f[0], admin: f[2], country: f[3], code: f[4], tz: f[7]}
		c.lat, _ = strconv.ParseFloat(f[5], 64)
		c.lon, _ = strconv.ParseFloat(f[6], 64)
		c.pop, _ = strconv.Atoi(f[8])
		c.keys = append(c.keys, normalize(f[0]))
		if f[1] != "" {
			for _, a := range strings.Split(f[1], ";") {
				c.keys = append(c.keys, normalize(a))
			}
		}
		out = append(out, c)
	}
	return out
})

var stripMarks = transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)

// normalize makes names comparable: lower case, no accents, hyphens and
// dots as spaces, single spaces.
func normalize(s string) string {
	s, _, _ = transform.String(stripMarks, s)
	s = strings.ToLower(strings.NewReplacer("-", " ", ".", " ", "'", "").Replace(s))
	return strings.Join(strings.Fields(s), " ")
}

// match scores how well q names a city, best first: 0 exactly, 1 the
// start, 2 the start of a word, 3 anywhere (4+ letters); -1 not at all.
// byName reports whether the best match was the city's own name (keys[0])
// rather than an alias.
func match(keys []string, q string) (tier int, byName bool) {
	tier = -1
	for i, k := range keys {
		t := -1
		switch {
		case k == q:
			t = 0
		case strings.HasPrefix(k, q):
			t = 1
		case strings.Contains(" "+k, " "+q):
			t = 2
		case len(q) >= 4 && strings.Contains(k, q):
			t = 3
		}
		if t >= 0 && (tier < 0 || t < tier || (t == tier && i == 0)) {
			tier, byName = t, i == 0
		}
	}
	return tier, byName
}

// weight ranks matches within a tier: population, with a strong preference
// for a city's own name, so "new delhi" is New Delhi (not Delhi, which also
// answers to it) while "calcutta" is still Kolkata, not a small town that
// happens to be named Calcutta.
func weight(c city, byName bool) int {
	if byName {
		return c.pop * 50
	}
	return c.pop
}

// Lookup searches the offline city list. "bangalore" finds Bengaluru;
// text after a comma narrows by state or country ("paris, texas",
// "springfield, il", "london, ca"). Best matches first, then bigger cities.
func Lookup(query string) []state.Place {
	parts := strings.Split(query, ",")
	q := normalize(parts[0])
	if q == "" {
		return nil
	}
	var within []string
	for _, p := range parts[1:] {
		if p = normalize(p); p != "" {
			within = append(within, p)
		}
	}
	type hit struct {
		c      city
		score  int
		weight int
	}
	var hits []hit
	for _, c := range cities() {
		score, byName := match(c.keys, q)
		if score < 0 {
			continue
		}
		ok := true
		for _, w := range within {
			admin, country, code := normalize(c.admin), normalize(c.country), strings.ToLower(c.code)
			if !(strings.HasPrefix(admin, w) || strings.HasPrefix(country, w) || code == w || initials(admin) == w) {
				ok = false
				break
			}
		}
		if ok {
			hits = append(hits, hit{c, score, weight(c, byName)})
		}
	}
	sort.SliceStable(hits, func(i, j int) bool {
		if hits[i].score != hits[j].score {
			return hits[i].score < hits[j].score
		}
		return hits[i].weight > hits[j].weight
	})
	var out []state.Place
	for i := 0; i < len(hits) && i < 8; i++ {
		out = append(out, hits[i].c.place())
	}
	return out
}

// initials lets "il" mean Illinois and "nsw" New South Wales.
func initials(s string) string {
	var b strings.Builder
	for _, w := range strings.Fields(s) {
		b.WriteByte(w[0])
	}
	return b.String()
}
