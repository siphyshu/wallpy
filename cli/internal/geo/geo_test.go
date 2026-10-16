package geo

import (
	"context"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestFromZone(t *testing.T) {
	for zone, want := range map[string][3]float64{
		"Asia/Kolkata":     {22.53, 88.37},
		"Europe/Berlin":    {52.50, 13.37},
		"America/New_York": {40.71, -74.01},
		"Australia/Sydney": {-33.87, 151.22},
	} {
		p, err := FromZone(zone)
		if err != nil {
			t.Fatal(err)
		}
		if math.Abs(p.Latitude-want[0]) > .01 || math.Abs(p.Longitude-want[1]) > .01 || p.Timezone != zone {
			t.Errorf("%s: %+v", zone, p)
		}
	}
	if _, err := FromZone("Mars/Olympus_Mons"); err == nil {
		t.Error("unknown zone found")
	}
}

func TestParseCoordinates(t *testing.T) {
	if p, ok := ParseCoordinates("52.52, 13.40"); !ok || p.Latitude != 52.52 || p.Longitude != 13.4 {
		t.Errorf("%+v %v", p, ok)
	}
	for _, bad := range []string{"Berlin", "95,10", "10,190", "1;2"} {
		if _, ok := ParseCoordinates(bad); ok {
			t.Errorf("%q accepted", bad)
		}
	}
}

func TestSearch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("name") == "nowhere" {
			w.Write([]byte(`{}`))
			return
		}
		w.Write([]byte(`{"results":[{"name":"Berlin","latitude":52.52,"longitude":13.41,"timezone":"Europe/Berlin","country":"Germany","admin1":"State of Berlin"}]}`))
	}))
	defer srv.Close()
	SearchURL = srv.URL
	got, err := Search(context.Background(), "Berlin")
	if err != nil || len(got) != 1 || got[0].Name != "Berlin, State of Berlin, Germany" || got[0].Timezone != "Europe/Berlin" {
		t.Errorf("%+v %v", got, err)
	}
	if _, err := Search(context.Background(), "nowhere"); err != ErrNoMatch {
		t.Errorf("got %v", err)
	}
}
