import pytest
from datetime import time
from wallpy.schedule import TimeSpecParser
from wallpy.models import TimeSpecType

class TestTimeSpecParser:
    """Tests for the TimeSpecParser class"""
    
    def test_parse_absolute_time(self):
        """Test parsing absolute time specifications"""
        parser = TimeSpecParser()
        
        # Test standard time format
        time_spec = parser.parse("08:30")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(8, 30)
        assert time_spec.offset == 0
        
        # Test with seconds
        time_spec = parser.parse("23:45:30")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 45, 30)
        
        # Test with whitespace
        time_spec = parser.parse("  12:15  ")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(12, 15)

        # Test with whitespace between hours and minutes
        time_spec = parser.parse("12 : 15")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(12, 15)

        # Test with AM/PM
        time_spec = parser.parse("5:30 AM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(5, 30)

        time_spec = parser.parse("11:30 PM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 30)

        # Test with AM/PM and whitespace
        time_spec = parser.parse("  11:30 PM  ")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(23, 30)

        # Test with AM/PM and whitespace between hours and minutes
        time_spec = parser.parse("12 : 15 AM")
        assert time_spec.type == TimeSpecType.ABSOLUTE
        assert time_spec.base == time(00, 15)


    def test_parse_solar_time(self):
        """Test parsing solar time specifications"""
        parser = TimeSpecParser()
        
        # Test basic solar event
        time_spec = parser.parse("sunrise")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "sunrise"
        assert time_spec.offset == 0
        
        # Test with positive offset
        time_spec = parser.parse("sunset+30")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "sunset"
        assert time_spec.offset == 30
        
        # Test with negative offset
        time_spec = parser.parse("noon-45")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "noon"
        assert time_spec.offset == -45
        
        # Test with 'm' suffix
        time_spec = parser.parse("dawn+15m")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "dawn"
        assert time_spec.offset == 15
        
        # Test with uppercase and whitespace
        time_spec = parser.parse("  DUSK-10  ")
        assert time_spec.type == TimeSpecType.SOLAR
        assert time_spec.base == "dusk"
        assert time_spec.offset == -10
    
    def test_invalid_time_formats(self):
        """Test handling of invalid time formats"""
        parser = TimeSpecParser()
        
        # Invalid absolute time
        with pytest.raises(ValueError):
            parser.parse("25:70")
        
        # Invalid format that doesn't match the regex pattern
        with pytest.raises(ValueError):
            parser.parse("sunrise:30")
        
        with pytest.raises(ValueError):
            parser.parse("sunrise*2")
        
        # Invalid solar event
        with pytest.raises(ValueError):
            parser.parse("midday+30")
        
        # Empty string
        with pytest.raises(ValueError):
            parser.parse("")

        # Invalid time format with AM/PM
        with pytest.raises(ValueError):
            parser.parse("12:30 MA")