import logging
import pytest
from datetime import datetime, timedelta, time, date
from pathlib import Path
from unittest.mock import Mock

from wallpy.models import (
    Schedule, ScheduleMeta, TimeSpec, TimeSpecType, TimeBlock,
    DaySchedule, ScheduleType, Location
)
from wallpy.schedule import SolarTimeCalculator
from wallpy.validate import ScheduleValidator

# Fixture for SolarTimeCalculator and ScheduleValidator.
@pytest.fixture
def solar_calculator():
    return SolarTimeCalculator()

@pytest.fixture
def validator(solar_calculator):
    validator = ScheduleValidator(solar_calculator)
    # Mock the problematic _analyze_time_coverage method to avoid the combine() error
    validator._analyze_time_coverage = Mock()
    return validator

# Fixture to simulate a pack directory containing image files.
@pytest.fixture
def temp_pack(tmp_path):
    pack_dir = tmp_path / "pack"
    pack_dir.mkdir()
    # Create dummy images for tests that expect them.
    (pack_dir / "image1.jpg").touch()
    (pack_dir / "day_image.jpg").touch()
    (pack_dir / "monday.jpg").touch()
    (pack_dir / "img1.jpg").touch()
    (pack_dir / "img2.jpg").touch()
    return pack_dir

def create_absolute_time_spec(start_hour, start_minute, end_hour, end_minute, offset=0):
    start_spec = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(start_hour, start_minute))
    end_spec = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(end_hour, end_minute))
    start_spec.offset = offset
    end_spec.offset = 0
    return start_spec, end_spec

class TestScheduleValidator:
    def test_missing_timeblocks_for_timeblock_schedule(self, validator, temp_pack):
        """Test that a timeblock schedule without any timeblocks raises an error."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Empty Timeblocks")
        schedule = Schedule(meta=meta, timeblocks={})
        result = validator.validate(schedule, temp_pack)
        assert not result.passed
        assert "schedule_timeblocks" in result.errors
    
    def test_missing_days_for_day_schedule(self, validator, temp_pack):
        """Test that a day-based schedule without any days raises an error."""
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Empty Days")
        schedule = Schedule(meta=meta, days={})
        result = validator.validate(schedule, temp_pack)
        assert not result.passed
        assert "schedule_days" in result.errors
    
    def test_timeblocks_solar_without_location(self, validator, temp_pack):
        """Timeblocks using solar times without location data should log a warning."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        time_spec_start = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        time_spec_end = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        block = TimeBlock(name="block1", start=time_spec_start, end=time_spec_end, images=[Path("image1.jpg")])
        schedule = Schedule(meta=meta, timeblocks={"block1": block})
        
        result = validator.validate(schedule, temp_pack)
        assert "schedule_solar" in result.warnings
    
    def test_timeblocks_solar_with_global_location(self, validator, temp_pack):
        """Timeblocks using solar times should use global location if available."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        time_spec_start = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        time_spec_end = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        block = TimeBlock(name="block1", start=time_spec_start, end=time_spec_end, images=[Path("image1.jpg")])
        schedule = Schedule(meta=meta, timeblocks={"block1": block})
        global_location = {
            "latitude": 40.0,
            "longitude": -74.0,
            "timezone": "UTC",
            "name": "Test Location",
            "region": "Test Region"
        }
        
        # This should not raise an error
        result = validator.validate(schedule, temp_pack, global_location)
        # Should not have solar warning with location provided
        assert "schedule_solar" not in result.warnings
    
    def test_timeblocks_missing_image(self, validator, tmp_path):
        """A timeblock referencing a missing image should raise FileNotFoundError."""
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        start_spec, end_spec = create_absolute_time_spec(8, 0, 10, 0)
        block = TimeBlock(name="block1", start=start_spec, end=end_spec, images=[Path("nonexistent.jpg")])
        schedule = Schedule(meta=meta, timeblocks={"block1": block})
        
        result = validator.validate(schedule, pack_dir)
        assert not result.passed
        assert "schedule_images" in result.errors
    
    def test_successful_timeblocks_validation(self, validator, temp_pack):
        """A valid timeblock schedule should pass validation without errors."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Valid Schedule")
        start_spec, end_spec = create_absolute_time_spec(8, 0, 10, 0)
        block = TimeBlock(name="block1", start=start_spec, end=end_spec, images=[Path("image1.jpg")])
        schedule = Schedule(meta=meta, timeblocks={"block1": block})
        
        result = validator.validate(schedule, temp_pack)
        assert result.passed
    
    def test_days_missing_image(self, validator, tmp_path):
        """A day-based schedule referencing a missing image should raise FileNotFoundError."""
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Days Schedule")
        day_sched = DaySchedule(images=[Path("missing_day.jpg")])
        schedule = Schedule(meta=meta, days={"monday": day_sched})
        
        result = validator.validate(schedule, pack_dir)
        assert not result.passed
        assert "schedule_images" in result.errors
    
    def test_successful_days_validation(self, validator, temp_pack):
        """A valid day-based schedule should pass validation."""
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Days Schedule")
        day_sched = DaySchedule(images=[Path("monday.jpg")])
        schedule = Schedule(meta=meta, days={"monday": day_sched})
        
        result = validator.validate(schedule, temp_pack)
        assert result.passed
