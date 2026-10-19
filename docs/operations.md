# Operations

How to run, test and change things. Commands assume the repo root unless they
`cd site`.

## Run the site

```sh
cd site && npm run dev        # http://localhost:3000, uses site/.env.local (production Supabase + R2)
```

There is no separate staging: local dev talks to the production database and
bucket. The e2e tests create throwaway users and delete everything they made.

## Checks

| What | Command | Notes |
|---|---|---|
| Types | `cd site && npm run typecheck` | |
| Lint | `cd site && npm run lint` | 0 errors expected (warnings are `<img>` in the builders) |
| Unit | `cd site && npm test` | Vitest: spec port vs vectors, storage, redirects, username and profile-field checks |
| E2E | `cd site && npm run test:e2e` | Needs `npm run dev` running; api, ui (album), moderation, versions, builders (Daypack + Weekpack, uses samples/), journey (creator → moderator → visitor by clicking only: zip upload, changes requested, notice, resubmit, approve, gallery, report, takedown), profile (sign-up username checks without submitting, profile editing with avatar/cover and removing them, visitor view), owner (unlist/list, delete, withdraw, account deletion both ways), reports (report → moderator sees it in the Reports tab → takedown with a reason → owner sees the reason → restore from the Published tab → pack history; an update's diff against the live version in the Queue), notices (submit → moderator approves/requests changes via RPC → owner sees the navbar dot and the note on `/notices` → dot clears; empty state for someone with no packs) suites (each also runnable alone: `test:e2e:<name>`; `SHOTS=dir` saves screenshots; `BASE=http://localhost:<port>` for another dev server). R2's CORS allows ports 3000 and 3101–3110, so run extra dev servers on those. Cleanup also deletes `profiles/<id>/` images |
| DB security | `supabase/scripts/test_security.sh` | Every migration on a scratch local Postgres, then the attack checks in `supabase/tests/security.sql` |
| Spec | `pytest spec/tests` | Needs `pip install -r spec/requirements.txt` |
| CLI | `cd cli && go vet ./... && go test ./...` | Runs `spec/vectors/vectors.json`; after changing `spec/schedule.schema.json`, copy it to `cli/internal/spec/` (a test checks) |
| CLI look | `cd cli && go run ./cmd/wallpy` in a dark **and** a light terminal; `vhs <tape>` records both (needs `brew install vhs`) | Every screen goes through `internal/ui`; piped output must be plain (`go run ./cmd/wallpy \| cat -v`) |
| CLI against dev | `WALLPY_SITE=http://localhost:3000 WALLPY_HOME=$(mktemp -d) go run ./cmd/wallpy get zelda-wind-waker` | `WALLPY_SITE` points at another site (downloads aren't counted there: dev shares the production DB); `WALLPY_HOME` keeps test packs out of your real library |
| CLI desktop check | `cd cli && WALLPY_TEST_DESKTOP=1 go test ./internal/wallpaper` | Really changes the wallpaper, verifies, restores the original (refuses if the original file can't be found) |
| Build | `cd site && npm run build` | |

Local Postgres for the security tests: Homebrew `postgresql@17` on
`localhost:54329`, user `postgres`.

## Change the database

1. Add `supabase/migrations/<yyyymmddhhmmss>_<name>.sql`.
2. Add attack checks to `supabase/tests/security.sql`; run `supabase/scripts/test_security.sh`.
3. Apply: `supabase/scripts/prod_sql.py migrate supabase/migrations/<file>.sql` (one transaction, recorded in `supabase_migrations.schema_migrations`).
4. Regenerate types: `cd site && npm run db:types`.

`supabase db dump` and direct connections don't work on this restored project;
`prod_sql.py` goes through the Management API using the Supabase CLI login.
Read-only queries: `supabase/scripts/prod_sql.py query "select ..."`.

## Storage (R2)

- Bucket `wallpy-public`, public at `https://wallpy-cdn.siphyshu.me`.
  Keys: `blobs/<sha256>` (pack images, thumbnails), `profiles/<uid>/<sha>.<ext>`, `artists/<sha>.<ext>`.
- Bucket `wallpy-packs` (private): `recovered/` originals and `archive/` zip. Keep.
- CORS allows `https://wallpy.siphyshu.me`, `http://localhost:3000` and, for parallel dev servers (worktrees), `http://localhost:3101`–`3110` (added 2026-10-17; remove before launch). Change it with the S3 API (`GetBucketCors`/`PutBucketCors`) using the R2 keys in `site/.env.local`.
- Browser `fetch()`es of CDN files use `cache: 'reload'`: `<img>` tags cache copies without CORS headers.

### Cloudflare cache (set up 2026-10-20)

1. Caching → Cache Rules: hostname `wallpy-cdn.siphyshu.me` → eligible for cache, edge TTL from origin `Cache-Control`, browser TTL respect origin.
2. Rules → Transform Rules → modify response header: set `Access-Control-Allow-Origin: *` for the same hostname.

Both live on zone `siphyshu.me` (Rules → Cache Rules and Transform Rules, descriptions start "Wallpy CDN"). They go together: R2 only adds CORS headers when a request has `Origin`, and the
edge cache doesn't vary on it, so without step 2 a cached copy can lack them.
`*` is fine: files are public and content-addressed.

## Image renditions

Uploads make a 640px thumbnail and a 1920px preview WebP of every image
(`lib/packs/client-upload.ts`). Files stored without them (before 2026-10-17,
or packs made through the API without renditions) can be backfilled; it's
idempotent and dry-runs without `--apply`:

```sh
cd site && node --env-file=.env.local ../supabase/seed/backfill_file_renditions.mjs --apply [--only slug,slug]
```

Use `--only` while e2e suites may be running, so their throwaway packs are left alone.

## Moderation

Make someone a moderator: `update public.profiles set role = 'moderator' where username = '...'`
(admins: `role = 'admin'`). The queue is `/moderation` (404 for everyone else).

## Sample packs

`samples/` (see its README) has a Daypack and a Weekpack for trying workflows by
hand; `node samples/make.mjs` regenerates them.

## Seed real packs

For adding curated packs to production in bulk (2026-10-20: six packs and two
new versions). Build a folder per pack (`schedule.toml` spec 2 with name,
author, description + `images/`), check each with `wallpy check <folder>`, set
the details in `PACKS` at the top of `site/scripts/seed-packs.mjs`, then
`cd site && node --env-file=.env.local scripts/seed-packs.mjs --dir <folder>`
(`--only slug,...`, `--no-approve`). It signs in as siphyshu with an admin
magic-link token (no email, no password), uploads through the live API exactly
as the wizard does (originals + 640/1920 WebP renditions), submits, and
approves with `moderate()`. Entries with `slug` submit a new version of that
pack. The 2026-10-20 pack folders are kept in `_src/seed-packs-2026-10-20/`.

macOS dynamic wallpapers (`.heic`) hold every frame plus their timings:
`site/scripts/heic-frames.swift` extracts them (instructions at the top).
Dynamic Wallpaper Club (dynamicwallpaper.club) hosts the full-size originals of
most popular packs; its 1600px previews are what older packs were made from.

## Refresh the CLI's city list

`internal/geo/cities.tsv.gz` comes from GeoNames. To refresh it, download
`cities15000.zip` (unzip it), `admin1CodesASCII.txt` and `countryInfo.txt`
from https://download.geonames.org/export/dump/ into a folder, then
`cd cli/internal/geo && go run gen/main.go <folder>` and run `go test ./internal/geo`.

## Release the CLI

Config: `cli/.goreleaser.yaml`. Dry run (everything but publishing, no tag
needed): `cd cli && goreleaser release --snapshot --clean`, then look in
`cli/dist/`.

To publish (ask first; it's public and permanent):

1. One-time: create `siphyshu/homebrew-tap` and `siphyshu/scoop-bucket` on
   GitHub, fork `microsoft/winget-pkgs` to `siphyshu/winget-pkgs`, and make an
   AUR account with an SSH key for `wallpy-bin`.
2. Tokens in the environment: `GITHUB_TOKEN` (releases on siphyshu/wallpy),
   `HOMEBREW_TAP_GITHUB_TOKEN`, `SCOOP_BUCKET_GITHUB_TOKEN`,
   `WINGET_GITHUB_TOKEN`, `AUR_KEY` (the private key).
3. `git tag v0.1.0 && git push origin v0.1.0`, then
   `cd cli && goreleaser release --clean`.

Tags `v*` version the CLI (the site isn't versioned). Binaries are unsigned:
the Homebrew cask clears macOS's quarantine flag; signing and notarizing
(macOS) and code signing (Windows SmartScreen) are on the roadmap.

## Hosting (Vercel)

- Vercel project `wallpy` (team siphyshu's projects). Pushing `main` deploys production; other branches get preview URLs. The local `.vercel/` link sits at the repo root.
- Project root `site/`, production domain `wallpy.siphyshu.me` (DNS: `CNAME wallpy → cname.vercel-dns.com`, DNS only in Cloudflare).
- Environment variables: everything in `site/.env.local`, plus `CRON_SECRET`.
- `site/vercel.json` runs `/api/keepalive` daily (06:17 UTC): one public read so the Supabase free plan never pauses for inactivity. Vercel sends `Authorization: Bearer $CRON_SECRET`; other callers get 401 when the secret is set.

## Releases

- The Python CLI's last version is archived as tag/release `python-v2.25.0`. The Go CLI is versioned from `v3.0.0` (tags `v*`).
