# Decisions

Settled questions, newest first, so they aren't reopened. Add one line (and
the why) whenever something is decided.

| Date | Decision | Why |
|---|---|---|
| 2026-10-17 | CLI releases are tagged `v*` from the monorepo and built from `cli/` (GoReleaser OSS has no monorepo tag prefixes) | The site isn't versioned, so `v*` can mean the CLI |
| 2026-10-17 | Background agent is resident (`wallpy run`), sleeping until the next change, not a 5-minute tick | Changes land on time (e.g. right at sunset); it re-checks at least every minute for sleep and clock changes |
| 2026-10-17 | Linux agent starts through XDG autostart, not a systemd user unit | Autostart runs inside the graphical session, so the agent sees DISPLAY/WAYLAND_DISPLAY/XDG_CURRENT_DESKTOP; systemd user units often don't |
| 2026-10-17 | The agent only sets the wallpaper when the scheduled image changes | If someone picks another wallpaper by hand, Wallpy doesn't fight it until the next change |
| 2026-10-17 | `location auto` uses the IANA zone.tab (embedded, offline). City search is offline first: GeoNames cities of 15,000+ people with their other names (CC BY 4.0, ~1.4 MB embedded), ranked by match then population (own name ×50); Open-Meteo online only when nothing matches | Open-Meteo alone matches only primary names: "bangalore" found a town in Pakistan, not Bengaluru. Offline is also instant and private |
| 2026-10-17 | macOS wallpaper via AppKit (`NSWorkspace.setDesktopImageURL`) through purego, on the main thread, waiting until applied | AppleScript needs an Automation permission prompt; cgo complicates cross-compiled releases; AppKit crashes off the main thread and applies changes asynchronously |
| 2026-10-17 | The CLI counts a download only after a successful install, and only against the real site (never with `WALLPY_SITE`) | Accurate numbers; local dev shares the production DB |
| 2026-10-17 | CLI commands designed around tasks, not the Python CLI: `use` installs + switches + sets + starts the service; `show` absorbs info/preview; no `config`/`service` groups (`pause`/`resume`/`doctor` instead) | Fewer verbs; the common path is one command |
| 2026-10-17 | CLI stack: Cobra + Fang for commands, Charm (Lip Gloss, Huh, Bubble Tea) for everything shown; one `internal/ui` design system | The CLI should feel crafted at every touchpoint; Cobra gives structure and completion, Charm gives the look. Interactive screens only on a TTY |
| 2026-10-17 | Go CLI lives at `cli/` (module `github.com/siphyshu/wallpy/cli`); the Python CLI moved to `cli/python/` until its final PyPI release | One CLI folder; history kept with `git mv` |
| 2026-10-17 | Go solar events: astral's NOAA routine ported line for line, not a Go sun library | Matches the reference exactly instead of within tolerance |
| 2026-10-18 | Builders hold spec 2 slots directly; anything a builder can't show exactly opens as text ("Edit as text"), never reshaped | What you see is what's submitted |
| 2026-10-18 | Daypack blocks are always listed and written in start order; picking a new solar event clears the offset | Order rule can't fail; offsets usually belong to their event |
| 2026-10-18 | Builders write a label on every slot (the block or group name) | Names show in previews and the CLI; harmless if unused |
| 2026-10-18 | No weekday pills on Daypack blocks for now | Keeps Daypack and Weekpack distinct; text mode covers mixed schedules |
| 2026-10-18 | Spec 1 is retired everywhere: the site accepts and shows only spec 2; the Go CLI reads spec 2 only | All production packs are already spec 2; one format to maintain |
| 2026-10-18 | **Decline** = final no for *new* packs (closes the pack). Updates to published packs get *request changes* or a takedown | A decline on an update would strand the live pack |
| 2026-10-18 | Owners may delete declined packs; images stay in R2 (shared by hash) | Lets people clear dead packs without risking images other packs use |
| 2026-10-18 | Thumbnails/previews follow `can_use_blob`, like pack files | Otherwise any stored hash could be claimed as a thumbnail |
| 2026-10-18 | New versions start from the latest rejected version, else the current one; one open (pending) version per pack | Matches "make changes" vs "update"; keeps review simple |
| 2026-10-16 | Pack format spec 2: ordered `[[slot]]`s with start times only, explicit `rotate`, portable shuffle, wall-clock arithmetic | Simpler and stronger than spec 1; see docs/spec-v2-proposal.md |
| 2026-10-16 | CLI rewritten in Go, shipped with GoReleaser; Python CLI retired (no further testing) | Single binary for brew / winget / apt |
| 2026-10-16 | AI disclosure: none / AI-assisted / AI-generated, required to submit; shown as a label, credit stays "by <name>" | Honest without discrediting the author |
| 2026-10-16 | Licence from a fixed list (personal use, CC BY, CC BY-NC, CC0, other) | Machine-readable, filterable |
| 2026-10-16 | Site: latest Next.js (App Router), strict TypeScript, DB types generated from the live schema | |
| 2026-10-16 | Files on Cloudflare R2 (public bucket, SHA-256 keys); Supabase for DB + auth | No egress fees; immutable, cacheable URLs |
| 2026-10-16 | Favourites are private | |
| 2026-10-15 | Monorepo: `cli/ site/ spec/ supabase/` | The spec is shared by site and CLI |
| — | UI must match the existing design system: extend existing components and classes, check screenshots | User feedback |
