import pytest
import tempfile
from pathlib import Path
from datetime import datetime, date, time, timedelta
import tomli_w

from wallpy.models import Schedule, ScheduleMeta, ScheduleType, TimeSpec, TimeSpecType, TimeBlock, DaySchedule
from wallpy.schedule import SolarTimeCalculator, ScheduleParser, ScheduleValidator, ScheduleManager

# --- Dummy SolarTimeCalculator for predictable results in tests ---
class DummySolarTimeCalculator(SolarTimeCalculator):
    def resolve_datetime(self, spec: TimeSpec, base_date: date, location: dict) -> datetime:
        if spec.type == TimeSpecType.ABSOLUTE:
            return datetime.combine(base_date, spec.base)
        else:
            # For testing, return fixed times for solar events.
            fallback_times = {
                "sunrise": time(6, 30),
                "sunset": time(18, 30)
            }
            t = fallback_times.get(spec.base.lower(), time(12, 0))
            return datetime.combine(base_date, t) + timedelta(minutes=spec.offset)

# --- Fixtures ---
@pytest.fixture
def schedule_manager():
    manager = ScheduleManager()
    # Override solar calculator with dummy version for predictable results.
    manager.solar_calculator = DummySolarTimeCalculator()
    manager.validator = ScheduleValidator(manager.solar_calculator)
    return manager

@pytest.fixture
def temp_pack(tmp_path):
    pack_dir = tmp_path / "pack"
    pack_dir.mkdir()
    # Create dummy images for tests.
    (pack_dir / "img1.jpg").touch()
    (pack_dir / "morning.jpg").touch()
    (pack_dir / "afternoon.jpg").touch()
    (pack_dir / "evening.jpg").touch()
    (pack_dir / "imgA.jpg").touch()
    (pack_dir / "imgB.jpg").touch()
    (pack_dir / "monday.jpg").touch()
    return pack_dir

@pytest.fixture
def sample_schedule_file():
    """Create a sample schedule file for testing"""
    with tempfile.NamedTemporaryFile(suffix=".toml", delete=False) as temp:
        schedule_data = {
            "meta": {
                "type": "timeblocks",
                "name": "Test Schedule",
                "author": "Test Author"
            },
            "timeblocks": {
                "morning": {
                    "start": "06:00",
                    "end": "12:00",
                    "images": ["morning.jpg"]
                },
                "afternoon": {
                    "start": "12:00",
                    "end": "18:00",
                    "images": ["afternoon.jpg"]
                },
                "evening": {
                    "start": "18:00",
                    "end": "06:00",
                    "images": ["evening.jpg"]
                }
            },
            "location": {
                "latitude": 40.7128,
                "longitude": -74.0060,
                "timezone": "America/New_York"
            }
        }
        tomli_w.dump(schedule_data, temp)
        temp_path = Path(temp.name)
    yield temp_path
    temp_path.unlink()

# --- Helper Functions ---
def create_absolute_time_spec(start_hour, start_minute, end_hour, end_minute, offset=0):
    start_spec = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(start_hour, start_minute))
    end_spec = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(end_hour, end_minute))
    start_spec.offset = offset
    end_spec.offset = 0
    return start_spec, end_spec

