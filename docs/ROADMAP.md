# Roadmap

Where Wallpy is and what's next. **Update this at the end of every piece of
work** (tick it off, add what you found). Decisions go in
[decisions.md](decisions.md); how-tos in [operations.md](operations.md).

Last updated: 2026-10-17 (CLI feature-complete; site next)

## Goal

Ship the site (wallpy.siphyshu.me), tested end to end, and a Go CLI
(single binary via brew / winget / apt) that installs packs from it.

## Done

- [x] Diagnosis, security lockdown, monorepo (`cli/ site/ spec/ supabase/`)
- [x] Storage on Cloudflare R2 (`wallpy-public`, served from `wallpy-cdn.siphyshu.me`); Supabase for DB + auth
- [x] Data model v2 ([schema-design.md](schema-design.md)): versions, content-addressed blobs, moderation state machine
- [x] Pack format spec 2 ([../spec/README.md](../spec/README.md)): reference implementation, 23 test vectors, TS port in `site/lib/spec`
- [x] Site on Next 16 + strict TypeScript, types generated from the live schema
- [x] AI-use disclosure (none / assisted / generated); credit stays "by <name>"
- [x] Upload: hash-pinned presigned PUTs, proof-of-upload tickets, atomic `create_pack`
- [x] Review queue: approve, request changes (with a note), decline (final, new packs only)
- [x] New versions: `/packs/<slug>/edit` for changes after review and for updates; existing images reused
- [x] Owners can delete declined packs from their profile
- [x] Production cleaned of test data (2026-10-18); sample packs in [../samples](../samples)
- [x] Builders on the v2 slot model (2026-10-18): state is spec 2 slots; v1 removed from the site; Daypack start-time picker + per-block "change images"; Weekpack day groups with presets; Album custom interval; "Edit as text" for anything the builders can't show; e2e for Daypack + Weekpack (`test:e2e:builders`)

## Now: the site

The CLI is feature-complete; it gets published once the site is
feature-complete too (the CLI downloads from wallpy.siphyshu.me, which isn't
live yet). Next: walk the site's user flows end to end with Jaiyank, then
design and feature work. Collected so far:

- [ ] Walk every user flow end to end (visitor, creator, moderator) and list what's missing or rough
- [ ] CLI docs on the site (install, commands, how the agent works; cli/README.md has the content)
- [ ] Install section on the homepage: it's only a heading ("Install Wallpy in 3 steps") with no steps
- [ ] Pack pages say `wallpy download <slug>` (components/packs/InstallCommand.tsx): use `wallpy use <slug>`
- [ ] Decide: can creators upload a ready-made pack folder or zip (schedule.toml + images)? Today only the builders
- [ ] Design pass across the site

Walkthrough findings (2026-10-17):

Visitor (home, gallery, pack page, profile)
- [ ] Navbar "Docs" links to `/docs`, which 404s
- [ ] Hero "Install Wallpy →" links to PyPI (the retired Python CLI); pack pages' "Install it first" links to `/#install`, but `<InstallSection />` is commented out in `app/page.tsx`
- [ ] No navigation on phones: the navbar hides Docs/Gallery/Github below `md` and there's no menu button (`isMobileMenuOpen` is never used)
- [ ] Gallery categories are a fixed list (`GalleryFilters.tsx`) but tags are free text, so chips only match exact tags: Zelda shows under Gaming only because its creator happened to type `gaming`; Ocean Hours isn't under Nature. Either pick tags from the category list at upload, or build the chips from tags in use
- [ ] Gallery search, category and sort aren't in the URL (only `?tag=` on first load): back button and shared links lose them
- [ ] Sort dropdown renders under the cards' "AI-generated" badge (z-index)
- [ ] Pack page images are slow: only the cover gets a thumb/preview at upload (gallery cards are 20–60 KB, fine), so `PackImageGallery` runs every ~4 MB original through the Next optimizer; thumbnails sit blank on first view. Make a small preview for every image at upload
- [ ] Pack page doesn't show the schedule, which is the point of a dynamic pack: what shows when (dawn → morning → dusk → night), ideally with a "now" marker like the CLI's sky strip
- [ ] Gallery cards don't say what kind of pack it is (Daypack / Weekpack / Album)
- [ ] Download counts show 0 everywhere; consider hiding at 0
- [ ] 404 page is Next's default (black, unstyled)
- [x] Profile "Contact Email" field is public but only labelled "(optional)"; say it's shown on the profile (2026-10-17: "Shown publicly on your profile.")
- [x] Profile shows "Published" status badges to visitors (only the owner needs them) (2026-10-17; visitors with no packs also no longer see "Upload your first pack")
- Fine: favourite while signed out → login with `?redirect=` back; `/upload` and `/edit` redirect to login; `/moderation` 404s for non-moderators; ZIP builds in the browser with hash checks and progress; CDN CORS allows localhost

