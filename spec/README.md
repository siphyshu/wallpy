# Wallpy pack spec

The contract between the website and the CLI. If the site accepts a pack, the
CLI must be able to install and run it.

- `schedule.schema.json`: a pack's `schedule.toml`, expressed as JSON (JSON Schema 2020-12).
- `examples/`: real schedules for the packs in the gallery.
- `tests/`: run with `pytest spec/tests` (needs `jsonschema`, and the CLI importable for the parser checks).

## Schedule kinds

| `meta.type` | UI name | Section | Picks the image by |
|---|---|---|---|
| `timeblocks` | Daypack | `[timeblocks.<name>]` with `start`, `end` | time of day, including solar events |
| `days` | Weekpack | `[days.<weekday>]`, all seven required | day of the week |
| `album` | Album | `[album]` with `interval` | rotation every `interval` |

Times are `HH:MM` (24h) or a solar event (`midnight`, `dawn`, `sunrise`, `noon`,
`sunset`, `dusk`) with an optional offset **in minutes**: `sunrise+90m`, not
`sunrise+1h` (the CLI parser doesn't accept hours).

## Rules the schema can't express

Validators (site server, CLI) must also check:

1. **Album interval range**: 5 minutes to 7 days (`5m` ≤ interval ≤ `7d`).
2. **Every image the schedule references exists in the pack**, and every image
   in the pack is referenced at least once.
3. **No duplicate filenames** in a pack, compared case-insensitively (macOS and
   Windows filesystems are case-insensitive).

Timeblock coverage (gaps and overlaps) depends on the user's location, so it
is left to the CLI validator, which reports it as a warning.

## Deliberately stricter than the CLI

The CLI accepts more than this spec, so people can hand-write packs for
themselves. The spec covers only what the gallery publishes:

- `[location]` is not allowed. The CLI ignores it anyway (solar times always use
  the user's configured location), and a shared pack must never pin someone
  else's sunrise.
- AM/PM times and case variants (`Sunrise+30`) are not allowed; the site only
  generates the canonical forms above.
- Weekpacks must define all seven days (the CLI only warns).
- Image filenames are plain names inside `images/`, with no folders, so a
  schedule can never point outside its own pack.

## Pack layout on disk

What `wallpy download` writes, and what a zip built by the website contains:

```
<Pack Name>/
  schedule.toml
  images/
    dawn.jpg
    ...
```
