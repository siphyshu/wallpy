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
| Unit | `cd site && npm test` | Vitest: spec port vs vectors, storage, redirects |
| E2E | `cd site && npm run test:e2e` | Needs `npm run dev` running; api, ui (album), moderation, versions, builders (Daypack + Weekpack, uses samples/) suites (each also runnable alone: `test:e2e:<name>`; `SHOTS=dir` saves screenshots) |
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
- CORS allows `http://localhost:3000` and `https://wallpy.siphyshu.me`.
- Browser `fetch()`es of CDN files use `cache: 'reload'`: `<img>` tags cache copies without CORS headers.

### Cloudflare cache (to do before launch)

1. Caching → Cache Rules: hostname `wallpy-cdn.siphyshu.me` → eligible for cache, edge TTL from origin `Cache-Control`, browser TTL respect origin.
2. Rules → Transform Rules → modify response header: set `Access-Control-Allow-Origin: *` for the same hostname.

Do both together: R2 only adds CORS headers when a request has `Origin`, and the
edge cache doesn't vary on it, so without step 2 a cached copy can lack them.
`*` is fine: files are public and content-addressed.

## Moderation

Make someone a moderator: `update public.profiles set role = 'moderator' where username = '...'`
(admins: `role = 'admin'`). The queue is `/moderation` (404 for everyone else).

## Sample packs

`samples/` (see its README) has a Daypack and a Weekpack for trying workflows by
hand; `node samples/make.mjs` regenerates them.
