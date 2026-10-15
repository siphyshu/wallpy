import pytest
from pathlib import Path
from datetime import time
import tomli_w

from wallpy.models import (
    Schedule, ScheduleMeta, TimeSpec, TimeSpecType, TimeBlock,
    DaySchedule, ScheduleType, Location
)
from wallpy.schedule import ScheduleManager

@pytest.fixture
def parser():
    """Create a ScheduleManager instance for testing."""
    return ScheduleManager()

class TestScheduleParser:
    def test_parse_meta(self, parser):
        """Test parsing schedule metadata."""
        # Test minimal metadata
        meta_data = {
            "type": "timeblocks",
            "name": "Test Schedule"
        }
        meta = parser._parse_meta(meta_data)
        assert isinstance(meta, ScheduleMeta)
        assert meta.type == ScheduleType.TIMEBLOCKS
        assert meta.name == "Test Schedule"
        assert meta.author == ""
        assert meta.description == ""
        assert meta.version == "1.0"
        
        # Test full metadata
        meta_data = {
            "type": "days",
            "name": "Full Schedule",
            "author": "Test Author",
            "description": "Test Description",
            "version": "2.0"
        }
        meta = parser._parse_meta(meta_data)
        assert meta.type == ScheduleType.DAYS
        assert meta.name == "Full Schedule"
        assert meta.author == "Test Author"
        assert meta.description == "Test Description"
        assert meta.version == "2.0"
    
    def test_parse_meta_missing_required_field(self, parser):
        """Test that missing required fields raise ValueError."""
        meta_data = {
            "type": "timeblocks"
            # Missing name field
        }
        with pytest.raises(ValueError):
            parser._parse_meta(meta_data)
    
    def test_parse_meta_invalid_type(self, parser):
        """Test that invalid schedule type raises ValueError."""
        meta_data = {
            "type": "invalid",
            "name": "Test Schedule"
        }
        with pytest.raises(ValueError):
            parser._parse_meta(meta_data)
    
    def test_parse_timeblocks(self, parser):
        """Test parsing timeblocks."""
        timeblocks_data = {
            "block1": {
                "start": "08:00",
                "end": "10:00",
                "images": ["image1.jpg"]
            }
        }
        timeblocks = parser._parse_timeblocks(timeblocks_data)
        assert isinstance(timeblocks, dict)
        assert "block1" in timeblocks
        block = timeblocks["block1"]
        assert isinstance(block, TimeBlock)
        assert block.name == "block1"
        assert block.start.type == TimeSpecType.ABSOLUTE
        assert block.start.base == time(8, 0)
        assert block.end.type == TimeSpecType.ABSOLUTE
        assert block.end.base == time(10, 0)
        assert block.images == [Path("image1.jpg")]
    
    def test_parse_timeblocks_missing_required_field(self, parser):
        """Test that missing required fields in timeblock raise ValueError."""
        timeblocks_data = {
            "block1": {
                "start": "08:00"
                # Missing end field
            }
        }
        with pytest.raises(ValueError):
            parser._parse_timeblocks(timeblocks_data)
    
    def test_parse_days(self, parser):
        """Test parsing days."""
        days_data = {
            "monday": {
                "images": ["monday.jpg"]
            }
        }
        days = parser._parse_days(days_data)
        assert isinstance(days, dict)
        assert "monday" in days
        day = days["monday"]
        assert isinstance(day, DaySchedule)
        assert day.images == [Path("monday.jpg")]
    
    def test_parse_days_missing_required_field(self, parser):
        """Test that missing required fields in day raise ValueError."""
        days_data = {
            "monday": {}
            # Missing images field
        }
        with pytest.raises(ValueError):
            parser._parse_days(days_data)
    
    def test_load_schedule_timeblocks(self, parser, tmp_path):
        """Test loading a complete timeblock schedule file."""
        schedule_data = {
            "meta": {
                "type": "timeblocks",
                "name": "Test Schedule"
            },
            "timeblocks": {
                "block1": {
                    "start": "08:00",
                    "end": "10:00",
                    "images": ["image1.jpg"]
                }
            }
        }
        schedule_file = tmp_path / "schedule.toml"
        with open(schedule_file, "wb") as f:
            tomli_w.dump(schedule_data, f)
        
        schedule = parser.load_schedule(schedule_file)
        assert isinstance(schedule, Schedule)
        assert schedule.meta.type == ScheduleType.TIMEBLOCKS
        assert "block1" in schedule.timeblocks
    
    def test_load_schedule_days(self, parser, tmp_path):
        """Test loading a complete day-based schedule file."""
        schedule_data = {
            "meta": {
                "type": "days",
                "name": "Test Schedule"
            },
            "days": {
                "monday": {
                    "images": ["monday.jpg"]
                }
            }
        }
        schedule_file = tmp_path / "schedule.toml"
        with open(schedule_file, "wb") as f:
            tomli_w.dump(schedule_data, f)
        
        schedule = parser.load_schedule(schedule_file)
        assert isinstance(schedule, Schedule)
        assert schedule.meta.type == ScheduleType.DAYS
        assert "monday" in schedule.days
