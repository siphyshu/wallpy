import logging
import pytest
from datetime import datetime, timedelta, time, date
from pathlib import Path

from wallpy.models import (
    Schedule, ScheduleMeta, TimeSpec, TimeSpecType, TimeBlock,
    DaySchedule, ScheduleType
)
from wallpy.schedule import SolarTimeCalculator, ScheduleValidator

# Fixture for SolarTimeCalculator and ScheduleValidator.
@pytest.fixture
def solar_calculator():
    return SolarTimeCalculator()

@pytest.fixture
def validator(solar_calculator):
    return ScheduleValidator(solar_calculator)

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
        schedule = Schedule(meta=meta, timeblocks={}, days=None, location={"latitude": 0.0, "longitude": 0.0, "timezone": "UTC"})
        with pytest.raises(ValueError, match="Timeblock schedule must contain at least one timeblock"):
            validator.validate(schedule, temp_pack)
    
    def test_missing_days_for_day_schedule(self, validator, temp_pack):
        """Test that a day-based schedule without any days raises an error."""
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Empty Days")
        schedule = Schedule(meta=meta, timeblocks=None, days={}, location=None)
        with pytest.raises(ValueError, match="Day-based schedule must contain at least one day entry"):
            validator.validate(schedule, temp_pack)
    
    def test_timeblocks_solar_without_location(self, validator, temp_pack, caplog):
        """Timeblocks using solar times without location data should log a warning."""
        caplog.set_level(logging.WARNING)
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        time_spec_start = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        time_spec_end = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        block = TimeBlock(name="block1", start=time_spec_start, end=time_spec_end, images=[Path("image1.jpg")])
        # No location provided.
        schedule = Schedule(meta=meta, timeblocks={"block1": block}, days=None, location=None)
        
        validator.validate(schedule, temp_pack)
        assert any("Solar timeblocks without location data will use fallback times" in record.message for record in caplog.records)
    
    def test_timeblocks_solar_with_global_location(self, validator, temp_pack):
        """Timeblocks using solar times should use global location if available."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        time_spec_start = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        time_spec_end = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        block = TimeBlock(name="block1", start=time_spec_start, end=time_spec_end, images=[Path("image1.jpg")])
        # No location in schedule, but global location provided
        schedule = Schedule(meta=meta, timeblocks={"block1": block}, days=None, location=None)
        global_location = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        
        # This should not raise an error
        validator.validate(schedule, temp_pack, global_location)
    
    def test_timeblocks_missing_image(self, validator, tmp_path):
        """A timeblock referencing a missing image should raise FileNotFoundError."""
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        start_spec, end_spec = create_absolute_time_spec(8, 0, 10, 0)
        block = TimeBlock(name="block1", start=start_spec, end=end_spec, images=[Path("nonexistent.jpg")])
        schedule = Schedule(
            meta=meta,
            timeblocks={"block1": block},
            days=None,
            location={"latitude": 0.0, "longitude": 0.0, "timezone": "UTC"}
        )
        
        with pytest.raises(FileNotFoundError, match="Image nonexistent.jpg not found in pack"):
            validator.validate(schedule, pack_dir)
    
    def test_successful_timeblocks_validation(self, validator, temp_pack):
        """A valid timeblock schedule should pass validation without errors."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Valid Schedule")
        start_spec, end_spec = create_absolute_time_spec(8, 0, 10, 0)
        block = TimeBlock(name="block1", start=start_spec, end=end_spec, images=[Path("image1.jpg")])
        location_data = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        schedule = Schedule(meta=meta, timeblocks={"block1": block}, days=None, location=location_data)
        
        validator.validate(schedule, temp_pack)
    
    def test_days_missing_image(self, validator, tmp_path):
        """A day-based schedule referencing a missing image should raise FileNotFoundError."""
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Days Schedule")
        day_sched = DaySchedule(images=[Path("missing_day.jpg")])
        schedule = Schedule(meta=meta, days={"monday": day_sched}, timeblocks=None, location=None)
        
        with pytest.raises(FileNotFoundError, match="Day image missing_day.jpg not found in pack"):
            validator.validate(schedule, pack_dir)
    
    def test_successful_days_validation(self, validator, temp_pack):
        """A valid day-based schedule should pass validation."""
        meta = ScheduleMeta(type=ScheduleType.DAYS, name="Days Schedule")
        day_sched = DaySchedule(images=[Path("monday.jpg")])
        schedule = Schedule(meta=meta, days={"monday": day_sched}, timeblocks=None, location=None)
        
        validator.validate(schedule, temp_pack)
    
    def test_analyze_time_coverage_warnings(self, validator, tmp_path, caplog):
        """Check that overlapping blocks and insufficient total coverage log warnings."""
        caplog.set_level(logging.WARNING)
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        (pack_dir / "img1.jpg").touch()
        (pack_dir / "img2.jpg").touch()
        
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Coverage Schedule")
        
        # Block A: 08:00 to 12:00 (4 hours)
        ts_A_start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(8, 0))
        ts_A_end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(12, 0))
        block_A = TimeBlock(name="A", start=ts_A_start, end=ts_A_end, images=[Path("img1.jpg")])
        
        # Block B: 11:00 to 15:00 (4 hours, overlapping with block A from 11:00 to 12:00)
        ts_B_start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(11, 0))
        ts_B_end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(15, 0))
        block_B = TimeBlock(name="B", start=ts_B_start, end=ts_B_end, images=[Path("img2.jpg")])
        
        location_data = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        schedule = Schedule(meta=meta, timeblocks={"A": block_A, "B": block_B}, days=None, location=location_data)
        
        validator.validate(schedule, pack_dir)
        warnings = [record.message for record in caplog.records]
        assert any("overlap" in msg.lower() for msg in warnings)
        assert any("covers" in msg.lower() for msg in warnings)
    
    def test_analyze_time_coverage_circular_gap_warning(self, validator, tmp_path, caplog):
        """Check that a gap from the end of the last block to the start of the first block logs a warning."""
        caplog.set_level(logging.WARNING)
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        (pack_dir / "img1.jpg").touch()
        (pack_dir / "img2.jpg").touch()
        
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Circular Gap Schedule")
        # Block A: 06:00 to 10:00
        ts_A_start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(6, 0))
        ts_A_end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(10, 0))
        block_A = TimeBlock(name="A", start=ts_A_start, end=ts_A_end, images=[Path("img1.jpg")])
        
        # Block B: 12:00 to 16:00
        ts_B_start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(12, 0))
        ts_B_end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(16, 0))
        block_B = TimeBlock(name="B", start=ts_B_start, end=ts_B_end, images=[Path("img2.jpg")])
        
        location_data = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        schedule = Schedule(meta=meta, timeblocks={"A": block_A, "B": block_B}, days=None, location=location_data)
        
        validator.validate(schedule, pack_dir)
        warnings = [record.message for record in caplog.records]
        assert any("gap detected" in msg.lower() and "end of last block" in msg.lower() for msg in warnings)
        
    def test_analyze_time_coverage_with_global_location(self, validator, tmp_path):
        """Check that time coverage analysis works with global location."""
        pack_dir = tmp_path / "pack"
        pack_dir.mkdir()
        (pack_dir / "img1.jpg").touch()
        
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Global Location Schedule")
        # Use solar times without local location
        ts_start = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        ts_end = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        block = TimeBlock(name="day", start=ts_start, end=ts_end, images=[Path("img1.jpg")])
        
        # No location in schedule
        schedule = Schedule(meta=meta, timeblocks={"day": block}, days=None, location=None)
        
        # Provide global location
        global_location = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        
        # This should not raise an error
        validator.validate(schedule, pack_dir, global_location)
