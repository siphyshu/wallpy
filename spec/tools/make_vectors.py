"""Build spec/vectors/vectors.json: (schedule, time, location) -> expected image.

Every implementation (Go CLI, site preview) must pass these. Cases with a
hand-computed `expect` also check the reference implementation itself; the
rest record what the reference computes. No vector sits within 5 minutes of a
slot or image boundary, because solar libraries can differ by a minute or two.

    python spec/tools/make_vectors.py      # rewrite vectors.json
    python spec/tools/make_vectors.py --check  # fail if it would change
"""
import hashlib
import json
import sys
import tomllib
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

SPEC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SPEC / "reference"))
import wallpy_ref as ref  # noqa: E402

MARGIN = timedelta(minutes=5)

DAYPACK = {"spec": 2, "name": "Daypack", "slot": [
    {"label": "dawn", "at": "dawn", "images": ["dawn.jpg"]},
    {"label": "day", "at": "sunrise+1h30m", "images": ["day1.jpg", "day2.jpg"]},
    {"label": "dusk", "at": "sunset-30m", "images": ["dusk.jpg"]},
    {"label": "night", "at": "dusk+1h", "images": ["night.jpg"]},
]}
WEEKPACK = {"spec": 2, "name": "Weekpack", "slot": [
    {"days": ["mon", "tue", "wed", "thu", "fri"], "images": ["weekday.jpg"]},
    {"days": ["sat", "sun"], "images": ["weekend-am.jpg"]},
    {"days": ["sat", "sun"], "at": "noon", "images": ["weekend-pm.jpg"]},
]}
ALBUM_DAILY = {"spec": 2, "name": "Daily album", "slot": [{"images": ["a.jpg", "b.jpg", "c.jpg"], "rotate": "every 1d"}]}
ALBUM_SHUFFLE = {"spec": 2, "name": "Shuffled album", "slot": [
    {"images": ["a.jpg", "b.jpg", "c.jpg", "d.jpg"], "rotate": "every 30m", "shuffle": True}]}
SPREAD_SHUFFLE = {"spec": 2, "name": "Shuffled spread", "slot": [
    {"at": "08:00", "images": ["1.jpg", "2.jpg", "3.jpg", "4.jpg"], "shuffle": True},
    {"at": "20:00", "images": ["night.jpg"]}]}
CLOCK = {"spec": 2, "name": "Clock", "slot": [
    {"at": "01:00", "images": ["early.jpg", "late.jpg"]},
    {"at": "06:00", "images": ["day.jpg"]}]}

NEW_DELHI = {"latitude": 28.61, "longitude": 77.21, "timezone": "Asia/Kolkata"}
TROMSO = {"latitude": 69.65, "longitude": 18.96, "timezone": "Europe/Oslo"}
BERLIN = {"latitude": 52.52, "longitude": 13.40, "timezone": "Europe/Berlin"}


def example(name):
    return tomllib.loads((SPEC / "examples" / f"{name}.toml").read_text())


def shuffled(n, seed):
    """README "Shuffle order", written out independently of the reference."""
    return sorted(range(n), key=lambda i: hashlib.sha256(f"{seed}/{i}".encode()).hexdigest())


# 2026-10-16 00:00 is 9785 days after the 2000-01-01 anchor; 9785 % 3 == 2.
DAYS_SINCE_ANCHOR = (datetime(2026, 10, 16) - datetime(2000, 1, 1)).days
# 2026-10-16 10:40 local = cycle 9785*48 + 21 (30-minute cycles); 4 images.
SHUFFLE_CYCLE = DAYS_SINCE_ANCHOR * 48 + 21

