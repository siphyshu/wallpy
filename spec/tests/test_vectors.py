"""spec/vectors/vectors.json is up to date and the reference passes it.

Other implementations (Go CLI, site preview) run the same file with their own
test runners.
"""
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

SPEC = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SPEC / "reference"))
import wallpy_ref as ref  # noqa: E402

VECTORS = json.loads((SPEC / "vectors" / "vectors.json").read_text())["vectors"]


def test_vectors_are_up_to_date():
    result = subprocess.run([sys.executable, str(SPEC / "tools" / "make_vectors.py"), "--check"],
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


@pytest.mark.parametrize("vector", VECTORS, ids=[v["name"] for v in VECTORS])
def test_reference_passes(vector):
    loc = ref.Location(**vector["location"]) if vector["location"] else None
    when = datetime.fromisoformat(vector["at"]).replace(tzinfo=ZoneInfo(vector["timezone"]))
    got = ref.active(vector["schedule"], when, loc)
    assert (got.image, got.slot) == (vector["expect"]["image"], vector["expect"]["slot"])
