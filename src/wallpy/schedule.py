# src/wallpy/schedule.py
import re
import tomli
from datetime import datetime, time, date, timedelta, timezone
from pathlib import Path
from typing import Optional, Union, Dict, List, Any
from astral import LocationInfo, sun
from .models import Schedule, ScheduleType, TimeSpec, TimeSpecType, TimeBlock, DaySchedule, ScheduleMeta, Location
import logging

# ----------- Constants & Config -----------
SOLAR_FALLBACKS = {
    "midnight": time(0, 0),
    "dawn": time(5, 0),
    "sunrise": time(6, 30),
    "noon": time(12, 0),
    "sunset": time(18, 30),
    "dusk": time(19, 30)
}

ACCEPTED_SOLAR_EVENTS = set(SOLAR_FALLBACKS.keys())

SOLAR_TIME_REGEX = re.compile(
    r"^(?P<event>\w+)"          # Solar event name
    r"(?:(?P<op>[+-])"          # Optional operator
    r"(?P<offset>\d+))?"        # Offset in minutes
    r"m?$",                     # Optional 'm' suffix
    re.IGNORECASE
)

# ----------- Core Classes -----------
class TimeSpecParser:
    """Parser for time specifications in schedules"""

    @staticmethod
    def parse(spec: str) -> TimeSpec:
        """
        Parse time strings into structured TimeSpec objects.

        Supports:
        - Absolute times: "08:30", "12 : 30", "5:30 AM", etc.
        - Solar events: "sunrise", "sunset+45m", "noon-30"
        """
        # Normalize the input
        spec_orig = spec
        spec = spec.strip().lower()
        
        # Check for AM/PM cases
        if "am" in spec or "pm" in spec:
            # Remove extra spaces around colon for consistency, e.g., "5 :30 am" -> "5:30 am"
            spec_normalized = re.sub(r'\s*:\s*', ':', spec)
            try:
                parsed_time = datetime.strptime(spec_normalized, "%I:%M %p").time()
                return TimeSpec(
                    type=TimeSpecType.ABSOLUTE,
                    base=parsed_time
                )
            except ValueError as e:
                logging.error(f"Failed to parse AM/PM time spec '{spec_orig}': {e}")
                raise ValueError(f"Invalid time format: {spec_orig}") from e

        # Handle 24-hour format with optional spaces (e.g., "12 : 30")
        if ":" in spec:
            try:
                # Remove all spaces to ensure a proper ISO format "HH:MM"
                clean_spec = spec.replace(" ", "")
                parsed_time = time.fromisoformat(clean_spec)
                return TimeSpec(
                    type=TimeSpecType.ABSOLUTE,
                    base=parsed_time
                )
            except ValueError as e:
                logging.error(f"Failed to parse 24-hour time spec '{spec_orig}': {e}")
                raise ValueError(f"Invalid time format: {spec_orig}") from e

        # Attempt to parse as a solar event
        match = SOLAR_TIME_REGEX.fullmatch(spec)
        if not match:
            logging.error(f"Time specification '{spec_orig}' did not match solar pattern.")
            raise ValueError(f"Invalid time specification: '{spec_orig}'")

        groups = match.groupdict()
        event = groups["event"].lower()
        # Validate the solar event name
        if event not in ACCEPTED_SOLAR_EVENTS:
            logging.error(f"Invalid solar event name: '{event}' in spec '{spec_orig}'")
            raise ValueError(f"Invalid solar event name: '{event}'")
        
        op = groups["op"] or "+"
        offset = int(groups["offset"] or 0) * (-1 if op == "-" else 1)

        return TimeSpec(
            type=TimeSpecType.SOLAR,
            base=event,
            offset=offset
        )


