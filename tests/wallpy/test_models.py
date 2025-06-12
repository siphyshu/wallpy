import pytest
from pathlib import Path
from datetime import time
from wallpy.models import (
    ScheduleMeta, ScheduleType, TimeSpec, TimeSpecType, TimeBlock,
    DaySchedule, Location, Schedule, Pack, PackSearchPaths
)

class TestModels:
    """Tests for the model classes"""
    
    def test_schedule_meta(self):
        """Test ScheduleMeta creation and defaults."""
        # Test with minimal data
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        assert meta.type == ScheduleType.TIMEBLOCKS
        assert meta.name == "Test Schedule"
        assert meta.author is None
        assert meta.description is None
        assert meta.version == "1.0"
        
        # Test with full data
        meta = ScheduleMeta(
            type=ScheduleType.DAYS,
            name="Full Schedule",
            author="Test Author",
            description="Test Description",
            version="2.0"
        )
        assert meta.type == ScheduleType.DAYS
        assert meta.name == "Full Schedule"
        assert meta.author == "Test Author"
        assert meta.description == "Test Description"
        assert meta.version == "2.0"
    
    def test_time_spec(self):
        """Test TimeSpec creation."""
        # Test absolute time
        spec = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(8, 30))
        assert spec.type == TimeSpecType.ABSOLUTE
        assert spec.base == time(8, 30)
        assert spec.offset == 0
        
        # Test solar time with offset
        spec = TimeSpec(type=TimeSpecType.SOLAR, base="sunrise", offset=30)
        assert spec.type == TimeSpecType.SOLAR
        assert spec.base == "sunrise"
        assert spec.offset == 30
    
    def test_time_block(self):
        """Test TimeBlock creation."""
        start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(8, 0))
        end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(10, 0))
        images = [Path("image1.jpg"), Path("image2.jpg")]
        
        block = TimeBlock(name="morning", start=start, end=end, images=images)
        assert block.name == "morning"
        assert block.start == start
        assert block.end == end
        assert block.images == images
        assert block.shuffle is False
        
        # Test with shuffle
        block = TimeBlock(name="morning", start=start, end=end, images=images, shuffle=True)
        assert block.shuffle is True
    
    def test_day_schedule(self):
        """Test DaySchedule creation."""
        images = [Path("monday1.jpg"), Path("monday2.jpg")]
        
        day = DaySchedule(images=images)
        assert day.images == images
        assert day.shuffle is False
        
        # Test with shuffle
        day = DaySchedule(images=images, shuffle=True)
        assert day.shuffle is True
    
    def test_location(self):
        """Test Location creation."""
        # Test with minimal data
        location = Location(latitude=40.0, longitude=-74.0)
        assert location.latitude == 40.0
        assert location.longitude == -74.0
        assert location.timezone == "UTC"
        assert location.name == "location"
        assert location.region == "region"
        
        # Test with full data
        location = Location(
            latitude=40.7128,
            longitude=-74.0060,
            timezone="America/New_York",
            name="New York",
            region="NY"
        )
        assert location.latitude == 40.7128
        assert location.longitude == -74.0060
        assert location.timezone == "America/New_York"
        assert location.name == "New York"
        assert location.region == "NY"
    
    def test_schedule(self):
        """Test Schedule creation."""
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        
        # Test timeblock schedule
        start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(8, 0))
        end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(10, 0))
        block = TimeBlock(name="morning", start=start, end=end, images=[Path("image.jpg")])
        
        schedule = Schedule(meta=meta, timeblocks={"morning": block})
        assert schedule.meta == meta
        assert schedule.timeblocks == {"morning": block}
        assert schedule.days is None
        assert schedule.is_timeblock_based() is True
        assert schedule.is_day_based() is False
        
        # Test day schedule
        meta_days = ScheduleMeta(type=ScheduleType.DAYS, name="Day Schedule")
        day = DaySchedule(images=[Path("monday.jpg")])
        
        schedule = Schedule(meta=meta_days, days={"monday": day})
        assert schedule.meta == meta_days
        assert schedule.days == {"monday": day}
        assert schedule.timeblocks is None
        assert schedule.is_timeblock_based() is False
        assert schedule.is_day_based() is True
    
    def test_pack(self):
        """Test Pack creation."""
        pack = Pack(name="test_pack", path=Path("/test/path"), uid="abc123")
        assert pack.name == "test_pack"
        assert pack.path == Path("/test/path")
        assert pack.uid == "abc123"
    
    def test_pack_search_paths(self):
        """Test PackSearchPaths creation."""
        search_paths = PackSearchPaths()
        paths = search_paths.get_paths()
        assert isinstance(paths, list)
        assert all(isinstance(path, Path) for path in paths)