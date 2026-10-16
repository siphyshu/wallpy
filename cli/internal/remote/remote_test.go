package remote

import "testing"

func TestResolve(t *testing.T) {
	for _, c := range []struct{ ref, slug, site string }{
		{"zelda-wind-waker", "zelda-wind-waker", DefaultSite},
		{"https://wallpy.siphyshu.me/packs/zelda-wind-waker", "zelda-wind-waker", DefaultSite},
		{"https://wallpy.siphyshu.me/packs/zelda-wind-waker/", "zelda-wind-waker", DefaultSite},
		{"http://localhost:3000/packs/ocean-hours", "ocean-hours", "http://localhost:3000"},
	} {
		cl := &Client{Site: DefaultSite}
		slug, err := cl.Resolve(c.ref)
		if err != nil || slug != c.slug || cl.Site != c.site {
			t.Errorf("%s: got (%q, %q, %v)", c.ref, slug, cl.Site, err)
		}
	}
	for _, bad := range []string{"Zelda", "zelda wind", "../x", "-x", "https://x.com/gallery", "ftp://x/packs/a", ""} {
		if _, err := (&Client{Site: DefaultSite}).Resolve(bad); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
}