class ScheduleParser:
    """Parser for schedule files and components"""
    
    def __init__(self):
        self.time_parser = TimeSpecParser()
    
    def parse_meta(self, data: dict) -> ScheduleMeta:
        """Parse schedule metadata section"""
        try:
            meta = ScheduleMeta(
                type=ScheduleType(data["type"]),
                name=data["name"],
                author=data.get("author"),
                description=data.get("description"),
                version=data.get("version", "1.0")
            )
            logging.info("Parsed metadata successfully.")
            return meta
        except KeyError as e:
            logging.error(f"Missing key in metadata: {e}")
            raise ValueError(f"Missing required meta field: {e}") from e

    def parse_timeblocks(self, data: dict) -> Dict[str, TimeBlock]:
        """Parse timeblocks section"""
        blocks = {}
        for name, spec in data.items():
            try:
                block = TimeBlock(
                    name=name,
                    start=self.time_parser.parse(spec["start"]),
                    end=self.time_parser.parse(spec["end"]),
                    images=[Path(img) for img in spec["images"]],
                    shuffle=spec.get("shuffle", False)
                )
                blocks[name] = block
                logging.info(f"Parsed timeblock '{name}' successfully.")
            except KeyError as e:
                logging.error(f"Missing key in timeblock '{name}': {e}")
                raise ValueError(f"Missing required field in timeblock '{name}': {e}") from e
            except Exception as e:
                logging.error(f"Error parsing timeblock '{name}': {e}")
                raise
        return blocks
    
    def parse_days(self, data: dict) -> Dict[str, DaySchedule]:
        """Parse days-of-week schedule"""
        days = {}
        for day, spec in data.items():
            try:
                if isinstance(spec, str):
                    days[day] = DaySchedule(images=[Path(spec)])
                else:
                    days[day] = DaySchedule(
                        images=[Path(img) for img in spec["images"]],
                        shuffle=spec.get("shuffle", False)
                    )
                logging.info(f"Parsed day schedule for '{day}' successfully.")
            except KeyError as e:
                logging.error(f"Missing key in day schedule for '{day}': {e}")
                raise ValueError(f"Missing required field in day schedule for '{day}': {e}") from e
            except Exception as e:
                logging.error(f"Error parsing day schedule for '{day}': {e}")
                raise
        return days
    
    def parse_location(self, data: dict) -> Location:
        """Parse location data"""
        try:
            location = Location(
                latitude=data.get("latitude", 0.0),
                longitude=data.get("longitude", 0.0),
                timezone=data.get("timezone", "UTC"),
                name=data.get("name", "location"),
                region=data.get("region", "region")
            )
            logging.info("Parsed location successfully.")
            return location
        except Exception as e:
            logging.error(f"Error parsing location data: {e}")
            raise ValueError("Error parsing location data") from e
    
    def parse_file(self, path: Path) -> Schedule:
        """Parse a schedule file into a Schedule object"""
        try:
            with open(path, "rb") as f:
                data = tomli.load(f)
            logging.info(f"Loaded schedule file from {path}.")
        except Exception as e:
            logging.error(f"Failed to load schedule file from {path}: {e}")
            raise ValueError(f"Failed to load schedule file: {e}") from e
        
        try:
            meta_data = data["meta"]
        except KeyError as e:
            logging.error(f"Missing 'meta' section in schedule file: {e}")
            raise ValueError("Missing 'meta' section in schedule file") from e
        
        meta = self.parse_meta(meta_data)
        schedule = Schedule(meta=meta)
        
        if meta.type == ScheduleType.TIMEBLOCKS:
            try:
                schedule.timeblocks = self.parse_timeblocks(data["timeblocks"])
            except KeyError as e:
                logging.error(f"Missing 'timeblocks' section in schedule file: {e}")
                raise ValueError("Missing 'timeblocks' section in schedule file") from e
            
            if "location" in data:
                try:
                    schedule.location = self.parse_location(data["location"])
                except Exception as e:
                    logging.error(f"Error parsing location: {e}")
                    raise
        elif meta.type == ScheduleType.DAYS:
            try:
                schedule.days = self.parse_days(data["days"])
            except KeyError as e:
                logging.error(f"Missing 'days' section in schedule file: {e}")
                raise ValueError("Missing 'days' section in schedule file") from e
        else:
            logging.error(f"Unknown schedule type: {meta.type}")
            raise ValueError(f"Unknown schedule type: {meta.type}")
        
        logging.info("Schedule file parsed successfully.")
        return schedule
    


