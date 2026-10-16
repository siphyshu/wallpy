# Wallpy

Dynamic wallpaper packs: a site to share them (site/), a CLI that installs and
runs them (cli/, being rewritten in Go), and the pack format both follow (spec/).

**Start here:** [docs/ROADMAP.md](docs/ROADMAP.md) (what's done, what's next),
[docs/decisions.md](docs/decisions.md) (don't reopen these),
[docs/operations.md](docs/operations.md) (commands, migrations, storage).

## Layout

| Path | What |
|---|---|
| `site/` | Next.js 16 App Router, strict TypeScript. `lib/spec` = TS port of the pack spec; `lib/data` = DB reads; `app/api` = upload/submit/manifest; `components/upload` = the wizard and builders (JS) |
| `spec/` | Pack format spec 2 (`README.md` is normative), JSON Schema, Python reference implementation, test vectors |
| `supabase/` | Migrations (applied to production), `tests/security.sql` (attack checks), `scripts/` (`prod_sql.py`, `test_security.sh`) |
| `cli/` | Go CLI (in progress): `cmd/wallpy` = entry point; `internal/app` = Cobra commands; `internal/ui` = terminal design system (all output goes through it); `internal/library` = installed packs + verified install; `internal/remote` = site API client; `internal/spec` = Go port of the pack spec. `cli/python/` = old Python CLI (retired) |
| `samples/` | Sample packs for manual testing |
| `_src/` | Old clones and the recovered archive (git-excluded; never delete `_src/archive/`) |

## Rules

- **Keep docs current.** When you finish something, tick it in `docs/ROADMAP.md`, log any decision in `docs/decisions.md`, and update `docs/operations.md` if a command or process changed. Do it in the same commit.
- UI must match the existing design system: extend existing components and Tailwind patterns (glass cards `bg-white/5 border-white/10`, white primary / `bg-white/10` secondary buttons, amber notices, pill badges). Check screenshots before calling UI done.
- The DB is the security boundary: RLS, column grants and `moderate()`. Every schema change gets attack checks in `supabase/tests/security.sql`.
- Local dev and e2e tests use **production** Supabase + R2; tests must clean up after themselves.
- Don't push, deploy or change Cloudflare/Supabase settings without asking. Keep secrets out of chat; they live in `site/.env.local`.
- Commit when a piece of work is done and tested (branch `monorepo`).

## Before calling site work done

`cd site && npm run typecheck && npm run lint && npm test`, plus the relevant
`npm run test:e2e:<suite>` (dev server running) and
`supabase/scripts/test_security.sh` for DB changes.
