# schedule.py
import re
import tomli
from datetime import datetime, time, date, timedelta
from pathlib import Path
from typing import Optional, Dict, Any, Union
import logging

from wallpy.models import (
    Schedule, ScheduleType, TimeSpec, TimeSpecType, 
    TimeBlock, DaySchedule, ScheduleMeta, Location
)
from wallpy.validate import ScheduleValidator

# Constants
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

class SolarTimeCalculator:
    """Calculator for solar event times"""
    
    def __init__(self):
        self._cache = {}  # Cache for solar calculations
        self._error_cache = set()  # Cache for known errors to avoid repeated warnings
        self.logger = logging.getLogger(__name__)
    
    def get_fallback_time(self, event: str) -> time:
        """Get predefined time for solar events when location data is missing"""
        return SOLAR_FALLBACKS[event.lower()]
    
    def _convert_location(self, location_data: Union[Location, Dict[str, Any], None]) -> Optional[Location]:
        """Convert location data to Location object if needed"""
        if location_data is None:
            return None
        
        if isinstance(location_data, Location):
            return location_data
            
        if isinstance(location_data, dict):
            return Location(
                latitude=location_data.get("latitude", 0.0),
                longitude=location_data.get("longitude", 0.0),
                timezone=location_data.get("timezone", "UTC"),
                name=location_data.get("name", "location"),
                region=location_data.get("region", "region")
            )
        
        return None
    
    def resolve_time(
        self,
        event: str,
        date_obj: date,
        location: Optional[Location] = None
    ) -> time:
        """Calculate concrete solar time using astral"""
        event = event.lower()
        
        # Use fallbacks if no location data
        if location is None:
            self.logger.debug(f"Using fallback time for {event}")
            return self.get_fallback_time(event)

        # Check cache first
        cache_key = (event, date_obj, location.latitude, location.longitude, location.timezone)
        if cache_key in self._cache:
            return self._cache[cache_key]

        # Check if we've already logged an error for this timezone
        error_key = f"timezone:{location.timezone}"
        
        try:
            from astral import LocationInfo, sun
            location_info = LocationInfo(location.name, location.region, location.timezone, location.latitude, location.longitude)
            
            # Handle different ways to get solar times
            if event == "midnight":
                result = time(0, 0)
            else:
                sun_object = sun.sun(location_info.observer, date=date_obj, tzinfo=location.timezone)
                result = sun_object[event].time()
                
            # Cache the result
            self._cache[cache_key] = result
            return result
        except Exception as e:
            # Only log warning once per unique timezone error
            if error_key not in self._error_cache:
                self._error_cache.add(error_key)
                if "time zone" in str(e).lower() or "timezone" in str(e).lower():
                    self.logger.warning(f"Invalid timezone '{location.timezone}': {e}")
                    self.logger.warning("💡 Use 'wallpy config location auto' to automatically detect your location and timezone")
                else:
                    self.logger.warning(f"Failed to calculate solar time for {event}: {e}")
                self.logger.warning("Using fallback solar times instead\n")
            return self.get_fallback_time(event)
    
    def resolve_datetime(
        self, 
        spec: TimeSpec, 
        base_date: date, 
        location: Union[Location, Dict[str, Any], None]
    ) -> datetime:
        """Convert TimeSpec to concrete datetime"""
        if spec.type == TimeSpecType.ABSOLUTE:
            return datetime.combine(base_date, spec.base)
        
        # Convert location data to Location object if needed
        location_obj = self._convert_location(location)
        
        solar_time = self.resolve_time(
            spec.base,
            base_date,
            location_obj
        )
        return datetime.combine(base_date, solar_time) + timedelta(minutes=spec.offset)