class TestScheduleManager:
    """Tests for the ScheduleManager class"""
    
    def test_load_schedule(self, sample_schedule_file, schedule_manager):
        """Test loading a schedule from a file"""
        schedule = schedule_manager.load_schedule(sample_schedule_file)
        assert schedule.meta.type == ScheduleType.TIMEBLOCKS
        assert schedule.meta.name == "Test Schedule"
        assert len(schedule.timeblocks) == 3
        assert schedule.location is not None
    
    def test_validate_schedule_success(self, schedule_manager, temp_pack):
        """Test that a valid schedule passes validation"""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Valid Schedule")
        start_spec, end_spec = create_absolute_time_spec(8, 0, 10, 0)
        block = TimeBlock(name="block1", start=start_spec, end=end_spec, images=[Path("img1.jpg")])
        location = {"latitude": 40.0, "longitude": -74.0, "timezone": "UTC"}
        schedule = Schedule(meta=meta, timeblocks={"block1": block}, days=None, location=location)
        schedule_manager.validate_schedule(schedule, temp_pack)
    
    def test_get_current_block(self, schedule_manager):
        """Test getting the current timeblock based on time"""
        # Create a test schedule with three blocks.
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        morning_block = TimeBlock(
            name="morning",
            start=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(6, 0)),
            end=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(12, 0)),
            images=[Path("morning.jpg")]
        )
        afternoon_block = TimeBlock(
            name="afternoon",
            start=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(12, 0)),
            end=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(18, 0)),
            images=[Path("afternoon.jpg")]
        )
        evening_block = TimeBlock(
            name="evening",
            start=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(18, 0)),
            end=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(6, 0)),
            images=[Path("evening.jpg")]
        )
        schedule = Schedule(
            meta=meta,
            timeblocks={"morning": morning_block, "afternoon": afternoon_block, "evening": evening_block},
            days=None,
            location={"latitude": 40.7128, "longitude": -74.0060, "timezone": "America/New_York"}
        )
        
        # Test morning time.
        when = datetime.combine(date.today(), time(9, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        assert block.name == "morning"
        
        # Test afternoon time.
        when = datetime.combine(date.today(), time(15, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        assert block.name == "afternoon"
        
        # Test evening time.
        when = datetime.combine(date.today(), time(21, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        assert block.name == "evening"
        
        # Test midnight (should be evening as block crosses midnight).
        when = datetime.combine(date.today(), time(0, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        assert block.name == "evening"
        
        # Test early morning (still in evening block from previous day).
        when = datetime.combine(date.today(), time(3, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        assert block.name == "evening"
        
        # Test time with no block defined.
        schedule.timeblocks = {
            "morning": TimeBlock(
                name="morning",
                start=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(9, 0)),
                end=TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(17, 0)),
                images=[Path("morning.jpg")]
            )
        }
        when = datetime.combine(date.today(), time(20, 0))
        block = schedule_manager.get_current_block(schedule, when)
        assert block is None
    
    def test_get_current_block_with_invalid_schedule(self, schedule_manager):
        """Test that get_current_block returns None for non-timeblock schedules"""
        # Test with day-based schedule.
        day_schedule = Schedule(
            meta=ScheduleMeta(type=ScheduleType.DAYS, name="Day Schedule"),
            days={"monday": DaySchedule(images=[Path("monday.jpg")])},
            timeblocks=None,
            location=None
        )
        when = datetime.now()
        block = schedule_manager.get_current_block(day_schedule, when)
        assert block is None
        
        # Test with empty timeblocks.
        empty_schedule = Schedule(
            meta=ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Empty Schedule"),
            timeblocks={},
            days=None,
            location=None
        )
        block = schedule_manager.get_current_block(empty_schedule, when)
        assert block is None
    
    def test_get_next_block(self, schedule_manager):
        """Test getting the next upcoming block after a given time"""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Timeblock Schedule")
        ts_A, ts_A_end = create_absolute_time_spec(6, 0, 10, 0)
        ts_B, ts_B_end = create_absolute_time_spec(11, 0, 15, 0)
        block_A = TimeBlock(name="A", start=ts_A, end=ts_A_end, images=[Path("imgA.jpg")])
        block_B = TimeBlock(name="B", start=ts_B, end=ts_B_end, images=[Path("imgB.jpg")])
        schedule = Schedule(
            meta=meta,
            timeblocks={"A": block_A, "B": block_B},
            days=None,
            location={"latitude": 0.0, "longitude": 0.0, "timezone": "UTC"}
        )
        
        # When before block A.
        when = datetime.combine(date.today(), time(5, 0))
        next_block = schedule_manager.get_next_block(schedule, when)
        assert next_block is not None
        assert next_block.name == "A"
        
        # When during block A, next should be block B.
        when = datetime.combine(date.today(), time(7, 0))
        next_block = schedule_manager.get_next_block(schedule, when)
        assert next_block is not None
        assert next_block.name == "B"
        
        # When after block B, next should be None.
        when = datetime.combine(date.today(), time(16, 0))
        next_block = schedule_manager.get_next_block(schedule, when)
        assert next_block is None

    def test_get_current_block_with_global_location(self, schedule_manager):
        """Test that get_current_block can use global location data"""
        # Create a schedule with solar times but no location
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Solar Schedule")
        
        # Create a block that spans from sunrise to sunset
        sunrise_spec = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        sunset_spec = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        day_block = TimeBlock(
            name="day",
            start=sunrise_spec,
            end=sunset_spec,
            images=[Path("day.jpg")]
        )
        
        # Create a block that spans from sunset to sunrise
        night_block = TimeBlock(
            name="night",
            start=sunset_spec,
            end=sunrise_spec,
            images=[Path("night.jpg")]
        )
        
        # Create schedule without location
        schedule = Schedule(
            meta=meta,
            timeblocks={"day": day_block, "night": night_block},
            days=None,
            location=None
        )
        
        # Create a global location
        global_location = {
            "latitude": 40.0,
            "longitude": -74.0,
            "timezone": "UTC"
        }
        
        # Test with a time that should be during the day
        when = datetime(2023, 6, 21, 12, 0)  # Noon on summer solstice
        
        # Without global location, it should use fallbacks
        block = schedule_manager.get_current_block(schedule, when)
        assert block is not None
        
        # With global location, it should use the provided location
        block_with_global = schedule_manager.get_current_block(schedule, when, global_location)
        assert block_with_global is not None
        
        # The blocks might be the same or different depending on the fallback times
        # and the actual solar times for the location, but both should return a block

    def test_get_next_block_with_global_location(self, schedule_manager):
        """Test that get_next_block can use global location data"""
        # Create a schedule with solar times but no location
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Solar Schedule")
        
        # Create a block that spans from sunrise to sunset
        sunrise_spec = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise")
        sunset_spec = TimeSpec(type=TimeSpecType.SOLAR, base="sunset")
        day_block = TimeBlock(
            name="day",
            start=sunrise_spec,
            end=sunset_spec,
            images=[Path("day.jpg")]
        )
        
        # Create a block that spans from sunset to sunrise
        night_block = TimeBlock(
            name="night",
            start=sunset_spec,
            end=sunrise_spec,
            images=[Path("night.jpg")]
        )
        
        # Create schedule without location
        schedule = Schedule(
            meta=meta,
            timeblocks={"day": day_block, "night": night_block},
            days=None,
            location=None
        )
        
        # Create a global location
        global_location = {
            "latitude": 40.0,
            "longitude": -74.0,
            "timezone": "UTC"
        }
        
        # Test with a time that should be just before sunrise
        when = datetime(2023, 6, 21, 4, 0)  # Early morning on summer solstice
        
        # Without global location, it should use fallbacks
        next_block = schedule_manager.get_next_block(schedule, when)
        assert next_block is not None
        
        # With global location, it should use the provided location
        next_block_with_global = schedule_manager.get_next_block(schedule, when, global_location)
        assert next_block_with_global is not None