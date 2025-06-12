# src/wallpy/models.py
import sys
from pathlib import Path
from datetime import time
from enum import Enum, auto
from dataclasses import dataclass, field
from typing import Optional, Union, Dict, List, Any
from collections import defaultdict

# Schedule-related data structures
class ScheduleType(Enum):
    """Type of schedule configuration"""
    TIMEBLOCKS = "timeblocks"  # Time-based schedule with blocks
    DAYS = "days"              # Day-of-week based schedule

class TimeSpecType(Enum):
    """Type of time specification"""
    ABSOLUTE = "absolute"  # Clock time (e.g., "08:30")
    SOLAR = "solar"        # Solar event (e.g., "sunrise+30")

@dataclass
class ScheduleMeta:
    """Metadata for a wallpaper schedule"""
    type: ScheduleType
    name: str
    author: Optional[str] = None
    description: Optional[str] = None
    version: str = "1.0"
    
    def __str__(self) -> str:
        """String representation of schedule metadata"""
        return f"{self.name} v{self.version}" + (f" by {self.author}" if self.author else "")

@dataclass
class TimeSpec:
    """Time specification that can be absolute or solar-based"""
    type: TimeSpecType
    base: Union[time, str]  # time object or solar event name
    offset: int = 0  # minutes
    
    def __str__(self) -> str:
        """Human-readable representation of the time spec"""
        if self.type == TimeSpecType.ABSOLUTE:
            return f"{self.base.strftime('%H:%M')}"
        else:
            sign = "+" if self.offset >= 0 else ""
            offset_str = f"{sign}{self.offset}" if self.offset != 0 else ""
            return f"{self.base}{offset_str}"

@dataclass
class TimeBlock:
    """A block of time with associated wallpaper images"""
    name: str
    start: TimeSpec
    end: TimeSpec
    images: List[Path]
    shuffle: bool = False
    
    def __str__(self) -> str:
        """Human-readable representation of the time block"""
        return f"{self.name}: {self.start} to {self.end} ({len(self.images)} images)"

@dataclass
class DaySchedule:
    """Schedule for a specific day of the week"""
    images: List[Path]
    shuffle: bool = False
    
    def __str__(self) -> str:
        """Human-readable representation of the day schedule"""
        return f"{len(self.images)} images" + (" (shuffled)" if self.shuffle else "")

@dataclass
class Location:
    """Geographic location data for solar calculations"""
    latitude: float
    longitude: float
    timezone: str = "UTC"
    name: str = "location"
    region: str = "region"
    
    def __str__(self) -> str:
        """Human-readable representation of the location"""
        return f"{self.name} ({self.latitude:.2f}, {self.longitude:.2f})"

@dataclass
class Schedule:
    """Complete wallpaper schedule configuration"""
    meta: ScheduleMeta
    timeblocks: Optional[Dict[str, TimeBlock]] = None
    days: Optional[Dict[str, DaySchedule]] = None
    
    def is_timeblock_based(self) -> bool:
        """Check if this is a timeblock-based schedule"""
        return self.meta.type == ScheduleType.TIMEBLOCKS
    
    def is_day_based(self) -> bool:
        """Check if this is a day-based schedule"""
        return self.meta.type == ScheduleType.DAYS
    
    def __str__(self) -> str:
        """Human-readable representation of the schedule"""
        if self.is_timeblock_based():
            block_count = len(self.timeblocks) if self.timeblocks else 0
            return f"{self.meta.name}: {block_count} timeblocks"
        else:
            day_count = len(self.days) if self.days else 0
            return f"{self.meta.name}: {day_count} days"
        

# Pack-related data structures
@dataclass
class Pack:
    """Wallpaper pack data structure"""
    name: str
    path: Path
    uid: str
    # is_active: bool = False
    # is_valid: bool
    # validation_result: ValidationResult


@dataclass
class PackSearchPaths:
    """OS-specific wallpacks search paths"""
    linux: List[str] = None
    darwin: List[str] = None
    win32: List[str] = None

    def __post_init__(self):
        self.linux = [
            "/usr/share/backgrounds",
            "~/.local/share/wallpapers",
            "/usr/share/wallpapers"
        ]
        self.darwin = [
            "~/Pictures/Wallpapers",
            "/Library/Desktop Pictures"
        ]
        self.win32 = [
            "~/AppData/Local/Microsoft/Windows/Themes",
            "~/Pictures/",
            "~/Pictures/Wallpapers",
            "C:/Users/Public/Pictures/",
            "C:/Users/Public/Pictures/Wallpapers",
            "C:/Windows/Web",
        ]

    def get_paths(self) -> List[Path]:
        """Get paths for current platform"""
        platform_paths = getattr(self, sys.platform, [])
        return [Path(p).expanduser() for p in platform_paths]

class ValidationResult:
    def __init__(self):
        self.messages = []

    def add(self, check: str, level: str, message: str):
        """
        Add a message to the result.
        :param check: Identifer for the check (e.g., "validate_schedule").
        :param level: The level of the message (error or warning).
        :param message: The message to display.
        """
    
        self.messages.append({
            "check": check,
            "level": level,
            "message": message
        })

    def remove(self, check: str):
        """
        Remove a message from the result.
        :param check: The identifier of the message to remove.
        """

        self.messages = [msg for msg in self.messages if msg["check"] != check]
    
    def merge(self, other: 'ValidationResult'):
        """
        Merge another ValidationResult into this one.
        :param other: The other ValidationResult to merge.
        """
    
        self.messages.extend(other.messages)
    
    @property
    def errors(self) -> dict:
        errors = defaultdict(list)
        for msg in self.messages:
            if msg["level"] == "error":
                errors[msg["check"]].append(msg["message"])
        
        return errors
    
    @property
    def warnings(self) -> dict:
        warnings = defaultdict(list)
        for msg in self.messages:
            if msg["level"] == "warning":
                warnings[msg["check"]].append(msg["message"])
        
        return warnings
    
    @property
    def passed(self) -> bool:
        """Validation is considered passed if there are no errors"""
        return len(self.errors) == 0
    
    @property
    def failed(self) -> bool:
        """Validation is considered failed if there are any errors"""
        return len(self.errors) > 0