# Roadmap

Where Wallpy is and what's next. **Update this at the end of every piece of
work** (tick it off, add what you found). Decisions go in
[decisions.md](decisions.md); how-tos in [operations.md](operations.md).

Last updated: 2026-10-18

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

## Now: builders on the v2 slot model

Proposal sent 2026-10-18, **waiting for sign-off** (design matters: reuse existing
components and classes, check screenshots).

- [ ] Builder state is the v2 slot list (no v1-shaped `timeblocks/days/album` state)
- [ ] Remove v1 from the site entirely (v1 import in ScheduleUploader, `scheduleToBuilder` v1 branch)
- [ ] Daypack: start-time picker (event + offset, or clock time); blocks shown in time order; per-block "Change images: across the block / every …"
- [ ] Weekpack: day groups with weekday pills; presets (one per day, weekdays/weekend, every day); uncovered-day warning
- [ ] Album: custom interval (5m–7d) after the presets
- [ ] Schedules the builder can't show: show as text with a note, never reshape silently
- [ ] Open question: weekday pills on Daypack blocks? (recommended: not now)
- [ ] E2E for Daypack + Weekpack wizards (Album is covered)

## Next: Go CLI

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

- Withdraw a version that's in review
- Garbage-collect R2 blobs no version uses (deleting a pack keeps its images)
- Keep moderation history when an owner deletes a declined pack (deleting cascades it today)
