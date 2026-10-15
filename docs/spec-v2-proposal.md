# Pack format v2 (proposal)

Status: **proposal, under consideration** (2026-10-16). Agreed direction: port the
CLI to Go and use the port to simplify the pack format. Nothing depends on this
yet; v1 (`spec/schedule.schema.json`) is what the site and database use today.

## What v1 gets wrong

1. **Three kinds, three shapes.** `timeblocks`, `days` and `album` each have their
   own structure, validator and code path, and can't be combined (no "weekend art
   that still follows sunrise/sunset").
2. **Blocks have a start *and* an end**, so gaps and overlaps are possible, and
   whether they happen depends on where the user lives (at high latitudes in
   winter `sunrise+90m` can land after `noon`). The validator can only warn, at
   runtime, on the user's machine.
3. **Multiple images in one block are implicit.** Whether they split the block,
   rotate or shuffle isn't stated anywhere; you find out by reading the Python code.
4. Papercuts: offsets in minutes only (`+90m`, not `+1h30m`); a `[location]`
   section that is parsed and then ignored; `version` versions the pack, not the
   format.

## The proposal: one shape, a list of slots, start times only

```toml
spec = 2
name = "Zelda Wind Waker"
author = "Matt Vince"

[[slot]]                       # each slot runs until the next one starts
at = "dawn"
images = ["dawn1.jpg", "dawn2.jpg", "dawn3.jpg"]   # default: split the slot evenly

[[slot]]
at = "sunrise+1h30m"
images = ["morning1.jpg", "morning2.jpg"]

[[slot]]
at = "sunset-30m"
images = ["dusk1.jpg"]

[[slot]]
at = "dusk+1h"
images = ["night1.jpg", "night2.jpg"]
rotate = "every 20m"           # or "spread" (default); shuffle = true optional
```

Defaults make the other pack types the same structure: `at` defaults to
`"00:00"`, `days` defaults to every day.

```toml
# Album: one all-day slot that rotates
[[slot]]
images = ["a.jpg", "b.jpg", "c.jpg"]
rotate = "every 30m"
shuffle = true

# Weekpack: slots filtered by day (add `at` and it's a time-of-day weekend pack)
[[slot]]
days = ["sat", "sun"]
images = ["weekend.jpg"]
```

### Rules (to be tightened)

- **No end times.** A slot lasts until the next applicable slot starts, wrapping
  past midnight. Gaps and overlaps are impossible by construction.
- **Which slot is active:** among slots whose `days` include today, the latest
  one whose start is ≤ now; if none has started yet today, the last slot of the
  previous day continues.
- **High latitudes:** slots keep their written order. If a solar time would fall
  before the previous slot's start, it is clamped to it (that slot gets zero
  length that day). Events that don't occur (polar day/night) use fixed fallback
  times, as the v1 CLI already does.
- **Slots are an array, never a keyed table.** Order carries meaning (it breaks
  ties and drives the high-latitude clamping), and Postgres `jsonb` does not keep
  object key order: v1's `[timeblocks.dawn]`… come back sorted as
  `day, dawn, dusk, night`. Arrays (`[[slot]]`) keep their order everywhere.
- **Rotation is explicit:** `rotate = "spread"` (default: divide the slot evenly
  across its images) or `rotate = "every <duration>"`; `shuffle = true` permutes
  the order with a seed per cycle, so it needs no saved state.
- **Durations** (`+1h30m`, `every 20m`): hours and minutes, and days for `every`.
- **Validation errors:** no slots; a slot with no images; two slots with the same
  start on the same day; image names outside the pack (same filename rule as v1).

### Why it's simpler and stronger

- One validator and one scheduler instead of three.
- The scheduler is a pure function, `(schedule, location, time) → image`, which
  suits a service that wakes every few seconds and is trivial to test.
- **Shared test vectors** in `spec/vectors/` (e.g. *this schedule, New Delhi,
  2026-12-21 07:40 → `morning1.jpg`*), run by the Go CLI and the site's
  day-preview. Go also compiles to WebAssembly, so the site preview could run
  the CLI's actual scheduler: one implementation instead of two that must agree.
- `spec = 2` versions the format itself; the Go CLI can still read v1
  (hand-made local packs) and there's a clear path to v3.

The upload flow still offers **Daypack / Weekpack / Album** as starting
templates; they are presets of one format, not three formats.

## Costs

- Convert the 4 stored schedules (mechanical; verified with the vectors).
- Upload builders target the new shape; DB checks (`schedule_shape_ok`,
  `schedule_images`) change.
- The Python CLI can't read v2 packs. Proposal: retire it rather than test it
  end-to-end (the PyPI release crashes on Python 3.13+ and every download URL it
  knew is dead), with a final release that points to the new installers.

## Order of work, if accepted

1. Spec v2: format doc, JSON Schema, test vectors; review the rules together.
2. Database: convert the 4 schedules; update the schedule checks.
3. Site: gallery, pack and profile pages proceed now (format-independent);
   upload and day-preview after the spec is settled.
4. Go CLI: implements v2 (reads v1), passes the shared vectors, ships via
   GoReleaser (Homebrew, winget, Scoop, deb/rpm, AUR).
5. End-to-end: upload → approve → `wallpy download` on a clean machine → the
   wallpaper changes.

## Open questions

- Does "each slot runs until the next one starts" match how you think about packs?
- Rotation as an explicit `rotate` setting: right defaults?
- Retire the Python CLI instead of testing it end-to-end?
