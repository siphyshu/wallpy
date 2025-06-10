# validate.py
import sys
import imghdr
import tomli
import logging
from PIL import Image
from typing import List, Optional, Dict, Any, Union, Tuple
from pathlib import Path
from datetime import datetime, timedelta, date, time
from platformdirs import user_config_path
from dataclasses import dataclass, field
from collections import defaultdict
import re
from difflib import get_close_matches

from wallpy.models import Schedule, TimeSpecType, ScheduleType, Location, ValidationResult, Pack

# Solar time constants
SOLAR_TIME_REGEX = re.compile(r"^(?P<event>sunrise|sunset|dawn|dusk|noon|midnight)(?:\s*[+-]\s*(?P<offset>\d+)(?P<unit>m|h))?$")
ACCEPTED_SOLAR_EVENTS = {
    "sunrise": "06:00",  # Default fallback times if location data is missing
    "sunset": "18:00",
    "dawn": "05:30",
    "dusk": "18:30",
    "noon": "12:00",
    "midnight": "00:00"
}
SOLAR_FALLBACKS = {event: time.fromisoformat(time_str) for event, time_str in ACCEPTED_SOLAR_EVENTS.items()}

def _format_timedelta(td: timedelta) -> str:
    """Format a timedelta into a human-readable string"""
    total_seconds = int(td.total_seconds())
    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes}m"