CASES = [
    # --- fallback times (no location): every expectation worked out by hand ---
    dict(name="dawn slot", schedule=DAYPACK, at="2026-06-21T06:00", tz="UTC",
         expect="dawn.jpg", why="dawn falls back to 05:00; the next slot starts at sunrise(06:30)+1h30m = 08:00"),
    dict(name="spread, first half", schedule=DAYPACK, at="2026-06-21T12:30", tz="UTC",
         expect="day1.jpg", why="day runs 08:00-18:00 (sunset 18:30 - 30m); 2 images split it at 13:00"),
    dict(name="spread, second half", schedule=DAYPACK, at="2026-06-21T13:30", tz="UTC",
         expect="day2.jpg", why="after the 13:00 split"),
    dict(name="night continues past midnight", schedule=DAYPACK, at="2026-06-21T02:00", tz="UTC",
         expect="night.jpg", why="no slot has started yet today, so yesterday's last slot (dusk 19:30 + 1h) continues"),
    dict(name="clock times", schedule=CLOCK, at="2026-06-21T05:00", tz="UTC",
         expect="late.jpg", why="01:00-06:00 split in two at 03:30"),
    dict(name="before the first clock slot", schedule=CLOCK, at="2026-06-21T00:30", tz="UTC",
         expect="day.jpg", why="yesterday's 06:00 slot runs until today's 01:00"),
    dict(name="weekday", schedule=WEEKPACK, at="2026-10-14T09:00", tz="UTC",
         expect="weekday.jpg", why="2026-10-14 is a Wednesday"),
    dict(name="weekend morning", schedule=WEEKPACK, at="2026-10-17T10:00", tz="UTC",
         expect="weekend-am.jpg", why="2026-10-17 is a Saturday, before noon"),
    dict(name="weekend afternoon", schedule=WEEKPACK, at="2026-10-17T15:00", tz="UTC",
         expect="weekend-pm.jpg", why="Saturday after noon"),
    dict(name="monday after a weekend", schedule=WEEKPACK, at="2026-10-19T00:30", tz="UTC",
         expect="weekday.jpg", why="Monday's slot starts at 00:00"),
    dict(name="daily album", schedule=ALBUM_DAILY, at="2026-10-16T09:00", tz="UTC",
         expect=["a.jpg", "b.jpg", "c.jpg"][DAYS_SINCE_ANCHOR % 3],
         why=f"day {DAYS_SINCE_ANCHOR} since 2000-01-01; {DAYS_SINCE_ANCHOR} mod 3 = {DAYS_SINCE_ANCHOR % 3}"),
    dict(name="daily album, next day", schedule=ALBUM_DAILY, at="2026-10-17T09:00", tz="UTC",
         expect=["a.jpg", "b.jpg", "c.jpg"][(DAYS_SINCE_ANCHOR + 1) % 3], why="one day later, the next image"),
    dict(name="shuffled album", schedule=ALBUM_SHUFFLE, at="2026-10-16T10:40", tz="UTC",
         expect=["a.jpg", "b.jpg", "c.jpg", "d.jpg"][shuffled(4, f"0/{SHUFFLE_CYCLE // 4}")[SHUFFLE_CYCLE % 4]],
         why=f"cycle {SHUFFLE_CYCLE}; order = sha256 sort with seed '0/{SHUFFLE_CYCLE // 4}', position {SHUFFLE_CYCLE % 4}"),
    dict(name="shuffled spread", schedule=SPREAD_SHUFFLE, at="2026-10-16T09:00", tz="UTC",
         expect=["1.jpg", "2.jpg", "3.jpg", "4.jpg"][shuffled(4, "0/2026-10-16")[0]],
         why="first quarter of 08:00-20:00; order = sha256 sort with seed '0/2026-10-16'"),
    dict(name="time zone is respected", schedule=DAYPACK, at="2026-06-21T12:30", tz="Asia/Tokyo",
         expect="day1.jpg", why="fallback times are local: same answer in any zone"),
    # --- real solar times: computed by the reference ---
    dict(name="New Delhi, summer morning", schedule=example("zelda-wind-waker"), at="2026-06-21T10:00", location=NEW_DELHI),
    dict(name="New Delhi, winter evening", schedule=example("zelda-wind-waker"), at="2026-12-21T18:30", location=NEW_DELHI),
    dict(name="New Delhi, winter morning", schedule=example("zelda-wind-waker"), at="2026-12-21T08:00", location=NEW_DELHI),
    dict(name="Tokyo Street at night", schedule=example("tokyo-street"), at="2026-03-20T23:00", location=NEW_DELHI),
    dict(name="Tromso polar night: no sunrise, so fallback", schedule=DAYPACK, at="2026-12-21T12:00", location=TROMSO),
    dict(name="Tromso midnight sun: every event falls back", schedule=DAYPACK, at="2026-06-21T13:30", location=TROMSO),
    dict(name="Berlin, spring-forward day", schedule=DAYPACK, at="2026-03-29T12:00", location=BERLIN),
    dict(name="Berlin, autumn evening", schedule=example("ocean-hours"), at="2026-10-25T21:00", location=BERLIN),
]


def margin_ok(schedule, when, location):
    a = ref.active(schedule, when, location)
    if not (a.slot_start + MARGIN <= when and when + MARGIN <= a.slot_end):
        return False
    return ref.active(schedule, when - MARGIN, location).image == a.image == ref.active(schedule, when + MARGIN, location).image


def build():
    vectors, failures = [], []
    for case in CASES:
        loc = case.get("location")
        tz = ZoneInfo(loc["timezone"] if loc else case["tz"])
        location = ref.Location(**loc) if loc else None
        when = datetime.fromisoformat(case["at"]).replace(tzinfo=tz)
        assert ref.validate(case["schedule"]) == [], case["name"]
        got = ref.active(case["schedule"], when, location)
        if "expect" in case and got.image != case["expect"]:
            failures.append(f"{case['name']}: reference says {got.image}, expected {case['expect']}")
        if not margin_ok(case["schedule"], when, location):
            failures.append(f"{case['name']}: within 5 minutes of a boundary, pick another time")
        vectors.append({
            "name": case["name"],
            "schedule": case["schedule"],
            "location": loc,
            "timezone": tz.key,
            "at": case["at"],
            "expect": {"image": got.image, "slot": got.slot,
                       "slot_start": got.slot_start.isoformat(timespec="minutes"),
                       "slot_end": got.slot_end.isoformat(timespec="minutes")},
            "why": case.get("why", "computed by spec/reference/wallpy_ref.py"),
        })
    return vectors, failures


if __name__ == "__main__":
    vectors, failures = build()
    if failures:
        sys.exit("\n".join(failures))
    out = SPEC / "vectors" / "vectors.json"
    text = json.dumps({"note": "Generated by spec/tools/make_vectors.py; see spec/README.md.", "vectors": vectors},
                      indent=2, ensure_ascii=False) + "\n"
    if "--check" in sys.argv:
        sys.exit(0 if out.exists() and out.read_text() == text else "vectors.json is out of date")
    out.parent.mkdir(exist_ok=True)
    out.write_text(text)
    print(f"wrote {len(vectors)} vectors to {out.relative_to(SPEC.parent)}")
