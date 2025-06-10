# validate.py
import sys
import imghdr
import tomli
import logging
from PIL import Image
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timedelta
from platformdirs import user_config_path
from dataclasses import dataclass, field
from collections import defaultdict

from wallpy.models import Schedule, TimeSpecType, ScheduleType, Location, ValidationResult

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
            
            if current_end > next_start:
                result.add("schedule_overlap", "warning", f"Timeblock overlap detected: '{current_name}' and '{next_name}'")
            elif current_end < next_start:
                gap = next_start - current_end
                if gap > timedelta(minutes=1):  # Allow 1-minute tolerance
                    result.add("schedule_gap", "warning", f"Gap detected between '{current_name}' and '{next_name}' ({gap})")
        
        # Check the gap from the end of the last block to the start of the first block (cycling over midnight)
        first_block_start = blocks[0][1]
        last_block_end = blocks[-1][2]
        circular_gap = (first_block_start + timedelta(days=1)) - last_block_end
        if circular_gap > timedelta(minutes=1):
            result.add("schedule_gap", "warning", f"Gap detected between end of last block and start of first block ({circular_gap})")
        
        # Compute total scheduled coverage
        total_coverage = timedelta()
        for _, start, end in blocks:
            total_coverage += (end - start)
        
        total_hours = total_coverage.total_seconds() / 3600.0
        if total_coverage < timedelta(hours=24):
            result.add("schedule_coverage", "warning", f"Schedule covers {total_hours:.1f} hours out of 24")

class Validator:
    """Validates schedules, config, packs, and other components"""

    def __init__(self):
        self.logger = logging.getLogger("wallpy.logger")
        self.logger.debug("🔧 Initializing Validator")

    def validate_schedule(self, schedule: dict) -> ValidationResult:
        """Validates a wallpaper pack schedule and reports any issues"""
        result = ValidationResult()
        return result

    def validate_config(self, config: dict, wallpacks: dict) -> ValidationResult:
        """Validates the global configuration file and reports any issues"""
        
        # Checks to perform:
        #   Check if the config file has the required sections [settings]
        #       The settings section should have the required key [active]
        #       The "active" key should be a valid pack
        #       It can also be "None" or empty to indicate no active pack
        #       If the [active] key is defined, then there must be a "path" key defined which points to a valid pack
        #   If the config file has the keys [custom_wallpacks], then:
        #       The [wallpacks] key should be a list of valid paths to directories containing packs or packs themselves
        #   If the config file has the keys [location], then:
        #       The [location] key should have the keys [latitude], [longitude], and [timezone]
        #       The [latitude] and [longitude] should be valid float values
        #       The [timezone] should be a valid timezone string
        
        self.logger.debug("🔧 Validating config file")
        
        result = ValidationResult()
        config_dir = user_config_path(appname="wallpy", appauthor=False, ensure_exists=True)

        # 1. Check if the config file has the required sections
        if "settings" not in config:
            result.add("config_section", "error", "Config is missing the required [settings] section")
            self.logger.debug("🚫 Config file is missing the required [settings] section")
            return result
        settings = config["settings"]
        self.logger.debug("✅ Config file has the required [settings] section")

        # 2. Check if the settings section has the required key [active]
        if "active" not in settings:
            result.add("config_active", "error", "Config is missing the required [active] key")
            self.logger.debug("🚫 Config file is missing the required [active] key")
            return result
        self.logger.debug("✅ Config file has the required [active] key")

        # 3. Check if the [active] key is a valid pack name
        active_pack = settings["active"]
        active_pack_path = settings["path"] if "path" in settings else None
        
        if active_pack.upper() in ["NONE", ""]:
            self.logger.debug("✅ Config file has no active pack defined")
        elif active_pack not in wallpacks.keys() and not active_pack_path:
            result.add("config_active", "error", "Config has an invalid active pack")
            self.logger.debug("🚫 Config file has an invalid active pack")
        elif active_pack not in wallpacks and active_pack_path:
            # Check if the path is a valid pack
            if not Path(active_pack_path).is_absolute():
                active_pack_path = config_dir / active_pack_path
            else:
                active_pack_path = Path(active_pack_path)

            if not active_pack_path.exists():
                result.add("config_active", "error", "Config has an invalid active pack path")
                self.logger.debug("🚫 Config file has an invalid active pack path")
            
            if not self.is_pack(active_pack_path):
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
                    result.add("config_custom_wallpacks", "warning", f"Config has an invalid custom wallpack path for {name}")
                    self.logger.debug(f"🚫 Config file has an invalid custom wallpack path for {name}")
            else:
                self.logger.debug("✅ Config file has valid custom wallpack paths")

        # 5. Check if the location key is present and has the required keys
        if "location" in config:
            location = config["location"]
            if not all(key in location for key in ["latitude", "longitude", "timezone"]):
                result.add("config_location", "error", "Config is missing the required keys in [location]")
                self.logger.debug("🚫 Config file is missing the required keys in [location]")
                return result
            self.logger.debug("✅ Config file has the required keys in [location]")

        return result

    def validate_pack(self, pack: Path) -> ValidationResult:
        """Validates a wallpaper pack and reports any issues"""

        # Checks to perform:
        #   Check if the directory is a pack
        #   Check if the schedule.toml is valid
        #   Check if the images are valid

        result = ValidationResult()
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
            with schedule_file.open("r") as f:
                schedule = tomli.load(f)
                result.merge(self.validate_schedule(schedule))
        except Exception as e:
            result.add("schedule_invalid", "error", f"{self.file} schedule.toml is invalid: {str(e)}")
        
        # Check if the images are valid
        images_dir = self.file / "images"
        for img in images_dir.iterdir():
            result.merge(self.validate_image(img))

        return result

    def validate_image(self, img: Path) -> ValidationResult:
        """Validates an image file"""

        # Checks to perform:
        #   Check if the image is a valid image file
        #   Check if the image is not too small
        #   Check if the image is not corrupted
        
        result = ValidationResult()
        self.file = Path(img).resolve()

        # Check if the file is a valid image
        if not imghdr.what(self.file):
            result.add("is_image", "error", f"{self.file} is not a valid image file")
            return result
        
        # Check the size of the image
        try:
            image = Image.open(self.file)
            width, height = image.size
            if width < 800 or height < 600:
                result.add("image_size", "warning", f"{self.file} is smaller than 800x600")
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