class SolarTimeCalculator:
    """Calculator for solar event times"""
    
    def __init__(self):
        self._cache = {}  # Cache for solar calculations
    
    def get_fallback_time(self, event: str) -> time:
        """Get predefined time for solar events when location data is missing"""
        return SOLAR_FALLBACKS[event.lower()]
    
    def resolve_time(
        self,
        event: str,
        date_obj: date,
        location: Optional[Location] = None
    ) -> time:
        """Calculate concrete solar time using astral"""
        event = event.lower()
        
        # Normalize event name
        valid_events = [
            "dawn",
            "sunrise",
            "noon",
            "sunset",
            "dusk",
            "midnight"
        ]
        
        if event not in valid_events:
            raise ValueError(f"Unknown solar event: {event}")

        # Use fallbacks if no location data
        if location is None:
            return self.get_fallback_time(event)

        # Extract location data
        latitude = location.latitude
        longitude = location.longitude
        tz = location.timezone
        name = location.name
        region = location.region

        # Check cache first
        cache_key = (event, date_obj, latitude, longitude, tz)
        if cache_key in self._cache:
            return self._cache[cache_key]

        try:
            location_info = LocationInfo(name, region, tz, latitude, longitude)
            
            # Handle different ways to get solar times
            if event == "midnight":
                # Midnight is a special case
                result = time(0, 0)
            else:
                # Use astral's sun object for other events
                sun_object = sun.sun(location_info.observer, date=date_obj, tzinfo=tz)
                result = sun_object[event].time()
                
            # Cache the result
            self._cache[cache_key] = result
            return result
        except (AttributeError, KeyError):
            return self.get_fallback_time(event)
    
    def resolve_datetime(
        self, 
        spec: TimeSpec, 
        base_date: date, 
        location_data: Optional[Dict[str, Any]]
    ) -> datetime:
        """Convert TimeSpec to concrete datetime"""
        if spec.type == TimeSpecType.ABSOLUTE:
            return datetime.combine(base_date, spec.base)
        
        # Create Location object from dict if available
        location = None
        if location_data:
            location = Location(
                latitude=location_data.get("latitude", 0.0),
                longitude=location_data.get("longitude", 0.0),
                timezone=location_data.get("timezone", "UTC"),
                name=location_data.get("name", "location"),
                region=location_data.get("region", "region")
            )
        
        solar_time = self.resolve_time(
            spec.base,
            base_date,
            location
        )
        return datetime.combine(base_date, solar_time) + timedelta(minutes=spec.offset)
    

class ScheduleValidator:
    """Validator for schedule integrity"""
    
    def __init__(self, solar_calculator: "SolarTimeCalculator") -> None:
        self.solar_calculator = solar_calculator
    
    def validate(self, schedule: "Schedule", pack_path: Path, global_location: Optional[Dict[str, Any]] = None) -> None:
        """Main validation entry point"""
        # Validate that the expected schedule sections are present.
        if schedule.meta.type == ScheduleType.TIMEBLOCKS:
            if not schedule.timeblocks or len(schedule.timeblocks) == 0:
                raise ValueError("Timeblock schedule must contain at least one timeblock.")
            self._validate_timeblocks(schedule, pack_path, global_location)
            self._analyze_time_coverage(schedule, global_location)
        elif schedule.meta.type == ScheduleType.DAYS:
            if not schedule.days or len(schedule.days) == 0:
                raise ValueError("Day-based schedule must contain at least one day entry.")
            self._validate_days(schedule, pack_path)
        else:
            raise ValueError("Unknown schedule type.")
    
    def _validate_timeblocks(self, schedule: "Schedule", pack_path: Path, global_location: Optional[Dict[str, Any]] = None) -> None:
        """Validate timeblock-based schedules"""
        # Check if any time specification uses solar events.
        has_solar = any(
            block.start.type == TimeSpecType.SOLAR or block.end.type == TimeSpecType.SOLAR
            for block in schedule.timeblocks.values()
        )
        
        if has_solar and not schedule.location and not global_location:
            logging.warning("Solar timeblocks without location data will use fallback times")
        
        # Validate that each image file exists in the given pack directory.
        for block in schedule.timeblocks.values():
            for img in block.images:
                if not (pack_path / img).exists():
                    raise FileNotFoundError(f"Image {img} not found in pack")
    
    def _validate_days(self, schedule: "Schedule", pack_path: Path) -> None:
        """Validate day-based schedules"""
        for day, day_sched in schedule.days.items():
            for img in day_sched.images:
                if not (pack_path / img).exists():
                    raise FileNotFoundError(f"Day image {img} not found in pack")
    
    def _analyze_time_coverage(self, schedule: "Schedule", global_location: Optional[Dict[str, Any]] = None) -> None:
        """Analyze schedule coverage and report potential issues as warnings"""
        if not schedule.timeblocks:
            return
        
        test_date: date = datetime.today().date()
        blocks = []
        
        # Use schedule location or global location if available
        location_data = schedule.location if schedule.location else global_location
        
        # Convert all time specifications into concrete datetimes for the test date.
        for block in schedule.timeblocks.values():
            start_dt = self.solar_calculator.resolve_datetime(block.start, test_date, location_data)
            end_dt = self.solar_calculator.resolve_datetime(block.end, test_date, location_data)
            
            # If the end time is before or equal to the start, assume the block crosses midnight.
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
                
            blocks.append((block.name, start_dt, end_dt))
        
        # Sort blocks by their start time.
        blocks.sort(key=lambda x: x[1])
        
        # Check for overlaps and gaps between consecutive blocks.
        for i in range(len(blocks) - 1):
            current_name, current_start, current_end = blocks[i]
            next_name, next_start, next_end = blocks[i + 1]
            
            if current_end > next_start:
                logging.warning(f"Timeblock overlap detected: '{current_name}' and '{next_name}'")
            elif current_end < next_start:
                gap = next_start - current_end
                if gap > timedelta(minutes=1):  # Allow 1-minute tolerance
                    logging.warning(f"Gap detected between '{current_name}' and '{next_name}' ({gap})")
        
        # Additionally, check the gap from the end of the last block to the start of the first block (cycling over midnight).
        first_block_start = blocks[0][1]
        last_block_end = blocks[-1][2]
        circular_gap = (first_block_start + timedelta(days=1)) - last_block_end
        if circular_gap > timedelta(minutes=1):
            logging.warning(f"Gap detected between end of last block and start of first block ({circular_gap})")
        
        # Compute total scheduled coverage.
        total_coverage = timedelta()
        for _, start, end in blocks:
            total_coverage += (end - start)
        
        total_hours = total_coverage.total_seconds() / 3600.0
        if total_coverage < timedelta(hours=24):
            logging.warning(f"Schedule covers {total_hours:.1f} hours out of 24")