class ScheduleValidator:
    """Validator for schedule integrity"""
    
    def __init__(self, solar_calculator):
        self.solar_calculator = solar_calculator
        self.logger = logging.getLogger(__name__)
    
    def validate(self, schedule: Schedule, pack_path: Path, global_location: Optional[Dict[str, Any]] = None) -> ValidationResult:
        """Main validation entry point"""
        result = ValidationResult()
        
        # Validate that the expected schedule sections are present
        if schedule.meta.type == ScheduleType.TIMEBLOCKS:
            if not schedule.timeblocks or len(schedule.timeblocks) == 0:
                result.add("schedule_timeblocks", "error", "Timeblock schedule must contain at least one timeblock")
            else:
                self._validate_timeblocks(schedule, pack_path, global_location, result)
                self._analyze_time_coverage(schedule, global_location, result)
        elif schedule.meta.type == ScheduleType.DAYS:
            if not schedule.days or len(schedule.days) == 0:
                result.add("schedule_days", "error", "Day-based schedule must contain at least one day entry")
            else:
                self._validate_days(schedule, pack_path, result)
        else:
            result.add("schedule_type", "error", f"Unknown schedule type: {schedule.meta.type}")
        
        return result
    
    def _validate_timeblocks(self, schedule: Schedule, pack_path: Path, global_location: Optional[Dict[str, Any]], result: ValidationResult) -> None:
        """Validate timeblock-based schedules"""
        # Check if any time specification uses solar events
        has_solar = any(
            block.start.type == TimeSpecType.SOLAR or block.end.type == TimeSpecType.SOLAR
            for block in schedule.timeblocks.values()
        )
        
        if has_solar and not global_location:
            result.add("schedule_solar", "warning", "Solar timeblocks without global location data will use fallback times")
        
        # Validate that each image file exists in the given pack directory
        for block in schedule.timeblocks.values():
            for img in block.images:
                if not (pack_path / img).exists():
                    result.add("schedule_images", "error", f"Image {img} not found in pack")
    
    def _validate_days(self, schedule: Schedule, pack_path: Path, result: ValidationResult) -> None:
        """Validate day-based schedules"""
        for day, day_sched in schedule.days.items():
            for img in day_sched.images:
                if not (pack_path / img).exists():
                    result.add("schedule_images", "error", f"Day image {img} not found in pack")
    
    def _analyze_time_coverage(self, schedule: Schedule, global_location: Optional[Dict[str, Any]], result: ValidationResult) -> None:
        """Analyze schedule coverage and report potential issues as warnings"""
        if not schedule.timeblocks:
            return
        
        test_date = datetime.today().date()
        blocks = []
        
        # Convert all time specifications into concrete datetimes for the test date
        for block in schedule.timeblocks.values():
            start_dt = self.solar_calculator.resolve_datetime(block.start, test_date, global_location)
            end_dt = self.solar_calculator.resolve_datetime(block.end, test_date, global_location)
            
            # If the end time is before or equal to the start, assume the block crosses midnight
            if end_dt <= start_dt:
                end_dt += timedelta(days=1)
                
            blocks.append((block.name, start_dt, end_dt))
        
        # Sort blocks by their start time
        blocks.sort(key=lambda x: x[1])
        
        # Check for overlaps and gaps between consecutive blocks
        for i in range(len(blocks) - 1):
            current_name, current_start, current_end = blocks[i]
            next_name, next_start, next_end = blocks[i + 1]
            
            # Handle blocks crossing midnight
            if current_end <= current_start:
                current_end = time(23, 59, 59)
            if next_end <= next_start:
                next_end = time(23, 59, 59)
            
            # Convert to datetime for easier comparison
            current_end_dt = datetime.combine(date.today(), current_end)
            next_start_dt = datetime.combine(date.today(), next_start)
            
            # Check for overlap (allowing 1-second tolerance for exact boundaries)
            if (current_end_dt - next_start_dt).total_seconds() > 1:
                result.add("schedule_overlap", "warning", f"Timeblock overlap detected: '{current_name}' and '{next_name}'")
            # Check for gap (allowing 1-second tolerance for exact boundaries)
            elif (next_start_dt - current_end_dt).total_seconds() > 1:
                gap = next_start_dt - current_end_dt
                result.add("schedule_gap", "warning", f"Gap detected between '{current_name}' and '{next_name}' ({gap})")
        
        # Check circular coverage (last block to first block)
        first_name, first_start, first_end = blocks[0]
        last_name, last_start, last_end = blocks[-1]
        
        # Handle blocks crossing midnight
        if last_end <= last_start:
            last_end = time(23, 59, 59)
        if first_end <= first_start:
            first_end = time(23, 59, 59)
        
        # Convert to datetime for easier comparison
        last_end_dt = datetime.combine(date.today(), last_end)
        first_start_dt = datetime.combine(date.today(), first_start)
        
        # Calculate gap from last block end to first block start
        if (first_start_dt - last_end_dt).total_seconds() > 1:
            gap = first_start_dt - last_end_dt
            result.add("schedule_gap", "warning", f"Gap detected between end of last block and start of first block ({gap})")
        
        # Calculate total coverage
        total_coverage = timedelta()
        for _, start, end in blocks:
            # Handle blocks crossing midnight
            if end <= start:
                # For blocks crossing midnight, calculate coverage in two parts:
                # 1. From start to midnight
                midnight = time(23, 59, 59)
                coverage1 = datetime.combine(date.today(), midnight) - datetime.combine(date.today(), start)
                # 2. From midnight to end
                coverage2 = datetime.combine(date.today(), end) - datetime.combine(date.today(), time(0, 0))
                total_coverage += coverage1 + coverage2
            else:
                coverage = datetime.combine(date.today(), end) - datetime.combine(date.today(), start)
                total_coverage += coverage
        
        total_hours = total_coverage.total_seconds() / 3600.0
        if abs(total_hours - 24.0) > 0.1:  # Allow small floating point differences
            if total_hours < 24:
                result.add("schedule_coverage", "warning", f"Schedule covers {total_hours:.1f} hours out of 24")
            else:
                result.add("schedule_coverage", "warning", f"Schedule covers {total_hours:.1f} hours (exceeds 24 hours)")
        
        # Update time coverage test status
        if not any(msg.startswith("schedule_") for msg in result.warnings.keys()):
            self.test_results["time_coverage"]["status"] = "passed"
        else:
            self.test_results["time_coverage"]["status"] = "warning"

