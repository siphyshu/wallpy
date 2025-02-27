import pytest
from pathlib import Path
from datetime import time
from wallpy.models import (
    ScheduleType, TimeSpecType, ScheduleMeta, TimeSpec, 
    TimeBlock, DaySchedule, Location, Schedule
)

class TestModels:
    """Tests for the model classes"""
    
    def test_schedule_meta(self):
        """Test ScheduleMeta class"""
        # Test minimal initialization
        meta = ScheduleMeta(
            type=ScheduleType.TIMEBLOCKS,
            name="Test Schedule"
        )
        assert meta.type == ScheduleType.TIMEBLOCKS
        assert meta.name == "Test Schedule"
        assert meta.author is None
        assert meta.description is None
        assert meta.version == "1.0"  # Default
        
        # Test string representation
        assert str(meta) == "Test Schedule v1.0"
        
        # Test with author
        meta = ScheduleMeta(
            type=ScheduleType.DAYS,
            name="Full Schedule",
            author="Test Author"
        )
        assert str(meta) == "Full Schedule v1.0 by Test Author"
    
    def test_time_spec(self):
        """Test TimeSpec class"""
        # Test absolute time
        time_spec = TimeSpec(
            type=TimeSpecType.ABSOLUTE,
            base=time(8, 30)
        )
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(8, 30)
        assert time_spec.offset == 0  # Default
        
        # Test string representation of absolute time
        assert str(time_spec) == "08:30"
        
        # Test solar time
        time_spec = TimeSpec(
            type=TimeSpecType.SOLAR,
            base="sunrise",
            offset=30
        )
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "sunrise"
        assert time_spec.offset == 30
        
        # Test string representation of solar time with positive offset
        assert str(time_spec) == "sunrise+30"
        
        # Test solar time with negative offset
        time_spec = TimeSpec(
            type=TimeSpecType.SOLAR,
            base="sunset",
            offset=-15
        )
        assert str(time_spec) == "sunset-15"
        
        # Test solar time with zero offset
        time_spec = TimeSpec(
            type=TimeSpecType.SOLAR,
            base="noon",
            offset=0
        )
        assert str(time_spec) == "noon"
    
    def test_time_block(self):
        """Test TimeBlock class"""
        # Create time specs for testing
        start = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(8, 0))
        end = TimeSpec(type=TimeSpecType.ABSOLUTE, base=time(17, 0))
        
        # Test initialization
        block = TimeBlock(
            name="workday",
            start=start,
            end=end,
            images=[Path("work1.jpg"), Path("work2.jpg")]
        )
        assert block.name == "workday"
        assert block.start == start
        assert block.end == end
        assert len(block.images) == 2
        assert block.shuffle is False  # Default
        
        # Test string representation
        assert str(block) == "workday: 08:00 to 17:00 (2 images)"
        
        # Test with shuffle enabled
        block = TimeBlock(
            name="evening",
            start=TimeSpec(type=TimeSpecType.SOLAR, base="sunset"),
            end=TimeSpec(type=TimeSpecType.SOLAR, base="sunrise"),
            images=[Path("evening.jpg")],
            shuffle=True
        )
        assert block.shuffle is True
    
    def test_day_schedule(self):
        """Test DaySchedule class"""
        # Test initialization
        day = DaySchedule(
            images=[Path("monday1.jpg"), Path("monday2.jpg")]
        )
        assert len(day.images) == 2
        assert day.shuffle is False  # Default
        
        # Test string representation
        assert str(day) == "2 images"
        
        # Test with shuffle enabled
        day = DaySchedule(
            images=[Path("tuesday.jpg")],
            shuffle=True
        )
        assert day.shuffle is True
        assert str(day) == "1 images (shuffled)"
    
    def test_location(self):
        """Test Location class"""
        # Test minimal initialization
        location = Location(
            latitude=40.7128,
            longitude=-74.0060
        )
        assert location.latitude == 40.7128
        assert location.longitude == -74.0060
        assert location.timezone == "UTC"  # Default
        assert location.name == "location"  # Default
        assert location.region == "region"  # Default
        
        # Test string representation
        assert str(location) == "location (40.71, -74.01)"
        
        # Test full initialization
        location = Location(
            latitude=51.5074,
            longitude=-0.1278,
            timezone="Europe/London",
            name="London",
            region="UK"
        )
        assert location.timezone == "Europe/London"
        assert location.name == "London"
        assert location.region == "UK"
        assert str(location) == "London (51.51, -0.13)"
    
    def test_schedule(self):
        """Test Schedule class"""
        # Create a timeblocks schedule
        meta = ScheduleMeta(type=ScheduleType.TIMEBLOCKS, name="Test Schedule")
        timeblocks = {
            "day": TimeBlock(
                name="day",
                start=TimeSpec(type=TimeSpecType.SOLAR, base="sunrise"),
                end=TimeSpec(type=TimeSpecType.SOLAR, base="sunset"),
                images=[Path("day.jpg")]
            ),
            "night": TimeBlock(
                name="night",
                start=TimeSpec(type=TimeSpecType.SOLAR, base="sunset"),
                end=TimeSpec(type=TimeSpecType.SOLAR, base="sunrise"),
                images=[Path("night.jpg")]
            )
        }
        location = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timezone": "America/New_York"
        }
        
        schedule = Schedule(
            meta=meta,
            timeblocks=timeblocks,
            location=location
        )
        
        # Test basic properties
        assert schedule.meta == meta
        assert schedule.timeblocks == timeblocks
        assert schedule.location == location
        assert schedule.days is None
        
        # Test helper methods
        assert schedule.is_timeblock_based() is True
        assert schedule.is_day_based() is False
        
        # Test string representation
        assert str(schedule) == "Test Schedule: 2 timeblocks"
        
        # Test get_location_object
        location_obj = schedule.get_location_object()
        assert location_obj is not None
        assert location_obj.latitude == 40.7128
        assert location_obj.longitude == -74.0060
        assert location_obj.timezone == "America/New_York"
        
        # Test a days schedule
        days_meta = ScheduleMeta(type=ScheduleType.DAYS, name="Days Schedule")
        days = {
            "monday": DaySchedule(images=[Path("monday.jpg")]),
            "tuesday": DaySchedule(images=[Path("tuesday.jpg")])
        }
        
        days_schedule = Schedule(
            meta=days_meta,
            days=days
        )
        
        assert days_schedule.is_timeblock_based() is False
        assert days_schedule.is_day_based() is True
        assert days_schedule.timeblocks is None
        assert days_schedule.location is None
        assert str(days_schedule) == "Days Schedule: 2 days"
        
        # Test with no location
        assert days_schedule.get_location_object() is None