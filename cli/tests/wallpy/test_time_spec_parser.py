import pytest
from datetime import time
from wallpy.schedule import ScheduleManager
from wallpy.models import TimeSpecType

class TestTimeSpecParser:
    """Tests for time specification parsing functionality"""
    
    @pytest.fixture
    def parser(self):
        return ScheduleManager()
    
    def test_parse_absolute_time(self, parser):
        """Test parsing absolute time specifications"""
        # Test standard time format
        time_spec = parser._parse_time_spec("08:30")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(8, 30)
        assert time_spec.offset == 0
        
        # Test with seconds
        time_spec = parser._parse_time_spec("23:45:30")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 45, 30)
        
        # Test with whitespace
        time_spec = parser._parse_time_spec("  12:15  ")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(12, 15)

        # Test with whitespace between hours and minutes
        time_spec = parser._parse_time_spec("12 : 15")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(12, 15)

        # Test with AM/PM
        time_spec = parser._parse_time_spec("5:30 AM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(5, 30)

        time_spec = parser._parse_time_spec("11:30 PM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 30)

        # Test with AM/PM and whitespace
        time_spec = parser._parse_time_spec("  11:30 PM  ")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 30)

        # Test with AM/PM and whitespace between hours and minutes
        time_spec = parser._parse_time_spec("12 : 15 AM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(00, 15)

    def test_parse_solar_time(self, parser):
        """Test parsing solar time specifications"""
        # Test basic solar event
        time_spec = parser._parse_time_spec("sunrise")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "sunrise"
        assert time_spec.offset == 0
        
        # Test with positive offset
        time_spec = parser._parse_time_spec("sunset+30")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "sunset"
        assert time_spec.offset == 30
        
        # Test with negative offset
        time_spec = parser._parse_time_spec("noon-45")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "noon"
        assert time_spec.offset == -45
        
        # Test with 'm' suffix
        time_spec = parser._parse_time_spec("dawn+15m")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "dawn"
        assert time_spec.offset == 15
        
        # Test with uppercase and whitespace
        time_spec = parser._parse_time_spec("  DUSK-10  ")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "dusk"
        assert time_spec.offset == -10
    
    def test_invalid_time_formats(self, parser):
        """Test handling of invalid time formats"""
        # Invalid absolute time
        with pytest.raises(ValueError):
            parser._parse_time_spec("25:70")
        
        # Invalid format that doesn't match the regex pattern
        with pytest.raises(ValueError):
            parser._parse_time_spec("sunrise:30")
        
        with pytest.raises(ValueError):
            parser._parse_time_spec("sunrise*2")
        
        # Invalid solar event
        with pytest.raises(ValueError):
            parser._parse_time_spec("midday+30")
        
        # Empty string
        with pytest.raises(ValueError):
            parser._parse_time_spec("")

        # Invalid time format with AM/PM
        with pytest.raises(ValueError):
            parser._parse_time_spec("12:30 MA")