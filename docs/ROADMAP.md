# Roadmap

Where Wallpy is and what's next. **Update this at the end of every piece of
work** (tick it off, add what you found). Decisions go in
[decisions.md](decisions.md); how-tos in [operations.md](operations.md).

Last updated: 2026-10-17 (Go CLI: all commands)

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

## Now: Go CLI

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
- [ ] E2E: upload on the site → approve → `wallpy download` on a clean machine → wallpaper changes

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
