// Package geo finds where the user is, for sunrise and sunset: from the
// system time zone (offline), a city search (offline, then online), or
// coordinates.
package geo

import (
	"bufio"
	"context"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/siphyshu/wallpy/cli/internal/spec"
	"github.com/siphyshu/wallpy/cli/internal/state"
)

// zone.tab from the IANA time zone database (public domain): one line per
// zone with the coordinates of its principal city.
//
//go:embed zone.tab
var zoneTab string

// SystemZone is the IANA name of this computer's time zone, if it can tell.
func SystemZone() string {
	if tz := os.Getenv("TZ"); tz != "" && !strings.HasPrefix(tz, ":/") {
		return strings.TrimPrefix(tz, ":")
	}
	if target, err := os.Readlink("/etc/localtime"); err == nil {
		if i := strings.Index(target, "zoneinfo/"); i >= 0 {
			return target[i+len("zoneinfo/"):]
		}
	}
	if data, err := os.ReadFile("/etc/timezone"); err == nil { // Debian
		return strings.TrimSpace(string(data))
	}
	return ""
}

// FromZone is the principal city of an IANA time zone.
func FromZone(zone string) (*state.Place, error) {
	sc := bufio.NewScanner(strings.NewReader(zoneTab))
	for sc.Scan() {
		f := strings.Split(sc.Text(), "\t")
		if len(f) < 3 || strings.HasPrefix(f[0], "#") || f[2] != zone {
			continue
		}
		lat, lon, err := parseISO6709(f[1])
		if err != nil {
			return nil, err
		}
		city := strings.ReplaceAll(filepath.Base(zone), "_", " ")
		return &state.Place{Name: city, Location: spec.Location{Latitude: lat, Longitude: lon, Timezone: zone}}, nil
	}
	return nil, fmt.Errorf("the time zone %q isn't one wallpy knows a city for", zone)
}

// parseISO6709 reads zone.tab coordinates: ±DDMM±DDDMM or ±DDMMSS±DDDMMSS.
func parseISO6709(s string) (lat, lon float64, err error) {
	split := strings.IndexAny(s[1:], "+-") + 1
	if split <= 0 {
		return 0, 0, fmt.Errorf("bad coordinates %q", s)
	}
	part := func(p string, degDigits int) (float64, error) {
		sign := 1.0
		if p[0] == '-' {
			sign = -1
		}
		d := p[1:]
		if len(d) < degDigits+2 {
			return 0, fmt.Errorf("bad coordinates %q", s)
		}
		deg, _ := strconv.Atoi(d[:degDigits])
		min, _ := strconv.Atoi(d[degDigits : degDigits+2])
		sec := 0
		if len(d) >= degDigits+4 {
			sec, _ = strconv.Atoi(d[degDigits+2 : degDigits+4])
		}
		return sign * (float64(deg) + float64(min)/60 + float64(sec)/3600), nil
	}
	if lat, err = part(s[:split], 2); err != nil {
		return
	}
	lon, err = part(s[split:], 3)
	return
}

// ParseCoordinates reads "52.52,13.40" (in the system time zone).
func ParseCoordinates(s string) (*state.Place, bool) {
	a, b, ok := strings.Cut(strings.ReplaceAll(s, " ", ""), ",")
	if !ok {
		return nil, false
	}
	lat, err1 := strconv.ParseFloat(a, 64)
	lon, err2 := strconv.ParseFloat(b, 64)
	if err1 != nil || err2 != nil || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return nil, false
	}
	zone := SystemZone()
	if zone == "" {
		zone = "UTC"
	}
	return &state.Place{Name: fmt.Sprintf("%.2f, %.2f", lat, lon),
		Location: spec.Location{Latitude: lat, Longitude: lon, Timezone: zone}}, true
}

// SearchURL is Open-Meteo's free geocoding API (no key). Tests replace it.
var SearchURL = "https://geocoding-api.open-meteo.com/v1/search"

// ErrNoMatch means the search found nothing.
var ErrNoMatch = errors.New("no place matches")

// Search finds places by name, most relevant first: the offline city list,
// then (only if that has nothing) Open-Meteo's online search for smaller
// places.
func Search(ctx context.Context, query string) ([]state.Place, error) {
	if found := Lookup(query); len(found) > 0 {
		return found, nil
	}
	return searchOnline(ctx, query)
}

func searchOnline(ctx context.Context, query string) ([]state.Place, error) {
	u := SearchURL + "?" + url.Values{"name": {query}, "count": {"8"}, "language": {"en"}, "format": {"json"}}.Encode()
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("couldn't reach the place search (geocoding-api.open-meteo.com): %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("the place search answered %s", res.Status)
	}
	var body struct {
		Results []struct {
			Name      string  `json:"name"`
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			Timezone  string  `json:"timezone"`
			Country   string  `json:"country"`
			Admin1    string  `json:"admin1"`
		} `json:"results"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, err
	}
	var out []state.Place
	for _, r := range body.Results {
		if r.Timezone == "" {
			continue
		}
		name := r.Name
		for _, extra := range []string{r.Admin1, r.Country} {
			if extra != "" && extra != r.Name && !strings.Contains(name, extra) {
				name += ", " + extra
			}
		}
		out = append(out, state.Place{Name: name, Location: spec.Location{Latitude: r.Latitude, Longitude: r.Longitude, Timezone: r.Timezone}})
	}
	if len(out) == 0 {
		return nil, ErrNoMatch
	}
	return out, nil
}
