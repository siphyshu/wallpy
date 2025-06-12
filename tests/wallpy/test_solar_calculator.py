import pytest
from datetime import date, time, datetime, timedelta
from wallpy.schedule import SolarTimeCalculator
from wallpy.models import Location, TimeSpec, TimeSpecType

class TestSolarTimeCalculator:
    """Tests for the SolarTimeCalculator class"""
    
    def test_get_fallback_time(self):
        """Test getting fallback times for solar events"""
        calculator = SolarTimeCalculator()
        
        # Test all standard solar events
        assert calculator.get_fallback_time("midnight") == time(0, 0)
        assert calculator.get_fallback_time("dawn") == time(5, 0)
        assert calculator.get_fallback_time("sunrise") == time(6, 30)
        assert calculator.get_fallback_time("noon") == time(12, 0)
        assert calculator.get_fallback_time("sunset") == time(18, 30)
        assert calculator.get_fallback_time("dusk") == time(19, 30)
        
        # Test case insensitivity
        assert calculator.get_fallback_time("SUNRISE") == time(6, 30)
    
    def test_resolve_time_without_location(self):
        """Test resolving solar times without location data"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)  # Summer solstice
        
        # Should return fallback times when no location is provided
        assert calculator.resolve_time("sunrise", test_date) == time(6, 30)
        assert calculator.resolve_time("sunset", test_date) == time(18, 30)
    
    def test_resolve_time_with_location(self):
        """Test resolving solar times with location data"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)  # Summer solstice
        
        # Create a test location (New Delhi)
        location = Location(
            latitude=28.6139,
            longitude=77.2090,
            timezone="Asia/Kolkata",
            name="New Delhi",
            region="India"
        )
        
        # Test with location - actual times will depend on the astral calculation.
        # We verify that it returns a time object and doesn't raise exceptions.
        result = calculator.resolve_time("sunrise", test_date, location)
        assert isinstance(result, time)
        
        result = calculator.resolve_time("sunset", test_date, location)
        assert isinstance(result, time)
    
    def test_resolve_time_caching(self):
        """Test that solar time calculations are cached"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)
        
        location = Location(
            latitude=28.6139,
            longitude=77.2090,
            timezone="Asia/Kolkata"
        )
        
        # First call should calculate and cache
        result1 = calculator.resolve_time("sunrise", test_date, location)
        
        # Second call should use cache
        result2 = calculator.resolve_time("sunrise", test_date, location)
        
        # Results should be identical
        assert result1 == result2
        
        # Check that the cache has one entry
        assert len(calculator._cache) == 1

        # Test with a different date
        new_test_date = date(2023, 6, 22)
        result3 = calculator.resolve_time("sunrise", new_test_date, location)
        
        # Check that the cache has two entries
        assert len(calculator._cache) == 2
    
    def test_resolve_datetime(self):
        """Test resolving TimeSpec to datetime"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)
        
        # Test absolute time
        time_spec = TimeSpec(
            type=TimeSpecType.ABSOLUTE,
            base=time(8, 30)
        )
        
        result = calculator.resolve_datetime(time_spec, test_date, None)
        assert result == datetime.combine(test_date, time(8, 30))
        
        # Test solar time with offset
        time_spec = TimeSpec(
            type=TimeSpecType.SOLAR,
            base="sunrise",
            offset=30  # 30 minutes after sunrise
        )
        
        # Create a Location object
        location = Location(
            latitude=28.6139,
            longitude=77.2090,
            timezone="Asia/Kolkata",
            name="New Delhi",
            region="India"
        )
        
        result = calculator.resolve_datetime(time_spec, test_date, location)
        
        # We can't assert the exact time since it depends on astral, but we verify it's a datetime.
        assert isinstance(result, datetime)
        
        # For comparison, get the base solar time and add the offset.
        base_time = calculator.resolve_time("sunrise", test_date, location)
        base_datetime = datetime.combine(test_date, base_time)
        assert result == base_datetime + timedelta(minutes=30)
    
    def test_resolve_datetime_without_location(self):
        """Test resolving solar datetime when no location data is provided, using fallback"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)
        time_spec = TimeSpec(
            type=TimeSpecType.SOLAR,
            base="sunrise",
            offset=15  # 15 minutes after fallback sunrise
        )
        # Without location, fallback for sunrise is time(6,30)
        expected_datetime = datetime.combine(test_date, time(6, 30)) + timedelta(minutes=15)
        result = calculator.resolve_datetime(time_spec, test_date, None)
        assert result == expected_datetime
    
    def test_invalid_solar_event(self):
        """Test handling of invalid solar events"""
        calculator = SolarTimeCalculator()
        test_date = date(2023, 6, 21)
        
        # Invalid solar event should use fallback or raise error
        # Based on the implementation, it should use fallback for unknown events
        try:
            result = calculator.resolve_time("invalid_event", test_date)
            # If it doesn't raise an error, it should return a fallback time
            assert isinstance(result, time)
        except KeyError:
            # This is also acceptable behavior
            pass
