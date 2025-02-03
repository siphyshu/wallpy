from pathlib import Path
import tomli
from platformdirs import user_config_path, user_pictures_dir

class ConfigManager:
    def __init__(self):
        self.config_dir = user_config_path("wallpy-sensei")
        self.config_file = self.config_dir / "config.toml"
        self.data = self._load_config()
        self.active_pack = self._validate_active_pack()

    def _load_config(self):
        if not self.config_file.exists():
            self._create_default_config()
        
        with open(self.config_file, "rb") as f:
            return tomli.load(f)

    def _create_default_config(self):
        """Create config file with default pack structure"""
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Create default pack
        default_pack_path = self.config_dir / "packs/default"
        default_pack_path.mkdir(parents=True, exist_ok=True)
        
        # Create sample schedule
        (default_pack_path / "schedule.toml").write_text("""[day]
start = "08:00"
end = "18:00"
images = ["day.jpg"]
""")
        
        # Create placeholder image
        (default_pack_path / "day.jpg").touch()  # Just placeholder for now
        
        # Write config
        config_content = f"""[active]
pack = "default"

[wallpacks.default]
path = "{default_pack_path.as_posix()}"
"""
        self.config_file.write_text(config_content)

    def _resolve_path(self, raw_path: str) -> Path:
        """Resolve paths with fallback locations"""
        expanded = Path(raw_path).expanduser()
        
        if expanded.exists():
            return expanded.resolve()
            
        fallback_dirs = [
            Path(user_pictures_dir()) / "Wallpapers",
            self.config_dir / "packs"
        ]
        
        for base in fallback_dirs:
            candidate = base / raw_path
            if candidate.exists():
                return candidate.resolve()
                
        raise FileNotFoundError(f"Wallpaper path not found: {raw_path}")

    def _validate_active_pack(self):
        """Validate active pack configuration"""
        active_name = self.data.get("active", {}).get("pack", "")
        packs = self.data.get("wallpacks", {})
        
        if not active_name or active_name not in packs:
            raise ValueError(f"Invalid active pack: {active_name}")
            
        pack_meta = packs[active_name]
        resolved_path = self._resolve_path(pack_meta["path"])
        
        if not (resolved_path / "schedule.toml").exists():
            raise FileNotFoundError(
                f"Missing schedule.toml in {resolved_path}"
            )
            
        return {
            "name": active_name,
            "path": resolved_path,
            "schedule": resolved_path / "schedule.toml"
        }