class Validator:
    """Validates schedules, config, packs, and other components"""

    def __init__(self):
        self.logger = logging.getLogger("wallpy.logger")
        self.logger.debug("🔧 Initializing Validator")
        self.test_results = {}

    def validate_schedule(self, schedule: dict, pack_path: Path) -> ValidationResult:
        """Validate schedule.toml file"""
        result = ValidationResult()
        
        # Initialize test results
        self.test_results = {
            "metadata": {"status": "pending", "message": "Metadata Validation"},
            "schedule_type": {"status": "pending", "message": "Schedule Type Validation"},
            "schedule_content": {"status": "pending", "message": "Schedule Content Validation"},
            "time_coverage": {"status": "pending", "message": "Time Coverage Analysis"},
            "images": {"status": "pending", "message": "Image Validation"}
        }
        
        # 1. Validate metadata
        if "meta" not in schedule:
            result.add("schedule_meta", "error", "Schedule is missing [meta] section")
            self.test_results["metadata"]["status"] = "failed"
            return result
            
        meta = schedule["meta"]
        required_fields = ["name", "type"]
        for field in required_fields:
            if field not in meta:
                result.add("schedule_meta", "error", f"Meta section is missing required field '{field}'")
                self.test_results["metadata"]["status"] = "failed"
                return result
        
        try:
            schedule_type = ScheduleType(meta["type"].lower())
            self.test_results["schedule_type"]["status"] = "passed"
        except ValueError:
            result.add("schedule_type", "error", f"Invalid schedule type: {meta['type']}. Must be one of: {', '.join(t.value for t in ScheduleType)}")
            self.test_results["schedule_type"]["status"] = "failed"
            return result  # Can't proceed with invalid type
        
        # Check optional meta fields
        if "author" in meta and not meta["author"]:
            result.add("schedule_meta", "warning", "Author field is empty")
        if "description" in meta and not meta["description"]:
            result.add("schedule_meta", "warning", "Description field is empty")
        
        self.test_results["metadata"]["status"] = "passed"
            
        # 2. Validate schedule type specific sections
        self.test_results["schedule_content"] = {"status": "pending", "message": "Schedule Content Validation"}
        if schedule_type == ScheduleType.TIMEBLOCKS:
            if "timeblocks" not in schedule:
                result.add("schedule_timeblocks", "error", "Timeblock schedule is missing [timeblocks] section")
                self.test_results["schedule_content"]["status"] = "failed"
                return result
                
            timeblocks = schedule["timeblocks"]
            if not timeblocks:
                result.add("schedule_timeblocks", "error", "Timeblock schedule must contain at least one timeblock")
                self.test_results["schedule_content"]["status"] = "failed"
                return result
                
            # Check for duplicate timeblock names
            block_names = set()
            for name in timeblocks.keys():
                if name in block_names:
                    result.add("schedule_timeblocks", "error", f"Duplicate timeblock name: {name}")
                    self.test_results["schedule_content"]["status"] = "failed"
                block_names.add(name)
                
            # Validate each timeblock
            blocks = []  # Store blocks for time coverage analysis
            for name, block in timeblocks.items():
                # Check required fields
                if "start" not in block:
                    result.add("schedule_timeblocks", "error", f"Timeblock '{name}' is missing required field 'start'")
                    self.test_results["schedule_content"]["status"] = "failed"
                if "end" not in block:
                    result.add("schedule_timeblocks", "error", f"Timeblock '{name}' is missing required field 'end'")
                    self.test_results["schedule_content"]["status"] = "failed"
                if "images" not in block:
                    result.add("schedule_timeblocks", "error", f"Timeblock '{name}' is missing required field 'images'")
                    self.test_results["schedule_content"]["status"] = "failed"
                else:
                    # Validate images
                    self._validate_images(block["images"], pack_path, result, f"in timeblock '{name}'")
                
                # Validate shuffle setting if present
                if "shuffle" in block and not isinstance(block["shuffle"], bool):
                    result.add("schedule_timeblocks", "error", f"Timeblock '{name}' has invalid shuffle setting")
                    self.test_results["schedule_content"]["status"] = "failed"
                
                # Validate time specifications
                if "start" in block and "end" in block:
                    try:
                        start_time = self._parse_time_spec(block["start"])
                        end_time = self._parse_time_spec(block["end"])
                        blocks.append((name, start_time, end_time))
                    except ValueError as e:
                        result.add("schedule_timeblocks", "error", f"Timeblock '{name}' has invalid time specification: {str(e)}")
                        self.test_results["schedule_content"]["status"] = "failed"
            
            # Analyze time coverage
            if blocks:
                self._analyze_time_coverage(blocks, result)
                    
        elif schedule_type == ScheduleType.DAYS:
            if "days" not in schedule:
                result.add("schedule_days", "error", "Day-based schedule is missing [days] section")
                self.test_results["schedule_content"]["status"] = "failed"
                return result
                
            days = schedule["days"]
            if not days:
                result.add("schedule_days", "error", "Day-based schedule must contain at least one day")
                self.test_results["schedule_content"]["status"] = "failed"
                return result
                
            # Check for duplicate days
            day_names = set()
            for day in days.keys():
                if day in day_names:
                    result.add("schedule_days", "error", f"Duplicate day entry: {day}")
                    self.test_results["schedule_content"]["status"] = "failed"
                day_names.add(day)
                
            # Validate each day
            valid_days = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
            for day, day_schedule in days.items():
                # Validate day name
                if day.lower() not in valid_days:
                    close_matches = get_close_matches(day.lower(), valid_days, n=1, cutoff=0.8)
                    if close_matches:
                        result.add("schedule_days", "error", f"Invalid day name: {day}. Did you mean '{close_matches[0]}'?")
                    else:
                        result.add("schedule_days", "error", f"Invalid day name: {day}")
                    self.test_results["schedule_content"]["status"] = "failed"
                
                # Check required fields
                if "images" not in day_schedule:
                    result.add("schedule_days", "error", f"Day '{day}' is missing required field 'images'")
                    self.test_results["schedule_content"]["status"] = "failed"
                else:
                    # Validate images
                    self._validate_images(day_schedule["images"], pack_path, result, f"in day '{day}'")
                
                # Validate shuffle setting if present
                if "shuffle" in day_schedule and not isinstance(day_schedule["shuffle"], bool):
                    result.add("schedule_days", "error", f"Day '{day}' has invalid shuffle setting")
                    self.test_results["schedule_content"]["status"] = "failed"
            
            # Check day coverage
            missing_days = valid_days - {day.lower() for day in days.keys()}
            if missing_days:
                result.add("schedule_days", "warning", f"Missing days: {', '.join(sorted(missing_days))}")
        
        if not any(msg.startswith("schedule_") for msg in result.errors.keys()):
            self.test_results["schedule_content"]["status"] = "passed"
        
        # Update image validation status
        if not any(msg == "images" for msg in result.errors.keys()):
            self.test_results["images"]["status"] = "passed"
        else:
            self.test_results["images"]["status"] = "failed"
        
        return result

    def _parse_time_spec(self, time_spec: str) -> time:
        """Parse a time specification string into a time object"""
        # Handle absolute time (HH:MM)
        if ":" in time_spec:
            try:
                hours, minutes = map(int, time_spec.split(":"))
                if not (0 <= hours <= 23 and 0 <= minutes <= 59):
                    raise ValueError("Hours must be 0-23 and minutes must be 0-59")
                return time(hours, minutes)
            except ValueError as e:
                raise ValueError(f"Invalid time format: {str(e)}")
        
        # Handle solar time
        solar_match = SOLAR_TIME_REGEX.match(time_spec.lower())
        if solar_match:
            event = solar_match.group("event")
            if event not in ACCEPTED_SOLAR_EVENTS:
                # Check if it's a typo
                close_matches = get_close_matches(event, ACCEPTED_SOLAR_EVENTS.keys(), n=1, cutoff=0.4)
                if close_matches:
                    raise ValueError(f"Unrecognized solar event '{event}'. Did you mean '{close_matches[0]}'?")
                else:
                    raise ValueError(f"'{time_spec}' is not a recognized time or solar event.")
            
            # Get base time for the event
            base_time = SOLAR_FALLBACKS[event]
            
            # Handle offset if present
            offset = solar_match.group("offset")
            if offset:
                try:
                    offset = int(offset)
                    unit = solar_match.group("unit")
                    if unit == "h":
                        offset_minutes = offset * 60
                    else:  # unit == "m"
                        offset_minutes = offset
                    
                    # Calculate new time with offset
                    total_minutes = base_time.hour * 60 + base_time.minute + offset_minutes
                    # Handle wrapping around midnight
                    total_minutes = total_minutes % (24 * 60)
                    return time(total_minutes // 60, total_minutes % 60)
                except ValueError:
                    raise ValueError(f"Invalid offset in '{time_spec}'. Offset must be a valid number.")
            
            return base_time
        
        raise ValueError(f"'{time_spec}' is not a recognized time or solar event.")

    def _validate_images(self, images: List[str], pack_path: Path, result: ValidationResult, context: str) -> None:
        """Validate image files exist and are valid images"""
        for img in images:
            # Try both root and images/ subdirectory
            img_path = (pack_path / img).resolve()
            img_path_images = (pack_path / "images" / img).resolve()
            if img_path.exists():
                found_path = img_path
            elif img_path_images.exists():
                found_path = img_path_images
            else:
                result.add("images", "error", f"Image file not found: {img} ({context})")
                continue
            
            if not found_path.is_file():
                result.add("images", "error", f"Image path is not a file: {img} ({context})")
                continue
            
            # Check file extension
            if not img.lower().endswith(('.jpg', '.jpeg', '.png')):
                result.add("images", "error", f"Invalid image format: {img}. Must be .jpg, .jpeg, or .png ({context})")
                continue
            
            # Try to open the image to verify it's valid
            try:
                with Image.open(found_path) as im:
                    # Check image dimensions
                    width, height = im.size
                    if width < 800 or height < 600:
                        result.add("images", "warning", f"Image {img} is small ({width}x{height}). Recommended minimum size is 800x600 ({context})")
                    
                    # Check file size
                    file_size = found_path.stat().st_size
                    if file_size > 10 * 1024 * 1024:  # 10MB
                        result.add("images", "warning", f"Image {img} is large ({file_size/1024/1024:.1f}MB). Consider optimizing it ({context})")
            except Exception as e:
                result.add("images", "error", f"Invalid image file {img}: {str(e)} ({context})")

    def _analyze_time_coverage(self, blocks: List[Tuple[str, time, time]], result: ValidationResult) -> None:
        """Analyze time coverage and report issues"""
        # Sort blocks by start time
        blocks.sort(key=lambda x: x[1])
        
        # Check for overlaps and gaps
        for i in range(len(blocks) - 1):
            current_name, current_start, current_end = blocks[i]
            next_name, next_start, next_end = blocks[i + 1]
            
            # Handle blocks crossing midnight
            if current_end <= current_start:
                current_end = time(23, 59, 59)
            if next_end <= next_start:
                next_end = time(23, 59, 59)
            
            # Convert to datetime for easier comparison
            current_end_dt = datetime.combine(date.today(), current_end)
            next_start_dt = datetime.combine(date.today(), next_start)
            
            # Check for overlap (allowing 1-second tolerance for exact boundaries)
            if (current_end_dt - next_start_dt).total_seconds() > 1:
                overlap = current_end_dt - next_start_dt
                result.add("schedule_overlap", "warning", 
                    f"Timeblock overlap detected: '{current_name}' and '{next_name}' ({_format_timedelta(overlap)})")
            # Check for gap (allowing 1-second tolerance for exact boundaries)
            elif (next_start_dt - current_end_dt).total_seconds() > 1:
                gap = next_start_dt - current_end_dt
                result.add("schedule_gap", "warning", 
                    f"Gap detected between '{current_name}' and '{next_name}' ({_format_timedelta(gap)})")
        
        # Check circular coverage (last block to first block)
        first_name, first_start, first_end = blocks[0]
        last_name, last_start, last_end = blocks[-1]
        
        # Handle blocks crossing midnight
        if last_end <= last_start:
            last_end = time(23, 59, 59)
        if first_end <= first_start:
            first_end = time(23, 59, 59)
        
        # Convert to datetime for easier comparison
        last_end_dt = datetime.combine(date.today(), last_end)
        first_start_dt = datetime.combine(date.today(), first_start)
        
        # Calculate gap from last block end to first block start
        if (first_start_dt - last_end_dt).total_seconds() > 1:
            gap = first_start_dt - last_end_dt
            result.add("schedule_gap", "warning", 
                f"Gap detected between end of last block and start of first block ({_format_timedelta(gap)})")
        
        # Calculate total coverage
        total_coverage = timedelta()
        for name, start, end in blocks:
            # Handle blocks crossing midnight
            if end <= start:
                # For blocks crossing midnight, calculate coverage in two parts:
                # 1. From start to midnight
                midnight = time(23, 59, 59)
                coverage1 = datetime.combine(date.today(), midnight) - datetime.combine(date.today(), start)
                # 2. From midnight to end
                coverage2 = datetime.combine(date.today(), end) - datetime.combine(date.today(), time(0, 0))
                total_coverage += coverage1 + coverage2
            else:
                coverage = datetime.combine(date.today(), end) - datetime.combine(date.today(), start)
                total_coverage += coverage
        
        total_hours = total_coverage.total_seconds() / 3600.0
        if abs(total_hours - 24.0) > 0.1:  # Allow small floating point differences
            if total_hours < 24:
                result.add("schedule_coverage", "warning", f"Schedule covers {total_hours:.1f} hours out of 24")
            else:
                result.add("schedule_coverage", "warning", f"Schedule covers {total_hours:.1f} hours (exceeds 24 hours)")
        
        # Update time coverage test status
        if not any(msg.startswith("schedule_") for msg in result.warnings.keys()):
            self.test_results["time_coverage"]["status"] = "passed"
        else:
            self.test_results["time_coverage"]["status"] = "warning"

    def validate_config(self, config: dict, wallpacks: dict) -> ValidationResult:
        """Validates the global configuration file and reports any issues"""
        
        # Checks to perform:
        #   Check if the config file has the required section [active]
        #       The active section should have the required keys [name], [path], and [uid]
        #       The [name] key should be a valid pack name
        #       The [path] key should point to a valid pack directory
        #       The [uid] key should be a valid pack UID
        #   If the config file has the keys [custom_wallpacks], then:
        #       The [wallpacks] key should be a list of valid paths to directories containing packs or packs themselves
        #   If the config file has the keys [location], then:
        #       The [location] key should have the keys [latitude], [longitude], and [timezone]
        #       The [latitude] and [longitude] should be valid float values
        #       The [timezone] should be a valid timezone string
        
        self.logger.debug("🔧 Validating config file")
        
        result = ValidationResult()
        config_dir = user_config_path(appname="wallpy", appauthor=False, ensure_exists=True)

        # 1. Check if the config file has the required section [active]
        if "active" not in config:
            result.add("config_active", "error", "Config is missing the required [active] section")
            self.logger.debug("🚫 Config file is missing the required [active] section")
            return result
        self.logger.debug("✅ Config file has the required [active] section")

        # 2. Check if the active section has the required keys
        active = config["active"]
        required_keys = ["name", "path"]
        for key in required_keys:
            if key not in active:
                result.add("config_active", "error", f"Config is missing the required key '{key}' in [active] section")
                self.logger.debug(f"🚫 Config file is missing the required key '{key}' in [active] section")
                return result
        self.logger.debug("✅ Config file has all required keys in [active] section")

        # 3. Check if the active pack is valid
        active_name = active["name"]
        active_path = active["path"]
        active_uid = active.get("uid")
        
        if active_name.upper() in ["NONE", ""]:
            self.logger.debug("✅ Config file has no active pack defined")
        elif active_name not in wallpacks.keys() and not active_path:
            result.add("config_active", "error", "Config has an invalid active pack")
            self.logger.debug("🚫 Config file has an invalid active pack")
        elif active_name not in wallpacks and active_path:
            # Check if the path is a valid pack
            if not Path(active_path).is_absolute():
                active_path = config_dir / active_path
            else:
                active_path = Path(active_path)

            if not active_path.exists():
                result.add("config_active", "error", "Config has an invalid active pack path")
                self.logger.debug("🚫 Config file has an invalid active pack path")
            
            if not self.is_pack(active_path):
                result.add("config_active", "error", "Config has an invalid active pack")
                self.logger.debug("🚫 Config file has an invalid active pack")
        else:   
            self.logger.debug("✅ Config file has a valid active pack")

        # 4. Check if the config file has the keys [custom_wallpacks]
        if "custom_wallpacks" in config:
            custom_paths = config["custom_wallpacks"]
            
            # Check if the paths are valid
            for name, path in custom_paths.items():
                if not Path(path).is_absolute():
                    path = config_dir / path
                else:
                    path = Path(path)

                if not path.exists():
                    result.add("config_custom_wallpacks", "warning", f"Custom wallpack path for {name} does not exist")
                    self.logger.debug(f"🚫 Config file has an invalid custom wallpack path for {name}")
                else:
                    # Check if it's a pack or a directory containing packs
                    if path.is_dir():
                        has_packs = False
                        for item in path.iterdir():
                            if item.is_dir() and self.is_pack(item):
                                has_packs = True
                                break
                        if not has_packs and not self.is_pack(path):
                            result.add("config_custom_wallpacks", "warning", f"Path for {name} is neither a pack nor contains any packs")
                            self.logger.debug(f"🚫 Path for {name} is neither a pack nor contains any packs")
                    else:
                        result.add("config_custom_wallpacks", "warning", f"Path for {name} is not a directory")
                        self.logger.debug(f"🚫 Path for {name} is not a directory")
            else:
                self.logger.debug("✅ Config file has valid custom wallpack paths")

        # 5. Check if the location key is present and has the required keys
        if "location" in config:
            location = config["location"]
            required_location_keys = ["latitude", "longitude", "timezone"]
            
            # Check for required keys
            if not all(key in location for key in required_location_keys):
                result.add("config_location", "error", "Config is missing the required keys in [location]")
                self.logger.debug("🚫 Config file is missing the required keys in [location]")
                return result
            self.logger.debug("✅ Config file has the required keys in [location]")

            # Validate latitude (-90 to 90)
            try:
                lat = float(location["latitude"])
                if not -90 <= lat <= 90:
                    result.add("config_location", "error", f"Invalid latitude value: {lat}. Must be between -90 and 90")
            except ValueError:
                result.add("config_location", "error", f"Invalid latitude value: {location['latitude']}. Must be a number")

            # Validate longitude (-180 to 180)
            try:
                lon = float(location["longitude"])
                if not -180 <= lon <= 180:
                    result.add("config_location", "error", f"Invalid longitude value: {lon}. Must be between -180 and 180")
            except ValueError:
                result.add("config_location", "error", f"Invalid longitude value: {location['longitude']}. Must be a number")

            # Validate timezone
            try:
                import pytz
                if location["timezone"] not in pytz.all_timezones:
                    result.add("config_location", "error", f"Invalid timezone: {location['timezone']}")
            except ImportError:
                # If pytz is not available, do a basic format check
                if not re.match(r'^[A-Za-z]+/[A-Za-z_]+$', location["timezone"]):
                    result.add("config_location", "warning", f"Timezone format may be invalid: {location['timezone']}")

        return result

    def validate_pack(self, pack: Union[Path, Pack]) -> ValidationResult:
        """Validates a wallpaper pack and reports any issues"""

        # Checks to perform:
        #   Check if the directory is a pack
        #   Check if the schedule.toml is valid
        #   Check if the images are valid

        result = ValidationResult()
        
        # Handle both Path and Pack objects
        if isinstance(pack, Pack):
            self.file = pack.path.resolve()
        else:
            self.file = Path(pack).resolve()
        
        # Check if the directory is a pack
        if not self.is_pack(self.file):
            result.add("is_pack", "error", f"{self.file} is not a wallpaper pack")
            return result
        
        # Check if the schedule.toml is valid
        schedule_file = self.file / "schedule.toml"
        if not schedule_file.exists():
            result.add("schedule_missing", "error", f"{self.file} is missing schedule.toml")
            return result
        
        try:
            with schedule_file.open("rb") as f:
                schedule = tomli.load(f)
                result.merge(self.validate_schedule(schedule, self.file))
        except Exception as e:
            result.add("schedule_invalid", "error", f"{self.file} schedule.toml is invalid: {str(e)}")
        
        # Check if the images are valid
        images_dir = self.file / "images"
        for img in images_dir.iterdir():
            result.merge(self.validate_image(img))

        return result

    def validate_image(self, img: Path) -> ValidationResult:
        """Validates an image file"""
        
        result = ValidationResult()
        self.file = Path(img).resolve()

        # Check if the file is a valid image
        if not imghdr.what(self.file):
            result.add("is_image", "error", f"{self.file} is not a valid image file")
            return result
        
        # Check the size and quality of the image
        try:
            image = Image.open(self.file)
            width, height = image.size
            
            # Check minimum dimensions
            if width < 800 or height < 600:
                result.add("image_size", "error", f"{self.file} is smaller than minimum required size (800x600)")
            
            # Check aspect ratio
            aspect_ratio = width / height
            if aspect_ratio < 1.3 or aspect_ratio > 2.4:  # Common monitor aspect ratios
                result.add("image_aspect", "warning", f"{self.file} has unusual aspect ratio ({aspect_ratio:.2f})")
            
            # Check file size
            file_size = self.file.stat().st_size
            if file_size < 50 * 1024:  # 50KB
                result.add("image_quality", "warning", f"{self.file} is very small ({file_size/1024:.1f}KB), may be low quality")
            elif file_size > 10 * 1024 * 1024:  # 10MB
                result.add("image_quality", "warning", f"{self.file} is very large ({file_size/1024/1024:.1f}MB), may impact performance")
            
            # Check image format
            format = image.format.lower()
            if format not in ['jpeg', 'jpg', 'png']:
                result.add("image_format", "warning", f"{self.file} is in {format.upper()} format. Consider using JPEG or PNG for better compatibility")
            
            # Check color mode
            if image.mode not in ['RGB', 'RGBA']:
                result.add("image_mode", "warning", f"{self.file} uses {image.mode} color mode. Consider converting to RGB/RGBA for better compatibility")
            
        except Exception as e:
            result.add("image_corrupt", "error", f"{self.file} is corrupted: {str(e)}")
        
        return result

    def is_pack(self, item: Path) -> bool:
        """Check if a directory is a valid wallpaper pack"""
        if not item.is_dir():
            return False
        
        # Check for schedule.toml
        if not (item / "schedule.toml").exists():
            return False
        
        # Check for images directory
        if not (item / "images").is_dir():
            return False
        
        # Check if there is at least one image in the images directory
        images_dir = item / "images"
        if not any(images_dir.iterdir()):
            return False
        
        return True