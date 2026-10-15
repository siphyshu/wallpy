"""Reference implementation of the Wallpy pack spec (spec/README.md).

Written for clarity, not speed: each function follows one numbered rule of the
README. The Go CLI and the site's preview must agree with it on spec/vectors/.

    validate(schedule) -> list[str]                          # [] when valid
    active(schedule, now, location=None) -> Active           # which image, and when it changes
    convert_v1(v1_schedule) -> dict                          # spec 1 -> spec 2
"""
from __future__ import annotations

import hashlib
import json
import math
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SCHEMA_PATH = Path(__file__).resolve().parents[1] / "schedule.schema.json"
WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
FALLBACKS = {"midnight": time(0, 0), "dawn": time(5, 0), "sunrise": time(6, 30),
             "noon": time(12, 0), "sunset": time(18, 30), "dusk": time(19, 30)}
ANCHOR = datetime(2000, 1, 1)  # local wall time; rotation "every X" counts from here

_CLOCK = re.compile(r"^([01][0-9]|2[0-3]):([0-5][0-9])$")
_SOLAR = re.compile(r"^(midnight|dawn|sunrise|noon|sunset|dusk)(?:([+-])(?:(\d+)h)?(?:(\d+)m)?)?$")
_EVERY = re.compile(r"^every ([1-9][0-9]{0,4})([mhd])$")


@dataclass(frozen=True)
class Location:
    latitude: float
    longitude: float
    timezone: str


@dataclass(frozen=True)
class Active:
    slot: int            # index into schedule["slot"]
    image: str
    image_index: int     # position of `image` in the slot's images
    slot_start: datetime
    slot_end: datetime


# ---------------------------------------------------------------------------
# Times
# ---------------------------------------------------------------------------

def parse_at(at: str) -> tuple[str, object, int]:
    """("clock", time, 0) or ("solar", event, offset_minutes)."""
    if m := _CLOCK.match(at):
        return ("clock", time(int(m[1]), int(m[2])), 0)
    if m := _SOLAR.match(at):
        event, sign, hours, minutes = m.groups()
        offset = int(hours or 0) * 60 + int(minutes or 0)
        return ("solar", event, -offset if sign == "-" else offset)
    raise ValueError(f"invalid time {at!r}")


def _solar_event(event: str, day: date, location: Location | None) -> time:
    if event == "midnight" or location is None:
        return FALLBACKS[event]
    from astral import Observer
    from astral.sun import dawn, dusk, noon, sunrise, sunset
    fn = {"dawn": dawn, "sunrise": sunrise, "noon": noon, "sunset": sunset, "dusk": dusk}[event]
    try:
        # Civil twilight (6 degrees) is astral's default for dawn/dusk.
        return fn(Observer(location.latitude, location.longitude), date=day,
                  tzinfo=ZoneInfo(location.timezone)).time()
    except ValueError:  # the event doesn't happen that day (polar day/night)
        return FALLBACKS[event]


def resolve(at: str, day: date, location: Location | None, tz: ZoneInfo) -> datetime:
    """Absolute start time of `at` on `day`, in `tz`."""
    kind, value, offset = parse_at(at)
    base = value if kind == "clock" else _solar_event(value, day, location)
    return datetime.combine(day, base, tzinfo=tz) + timedelta(minutes=offset)


def fallback_minutes(at: str) -> int:
    """Minutes after midnight at the fallback times (no location)."""
    kind, value, offset = parse_at(at)
    base = value if kind == "clock" else FALLBACKS[value]
    return base.hour * 60 + base.minute + offset


def every_seconds(rotate: str) -> int | None:
    if m := _EVERY.match(rotate):
        return int(m[1]) * {"m": 60, "h": 3600, "d": 86400}[m[2]]
    return None


# ---------------------------------------------------------------------------
# Validation (schema + README "Rules beyond the JSON Schema")
# ---------------------------------------------------------------------------

def validate(schedule: dict, pack_files: list[str] | None = None) -> list[str]:
    from jsonschema import Draft202012Validator
    schema = json.loads(SCHEMA_PATH.read_text())
    errors = [f"{'/'.join(map(str, e.absolute_path)) or '(root)'}: {e.message}"
              for e in Draft202012Validator(schema).iter_errors(schedule)]
    if errors:
        return errors

    slots = schedule["slot"]
    for i, s in enumerate(slots):
        if (secs := every_seconds(s.get("rotate", "spread"))) is not None and not 5 * 60 <= secs <= 7 * 86400:
            errors.append(f"slot/{i}/rotate: interval must be between 5m and 7d")
        if s.get("at") and parse_at(s["at"])[0] == "solar" and abs(parse_at(s["at"])[2]) > 12 * 60:
            errors.append(f"slot/{i}/at: offset must be at most 12h")

    for day in WEEKDAYS:
        applicable = [(i, s.get("at", "00:00")) for i, s in enumerate(slots) if day in s.get("days", WEEKDAYS)]
        if not applicable:
            errors.append(f"no slot applies on {day}")
            continue
        seen: dict[str, int] = {}
        previous = None
        for i, at in applicable:
            if at in seen:
                errors.append(f"slot/{i}/at: slot {seen[at]} also starts at {at!r} on {day}")
            seen[at] = i
            minutes = fallback_minutes(at)
            if previous is not None and minutes < previous[1]:
                errors.append(f"slot/{i}/at: {at!r} is listed after slot {previous[0]} but starts earlier on {day}; "
                              "list slots in time order")
            previous = (i, minutes)

    if pack_files is not None:
        named = {img for s in slots for img in s["images"]}
        lower = [f.lower() for f in pack_files]
        errors += [f"image {img!r} is not in the pack" for img in sorted(named - set(pack_files))]
        errors += [f"image {f!r} is in the pack but not used" for f in sorted(set(pack_files) - named)]
        errors += [f"filenames differ only by case: {f!r}" for f in sorted(set(pack_files)) if lower.count(f.lower()) > 1]
    return errors


