# schedule/models.py
from dataclasses import dataclass
from datetime import time
from enum import Enum
from pathlib import Path
from typing import Optional, Union

class ScheduleType(Enum):
    TIMEBLOCKS = "timeblocks"
    DAYS = "days"

class TimeSpecType(Enum):
    ABSOLUTE = "absolute"
    SOLAR = "solar"

@dataclass
class ScheduleMeta:
    type: ScheduleType
    name: str
    author: Optional[str] = None
    description: Optional[str] = None
    version: str = "1.0"

@dataclass
class TimeSpec:
    type: TimeSpecType
    base: Union[time, str]  # time obj or solar event name
    offset: int = 0  # minutes

@dataclass
class TimeBlock:
    name: str
    start: TimeSpec
    end: TimeSpec
    images: list[Path]
    shuffle: bool = False

@dataclass
class DaySchedule:
    images: list[Path]
    shuffle: bool = False

@dataclass
class Schedule:
    meta: ScheduleMeta
    timeblocks: Optional[dict[str, TimeBlock]] = None
    days: Optional[dict[str, DaySchedule]] = None
    location: Optional[dict[str, float]] = None  # lat, lon, tz