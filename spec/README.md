# Wallpy pack spec

The contract between the website and the CLI. If the site accepts a pack, the
CLI must install it and show exactly the image this document says it shows.

| | |
|---|---|
| `schedule.schema.json` | **Spec 2**: a pack's `schedule.toml`, as JSON (JSON Schema 2020-12) |
| `examples/` | Spec 2 schedules for the packs in the gallery |
| `reference/wallpy_ref.py` | Reference implementation: validator, scheduler, v1 converter |
| `vectors/` | Test vectors: *(schedule, time, location) → image*. Every implementation must pass them |
| `schedule.v1.schema.json`, `v1-examples/` | Spec 1 (legacy). Read by the CLI, converted on upload |
| `tests/` | `pytest spec/tests` |

## Pack layout

```
<Pack Name>/
  schedule.toml
  images/
    dawn.jpg
    ...
```

## Schedule

```toml
spec = 2
name = "Zelda Wind Waker"
author = "Matt Vince"          # optional
description = "..."            # optional

[[slot]]
label = "dawn"                 # optional, shown in previews
at = "dawn"                    # default "00:00"
images = ["dawn1.jpg", "dawn2.jpg", "dawn3.jpg"]

[[slot]]
at = "sunrise+1h30m"
days = ["sat", "sun"]          # default: every day
images = ["weekend.jpg"]
rotate = "every 20m"           # default "spread"
shuffle = true                 # default false
```

The site's three upload templates are presets of this one shape:

| Template | Slots |
|---|---|
| Daypack | several slots with `at` |
| Weekpack | slots with `days` (and optionally `at`) |
| Album | one slot, no `at`, `rotate = "every …"` |

### Times

`at` is a 24h clock time (`"08:30"`) or a solar event plus an optional offset:
`sunrise+90m`, `sunset-1h`, `dusk+1h30m`.

| Event | Meaning (at the user's location) | Fallback |
|---|---|---|
| `midnight` | 00:00 (clock midnight, as in spec 1) | 00:00 |
| `dawn` | civil dawn, sun 6° below the horizon | 05:00 |
| `sunrise` | sunrise | 06:30 |
| `noon` | solar noon | 12:00 |
| `sunset` | sunset | 18:30 |
| `dusk` | civil dusk, sun 6° below the horizon | 19:30 |

The **fallback** time is used when no location is configured, or when the event
does not happen that day at that place (polar day or night).

Implementations compute solar events with the NOAA algorithm (as Python's
`astral` does). Different libraries agree to within a minute or two, so test
vectors never sit within 5 minutes of a boundary.

## Which image is shown

All of this is evaluated in the user's local time zone. It needs no saved state:
the same inputs always give the same image.

1. **Slots that apply on a day** are those whose `days` include that weekday,
   in written order.
2. **Start times on a day:** resolve each applicable slot's `at` for that date,
   in order. If a start would be earlier than the previous slot's start, it is
   **clamped** to it, and that slot runs for zero time that day. (This only
   happens at extreme latitudes; validators reject schedules that are out of
   order even at the fallback times.)
3. **The active slot** at time `T` on date `D` is the last applicable slot whose
   start is `≤ T`. If none has started yet, the last applicable slot of the most
   recent earlier day that has applicable slots continues (so a night slot runs
   past midnight until the next morning's first slot).
4. **The slot ends** at the next applicable start after it: the next one the
   same day, or the first one on the next day that has applicable slots.
5. **The image within the slot:**
   - `rotate = "spread"`: the slot's duration is split into `n` equal parts
     (`n` = number of images); part `k` shows image `k`. Matches spec 1.
   - `rotate = "every X"`: the image changes every `X`, counted from a fixed
     anchor (2000-01-01 00:00 local time), so rotation continues across slot and
     day boundaries: cycle `c = floor((T − anchor) / X)`, image `c mod n`. An
     album with `every 1d` therefore changes once a day.
   - With `shuffle = true`, images are taken in a shuffled order instead of the
     written one (below).

Durations are real elapsed time. On days with a DST change, `spread` divides
the slot's real length, and `every` intervals stay fixed in real time.

### Shuffle order (portable)

The order is the images sorted by `sha256("<seed>/<index>")` (lowercase hex,
ascending), where `<index>` is the image's position in `images`, starting at 0.
Every language has SHA-256, so every implementation gets the same order.

| rotate | seed | effect |
|---|---|---|
| `spread` | `"<slot index>/<YYYY-MM-DD of the slot's start>"` | a new order each time the slot begins |
| `every X` | `"<slot index>/<floor(c / n)>"` | a new order for each full pass, so no image repeats within a pass |

## Rules beyond the JSON Schema

Validators (site server, CLI) must also check:

1. **Interval range:** `every X` is between 5 minutes (how often the CLI wakes up)
   and 7 days.
2. **Offsets** are at most 12 hours.
3. **Order:** for each weekday, the applicable slots' start times at the
   fallback times are non-decreasing in written order.
4. **No duplicate starts:** two slots that apply on the same weekday can't have
   the same `at`.
5. **Images:** every image named in the schedule exists in the pack, every image
   in the pack is used, and no two filenames differ only by case (macOS and
   Windows filesystems are case-insensitive).
6. **Every weekday is covered** by at least one slot (else that day would have
   no wallpaper of its own).

## Spec 1 (legacy)

`timeblocks` / `days` / `album` tables keyed by name. The converter
(`reference/wallpy_ref.py: convert_v1`) maps them onto slots:

- `[timeblocks.*]`: one slot per block, ordered by start at the fallback
  times; `end` is dropped (the gallery's blocks were all contiguous, checked when
  converting). Spec 1's `shuffle` was ignored by the spec 1 CLI (it always showed
  the first image), so converted slots keep `shuffle = false`.
- `[days.*]`: one slot per weekday with `days = [that day]`.
- `[album]`: one slot with `rotate = "every <interval>"`.
