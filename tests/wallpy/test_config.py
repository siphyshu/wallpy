import sys
import pytest
from pathlib import Path
import tomli_w
from wallpy.config import ConfigManager, SearchPaths

# Fixture to override the user config path to a temporary directory
@pytest.fixture
def temp_config_dir(tmp_path, monkeypatch):
    # Create a temporary config directory
    config_dir = tmp_path / "wallpy-sensei"
    config_dir.mkdir(parents=True, exist_ok=True)
    # Override user_config_path to return our temporary directory
    monkeypatch.setattr("wallpy.config.user_config_path", lambda app: config_dir)
    return config_dir

def test_default_config_creation(temp_config_dir):
    """Test that a default config and default pack are created when none exist."""
    config_file = temp_config_dir / "config.toml"
    packs_dir = temp_config_dir / "packs"
    # Ensure the config file doesn't exist
    if config_file.exists():
        config_file.unlink()
    cm = ConfigManager()
    # Check that the config file and packs directory exist
    assert config_file.exists()
    assert packs_dir.exists()
    # Check default config values
    assert cm.data["active"]["pack"] == "default"
    default_pack_path = packs_dir / "default"
    assert default_pack_path.exists()
    schedule_file = default_pack_path / "schedule.toml"
    assert schedule_file.exists()

def test_set_active_pack(temp_config_dir):
    """Test setting the active pack to a newly added pack."""
    cm = ConfigManager()
    # Create a new pack in the packs directory
    new_pack_dir = cm.config_dir / "packs" / "new_pack"
    new_pack_dir.mkdir(parents=True)
    schedule_file = new_pack_dir / "schedule.toml"
    # Write a minimal schedule to the new pack's schedule.toml
    schedule_file.write_text(
        "[meta]\ntype = 'timeblocks'\nname = 'New Pack'\n"
    )
    cm.add_pack("new_pack", new_pack_dir)
    cm.set_active_pack("new_pack")
    assert cm.data["active"]["pack"] == "new_pack"
    # Verify that the active pack paths match
    assert cm.active_pack["path"] == new_pack_dir.resolve()

def test_remove_pack(temp_config_dir):
    """Test removing a pack that is not active."""
    cm = ConfigManager()
    # Cannot remove the active (default) pack
    with pytest.raises(ValueError):
        cm.remove_pack("default")
    # Create a new pack and then remove it
    another_pack_dir = cm.config_dir / "packs" / "another_pack"
    another_pack_dir.mkdir(parents=True)
    (another_pack_dir / "schedule.toml").write_text(
        "[meta]\ntype = 'timeblocks'\nname = 'Another Pack'\n"
    )
    cm.add_pack("another_pack", another_pack_dir)
    cm.remove_pack("another_pack")
    assert "another_pack" not in cm.data["wallpacks"]

def test_reset_config(temp_config_dir):
    """Test that resetting the config recreates the default configuration."""
    cm = ConfigManager()
    # Change active pack to something invalid
    cm.data["active"]["pack"] = "nonexistent"
    cm.reset_config()
    assert cm.data["active"]["pack"] == "default"

def test_invalid_config_file(temp_config_dir):
    """Test that an invalid config file results in a new default config."""
    config_file = temp_config_dir / "config.toml"
    # Write invalid TOML content
    config_file.write_text("not valid toml")
    cm = ConfigManager()
    # Since _load_config catches errors and creates a default config,
    # our config data should contain the required sections.
    assert "active" in cm.data
    assert "wallpacks" in cm.data

def test_invalid_active_pack(temp_config_dir):
    """Test that _validate_active_pack raises an error when the active pack is missing files."""
    cm = ConfigManager()
    # Create a broken pack (directory exists but no schedule.toml)
    broken_pack_dir = cm.config_dir / "packs" / "broken_pack"
    broken_pack_dir.mkdir(parents=True, exist_ok=True)
    cm.data["active"]["pack"] = "broken_pack"
    cm.data["wallpacks"]["broken_pack"] = {"path": str(broken_pack_dir.relative_to(cm.config_dir))}
    cm.wallpacks = cm._merge_packs()
    with pytest.raises(ValueError, match=r"Pack 'broken_pack' not found\. Available: .*"):
        cm._validate_active_pack()

def test_search_paths_platform(tmp_path, monkeypatch):
    """Test that SearchPaths returns a list of Paths for the current platform."""
    # Force sys.platform to 'linux' for this test
    monkeypatch.setattr(sys, "platform", "linux")
    sp = SearchPaths()
    paths = sp.get_for_platform()
    # Check that each item is a Path
    for p in paths:
        assert isinstance(p, Path)

def test_get_location(temp_config_dir):
    """Test getting global location configuration"""
    # Create a new ConfigManager instance
    config_manager = ConfigManager()
    
    # Initially, location should be None (empty dict converted to None)
    assert config_manager.get_location() is None
    
    # Set a location
    location_data = {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "timezone": "America/New_York",
        "name": "New York",
        "region": "USA"
    }
    config_manager.set_location(location_data)
    
    # Get the location and verify it matches
    retrieved_location = config_manager.get_location()
    assert retrieved_location is not None
    assert retrieved_location["latitude"] == 40.7128
    assert retrieved_location["longitude"] == -74.0060
    assert retrieved_location["timezone"] == "America/New_York"
    assert retrieved_location["name"] == "New York"
    assert retrieved_location["region"] == "USA"
    
    # Reset the config and verify location is None again
    config_manager.reset_config()
    assert config_manager.get_location() is None
