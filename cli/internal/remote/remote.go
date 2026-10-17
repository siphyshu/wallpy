// Package remote talks to the Wallpy site's API (site/app/api).
package remote

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"runtime"
	"strings"
	"time"
)

// DefaultSite is where packs come from. WALLPY_SITE overrides it (local
// development: http://localhost:3000).
const DefaultSite = "https://wallpy.siphyshu.me"

// Manifest is GET /api/packs/<slug>/manifest (site/lib/types.ts: Manifest).
type Manifest struct {
	Manifest int             `json:"manifest"`
	Slug     string          `json:"slug"`
	Version  int             `json:"version"`
	Status   string          `json:"status"`
	Title    string          `json:"title"`
	Kind     string          `json:"kind"`
	Credit   Credit          `json:"credit"`
	License  string          `json:"license"`
	AIUse    *string         `json:"aiUse"`
	Schedule json.RawMessage `json:"schedule"`
	Files    []File          `json:"files"`
}

type Credit struct {
	Name string  `json:"name"`
	URL  *string `json:"url"`
}

type File struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
	URL    string `json:"url"`
}

// Size is the total size of the pack's files.
func (m *Manifest) Size() int64 {
	var n int64
	for _, f := range m.Files {
		n += f.Size
	}
	return n
}

// ErrNotFound means the site has no public pack with that slug.
var ErrNotFound = errors.New("pack not found")

// Unreachable wraps a network failure: the site couldn't be reached at all.
type Unreachable struct {
	Host string
	Err  error
}

func (e *Unreachable) Error() string { return "couldn't reach " + e.Host + ": " + e.Err.Error() }
func (e *Unreachable) Unwrap() error { return e.Err }

// Client is the site API.
type Client struct {
	Site      string // origin, no trailing slash
	HTTP      *http.Client
	UserAgent string
}

// New is a Client for the configured site.
func New(version string) *Client {
	site := strings.TrimRight(os.Getenv("WALLPY_SITE"), "/")
	if site == "" {
		site = DefaultSite
	}
	if version == "" {
		version = "dev"
	}
	return &Client{
		Site: site,
		HTTP: &http.Client{Transport: &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			ResponseHeaderTimeout: 30 * time.Second,
			TLSHandshakeTimeout:   15 * time.Second,
			MaxIdleConnsPerHost:   8,
		}},
		UserAgent: fmt.Sprintf("wallpy/%s (%s/%s)", version, runtime.GOOS, runtime.GOARCH),
	}
}

// Host is the site's host name, for messages.
func (c *Client) Host() string {
	if u, err := url.Parse(c.Site); err == nil && u.Host != "" {
		return u.Host
	}
	return c.Site
}

var slugRe = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

// Resolve turns what the user typed into a slug: "zelda-wind-waker", or a
// link copied from the site ("https://wallpy.siphyshu.me/packs/zelda-wind-waker").
// A link to another site points the client there.
func (c *Client) Resolve(ref string) (string, error) {
	if !strings.Contains(ref, "://") {
		if slugRe.MatchString(ref) {
			return ref, nil
		}
		return "", fmt.Errorf("%q isn't a pack name: names are lowercase letters, digits and dashes", ref)
	}
	u, err := url.Parse(ref)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") {
		return "", fmt.Errorf("%q isn't a link to a pack", ref)
	}
	parts := strings.Split(strings.Trim(u.Path, "/"), "/")
	if len(parts) < 2 || parts[0] != "packs" || !slugRe.MatchString(parts[1]) {
		return "", fmt.Errorf("%q isn't a link to a pack: pack links look like %s/packs/<name>", ref, c.Site)
	}
	c.Site = u.Scheme + "://" + u.Host
	return parts[1], nil
}

// Manifest fetches a pack's manifest. It doesn't count as a download.
func (c *Client) Manifest(ctx context.Context, slug string) (*Manifest, error) {
	res, err := c.get(ctx, c.Site+"/api/packs/"+url.PathEscape(slug)+"/manifest")
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	switch {
	case res.StatusCode == http.StatusNotFound:
		return nil, ErrNotFound
	case res.StatusCode != http.StatusOK:
		return nil, fmt.Errorf("%s answered %s", c.Host(), res.Status)
	}
	var m Manifest
	if err := json.NewDecoder(io.LimitReader(res.Body, 4<<20)).Decode(&m); err != nil {
		return nil, fmt.Errorf("%s sent a manifest wallpy can't read: %w", c.Host(), err)
	}
	if m.Manifest != 1 {
		return nil, fmt.Errorf("%s sent manifest format %d; update wallpy to install this pack", c.Host(), m.Manifest)
	}
	return &m, nil
}

// CountDownload tells the site a pack was installed. Best effort: a
// failure here never fails an install. Only the real site counts:
// development (WALLPY_SITE) shares the production database, and test
// downloads mustn't inflate real packs' numbers.
func (c *Client) CountDownload(ctx context.Context, slug string) {
	if c.Site != DefaultSite {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if res, err := c.get(ctx, c.Site+"/api/packs/"+url.PathEscape(slug)+"/manifest?download=cli"); err == nil {
		res.Body.Close()
	}
}

// Open starts downloading a file.
func (c *Client) Open(ctx context.Context, f File) (io.ReadCloser, error) {
	res, err := c.get(ctx, f.URL)
	if err != nil {
		return nil, err
	}
	if res.StatusCode != http.StatusOK {
		res.Body.Close()
		return nil, fmt.Errorf("downloading %s: %s", f.Path, res.Status)
	}
	return res.Body, nil
}

func (c *Client) get(ctx context.Context, rawURL string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", c.UserAgent)
	res, err := c.HTTP.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		host := req.URL.Host
		return nil, &Unreachable{Host: host, Err: err}
	}
	return res, nil
}

// Listing is one pack in the gallery (GET /api/packs).
type Listing struct {
	Slug      string `json:"slug"`
	Name      string `json:"name"`
	Author    string `json:"author"`
	Preview   string `json:"preview"`
	Kind      string `json:"kindLabel"`
	AIUse     string `json:"aiUse"`
	Downloads int    `json:"downloads"`
}

// Gallery lists public packs, most popular first.
func (c *Client) Gallery(ctx context.Context, search string) ([]Listing, int, error) {
	q := url.Values{"limit": {"48"}, "sort": {"popular"}}
	if search != "" {
		q.Set("search", search)
	}
	res, err := c.get(ctx, c.Site+"/api/packs?"+q.Encode())
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, 0, fmt.Errorf("%s answered %s", c.Host(), res.Status)
	}
	var body struct {
		Packs []Listing `json:"packs"`
		Total int       `json:"total"`
	}
	if err := json.NewDecoder(io.LimitReader(res.Body, 4<<20)).Decode(&body); err != nil {
		return nil, 0, err
	}
	return body.Packs, body.Total, nil
}

// Fetch downloads a small resource (a preview image), up to 30 MB.
func (c *Client) Fetch(ctx context.Context, rawURL string) ([]byte, error) {
	res, err := c.get(ctx, rawURL)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s", res.Status)
	}
	return io.ReadAll(io.LimitReader(res.Body, 30<<20))
}

// PackURL is a pack's page in the gallery.
func (c *Client) PackURL(slug string) string {
	return c.Site + "/packs/" + url.PathEscape(slug)
}
