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