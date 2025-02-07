# config.py
from pathlib import Path
import tomli
import sys
from platformdirs import user_config_path, user_pictures_dir

class ConfigManager:
    COMMON_PATHS = {
        "linux": [
            "/usr/share/backgrounds",
            "~/.local/share/wallpapers",
            "/usr/share/wallpapers"
        ],
        "darwin": [
            "~/Pictures/Wallpapers",
            "/Library/Desktop Pictures"
        ],
        "win32": [
            "~/Pictures",
            "C:/Users/Public/Wallpapers",
            "~/AppData/Local/Microsoft/Windows/Themes"
        ]
    }


    def __init__(self):
        self.config_dir = user_config_path("wallpy-sensei")
        self.config_file = self.config_dir / "config.toml"
        self.data = self._load_config()
        self.wallpacks = self._merge_packs()
        self.active_pack = self._validate_active_pack()


    def _load_config(self):
        """Load TOML config or create default if missing"""
        if not self.config_file.exists():
            self._create_default_config()
        
        with open(self.config_file, "rb") as f:
            return tomli.load(f)


    def _create_default_config(self):
        """Initialize default config and pack structure"""
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Create default pack
        default_pack_path = self.config_dir / "packs/default"
        default_pack_path.mkdir(parents=True, exist_ok=True)
        
        # Default schedule
        (default_pack_path / "schedule.toml").write_text("""[day]
start = "08:00"
end = "18:00"
images = ["day.jpg"]
""")
        
        # Placeholder image
        (default_pack_path / "day.jpg").touch()
        
        # Write config
        config_content = f"""[active]
pack = "default"

[wallpacks.default]
path = "{default_pack_path.as_posix()}"
"""
        self.config_file.write_text(config_content)


    def _merge_packs(self):
        """Combine config-defined and auto-discovered packs"""
        config_packs = {
            name: self._process_pack_meta(meta)
            for name, meta in self.data.get("wallpacks", {}).items()
        }
        return {**self._find_auto_packs(), **config_packs}


    def _find_auto_packs(self):
        """Discover valid packs in OS-specific locations"""
        found = {}
        for path in self._get_os_paths():
            if not path.exists():
                continue
            
            for pack_dir in path.iterdir():
                if pack_dir.is_dir() and (pack_dir / "schedule.toml").exists():
                    found[pack_dir.name] = {
                        "path": pack_dir.resolve(),
                        "schedule": pack_dir / "schedule.toml"
                    }
        return found


    def _get_os_paths(self):
        """Get validated OS-specific search paths"""
        platform = sys.platform
        paths = self.COMMON_PATHS.get(platform, [])
        return [Path(p).expanduser() for p in paths if Path(p).expanduser().exists()]


    def _process_pack_meta(self, meta):
        """Resolve paths relative to config directory"""
        raw_path = Path(meta["path"])
        
        # Resolve relative to config directory if not absolute
        if raw_path.is_absolute():
            resolved_path = raw_path.expanduser()
        else:
            resolved_path = (self.config_dir / "packs" / raw_path).expanduser()
        
        return { 
            "path": resolved_path.resolve(),
            "schedule": resolved_path / "schedule.toml"
        }


    def _validate_active_pack(self):
        """Validate active pack configuration"""
        active_name = self.data.get("active", {}).get("pack", "")
        
        if not active_name:
            raise ValueError("No active pack specified in config")
            
        if active_name not in self.wallpacks:
            available = ", ".join(self.wallpacks.keys())
            raise ValueError(f"Pack '{active_name}' not found. Available: {available}")
        
        pack = self.wallpacks[active_name]
        original_path = self.data["wallpacks"][active_name]["path"]  # Get from raw config
        
        if not pack["path"].exists():
            raise FileNotFoundError(
                f"Pack directory missing: {pack['path']}\n"
                f"Configured path: {original_path}\n"
                f"Resolved relative to: {self.config_dir}"
            )
            
        if not pack["schedule"].exists():
            raise FileNotFoundError(f"Missing schedule.toml in {pack['path']}")
            
        return pack