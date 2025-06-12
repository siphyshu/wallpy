from pathlib import Path
from datetime import datetime
from wallpy.schedule import ScheduleManager
from wallpy.models import ScheduleType

def test_schedule(schedule_file: Path):
    print(f"\nTesting schedule: {schedule_file.name}")
    print("-" * 50)
    
    # Load and parse the schedule
    manager = ScheduleManager()
    schedule = manager.load_schedule(schedule_file)

    # Print schedule information
    print("\nSchedule Information:")
    print(f"Name: {schedule.meta.name}")
    print(f"Author: {schedule.meta.author}")
    print(f"Type: {schedule.meta.type}")
    
    # Validate the schedule
    try:
        manager.validate_schedule(schedule, schedule_file.parent)
        print("\nSchedule validation successful!")
    except Exception as e:
        print(f"\nSchedule validation failed: {e}")

    if schedule.meta.type == ScheduleType.TIMEBLOCKS:
        # Get current timeblock
        now = datetime.now()
        current_block = manager.get_current_block(schedule, now)
        
        if current_block:
            print(f"\nCurrent timeblock: {current_block.name}")
            print(f"Start time: {current_block.start}")
            print(f"End time: {current_block.end}")
            print(f"Images: {[str(img) for img in current_block.images]}")
        else:
            print("\nNo active timeblock found for current time")

def main():
    # Create test directory structure
    test_dir = Path("tests/schedules")
    test_dir.mkdir(exist_ok=True, parents=True)
    
    # Create dummy image files
    for img in ["morning.jpg", "afternoon.jpg", "evening.jpg", "night.jpg", 
                "monday.jpg", "tuesday.jpg", "weekend.jpg"]:
        (test_dir / img).touch()

    # Test each schedule
    for schedule_file in test_dir.glob("*.toml"):
        test_schedule(schedule_file)

if __name__ == "__main__":
    main() 