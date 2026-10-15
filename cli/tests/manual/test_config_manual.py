import logging
from wallpy.config import ConfigManager

def main():
    # Configure logging to see INFO messages
    logging.basicConfig(level=logging.INFO)
    try:
        cm = ConfigManager()
    except Exception as e:
        print(f"Error loading configuration: {e}")
        return

    print("Current Configuration:")
    print("----------------------")
    active = cm.config.get("active", {})
    if active:
        print(f"Active Pack: {active.get('name', 'Unnamed')}")
        print(f"Active Pack UID: {active.get('uid', 'N/A')}")
        print(f"Active Pack Path: {active.get('path', 'N/A')}")
    else:
        print("No active pack configured")
    
    print("\nAvailable Packs:")
    for name, meta in cm.wallpacks.items():
        print(f" - {name}: {meta['path']}")
    
    print("\nActive Pack Schedule File:")
    if cm.active_pack and "schedule" in cm.active_pack:
        print(cm.active_pack["schedule"])
    else:
        print("No active pack schedule found.")

if __name__ == "__main__":
    main()
