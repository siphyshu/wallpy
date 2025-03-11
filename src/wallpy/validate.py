# validate.py
import sys
import imghdr
import tomli
import logging
from PIL import Image
from typing import List
from pathlib import Path
from platformdirs import user_config_path
from dataclasses import dataclass, field
from collections import defaultdict


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
        """Validtion is considered passed if there are no errors"""
        return len(self.errors) == 0
    
    @property
    def failed(self) -> bool:
        """Validation is considered failed if there are any errors"""
        return len(self.errors) > 0



class Validator:
    """Validates schedules, config, packs, and other components"""

    def __init__(self):
        self.logger = logging.getLogger("wallpy.logger")
        self.logger.debug("🔧 Initializing Validator")


    def validate_schedule(self, schedule: dict):
        """Validates a wallpaper pack schedule and reports any issues"""

        result = ValidationResult()

        return result


    def validate_config(self, config: dict, wallpacks: dict):
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
        custom_wallpacks = defaultdict(list)
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


    def validate_pack(self, pack: Path):
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


    def validate_image(self, img: Path):
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
        image = Image.open(self.file)
        width, height = image.size

        if width < 1920 or height < 1080:
            result.add("image_size", "warning", f"{self.file} is smaller than 1920x1080, wallpaper may appear pixelated or cut off")

        # Check if the image is corrupted
        try:
            image.verify()
        except Exception as e:
            result.add("image_corrupted", "error", f"{self.file} is corrupted: {str(e)}")

        return result
    

    def is_pack(self, item: Path) -> bool:
        """Checks if a directory is a wallpaper pack"""
        
        # Conditions for a directory to be a pack:
        #   Condition 1: Is a directory
        #   Condition 2: schedule.toml exists
        #   Condition 3: images directory exists 
        #   Condition 4: images directory contains at least 1 valid image

        # Check condition 1 (Is a directory)
        if not item.is_dir():
            return False
        
        # Check condition 2 (schedule.toml exists)
        schedule_file = item / "schedule.toml"
        if not schedule_file.exists():
            return False
        
        # Check condition 3 (images directory exists)
        images_dir = item / "images"
        if not images_dir.exists() or not any(images_dir.iterdir()):
            return False
        
        # Check condition 4 (images directory contains at least 1 valid image)
        valid_images = [img for img in images_dir.iterdir() if imghdr.what(img)]
        if not valid_images:
            return False
        
        return True