# ---------------------------------------------------------------------------
# Scheduling (README "Which image is shown")
# ---------------------------------------------------------------------------

def _starts(slots: list[dict], day: date, location: Location | None, tz: ZoneInfo) -> list[tuple[int, datetime]]:
    """Rules 1 and 2: applicable slots on `day`, with clamped start times."""
    weekday = WEEKDAYS[day.weekday()]
    out: list[tuple[int, datetime]] = []
    for i, s in enumerate(slots):
        if weekday not in s.get("days", WEEKDAYS):
            continue
        start = resolve(s.get("at", "00:00"), day, location, tz)
        if out and start < out[-1][1]:
            start = out[-1][1]
        out.append((i, start))
    return out


def _shuffled(images: list[str], seed: str) -> list[int]:
    return sorted(range(len(images)), key=lambda i: hashlib.sha256(f"{seed}/{i}".encode()).hexdigest())


def active(schedule: dict, now: datetime, location: Location | None = None) -> Active:
    """Which image is showing at `now` (an aware datetime in the user's time zone)."""
    tz = now.tzinfo if isinstance(now.tzinfo, ZoneInfo) else ZoneInfo(str(now.tzinfo))
    slots = schedule["slot"]
    today = now.date()

    # Rule 3: last started slot today, else the last slot of the previous day that has any.
    started = [(i, t) for i, t in _starts(slots, today, location, tz) if t <= now]
    if started:
        slot, start = started[-1]
    else:
        for back in range(1, 8):
            earlier = _starts(slots, today - timedelta(days=back), location, tz)
            if earlier:
                slot, start = earlier[-1]
                break
        else:
            raise ValueError("no slot applies on any day")

    # Rule 4: the next applicable start after this slot's start.
    end = None
    for ahead in range(0, 8):
        day = start.date() + timedelta(days=ahead)
        later = [t for i, t in _starts(slots, day, location, tz) if t > start]
        if later:
            end = later[0]
            break
    assert end is not None

    # Rule 5: the image within the slot.
    s = slots[slot]
    images = s["images"]
    n = len(images)
    secs = every_seconds(s.get("rotate", "spread"))
    if secs is None:  # spread
        part = (end - start).total_seconds() / n
        k = min(int((now - start).total_seconds() // part), n - 1)
        order = _shuffled(images, f"{slot}/{start.date().isoformat()}") if s.get("shuffle") else list(range(n))
    else:
        anchor = ANCHOR.replace(tzinfo=tz)
        cycle = math.floor((now - anchor).total_seconds() / secs)
        k = cycle % n
        order = _shuffled(images, f"{slot}/{cycle // n}") if s.get("shuffle") else list(range(n))
    index = order[k]
    return Active(slot, images[index], index, start, end)


# ---------------------------------------------------------------------------
# Spec 1 -> spec 2
# ---------------------------------------------------------------------------

_V1_DAYS = {"monday": "mon", "tuesday": "tue", "wednesday": "wed", "thursday": "thu",
            "friday": "fri", "saturday": "sat", "sunday": "sun"}


def _v1_time(spec: str) -> str:
    """Spec 1 times: "sunrise+90m", "sunrise+90", "Sunrise", "08:30", "8:30 am"."""
    s = spec.strip().lower()
    if m := re.match(r"^(\d{1,2})\s*:\s*(\d{2})\s*(am|pm)$", s):
        hour = int(m[1]) % 12 + (12 if m[3] == "pm" else 0)
        return f"{hour:02d}:{m[2]}"
    if m := re.match(r"^(\d{1,2}):(\d{2})$", s):
        return f"{int(m[1]):02d}:{m[2]}"
    if m := re.match(r"^(\w+)(?:([+-])(\d+))?m?$", s):
        event, sign, offset = m.groups()
        return event if not offset or int(offset) == 0 else f"{event}{sign}{int(offset)}m"
    raise ValueError(f"unrecognised spec 1 time {spec!r}")


def convert_v1(v1: dict) -> dict:
    meta = v1["meta"]
    out: dict = {"spec": 2, "name": meta["name"]}
    for key in ("author", "description"):
        if meta.get(key):
            out[key] = meta[key]

    kind = meta["type"]
    if kind == "timeblocks":
        blocks = list(v1["timeblocks"].items())
        starts = {name: _v1_time(b["start"]) for name, b in blocks}
        blocks.sort(key=lambda nb: fallback_minutes(starts[nb[0]]))
        # Dropping `end` is only lossless if each block ends where the next starts.
        for (name, b), (next_name, _) in zip(blocks, blocks[1:] + blocks[:1]):
            if _v1_time(b["end"]) != starts[next_name]:
                raise ValueError(f"block {name!r} ends at {b['end']!r} but {next_name!r} starts at "
                                 f"{starts[next_name]!r}; spec 2 has no gaps, fix the schedule first")
        out["slot"] = [{"label": name, "at": starts[name], "images": list(b["images"])} for name, b in blocks]
    elif kind == "days":
        out["slot"] = [{"label": day, "days": [_V1_DAYS[day.lower()]], "images": list(d["images"])}
                        for day, d in v1["days"].items()]
    elif kind == "album":
        a = v1["album"]
        out["slot"] = [{"images": list(a["images"]), "rotate": f"every {a['interval']}",
                         **({"shuffle": True} if a.get("shuffle") else {})}]
    else:
        raise ValueError(f"unknown spec 1 type {kind!r}")
    return out
