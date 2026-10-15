"""The spec must accept every published example and reject known-bad schedules.

Each rejected case documents a real bug or attack: the Dec 2025 uploader's blank
name, CLI-incompatible hour offsets, and paths that escape the pack.
"""
import copy
import json
import tomllib
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

SPEC = Path(__file__).resolve().parents[1]
SCHEMA = json.loads((SPEC / "schedule.v1.schema.json").read_text())
VALIDATOR = Draft202012Validator(SCHEMA)
EXAMPLES = sorted((SPEC / "v1-examples").glob("*.toml"))


def load(path):
    with open(path, "rb") as f:
        return tomllib.load(f)


def is_valid(doc):
    return not list(VALIDATOR.iter_errors(doc))


def test_schema_is_valid_json_schema():
    Draft202012Validator.check_schema(SCHEMA)


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.name)
def test_examples_pass(path):
    errors = [e.message for e in VALIDATOR.iter_errors(load(path))]
    assert not errors, errors


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.name)
def test_examples_parse_in_cli(path):
    schedule_mod = pytest.importorskip("wallpy.schedule")
    assert schedule_mod.ScheduleManager().load_schedule(path) is not None


DAYPACK = {
    "meta": {"type": "timeblocks", "name": "Test"},
    "timeblocks": {
        "day": {"start": "sunrise", "end": "sunset", "images": ["day.jpg"]},
        "night": {"start": "sunset", "end": "sunrise", "images": ["night.jpg"]},
    },
}
WEEKPACK = {
    "meta": {"type": "days", "name": "Test"},
    "days": {d: {"images": ["a.jpg"]} for d in
             ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]},
}
ALBUM = {"meta": {"type": "album", "name": "Test"},
         "album": {"images": ["a.jpg", "b.jpg"], "interval": "30m", "shuffle": True}}


@pytest.mark.parametrize("doc", [DAYPACK, WEEKPACK, ALBUM], ids=["daypack", "weekpack", "album"])
def test_minimal_packs_pass(doc):
    assert is_valid(doc)


def edit(doc, fn):
    doc = copy.deepcopy(doc)
    fn(doc)
    return doc


REJECTED = {
    "hour offset (CLI parses minutes only)": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(end="sunset+1h")),
    "path traversal": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(images=["../../x.jpg"])),
    "subfolder": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(images=["sub/x.jpg"])),
    "non-image file": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(images=["evil.html"])),
    "empty image list": edit(DAYPACK, lambda d: d["timeblocks"]["night"].update(images=[])),
    "blank name (Dec 2025 uploader bug)": edit(DAYPACK, lambda d: d["meta"].update(name="")),
    "unknown key": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(colour="red")),
    "pinned location": edit(DAYPACK, lambda d: d.update(location={"latitude": 1, "longitude": 2})),
    "type does not match section": edit(DAYPACK, lambda d: d["meta"].update(type="days")),
    "two sections at once": edit(DAYPACK, lambda d: d.update(album=ALBUM["album"])),
    "invalid clock time": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(start="25:00")),
    "AM/PM time": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(start="8:00 am")),
    "unknown solar event": edit(DAYPACK, lambda d: d["timeblocks"]["day"].update(start="moonrise")),
    "weekpack missing a day": edit(WEEKPACK, lambda d: d["days"].pop("sunday")),
    "weekpack misspelled day": edit(WEEKPACK, lambda d: d["days"].update(munday={"images": ["a.jpg"]})),
    "album without interval": edit(ALBUM, lambda d: d["album"].pop("interval")),
    "album interval in seconds": edit(ALBUM, lambda d: d["album"].update(interval="30s")),
}


@pytest.mark.parametrize("doc", REJECTED.values(), ids=REJECTED.keys())
def test_rejected(doc):
    assert not is_valid(doc)
