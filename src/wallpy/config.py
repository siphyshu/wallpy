# config.py

import sys
import imghdr
import shutil
import logging
import hashlib
import difflib
import tomli, tomli_w
from pathlib import Path
from dataclasses import dataclass
from collections import defaultdict
from importlib.resources import files
from platformdirs import user_config_path
from typing import Dict, List, Optional, TypedDict, Any, DefaultDict

from wallpy.validate import Validator, ValidationResult
from wallpy.models import PackSearchPaths, Pack, Location


def generate_uid(path: str) -> str:
    # Create a short MD5 hash from the pack's absolute path
    hash_object = hashlib.md5(path.encode())
    return hash_object.hexdigest()[:6]


class ConfigManager:
    """Manages wallpaper configuration and pack discovery"""

    # note to self: 
    # if you ever question why config manager is handling packs as well as the config file, instead of a separate pack manager class, remember that: 
    #   - the config manager is the only class that knows where the packs are stored, because that info is stored in the config file
    #   - if not for the config manager, the pack manager would have to know where the config is stored + make edits to the config file
    #   - it would have to inevidently use ConfigManager anyway, which just adds an extra layer of abstraction that is unnecessary

    def __init__(self):
        self.logger = logging.getLogger("wallpy.config")
        self.logger.debug("🔧 Initializing ConfigManager")

        self.validator = Validator()

        # Get directories and paths
        self.config_dir = user_config_path(appname="wallpy", appauthor=False, ensure_exists=True)
        # self.logger.debug(f"📝 Config directory: {self.config_dir}")
        self.config_file_path = self.config_dir / "config.toml"
        # self.logger.debug(f"📝 Global Config File: {self.config_file_path}")
        self.packs_dir = self.config_dir / "packs"
        # self.logger.debug(f"📝 Packs directory: {self.packs_dir}")
        self.data_dir = files("wallpy.data")
        # self.logger.debug(f"📝 Data directory: {self.data_dir}")
        self.pack_search_paths = PackSearchPaths().get_paths() # could replace with just a func, but having a dataclass seemed in-line with models.py
        # self.logger.debug(f"📝 Pack search paths:")
        # for i, path in enumerate(self.pack_search_paths):
        #     if path.exists():
        #         self.logger.debug(f"    (#{i+1}) {path}")
        #     else:
        #         self.logger.debug(f"    (#{i+1}) {path} (❗)")
        
        # Load config and packs
        self.config = self.load_config()
        self.wallpacks = self.load_packs() # we're loading the packs initially, but also remember to load them when needed to refresh the list
    

    def load_config(self) -> Dict[str, Any]:
        """Loads the global configuration file"""
        
        self.logger.debug("🔁 Loading configuration")

        # Create a default config file if it doesn't exist
        if not self.config_file_path.exists():
            self.logger.debug("⚠️ Config file not found, creating default")
            self._create_default_config()

        # Check if the config file is empty
        if self.config_file_path.stat().st_size == 0:
            self.logger.debug("⚠️ Config file is empty, creating default")
            self._create_default_config()

        try:
            # Load the config file
            with open(self.config_file_path, "rb") as f:
                config = tomli.load(f)
                
                # Cache the config for later use
                self.config = config
                return config

        except Exception as e:
            self.logger.error(f"💀 Error loading configuration: {str(e)}")
            sys.exit(1)

    def validate_config(self) -> ValidationResult:
        """Validates the current configuration and returns validation results"""
        return self.validator.validate_config(self.config, self.wallpacks)

    def load_packs(self, skip_custom: bool = False) -> DefaultDict[str, List[Pack]]:
        """Loads all available wallpaper packs
        
        Args:
            skip_custom (bool, optional): Skip loading custom paths. Defaults to False
        """

        self.logger.debug("🔁 Loading wallpacks")

        # Create a default pack if none exists
        if not self.packs_dir.exists() or not any(self.packs_dir.iterdir()):
            self.logger.debug("⚠️ No packs found, creating default")
            self._create_default_pack()

        # Packs can be found in the following ways:
        # 1. In the packs directory
        # 2. In common directories for each OS (e.g. /usr/share/wallpy/packs or ~/Pictures/Wallpapers)
        # 3. In the config file, custom paths can be specified to packs or directories containing packs
        
        # We use a defaultdict here to handle duplicates (multiple packs with same name in different dirs)
        packs = defaultdict(list)
        
        # First we get all packs in the packs directory
        self.logger.debug("🔍 Searching packs directory")
        # packs.extend(self.scan_directory(self.packs_dir))
        packs.update(self.scan_directory(self.packs_dir))

        # Then we get all packs in the common directories
        self.logger.debug("🔍 Searching common directories")
        for i, path in enumerate(self.pack_search_paths):
            for name, pack in self.scan_directory(path, f"#{i+1}").items():
                packs[name].extend(pack)

        # Finally we get all packs in the custom paths specified in the config
        if (not skip_custom) and ("custom_wallpacks" in self.config):
            self.logger.debug("🔍 Searching custom directories")
            custom_paths = self.config["custom_wallpacks"]

            # Check each custom path
            for name, path in custom_paths.items():
                # Check if the path is relative
                if not Path(path).is_absolute():
                    path = self.config_dir / path
                else:
                    path = Path(path)

                for name, pack in self.scan_directory(path, name).items():
                    packs[name].extend(pack)
            
        self.logger.debug(f"✅ Wallpacks loaded ({len(packs)} found)")

        # Remove duplicate packs by UID
        # We'll keep the first occurrence of each UID and remove any duplicates
        seen_uids = set()
        unique_packs = defaultdict(list)
        
        for name, pack_list in packs.items():
            for pack in pack_list:
                if pack.uid not in seen_uids:
                    seen_uids.add(pack.uid)
                    unique_packs[name].append(pack)
                else:
                    self.logger.debug(f"Removing duplicate pack: {pack.name} ({pack.uid}) at {pack.path}")

        # Cache the packs for later use
        self.wallpacks = unique_packs

        return unique_packs


    def _create_default_config(self) -> None:
        """Creates a default configuration file"""
        
        # First we create the default config
        default_config_path = self.data_dir / "config.toml"
        
        self.logger.debug(f"🔁 Copying default config")
        
        try:
            shutil.copy(default_config_path, self.config_file_path)
            self.logger.debug("✅ Default configuration created")
        except Exception as e:
            self.logger.error(f"💀 Error copying default config: {str(e)}")
        
        # Then we create the default pack
        self._create_default_pack()

    
    def _create_default_pack(self) -> None:
        """Creates a default wallpaper pack"""
        
        # Copy the default pack from the package data
        default_pack_path = self.data_dir / "packs" / "default"
        default_pack_dest = self.packs_dir / "default"
        
        self.logger.debug(f"🔁 Copying default pack")
        
        try:
            shutil.copytree(default_pack_path, default_pack_dest, dirs_exist_ok=True)
            self.logger.debug("✅ Default pack created")
        except Exception as e:
            self.logger.error(f"💀 Error copying default pack: {str(e)}")
    
    
    def scan_directory(self, path: Path, path_nick: str = None) -> DefaultDict[str, List[Pack]]:
        """Finds all packs in a given path
        
        Args:
            path (Path): The path to search for packs
            path_nick (str, optional): A nickname for the path. Defaults to None.
        """
        
        packs = defaultdict(list)

        # Check if the path exists or is not a directory
        if not path.exists() or not path.is_dir():
            return packs
        
        # Check if the path is a pack
        if self.validator.is_pack(path):
            # self.logger.debug(f"    📦 {path.name} (in {path_nick})" if path_nick else f"    📦 {path.name}")
            pack = Pack(name=path.name, path=path.resolve(), uid=generate_uid(str(path.resolve())))
            packs[path.name].append(pack)
        else:    
            # Check if the path contains any packs
            for item in path.iterdir():
                if self.validator.is_pack(item):
                    # self.logger.debug(f"    📦 {item.name} (in {path_nick})" if path_nick else f"    📦 {item.name}")
                    pack = Pack(name=item.name, path=item.resolve(), uid=generate_uid(str(item.resolve())))
                    packs[item.name].append(pack)
        
        return packs
    

    def get_pack_by_uid(self, pack_uid: str) -> Optional[Pack]:
        """Gets a pack by its unique identifier"""

        self.load_packs()
        
        for packs in self.wallpacks.values():
            for pack in packs:
                if pack.uid == pack_uid:
                    return pack
        else:
            return None
        

    def find_similar_pack(self, pack_name: str, available_packs: List[str]) -> List[str]:
        """Finds similar pack names from a list of available packs"""
            
        pack_name = pack_name.lower().strip()        
        matches = difflib.get_close_matches(pack_name, available_packs, n=3, cutoff=0.2)
        return matches
    

    def get_active_pack(self) -> Pack:
        """Gets the active wallpaper pack from the config"""
        
        if "active" in self.config:
            active = self.config["active"]
            pack_name = active.get("name")
            pack_path = Path(active.get("path"))
            pack_uid = active.get("uid")
            
            # Create a Pack object with the active pack info
            return Pack(
                name=pack_name,
                path=pack_path,
                uid=pack_uid or generate_uid(str(pack_path))
            )
        else:
            return None

    

    def set_active_pack(self, pack: Pack) -> None:
        """Sets the active wallpaper pack in the config
        
        Args:
            pack (Pack): The pack to activate
        """
        
        self.logger.debug(f"🔁 Setting active pack to {pack.name}")

        # Load the current config
        self.load_config()

        # Set the active pack in the active section
        self.config["active"] = {
            "name": pack.name,
            "path": str(pack.path),
            "uid": pack.uid
        }
        
        self.logger.debug(f"Config: {self.config}")

        # Save the config
        return self._save_config(self.config)



    def _save_config(self, config: dict) -> None:
        """Saves the configuration to the global config file"""
        
        self.logger.debug("🔁 Saving configuration")

        # Validate the config before saving
        validation = self.validator.validate_config(config, self.wallpacks)
        if validation.failed:
            self.logger.error("💀 Configuration validation failed")
            for key, result in validation.errors.items():
                self.logger.error(f"    ❗ {key.upper()}: {result}")
            return False

        # Log any warnings
        for key, result in validation.warnings.items():
            self.logger.warning(f"    ⚠️ {key.upper()}: {result}")

        try:
            # Ensure the config directory exists
            self.config_file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save the config file
            with open(self.config_file_path, "wb") as f:
                tomli_w.dump(config, f)
            
            # Verify the file was written correctly
            if not self.config_file_path.exists():
                self.logger.error("💀 Failed to write config file")
                return False
                
            # Verify the file can be read back
            try:
                with open(self.config_file_path, "rb") as f:
                    tomli.load(f)
            except Exception as e:
                self.logger.error(f"💀 Config file verification failed: {str(e)}")
                return False
                
            self.logger.debug("✅ Configuration saved")
            return True
            
        except Exception as e:
            self.logger.error(f"💀 Error saving configuration: {str(e)}")
            return False

    def get_location(self) -> Optional[Location]:
        """Gets the global location from the config"""
        if "location" in self.config:
            loc_data = self.config["location"]
            return Location(
                name=loc_data.get("name", "New Delhi"),
                region=loc_data.get("region", "Asia"),
                latitude=loc_data.get("latitude", 28.6139),
                longitude=loc_data.get("longitude", 77.2090),
                timezone=loc_data.get("timezone", "Asia/Kolkata"),
            )
        return None

    def set_location(self, location: Location) -> None:
        """Sets the global location in the config
        
        Args:
            location (Location): The location to set
        """
        self.logger.debug(f"🔁 Setting global location")

        # Load the current config
        self.load_config()

        # Set the location in the config
        self.config["location"] = {
            "latitude": location.latitude,
            "longitude": location.longitude,
            "timezone": location.timezone,
            "name": location.name,
            "region": location.region
        }
        
        # Save the config
        return self._save_config(self.config)