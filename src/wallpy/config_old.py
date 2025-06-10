# config_full.py

# THIS FILE IS BEING REFACTORED / SIMPLIFIED / DISTILLED INTO config.py
# ONLY USE FOR UNDERSTANDING THE LOGIC HERE. DO NOT USE THIS FILE FOR IMPLEMENTATION
from pathlib import Path
import tomli
import tomli_w
import sys
import logging
from typing import Dict, List, Optional, TypedDict, Any
from dataclasses import dataclass
from platformdirs import user_config_path

class PackMeta(TypedDict):
    """Type definition for pack metadata"""
    path: Path
    schedule: Path

class ConfigData(TypedDict):
    """Type definition for config file structure"""
    active: Dict[str, str]
    wallpacks: Dict[str, Dict[str, str]]
    location: Optional[Dict[str, Any]]

@dataclass
class SearchPaths:
    """OS-specific wallpaper search paths"""
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
            "~/Pictures/Wallpapers",
            "C:/Users/Public/Pictures/Wallpapers",
            "~/AppData/Local/Microsoft/Windows/Themes"
        ]

    def get_for_platform(self) -> List[Path]:
        """Get paths for current platform"""
        platform_paths = getattr(self, sys.platform, [])
        return [Path(p).expanduser() for p in platform_paths]