Accounts (sign-up, login, reset; read through, not submitted: they hit production)
- [x] Sign-up doesn't check the username: the DB requires `^[a-z0-9_]{3,30}$` and uniqueness (`handle_new_user` trigger), so "John Doe", "jd" or a taken name fail with Supabase's generic "Database error saving new user". Validate inline, check availability, and show the rule (2026-10-17: `lib/username.ts`; lowercased as typed, rule/problem/"Available" under the field, availability via the public `profiles` select, the generic error mapped to a username message)
- [x] After the email code, sign-up goes to `/gallery`, dropping any `?redirect=` (e.g. a visitor who hit Upload); a new creator also lands with an empty profile and no nudge to fill it in (2026-10-17: `?redirect=` honoured via `safeRedirectPath` and carried across the login ↔ sign-up links; an amber "Fill in your profile" notice on your own profile while avatar and bio are empty)
- Fine: password reset (tested by Jaiyank)
- [x] Auth pages all have the generic site title ("Wallpy - Dynamic Wallpapers for your desktop") (2026-10-17: sign in, sign up, reset/choose password, check your email, error. The homepage keeps the site title; `/auth/sign-out` renders nothing)

Creator (from the e2e suites' screenshots: ui, builders, versions; 75/75 checks passed)
- [ ] Wizard uses blue steps/Next and a green-ish "Upload Wallpack", not the design system (white primary, `bg-white/10` secondary)
- [ ] Wizard state is only in memory: a refresh or a stray link loses everything, with no "leave page?" warning
- [ ] Next is disabled on Details with no reason shown (title, tags and the AI question are required; tags is easy to miss)
- [ ] Details come before images; images first would let the cover, title and AI question follow from what was uploaded
- [ ] The cover is always the first uploaded image; no way to pick it
- [ ] Schedule step leads with the raw `schedule.toml` (a tall, mostly empty code box), an "Upload schedule file" panel and a long Configuration Guide; the builder and preview are what creators need. Collapse the TOML and the guide behind "Advanced"/"Help"
- [ ] Daypack's time blocks scroll inside a fixed-height panel, so blocks below the fold are easy to miss
- [ ] Review step shows the pack's size with a download icon ("⬇ 50 KB"), which reads like a download button; tags show as typed (#Test) though they're stored lowercase
- [ ] No notifications: creators aren't told (email or in-site) when a pack is approved, sent back or declined; they have to check their profile
- [ ] "Waiting for review" doesn't say what happens next or how long it usually takes
- [ ] Owners can't unlist or delete a published pack (the DB has `is_listed`; only declined packs can be deleted), or withdraw a version in review (already under Later)
- [ ] No upload from a ready-made folder/zip (already listed above)

Moderator (from the e2e screenshots)
- [ ] An update shows only "Update · vN": no diff against the live version (images added/removed, schedule, title/tags/licence changes)
- [ ] The queue card doesn't show the schedule or tags; the moderator has to open the pack page to judge them
- [ ] No takedown/restore for published packs, though `moderate()` supports both; no way for visitors to report a pack
- [ ] No moderation history (who approved/declined what, when)
- [ ] Cover on the queue card stretches past 16:9 (flex row overrides `aspect-video`) and crops the image
- Fine: decline needs a reason; the uploader sees the note; declined packs can't be resubmitted and can be deleted; approve publishes and lists in the gallery; v1 stays live while v2 is in review; a second pending version is refused; unchanged images aren't re-uploaded
Profile editing (walked 2026-10-17 with a throwaway user; now `npm run test:e2e:profile`, 28 checks)
- Fine: name, bio, links, contact email, avatar and cover save, survive a reload and show to signed-out visitors; images land in `profiles/<id>/`
- [x] Fixed: a link without `https://` or a malformed contact email failed the DB check with a raw constraint error; now checked first with a clear message (`lib/profile-fields.ts`), scheme added for bare domains. Link URLs were silently cut at 100 characters (DB allows 300), name at 50 (DB 60). Images over 5 MB only failed on Save; now on picking. "Add Link" was blue; now the `bg-white/10` secondary pill
- [ ] Navbar avatar doesn't update after saving a new one until the page reloads (it loads the profile once on mount)
- [ ] No way to remove an avatar or cover once set (only replace); replaced files stay in R2 under `profiles/<id>/`
- [ ] `profiles.website` exists (filled for v1 users) but the profile neither shows nor edits it; links cover the same need
- [ ] With no display name the profile shows an empty heading above `@username` (sign-up asks for a name, so mostly old/test accounts)

## Go CLI: feature-complete (publish after the site)

Goal: the CLI should feel delightful, crafted at every touchpoint from install
to everyday use. Stack: Cobra + Fang (commands, help, errors), Lip Gloss (all
output, via `internal/ui`), Huh (prompts), Bubble Tea + Bubbles (interactive
screens). Plain output when piped, `NO_COLOR` respected, the background tick
silent and instant. Check every screen in a light and a dark terminal (VHS).

- [x] Scheduler + validator passing `spec/vectors/vectors.json` (2026-10-17): `cli/internal/spec`; solar maths ported from astral, identical to the second on 3,660 sample times
- [x] Foundation (2026-10-17): Cobra + Fang skeleton (`wallpy`, `--help`, `--version`, completion) and `internal/ui`, the terminal design system: the site's monochrome hierarchy plus one accent, the colour of the sky right now; a 24h sky strip; errors in Wallpy's voice with "did you mean"; adapts to light/dark; plain when piped
Commands (designed fresh, not copied from the Python CLI): `wallpy` (home),
`use <pack|url|folder>` (install if needed, switch, set now, start the service
on first use), `browse`, `show [--at]`, `list`, `get` (alias `download`),
`update`, `remove`, `location`, `pause`/`resume`, `doctor`, `check <folder>`,
hidden `run` for the service.

- [x] `wallpy get <slug|url>` (2026-10-17): manifest → parallel downloads streamed through SHA-256 + size checks → schedule validated against the files → atomic swap; reinstall reuses verified local files (`--force` repairs); Ctrl-C leaves nothing; downloads counted (`?download=cli`) only after a successful install on the real site. Packs live in `library.Home()` (per-OS data dir, `WALLPY_HOME` overrides)
- [x] `wallpy` home screen (2026-10-17): active pack, sky strip on real sun times, today's slots with the current one marked, next change
- [x] `use` (slug, link or folder: installs/imports, sets now, starts the agent), `list`, `show [--at]` (also for gallery packs, without installing), `remove` (asks first), `update` (reuses unchanged images), `check <folder>`, `location` (auto from time zone via embedded zone.tab, city search via Open-Meteo, lat,lon), `pause`/`resume`, `uninstall` (removes the agent, optionally packs and settings, saving the wallpaper on screen; prints the package manager's remove command), `doctor` (wallpaper method, agent, pack hashes, location, last agent error)
- [x] Set wallpaper (2026-10-17): `internal/wallpaper`. macOS via AppKit through purego (no cgo, no AppleScript prompt; main thread only, waits until macOS applies it; checked live with `WALLPY_TEST_DESKTOP=1`). Windows via SystemParametersInfo (compile-checked). Linux/BSD: GNOME, Cinnamon, MATE, KDE, Xfce, LXQt, sway, Hyprland (swww/hyprpaper), feh (selection unit-tested; not yet run on a Linux desktop)
- [x] Background agent (2026-10-17): `wallpy run` sleeps until the next change (waking at least every minute), one at a time via `agent.lock`, logs to `agent.log`; launchd LaunchAgent (tested live), XDG autostart on Linux, Task Scheduler logon task on Windows (both compile-checked)
- [x] `wallpy browse [search]` (2026-10-17): Bubble Tea gallery, previews drawn in half blocks (any colour terminal), `/` filter, Enter installs and uses; plain list when piped
- [x] Guided first run (2026-10-17): first `wallpy` in a terminal asks where you are (time-zone guess first) and opens the gallery; prompts themed from `internal/ui`
- [x] Sharper previews (2026-10-17): Kitty graphics with Unicode placeholders in Ghostty and Kitty (real pixels; half blocks show first, then the image), better half blocks elsewhere (Catmull-Rom resampling, cached per size); `WALLPY_IMAGES=kitty|blocks` overrides detection. Kitty output is unit-tested against the protocol, not yet seen in Ghostty by a person
- [x] Gallery links (2026-10-17): `o` in browse, `wallpy show <pack> --web`, pack titles are OSC 8 links in show/get/list/update/use/home
- [x] `show` draws the pack's picture (2026-10-17): the image on screen now or at `--at`; Kitty graphics or half blocks; fetches one image for gallery packs
- [x] Update notices (2026-10-17): once a day, in the background, GitHub's latest release; one line on stderr with the upgrade command for how wallpy was installed; never for dev builds, the agent, pipes or CI; `WALLPY_NO_UPDATE_CHECK=1`
- Tabled: `wallpy new` (pack creation stays on the site's builders; the CLI keeps `check` and `use ./folder`)
- [x] iTerm2 and Sixel previews (2026-10-17): iTerm2/WezTerm use iTerm2 inline images, foot/Windows Terminal/Konsole/mlterm use Sixel; in browse the box is left blank and the image painted into it; printed images reserve their rows first, so terminals' differing cursor behaviour doesn't matter. Data and placement are unit-tested; not yet seen in those terminals by a person
- [x] GoReleaser config (2026-10-17): `cli/.goreleaser.yaml`, cgo-free builds for macOS/Linux/Windows (amd64, arm64) and FreeBSD, archives with completions + man page, deb/rpm/apk, Homebrew cask, Scoop, winget, AUR; `--snapshot` verified
- [ ] Publish the first release (needs the tap/bucket repos, winget fork, AUR key and tokens: operations.md "Release the CLI")
- [ ] Sign and notarize macOS binaries (Apple Developer ID); sign Windows binaries (SmartScreen)
- [ ] Run on a real Linux desktop (GNOME, KDE, sway) and a real Windows machine: setters and agent are compile-checked and unit-tested only
- [ ] Final PyPI release of the Python CLI pointing at the new installers
- [x] E2E (2026-10-17, by Jaiyank): upload on the site → approve → install with the CLI → wallpaper changes

## Before launch

- [ ] Cloudflare on `wallpy-cdn.siphyshu.me`: Cache Rule (eligible, respect origin TTL) **and** a response-header rule `Access-Control-Allow-Origin: *` (both together; see operations.md)
- [ ] Swap the temporary admin R2 token `wallpy-admin-setup` for a bucket-scoped `wallpy-site-prod`
- [ ] DNS: `wallpy.siphyshu.me` points at a dead IP; stale `*.siphyshu.me` wildcard
- [ ] Deploy the site (host TBD) with production env vars
- [x] Footer year updated to 2026 (2026-10-17)
- [ ] Replace trial / unlicensed fonts (Thunder, Megna trial)
- [ ] Push the `monorepo` branch (only when asked)

## Later / ideas

- Weekday pills on Daypack blocks (weekend variants of a time block); the format allows it, the builder doesn't (use Edit as text)
- Withdraw a version that's in review
- Garbage-collect R2 blobs no version uses (deleting a pack keeps its images)
- Keep moderation history when an owner deletes a declined pack (deleting cascades it today)
