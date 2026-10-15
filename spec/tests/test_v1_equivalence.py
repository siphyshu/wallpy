"""Converting a gallery pack from spec 1 to spec 2 must not change what it shows.

Oracle: the spec 1 CLI's own scheduler (wallpy.schedule, kept in cli/ until the
Go CLI replaces it). For each example pack we compare the image both choose
every 7 minutes across sample days, without a location (fallback times) and at
real locations. Skipped when the spec 1 CLI isn't importable.
"""
import logging
import tomllib
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

SPEC = Path(__file__).resolve().parents[1]
import sys
sys.path.insert(0, str(SPEC / "reference"))
import wallpy_ref as ref  # noqa: E402

v1 = pytest.importorskip("wallpy.schedule")
v1_models = pytest.importorskip("wallpy.models")
logging.disable(logging.CRITICAL)

PACKS = sorted((SPEC / "v1-examples").glob("*.toml"))
LOCATIONS = {
    "none": None,
    "new-delhi": ref.Location(28.61, 77.21, "Asia/Kolkata"),
    "sydney": ref.Location(-33.87, 151.21, "Australia/Sydney"),
}
DAYS = [date(2026, 3, 20), date(2026, 6, 21), date(2026, 9, 23), date(2026, 12, 21)]


class FrozenDatetime(datetime):
    frozen: datetime

    @classmethod
    def now(cls, tz=None):
        return cls.frozen


def v1_image(path, when_naive, location):
    FrozenDatetime.frozen = when_naive
    original = v1.datetime
    v1.datetime = FrozenDatetime
    try:
        manager = v1.ScheduleManager()
        schedule = manager.load_schedule(path)
        loc = None if location is None else v1_models.Location(
            latitude=location.latitude, longitude=location.longitude, timezone=location.timezone)
        image = manager.get_wallpaper(schedule, global_location=loc)
        return Path(image).name if image else None
    finally:
        v1.datetime = original


@pytest.mark.parametrize("location", LOCATIONS, ids=LOCATIONS.keys())
@pytest.mark.parametrize("path", PACKS, ids=lambda p: p.stem)
def test_same_image_as_spec1(path, location):
    loc = LOCATIONS[location]
    tz = ZoneInfo(loc.timezone if loc else "UTC")
    v2 = ref.convert_v1(tomllib.loads(path.read_text()))
    assert ref.validate(v2) == []

    mismatches = []
    for day in DAYS:
        t = datetime.combine(day, datetime.min.time(), tzinfo=tz)
        while t.date() == day:
            want = v1_image(path, t.replace(tzinfo=None), loc)
            got = ref.active(v2, t, loc).image  # spec 2 always picks an image
            # Spec 1 sometimes finds no block exactly at a boundary (a spec 1
            # bug: e.g. Sydney, 2026-03-20 06:32). Nothing to compare there.
            if want is not None and want != got:
                # Spec 1 approximates an overnight block's start with *today's*
                # solar time; spec 2 uses the previous evening's. That moves
                # boundaries by about a minute, so allow +-3 minutes.
                nearby = {ref.active(v2, t + timedelta(minutes=d), loc).image for d in (-3, 3)}
                if want not in nearby:
                    mismatches.append(f"{t:%Y-%m-%d %H:%M}: spec1={want} spec2={got}")
            t += timedelta(minutes=7)
    assert not mismatches, f"{len(mismatches)} mismatches, e.g. {mismatches[:5]}"