class ScheduleManager:
    """Main class for schedule operations"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.solar_calculator = SolarTimeCalculator()
        self.validator = ScheduleValidator(self.solar_calculator)
    
    def load_schedule(self, path: Path) -> Schedule:
        """Load and parse schedule file"""
        self.logger.debug(f"Loading schedule from {path}")
        return self._parse_file(path)
    
    def _parse_file(self, path: Path) -> Schedule:
        """Parse a schedule file into a Schedule object"""
        try:
            with open(path, "rb") as f:
                data = tomli.load(f)
            self.logger.debug(f"Loaded schedule file from {path}")
        except Exception as e:
            self.logger.error(f"Failed to load schedule file from {path}: {e}")
            raise ValueError(f"Failed to load schedule file: {e}")
        
        try:
            meta_data = data["meta"]
        except KeyError as e:
            self.logger.error(f"Missing 'meta' section in schedule file: {e}")
            raise ValueError("Missing 'meta' section in schedule file")
        
        meta = self._parse_meta(meta_data)
        schedule = Schedule(meta=meta)
        
        if meta.type == ScheduleType.TIMEBLOCKS:
            try:
                schedule.timeblocks = self._parse_timeblocks(data["timeblocks"])
            except KeyError as e:
                self.logger.error(f"Missing 'timeblocks' section in schedule file: {e}")
                raise ValueError("Missing 'timeblocks' section in schedule file")
        elif meta.type == ScheduleType.DAYS:
            try:
                schedule.days = self._parse_days(data["days"])
            except KeyError as e:
                self.logger.error(f"Missing 'days' section in schedule file: {e}")
                raise ValueError("Missing 'days' section in schedule file")
        else:
            self.logger.error(f"Unknown schedule type: {meta.type}")
            raise ValueError(f"Unknown schedule type: {meta.type}")
        
        self.logger.debug("Schedule file parsed successfully")
        return schedule

    def _parse_meta(self, data: dict) -> ScheduleMeta:
        """Parse schedule metadata section"""
        try:
            meta = ScheduleMeta(
                type=ScheduleType(data["type"]),
                name=data["name"],
                author=data.get("author", ""),
                description=data.get("description", ""),
                version=data.get("version", "1.0")
            )
            self.logger.debug("Parsed metadata successfully")
            return meta
        except KeyError as e:
            self.logger.error(f"Missing key in metadata: {e}")
            raise ValueError(f"Missing required meta field: {e}")

    def _parse_timeblocks(self, data: dict) -> Dict[str, TimeBlock]:
        """Parse timeblocks section"""
        blocks = {}
        for name, spec in data.items():
            try:
                block = TimeBlock(
                    name=name,
                    start=self._parse_time_spec(spec["start"]),
                    end=self._parse_time_spec(spec["end"]),
                    images=[Path(img) for img in spec["images"]],
                    shuffle=spec.get("shuffle", False)
                )
                blocks[name] = block
                self.logger.debug(f"Parsed timeblock '{name}' successfully")
            except KeyError as e:
                self.logger.error(f"Missing key in timeblock '{name}': {e}")
                raise ValueError(f"Missing required field in timeblock '{name}': {e}")
            except Exception as e:
                self.logger.error(f"Error parsing timeblock '{name}': {e}")
                raise
        return blocks
    
    def _parse_days(self, data: dict) -> Dict[str, DaySchedule]:
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
                self.logger.debug(f"Parsed day schedule for '{day}' successfully")
            except KeyError as e:
                self.logger.error(f"Missing key in day schedule for '{day}': {e}")
                raise ValueError(f"Missing required field in day schedule for '{day}': {e}")
            except Exception as e:
                self.logger.error(f"Error parsing day schedule for '{day}': {e}")
                raise
        return days

    def _parse_time_spec(self, spec: str) -> TimeSpec:
        """Parse time strings into structured TimeSpec objects"""
        # Normalize the input
        spec_orig = spec
        spec = spec.strip().lower()
        
        # Check for AM/PM cases
        if "am" in spec or "pm" in spec:
            spec_normalized = re.sub(r'\s*:\s*', ':', spec)
            try:
                parsed_time = datetime.strptime(spec_normalized, "%I:%M %p").time()
                return TimeSpec(
                    type=TimeSpecType.ABSOLUTE,
                    base=parsed_time
                )
            except ValueError as e:
                self.logger.error(f"Failed to parse AM/PM time spec '{spec_orig}': {e}")
                raise ValueError(f"Invalid time format: {spec_orig}")

        # Handle 24-hour format
        if ":" in spec:
            try:
                clean_spec = spec.replace(" ", "")
                parsed_time = time.fromisoformat(clean_spec)
                return TimeSpec(
                    type=TimeSpecType.ABSOLUTE,
                    base=parsed_time
                )
            except ValueError as e:
                self.logger.error(f"Failed to parse 24-hour time spec '{spec_orig}': {e}")
                raise ValueError(f"Invalid time format: {spec_orig}")

        # Attempt to parse as a solar event
        match = SOLAR_TIME_REGEX.fullmatch(spec)
        if not match:
            self.logger.error(f"Time specification '{spec_orig}' did not match solar pattern")
            raise ValueError(f"Invalid time specification: '{spec_orig}'")

        groups = match.groupdict()
        event = groups["event"].lower()
        if event not in ACCEPTED_SOLAR_EVENTS:
            self.logger.error(f"Invalid solar event name: '{event}' in spec '{spec_orig}'")
            raise ValueError(f"Invalid solar event name: '{event}'")
        
        op = groups["op"] or "+"
        offset = int(groups["offset"] or 0) * (-1 if op == "-" else 1)

        return TimeSpec(
            type=TimeSpecType.SOLAR,
            base=event,
            offset=offset
        )

    def get_block(self, schedule: Schedule, global_location: Union[Location, Dict[str, Any], None] = None, get_next: bool = False) -> Optional[TimeBlock]:
        """Get the current or next timeblock based on the current time"""
        when = datetime.now()
        test_date = when.date()
        
        if schedule.meta.type != ScheduleType.TIMEBLOCKS or not schedule.timeblocks:
            self.logger.debug("Schedule is not timeblock-based or has no timeblocks")
            return None
            
        if get_next:
            future_blocks = []
            
            # First check blocks on the current date
            for block in schedule.timeblocks.values():
                start = self.solar_calculator.resolve_datetime(block.start, test_date, global_location)
                end = self.solar_calculator.resolve_datetime(block.end, test_date, global_location)
                if end <= start:
                    end += timedelta(days=1)
                if start > when:
                    future_blocks.append((start, block))
            
            # If no future blocks found on current date, check blocks on next date
            if not future_blocks:
                next_date = test_date + timedelta(days=1)
                for block in schedule.timeblocks.values():
                    start = self.solar_calculator.resolve_datetime(block.start, next_date, global_location)
                    end = self.solar_calculator.resolve_datetime(block.end, next_date, global_location)
                    if end <= start:
                        end += timedelta(days=1)
                    future_blocks.append((start, block))
            
            if future_blocks:
                future_blocks.sort(key=lambda x: x[0])
                self.logger.debug(f"Next block determined: {future_blocks[0][1].name}")
                return future_blocks[0][1]
                
            # If still no blocks found (shouldn't happen), return the first block
            first_block = next(iter(schedule.timeblocks.values()))
            self.logger.debug(f"No future blocks found, wrapping to first block: {first_block.name}")
            return first_block
        else:
            # Find current block
            for block in schedule.timeblocks.values():
                start = self.solar_calculator.resolve_datetime(block.start, test_date, global_location)
                end = self.solar_calculator.resolve_datetime(block.end, test_date, global_location)
                
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

    def _get_image_index(self, block: TimeBlock, when: datetime, start: datetime, end: datetime, is_next: bool = False) -> int:
        """Calculate which image should be shown based on time and shuffle settings"""
        if block.shuffle:
            return 0 if not is_next else 1
            
        total_duration = (end - start).total_seconds()
        elapsed = (when - start).total_seconds()
        num_images = len(block.images)
        
        if num_images == 0:
            return -1
            
        image_duration = total_duration / num_images
        current_index = int(elapsed / image_duration)
        
        if is_next:
            current_index = (current_index + 1) % num_images
            
        return min(max(0, current_index), num_images - 1)

    def _get_block_times(self, block: TimeBlock, test_date: date, global_location: Union[Location, Dict[str, Any], None] = None) -> tuple[datetime, datetime, float]:
        """Calculate block times and image duration. Returns (start, end, image_duration)"""
        start = self.solar_calculator.resolve_datetime(block.start, test_date, global_location)
        end = self.solar_calculator.resolve_datetime(block.end, test_date, global_location)
        
        if end <= start:
            end += timedelta(days=1)
            
        total_duration = (end - start).total_seconds()
        image_duration = total_duration / len(block.images) if block.images else 0
        
        return start, end, image_duration

    def get_wallpaper(self, schedule: Schedule, global_location: Union[Location, Dict[str, Any], None] = None, include_time: bool = False, get_next: bool = False) -> Union[Optional[Path], tuple[Optional[Path], Optional[datetime], Optional[datetime]]]:
        """Get the current or next wallpaper based on the schedule type and current time"""
        when = datetime.now()
        test_date = when.date()
        
        if schedule.meta.type == ScheduleType.TIMEBLOCKS:
            current_block = self.get_block(schedule, global_location)
            next_block = self.get_block(schedule, global_location, True)
            
            if get_next:
                if current_block and current_block.images:
                    # Get current block times and image duration
                    start, end, image_duration = self._get_block_times(current_block, test_date, global_location)
                    
                    # Handle blocks that span midnight (end date != start date) where the current time
                    # is after midnight but before the block's "start" on the same date. In that case,
                    # the block actually began the previous day, so recalculate the start/end times for
                    # the previous date.
                    if when < start and end.date() != start.date():
                        prev_start, prev_end, prev_image_duration = self._get_block_times(
                            current_block, test_date - timedelta(days=1), global_location
                        )
                        if prev_start <= when < prev_end:
                            start, end, image_duration = prev_start, prev_end, prev_image_duration
                    
                    # Calculate time remaining in current block
                    time_remaining = (end - when).total_seconds()
                    
                    # If there's enough time for another image in current block
                    if time_remaining >= image_duration:
                        if current_block.shuffle:
                            # For shuffled blocks, next image is random
                            return (current_block.images[0], start, end) if include_time else current_block.images[0]
                        else:
                            # For non-shuffled blocks, get next image in sequence
                            current_index = self._get_image_index(current_block, when, start, end)
                            next_index = (current_index + 1) % len(current_block.images)
                            if include_time:
                                image_start = start + timedelta(seconds=next_index * image_duration)
                                image_end = image_start + timedelta(seconds=image_duration)
                                return current_block.images[next_index], image_start, image_end
                            return current_block.images[next_index]
                    
                    # If not enough time in current block, get first image from next block
                    if next_block and next_block.images:
                        if include_time:
                            next_start, next_end, _ = self._get_block_times(next_block, test_date, global_location)
                            return next_block.images[0], next_start, next_end
                        return next_block.images[0]
                    
                    # If no next block, get first image of first block
                    first_block = next(iter(schedule.timeblocks.values())) if schedule.timeblocks else None
                    if first_block and first_block.images:
                        if include_time:
                            start, end, _ = self._get_block_times(first_block, test_date, global_location)
                            return first_block.images[0], start, end
                        return first_block.images[0]
                else:
                    # If no current block, get first image from next block
                    if next_block and next_block.images:
                        if include_time:
                            start, end, _ = self._get_block_times(next_block, test_date, global_location)
                            return next_block.images[0], start, end
                        return next_block.images[0]
                return (None, None, None) if include_time else None
            
            # Get current wallpaper
            if current_block and current_block.images:
                start, end, image_duration = self._get_block_times(current_block, test_date, global_location)
                
                # Adjust for blocks that cross midnight, similar to the logic above
                if when < start and end.date() != start.date():
                    prev_start, prev_end, prev_image_duration = self._get_block_times(
                        current_block, test_date - timedelta(days=1), global_location
                    )
                    if prev_start <= when < prev_end:
                        start, end, image_duration = prev_start, prev_end, prev_image_duration
                
                if when < start:
                    return (None, None, None) if include_time else None
                if when >= end:
                    return (current_block.images[-1], start, end) if include_time else current_block.images[-1]
                    
                image_index = self._get_image_index(current_block, when, start, end)
                if image_index < 0:
                    return (None, None, None) if include_time else None
                    
                if include_time:
                    image_start = start + timedelta(seconds=image_index * image_duration)
                    image_end = image_start + timedelta(seconds=image_duration)
                    return current_block.images[image_index], image_start, image_end
                return current_block.images[image_index]

        elif schedule.meta.type == ScheduleType.DAYS:
            if not schedule.days:
                return (None, None, None) if include_time else None
                
            current_day = when.strftime("%A").lower()
            if current_day in schedule.days and schedule.days[current_day].images:
                day_schedule = schedule.days[current_day]
                
                if get_next:
                    if day_schedule.shuffle:
                        # For shuffled days, check if there's still time in current day
                        time_remaining = datetime.combine(test_date, time(23, 59)) - when
                        if time_remaining.total_seconds() > 0:
                            # Still time in current day
                            if include_time:
                                return day_schedule.images[0], when, datetime.combine(test_date, time(23, 59))
                            return day_schedule.images[0]
                    else:
                        # For non-shuffled days, get next image in sequence
                        day_duration = timedelta(days=1)
                        image_duration = day_duration / len(day_schedule.images)
                        elapsed = when - datetime.combine(test_date, time(0, 0))
                        current_index = int(elapsed.total_seconds() / image_duration.total_seconds())
                        next_index = (current_index + 1) % len(day_schedule.images)
                        
                        # If we're at the last image and there's no time left, move to next day
                        if next_index == 0 and time_remaining.total_seconds() <= 0:
                            next_day = (test_date + timedelta(days=1)).strftime("%A").lower()
                            if next_day in schedule.days and schedule.days[next_day].images:
                                next_day_schedule = schedule.days[next_day]
                                if include_time:
                                    return next_day_schedule.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                                return next_day_schedule.images[0]
                            else:
                                # If no next day schedule, wrap to first day
                                first_day = next(iter(schedule.days.values()))
                                if include_time:
                                    return first_day.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                                return first_day.images[0]
                        
                        # Otherwise, get next image from current day
                        if include_time:
                            image_start = datetime.combine(test_date, time(0, 0)) + (image_duration * next_index)
                            image_end = image_start + image_duration
                            return day_schedule.images[next_index], image_start, image_end
                        return day_schedule.images[next_index]
                    
                    # If no time remaining in current day, get next day's first image
                    next_day = (test_date + timedelta(days=1)).strftime("%A").lower()
                    if next_day in schedule.days and schedule.days[next_day].images:
                        next_day_schedule = schedule.days[next_day]
                        if include_time:
                            return next_day_schedule.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                        return next_day_schedule.images[0]
                    else:
                        # If no next day schedule, wrap to first day
                        first_day = next(iter(schedule.days.values()))
                        if include_time:
                            return first_day.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                        return first_day.images[0]
                else:
                    # Get current wallpaper
                    if day_schedule.shuffle:
                        if include_time:
                            return day_schedule.images[0], datetime.combine(test_date, time(0, 0)), datetime.combine(test_date, time(23, 59))
                        return day_schedule.images[0]
                    else:
                        # For non-shuffled days, get current image based on time
                        day_duration = timedelta(days=1)
                        image_duration = day_duration / len(day_schedule.images)
                        elapsed = when - datetime.combine(test_date, time(0, 0))
                        current_index = int(elapsed.total_seconds() / image_duration.total_seconds())
                        
                        if include_time:
                            image_start = datetime.combine(test_date, time(0, 0)) + (image_duration * current_index)
                            image_end = image_start + image_duration
                            return day_schedule.images[current_index], image_start, image_end
                        return day_schedule.images[current_index]

            # If no schedule for current day, get first day's first image
            first_day = next(iter(schedule.days.values())) if schedule.days else None
            if first_day and first_day.images:
                if get_next:
                    # For next wallpaper, get next day's first image
                    next_day = (test_date + timedelta(days=1)).strftime("%A").lower()
                    if next_day in schedule.days and schedule.days[next_day].images:
                        next_day_schedule = schedule.days[next_day]
                        if include_time:
                            return next_day_schedule.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                        return next_day_schedule.images[0]
                    else:
                        # If no next day schedule, wrap to first day
                        if include_time:
                            return first_day.images[0], datetime.combine(test_date + timedelta(days=1), time(0, 0)), datetime.combine(test_date + timedelta(days=1), time(23, 59))
                        return first_day.images[0]
                else:
                    # For current wallpaper, get first day's first image
                    if include_time:
                        return first_day.images[0], datetime.combine(test_date, time(0, 0)), datetime.combine(test_date, time(23, 59))
                    return first_day.images[0]

        return (None, None, None) if include_time else None