class ConfigManager:
    """Manages wallpaper configuration and pack discovery"""
    
    def __init__(self):
        self.logger = logging.getLogger("wallpy.config")
        self.search_paths = SearchPaths()
        self.config_dir = user_config_path("wallpy-sensei")
        self.config_file = self.config_dir / "config.toml"
        self.packs_dir = self.config_dir / "packs"
        
        # Ensure directories exist
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.packs_dir.mkdir(parents=True, exist_ok=True)
        
        # Load configuration
        self.data = self._load_config()
        self.wallpacks = self._merge_packs()
        self.active_pack = self._validate_active_pack()

    def _load_config(self) -> ConfigData:
        """Load or create configuration file"""
        if not self.config_file.exists():
            self.logger.info("No config file found, creating default")
            return self._create_default_config()
        
        try:
            with open(self.config_file, "rb") as f:
                data = tomli.load(f)
            
            self._validate_config_structure(data)
            return data
        except Exception as e:
            self.logger.error(f"Failed to load config: {e}")
            self.logger.info("Creating new default config")
            return self._create_default_config()

    def _validate_config_structure(self, data: dict) -> None:
        """Validate config file structure"""
        required_sections = ["active", "wallpacks"]
        for section in required_sections:
            if section not in data:
                raise ValueError(f"Missing required section: {section}")
        
        if "pack" not in data["active"]:
            raise ValueError("No active pack specified")
        
        if not isinstance(data["wallpacks"], dict):
            raise ValueError("Invalid wallpacks section")

    def _create_default_config(self) -> ConfigData:
        """Create default configuration"""
        # Create default pack
        default_pack = self._create_default_pack()
        
        # Create config structure
        config: ConfigData = {
            "active": {"pack": "default"},
            "wallpacks": {
                "default": {
                    "path": str(default_pack.relative_to(self.config_dir))
                }
            },
            "location": {}
        }
        
        # Save config
        with open(self.config_file, "wb") as f:
            tomli_w.dump(config, f)
        
        return config

    def _create_default_pack(self) -> Path:
        """Create a default wallpaper pack"""
        pack_path = self.packs_dir / "default"
        pack_path.mkdir(parents=True, exist_ok=True)
        
        # Create default schedule
        schedule = {
            "meta": {
                "type": "timeblocks",
                "name": "Default Pack",
                "author": "wallpy-sensei",
                "description": "Default wallpaper pack"
            },
            "timeblocks": {
                "day": {
                    "start": "sunrise",
                    "end": "sunset",
                    "images": ["day.jpg"]
                },
                "night": {
                    "start": "sunset",
                    "end": "sunrise",
                    "images": ["night.jpg"]
                }
            }
        }
        
        with open(pack_path / "schedule.toml", "wb") as f:
            tomli_w.dump(schedule, f)
        
        # Create placeholder images
        (pack_path / "day.jpg").touch()
        (pack_path / "night.jpg").touch()
        
        return pack_path

    def _merge_packs(self) -> Dict[str, PackMeta]:
        """Combine configured and discovered packs"""
        discovered = self._find_auto_packs()
        configured = self._process_configured_packs()
        
        # Configured packs take precedence over discovered ones
        return {**discovered, **configured}

    def _find_auto_packs(self) -> Dict[str, PackMeta]:
        """Discover valid packs in search paths"""
        found: Dict[str, PackMeta] = {}
        
        # Search in config directory first
        found.update(self._scan_directory(self.packs_dir))
        
        # Search in platform-specific locations
        for search_path in self.search_paths.get_for_platform():
            if search_path.exists():
                found.update(self._scan_directory(search_path))
        
        return found

    def _scan_directory(self, path: Path) -> Dict[str, PackMeta]:
        """Scan directory for valid wallpaper packs"""
        found = {}
        for item in path.iterdir():
            if not item.is_dir():
                continue
                
            schedule_file = item.resolve() / "schedule.toml"
            if schedule_file.exists():
                found[item.name] = PackMeta(
                    path=item.resolve(),
                    schedule=schedule_file
                )
        return found

    def _process_configured_packs(self) -> Dict[str, PackMeta]:
        """Process packs from config file"""
        configured = {}
        for name, meta in self.data.get("wallpacks", {}).items():
            try:
                raw_path = Path(meta["path"])
                if raw_path.is_absolute():
                    pack_path = raw_path
                else:
                    pack_path = (self.packs_dir / raw_path).resolve()
                
                if pack_path.exists():
                    configured[name] = PackMeta(
                        path=pack_path,
                        schedule=pack_path / "schedule.toml"
                    )
                else:
                    self.logger.warning(f"Configured pack not found: {name} at {pack_path}")
            except Exception as e:
                self.logger.error(f"Error processing pack '{name}': {e}")
        return configured

    def _validate_active_pack(self) -> PackMeta:
        """Validate and return active pack configuration"""
        active_name = self.data.get("active", {}).get("pack")
        if not active_name:
            raise ValueError("No active pack specified in config")
        
        if active_name not in self.wallpacks:
            available = ", ".join(self.wallpacks.keys())
            raise ValueError(f"Pack '{active_name}' not found. Available: {available}")
        
        pack = self.wallpacks[active_name]
        if not pack["path"].exists():
            raise FileNotFoundError(f"Pack directory missing: {pack['path']}")
        
        if not pack["schedule"].exists():
            raise FileNotFoundError(f"Missing schedule.toml in {pack['path']}")
        
        return pack

    def set_active_pack(self, name: str) -> None:
        """Set the active wallpaper pack"""
        if name not in self.wallpacks:
            available = ", ".join(self.wallpacks.keys())
            raise ValueError(f"Pack '{name}' not found. Available: {available}")
        
        self.data["active"]["pack"] = name
        with open(self.config_file, "wb") as f:
            tomli_w.dump(self.data, f)
        
        self.active_pack = self.wallpacks[name]

    def add_pack(self, name: str, path: Path) -> None:
        """Add a new pack to configuration"""
        if name in self.wallpacks:
            raise ValueError(f"Pack '{name}' already exists")
        
        if not path.exists():
            raise FileNotFoundError(f"Pack path does not exist: {path}")
        
        if not (path / "schedule.toml").exists():
            raise FileNotFoundError(f"No schedule.toml found in {path}")
        
        # Add to config
        self.data["wallpacks"][name] = {"path": str(path)}
        with open(self.config_file, "wb") as f:
            tomli_w.dump(self.data, f)
        
        # Update wallpacks
        self.wallpacks = self._merge_packs()

    def remove_pack(self, name: str) -> None:
        """Remove a pack from configuration"""
        if name not in self.wallpacks:
            raise ValueError(f"Pack '{name}' not found")
        
        if name == self.data["active"]["pack"]:
            raise ValueError("Cannot remove active pack")
        
        del self.data["wallpacks"][name]
        with open(self.config_file, "wb") as f:
            tomli_w.dump(self.data, f)
        
        # Update wallpacks
        self.wallpacks = self._merge_packs()

    def reset_config(self) -> None:
        """Reset configuration to defaults"""
        self.data = self._create_default_config()
        self.wallpacks = self._merge_packs()
        self.active_pack = self._validate_active_pack()
        
    def get_location(self) -> Optional[Dict[str, Any]]:
        """Get global location configuration if available"""
        location = self.data.get("location", {})
        # Return None if the location is an empty dictionary
        return location if location else None
        
    def set_location(self, location_data: Dict[str, Any]) -> None:
        """Set global location configuration"""
        self.data["location"] = location_data
        with open(self.config_file, "wb") as f:
            tomli_w.dump(self.data, f)