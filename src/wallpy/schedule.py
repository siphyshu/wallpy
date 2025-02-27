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
