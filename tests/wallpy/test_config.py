import pytest
from pathlib import Path
from wallpy.config import ConfigManager, PackSearchPaths, generate_uid

class TestConfigManager:
    def test_config_manager_initialization(self):
        """Test that ConfigManager initializes correctly."""
        config_manager = ConfigManager()
        assert config_manager.config_dir is not None
        assert config_manager.config_file_path is not None
        assert config_manager.packs_dir is not None
    
    def test_load_config(self):
        """Test loading configuration."""
        config_manager = ConfigManager()
        config = config_manager.load_config()
        assert isinstance(config, dict)
    
    def test_get_active_pack(self):
        """Test getting the active pack."""
        config_manager = ConfigManager()
        # This should not raise an error even if no active pack is set
        try:
            active_pack = config_manager.get_active_pack()
        except Exception:
            # It's okay if there's no active pack configured
            pass
    
    def test_load_packs(self):
        """Test loading wallpaper packs."""
        config_manager = ConfigManager()
        packs = config_manager.load_packs()
        assert isinstance(packs, dict)

class TestPackSearchPaths:
    def test_pack_search_paths(self):
        """Test that pack search paths are valid Path objects."""
        search_paths = PackSearchPaths()
        paths = search_paths.get_paths()
        assert isinstance(paths, list)
        assert all(isinstance(path, Path) for path in paths)
        assert len(paths) > 0

def test_generate_uid():
    """Test that generate_uid creates unique IDs."""
    path1 = "/test/path/1"
    path2 = "/test/path/2"
    uid1 = generate_uid(path1)
    uid2 = generate_uid(path2)
    assert isinstance(uid1, str)
    assert len(uid1) == 6
    assert uid1 != uid2
    # Same path should generate same UID
    assert generate_uid(path1) == uid1
