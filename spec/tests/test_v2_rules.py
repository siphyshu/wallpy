"""Spec 2 validation: every rule in spec/README.md, accepted and rejected."""
import copy
import sys
import tomllib
from pathlib import Path

import pytest

SPEC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SPEC / "reference"))
import wallpy_ref as ref  # noqa: E402

EXAMPLES = sorted((SPEC / "examples").glob("*.toml"))

DAYPACK = {"spec": 2, "name": "Test", "slot": [
    {"label": "dawn", "at": "dawn", "images": ["dawn.jpg"]},
    {"at": "sunrise+1h30m", "images": ["day1.jpg", "day2.jpg"]},
    {"at": "sunset-30m", "images": ["dusk.jpg"]},
    {"at": "dusk+1h", "images": ["night.jpg"], "rotate": "every 20m", "shuffle": True},
]}
WEEKPACK = {"spec": 2, "name": "Test", "slot": [
    {"days": ["mon", "tue", "wed", "thu", "fri"], "images": ["weekday.jpg"]},
    {"days": ["sat", "sun"], "images": ["weekend-am.jpg"]},
    {"days": ["sat", "sun"], "at": "noon", "images": ["weekend-pm.jpg"]},
]}
ALBUM = {"spec": 2, "name": "Test", "slot": [{"images": ["a.jpg", "b.jpg", "c.jpg"], "rotate": "every 1d"}]}


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda p: p.stem)
def test_gallery_examples_are_valid(path):
    assert ref.validate(tomllib.loads(path.read_text())) == []


@pytest.mark.parametrize("doc", [DAYPACK, WEEKPACK, ALBUM], ids=["daypack", "weekpack", "album"])
def test_templates_are_valid(doc):
    assert ref.validate(doc) == []


def edit(doc, fn):
    doc = copy.deepcopy(doc)
    fn(doc)
    return doc


REJECTED = {
    # JSON Schema
    "wrong spec version": edit(ALBUM, lambda d: d.update(spec=1)),
    "no slots": edit(ALBUM, lambda d: d.update(slot=[])),
    "blank name": edit(ALBUM, lambda d: d.update(name="")),
    "unknown slot key": edit(ALBUM, lambda d: d["slot"][0].update(colour="red")),
    "path traversal": edit(ALBUM, lambda d: d["slot"][0].update(images=["../../x.jpg"])),
    "subfolder": edit(ALBUM, lambda d: d["slot"][0].update(images=["sub/x.jpg"])),
    "non-image file": edit(ALBUM, lambda d: d["slot"][0].update(images=["evil.html"])),
    "empty image list": edit(ALBUM, lambda d: d["slot"][0].update(images=[])),
    "unknown weekday": edit(WEEKPACK, lambda d: d["slot"][0].update(days=["monday"])),
    "repeated weekday": edit(WEEKPACK, lambda d: d["slot"][1].update(days=["sat", "sat"])),
    "invalid clock time": edit(DAYPACK, lambda d: d["slot"][0].update(at="25:00")),
    "AM/PM time": edit(DAYPACK, lambda d: d["slot"][0].update(at="8:00 am")),
    "unknown solar event": edit(DAYPACK, lambda d: d["slot"][0].update(at="moonrise")),
    "seconds in rotate": edit(ALBUM, lambda d: d["slot"][0].update(rotate="every 30s")),
    "pinned location": edit(ALBUM, lambda d: d.update(location={"latitude": 1})),
    # README rules
    "interval under 5m": edit(ALBUM, lambda d: d["slot"][0].update(rotate="every 4m")),
    "interval over 7d": edit(ALBUM, lambda d: d["slot"][0].update(rotate="every 8d")),
    "offset over 12h": edit(DAYPACK, lambda d: d["slot"][3].update(at="dusk+13h")),
    "slots out of time order": edit(DAYPACK, lambda d: d["slot"].reverse()),
    "two slots start together": edit(DAYPACK, lambda d: d["slot"][2].update(at="sunrise+1h30m")),
    "a weekday has no slot": edit(WEEKPACK, lambda d: d["slot"][0].update(days=["mon", "tue"])),
}


@pytest.mark.parametrize("doc", REJECTED.values(), ids=REJECTED.keys())
def test_rejected(doc):
    assert ref.validate(doc) != []


def test_same_start_on_different_days_is_fine():
    doc = edit(WEEKPACK, lambda d: d["slot"].append({"days": ["mon"], "at": "noon", "images": ["x.jpg"]}))
    assert ref.validate(doc) == []


def test_pack_files_must_match_schedule():
    names = ["a.jpg", "b.jpg", "c.jpg"]
    assert ref.validate(ALBUM, names) == []
    assert any("not in the pack" in e for e in ref.validate(ALBUM, names[:2]))
    assert any("not used" in e for e in ref.validate(ALBUM, names + ["d.jpg"]))
    assert any("only by case" in e for e in ref.validate(ALBUM, names + ["A.jpg"]))