class ScheduleManager:
    """Main class for schedule operations"""
    
    def __init__(self):
        self.parser = ScheduleParser()
        self.solar_calculator = SolarTimeCalculator()
        self.validator = ScheduleValidator(self.solar_calculator)
        self.logger = logging.getLogger(__name__)
    
    def load_schedule(self, path: Path) -> "Schedule":
        """Load and parse schedule file"""
        self.logger.debug(f"Loading schedule from {path}")
        return self.parser.parse_file(path)
    
    def validate_schedule(self, schedule: "Schedule", pack_path: Path, global_location: Optional[Dict[str, Any]] = None) -> None:
        """Validate schedule integrity"""
        self.logger.debug(f"Validating schedule {schedule}")
        self.validator.validate(schedule, pack_path, global_location)
    
    def get_current_block(self, schedule: "Schedule", when: datetime, global_location: Optional[Dict[str, Any]] = None) -> Optional["TimeBlock"]:
        """Find active timeblock for given datetime"""
        if schedule.meta.type != ScheduleType.TIMEBLOCKS or not schedule.timeblocks:
            self.logger.debug("Schedule is not timeblock-based or has no timeblocks")
            return None
            
        test_date = when.date()
        
        # Use schedule location or global location if available
        location_data = schedule.location if schedule.location else global_location
        
        for block in schedule.timeblocks.values():
            start = self.solar_calculator.resolve_datetime(block.start, test_date, location_data)
            end = self.solar_calculator.resolve_datetime(block.end, test_date, location_data)
            
            self.logger.debug(f"Block: {block.name}, Start: {start}, End: {end}, When: {when}")
            
            # Handle midnight crossing
            if end <= start:
                self.logger.debug("Midnight crossing detected")
                end += timedelta(days=1)
                # Also check previous day for midnight crossing blocks
                if when < end and when.time() < end.time():
                    prev_start = start - timedelta(days=1)
                    prev_end = end - timedelta(days=1)
                    if prev_start <= when < prev_end:
                        return block
            
            if start <= when < end:
                return block
                
        return None

    def get_next_block(self, schedule: "Schedule", when: datetime, global_location: Optional[Dict[str, Any]] = None) -> Optional["TimeBlock"]:
        """Find the next upcoming timeblock after the given datetime"""
        if schedule.meta.type != ScheduleType.TIMEBLOCKS or not schedule.timeblocks:
            self.logger.debug("Schedule is not timeblock-based or has no timeblocks")
            return None
            
        test_date = when.date()
        future_blocks = []
        
        # Use schedule location or global location if available
        location_data = schedule.location if schedule.location else global_location
        
        for block in schedule.timeblocks.values():
            start = self.solar_calculator.resolve_datetime(block.start, test_date, location_data)
            end = self.solar_calculator.resolve_datetime(block.end, test_date, location_data)
            if end <= start:
                end += timedelta(days=1)
            if start > when:
                future_blocks.append((start, block))
        
        if future_blocks:
            future_blocks.sort(key=lambda x: x[0])
            self.logger.debug(f"Next block determined: {future_blocks[0][1].name}")
            return future_blocks[0][1]
        return None
