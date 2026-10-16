# Decisions

Settled questions, newest first, so they aren't reopened. Add one line (and
the why) whenever something is decided.

| Date | Decision | Why |
|---|---|---|
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
