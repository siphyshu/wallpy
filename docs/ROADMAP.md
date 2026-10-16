# Roadmap

Where Wallpy is and what's next. **Update this at the end of every piece of
work** (tick it off, add what you found). Decisions go in
[decisions.md](decisions.md); how-tos in [operations.md](operations.md).

Last updated: 2026-10-18 (builders done)

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

- [ ] Scheduler + validator passing `spec/vectors/vectors.json`
- [ ] `wallpy download <slug>` via `/api/packs/<slug>/manifest?download=cli`, verifying SHA-256
- [ ] Set wallpaper: macOS, Windows, Linux (GNOME/KDE/sway…)
- [ ] Background service: launchd, systemd user unit, Task Scheduler
- [ ] GoReleaser: Homebrew tap, winget, Scoop, deb/rpm, AUR
- [ ] Final PyPI release of the Python CLI pointing at the new installers
- [ ] E2E: upload on the site → approve → `wallpy download` on a clean machine → wallpaper changes

## Before launch

- [ ] Cloudflare on `wallpy-cdn.siphyshu.me`: Cache Rule (eligible, respect origin TTL) **and** a response-header rule `Access-Control-Allow-Origin: *` (both together; see operations.md)
- [ ] Swap the temporary admin R2 token `wallpy-admin-setup` for a bucket-scoped `wallpy-site-prod`
- [ ] DNS: `wallpy.siphyshu.me` points at a dead IP; stale `*.siphyshu.me` wildcard
- [ ] Deploy the site (host TBD) with production env vars
- [ ] Footer says "© 2025"
- [ ] Replace trial / unlicensed fonts (Thunder, Megna trial)
- [ ] Push the `monorepo` branch (only when asked)

## Later / ideas

- Weekday pills on Daypack blocks (weekend variants of a time block); the format allows it, the builder doesn't (use Edit as text)
- Withdraw a version that's in review
- Garbage-collect R2 blobs no version uses (deleting a pack keeps its images)
- Keep moderation history when an owner deletes a declined pack (deleting cascades it today)
