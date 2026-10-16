import logging
from pathlib import Path
from platformdirs import user_data_path

from wallpy.config import ConfigManager
from wallpy.engine import WallpaperEngine
from wallpy.schedule import ScheduleManager

def main():
    # Setup logging
    log_dir = user_data_path(appname="wallpy", appauthor=False, ensure_exists=True) / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        filename=log_dir / "wallpy.log",
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger("Wallpy")

    try:
        # Initialize components
        config_manager = ConfigManager()
        engine = WallpaperEngine()
        schedule_manager = ScheduleManager()

        # Get the active pack
        active_pack = config_manager.get_active_pack()
        if not active_pack:
            logger.error("No active pack found")
            return

        logger.info(f"Active pack path: {active_pack.path}")

        # Locate schedule file
        possible_files = [
            active_pack.path / "schedule.toml",
            active_pack.path / "schedule.tml",
        ]
        logger.info(f"Looking for schedule files in: {[str(p) for p in possible_files]}")
        
        schedule_file = next((p for p in possible_files if p.exists()), None)
        if not schedule_file:
            logger.error(f"No schedule file found in pack: {active_pack.name}")
            return

        logger.info(f"Found schedule file: {schedule_file}")

        # Load the schedule
        schedule = schedule_manager.load_schedule(schedule_file)

        # Get the current wallpaper
        wallpaper_path = schedule_manager.get_wallpaper(
            schedule,
            global_location=config_manager.get_location()
        )

        if not wallpaper_path:
            logger.error("No suitable wallpaper found in schedule")
            return

        # Resolve the path relative to pack directory if needed
        if not wallpaper_path.is_absolute():
            wallpaper_path = (active_pack.path / "images" / wallpaper_path).resolve()

        # Change the wallpaper
        success = engine.set_wallpaper(wallpaper_path)
        if success:
            logger.info(f"Successfully changed wallpaper to: {wallpaper_path}")
        else:
            logger.error(f"Failed to change wallpaper to: {wallpaper_path}")

    except Exception as e:
        logger.error(f"Error changing wallpaper: {str(e)}", exc_info=True)

if __name__ == '__main__':
    main()
