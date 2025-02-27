import pytest
from pathlib import Path
import tempfile
import tomli_w
from datetime import time
from wallpy.schedule import ScheduleParser
from wallpy.models import ScheduleType, TimeSpecType, Location

class TestScheduleParser:
    """Tests for the ScheduleParser class"""
    
    def test_parse_meta(self):
        """Test parsing schedule metadata"""
        parser = ScheduleParser()
        
        # Test minimal metadata
        meta_data = {
            "type": "timeblocks",
            "name": "Test Schedule"
        }
        
        meta = parser.parse_meta(meta_data)
        assert meta.type == ScheduleType.TIMEBLOCKS
        assert meta.name == "Test Schedule"
        assert meta.author is None
        assert meta.description is None
        assert meta.version == "1.0"  # Default version
        
        # Test complete metadata
        meta_data = {
            "type": "days",
            "name": "Complete Test",
            "author": "Test Author",
            "description": "A test schedule",
            "version": "2.0"
        }
        
        meta = parser.parse_meta(meta_data)
        assert meta.type == ScheduleType.DAYS
        assert meta.name == "Complete Test"
        assert meta.author == "Test Author"
        assert meta.description == "A test schedule"
        assert meta.version == "2.0"
    
    def test_parse_meta_missing_required_field(self):
        """Test that missing required meta fields raises an error"""
        parser = ScheduleParser()
        # Missing 'type'
        meta_data = {"name": "Missing Type"}
        with pytest.raises(ValueError):
            parser.parse_meta(meta_data)
        
        # Missing 'name'
        meta_data = {"type": "timeblocks"}
        with pytest.raises(ValueError):
            parser.parse_meta(meta_data)
    
    def test_parse_meta_invalid_type(self):
        """Test that an invalid schedule type raises an error"""
        parser = ScheduleParser()
        meta_data = {
            "type": "invalid",
            "name": "Test Schedule"
        }
        with pytest.raises(ValueError):
            parser.parse_meta(meta_data)
    
    def test_parse_timeblocks(self):
        """Test parsing timeblocks section"""
        parser = ScheduleParser()
        
        timeblocks_data = {
            "morning": {
                "start": "sunrise",
                "end": "noon",
                "images": ["img1.jpg", "img2.jpg"]
            },
            "afternoon": {
                "start": "12:00",
                "end": "sunset",
                "images": ["img3.jpg"],
                "shuffle": True
            }
        }
        
        blocks = parser.parse_timeblocks(timeblocks_data)
        
        # Check morning block
        assert "morning" in blocks
        morning = blocks["morning"]
        assert morning.name == "morning"
        assert morning.start.type == TimeSpecType.SOLAR
        assert morning.start.base == "sunrise"
        assert morning.end.type == TimeSpecType.SOLAR
        assert morning.end.base == "noon"
        assert len(morning.images) == 2
        assert morning.images[0] == Path("img1.jpg")
        assert morning.images[1] == Path("img2.jpg")
        assert morning.shuffle is False  # Default
        
        # Check afternoon block
        assert "afternoon" in blocks
        afternoon = blocks["afternoon"]
        assert afternoon.name == "afternoon"
        assert afternoon.start.type == TimeSpecType.ABSOLUTE
        assert afternoon.start.base == time(12, 0)
        assert afternoon.end.type == TimeSpecType.SOLAR
        assert afternoon.end.base == "sunset"
        assert len(afternoon.images) == 1
        assert afternoon.images[0] == Path("img3.jpg")
        assert afternoon.shuffle is True
    
    def test_parse_timeblocks_missing_required_field(self):
        """Test that missing required fields in a timeblock raises an error"""
        parser = ScheduleParser()
        # Missing 'start'
        timeblocks_data = {
            "block1": {
                "end": "noon",
                "images": ["img.jpg"]
            }
        }
        with pytest.raises(ValueError):
            parser.parse_timeblocks(timeblocks_data)
    
    def test_parse_days(self):
        """Test parsing days section"""
        parser = ScheduleParser()
        
        # Test with string shorthand
        days_data = {
            "monday": "monday.jpg",
            "tuesday": {
                "images": ["tue1.jpg", "tue2.jpg"],
                "shuffle": True
            }
        }
        
        days = parser.parse_days(days_data)
        
        # Check Monday (string shorthand)
        assert "monday" in days
        monday = days["monday"]
        assert len(monday.images) == 1
        assert monday.images[0] == Path("monday.jpg")
        assert monday.shuffle is False  # Default
        
        # Check Tuesday (full spec)
        assert "tuesday" in days
        tuesday = days["tuesday"]
        assert len(tuesday.images) == 2
        assert tuesday.images[0] == Path("tue1.jpg")
        assert tuesday.images[1] == Path("tue2.jpg")
        assert tuesday.shuffle is True
    
    def test_parse_days_missing_required_field(self):
        """Test that a day spec missing required fields raises an error"""
        parser = ScheduleParser()
        days_data = {
            "wednesday": {"shuffle": True}  # missing 'images'
        }
        with pytest.raises(ValueError):
            parser.parse_days(days_data)
    
    def test_parse_location(self):
        """Test parsing location data"""
        parser = ScheduleParser()
        
        # Test minimal location data
        location_data = {
            "latitude": 40.7128,
            "longitude": -74.0060
        }
        
        location = parser.parse_location(location_data)
        assert location.latitude == 40.7128
        assert location.longitude == -74.0060
        assert location.timezone == "UTC"  # Default
        assert location.name == "location"  # Default
        assert location.region == "region"  # Default
        
        # Test complete location data
        location_data = {
            "latitude": 51.5074,
            "longitude": -0.1278,
            "timezone": "Europe/London",
            "name": "London",
            "region": "UK"
        }
        
        location = parser.parse_location(location_data)
        assert location.latitude == 51.5074
        assert location.longitude == -0.1278
        assert location.timezone == "Europe/London"
        assert location.name == "London"
        assert location.region == "UK"
    
    def test_parse_file_timeblocks(self):
        """Test parsing a complete schedule file for timeblocks schedule"""
        parser = ScheduleParser()
        
        # Create a temporary schedule file for timeblocks
        with tempfile.NamedTemporaryFile(suffix=".toml", delete=False) as temp:
            schedule_data = {
                "meta": {
                    "type": "timeblocks",
                    "name": "Test Schedule",
                    "author": "Test Author"
                },
                "timeblocks": {
                    "day": {
                        "start": "sunrise",
                        "end": "sunset",
                        "images": ["day.jpg"]
                    },
                    "night": {
                        "start": "sunset",
                        "end": "sunrise",
                        "images": ["night1.jpg", "night2.jpg"],
                        "shuffle": True
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
        
        try:
            schedule = parser.parse_file(temp_path)
            
            # Check metadata
            assert schedule.meta.type == ScheduleType.TIMEBLOCKS
            assert schedule.meta.name == "Test Schedule"
            assert schedule.meta.author == "Test Author"
            
            # Check timeblocks
            assert len(schedule.timeblocks) == 2
            assert "day" in schedule.timeblocks
            assert "night" in schedule.timeblocks
            
            # Check location (ensure it's parsed as a Location object)
            assert schedule.location is not None
            assert schedule.location.latitude == 40.7128
            assert schedule.location.longitude == -74.0060
            assert schedule.location.timezone == "America/New_York"
            
            # Check that days is None for a timeblocks schedule
            assert schedule.days is None
        finally:
            temp_path.unlink()
    
    def test_parse_file_days(self):
        """Test parsing a complete schedule file for days schedule"""
        parser = ScheduleParser()
        
        # Create a temporary schedule file for a days-based schedule
        with tempfile.NamedTemporaryFile(suffix=".toml", delete=False) as temp:
            schedule_data = {
                "meta": {
                    "type": "days",
                    "name": "Days Schedule"
                },
                "days": {
                    "monday": "mon.jpg",
                    "tuesday": {
                        "images": ["tue.jpg"],
                        "shuffle": False
                    }
                }
            }
            tomli_w.dump(schedule_data, temp)
            temp_path = Path(temp.name)
        
        try:
            schedule = parser.parse_file(temp_path)
            assert schedule.meta.type == ScheduleType.DAYS
            assert schedule.meta.name == "Days Schedule"
            assert schedule.days is not None
            assert "monday" in schedule.days
            assert "tuesday" in schedule.days
            # For a days schedule, timeblocks should be None
            assert schedule.timeblocks is None
        finally:
            temp_path.unlink()
    
    def test_parse_file_missing_meta(self):
        """Test parsing a schedule file missing the meta section"""
        parser = ScheduleParser()
        
        with tempfile.NamedTemporaryFile(suffix=".toml", delete=False) as temp:
            schedule_data = {
                "timeblocks": {}
            }
            tomli_w.dump(schedule_data, temp)
            temp_path = Path(temp.name)
        
        try:
            with pytest.raises(ValueError):
                parser.parse_file(temp_path)
        finally:
            temp_path.unlink()
    
    def test_parse_file_invalid_toml(self):
        """Test that parsing an invalid TOML file raises an error"""
        parser = ScheduleParser()
        
        with tempfile.NamedTemporaryFile(suffix=".toml", delete=False) as temp:
            temp.write(b"not valid toml content")
            temp_path = Path(temp.name)
        
        try:
            with pytest.raises(ValueError):
                parser.parse_file(temp_path)
        finally:
            temp_path.unlink()
    
    def test_parse_file_nonexistent(self):
        """Test that attempting to parse a non-existent file raises an error"""
        parser = ScheduleParser()
        non_existent = Path("nonexistent_file.toml")
        with pytest.raises(ValueError):
            parser.parse_file(non_existent)
