"""
Utility functions for the CLI.
"""

import sys
import typer
import logging
from pathlib import Path
from rich.console import Console
from platformdirs import user_config_path
import logging

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine
from wallpy.validate import Validator

def get_app_state(verbose: bool) -> dict:
    """
    Get the current state of the application
    """
    
    console = Console()
    
    logger = logging.getLogger("wallpy")
    if verbose:
        log_level = logging.DEBUG
    else:
        log_level = logging.INFO
    logging.basicConfig(
        level=log_level,
        # format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        format="(%(name)s) %(message)s",
    )

    # Initialize configuration
    try:
        config_manager = ConfigManager()
    except Exception as e:
        console.print(f"[red]Error loading configuration:[/] {str(e)}")
        sys.exit(1)
    
    # Initialize schedule manager
    try:
        schedule_manager = ScheduleManager()
    except Exception as e:
        console.print(f"[red]Error initializing schedule manager:[/] {str(e)}")
        sys.exit(1)
    
    # Initialize wallpaper engine
    try:
        wallpaper_engine = WallpaperEngine()
    except Exception as e:
        console.print(f"[red]Error initializing wallpaper engine:[/] {str(e)}")
        sys.exit(1)

    # Initialize validator
    try:
        validator = Validator()
    except Exception as e:
        console.print(f"[red]Error initializing validator:[/] {str(e)}")
        sys.exit(1)
    
    return {
        "console": console,
        "logger": logger,
        "config_manager": config_manager,
        "schedule_manager": schedule_manager,
        "engine": wallpaper_engine,
        "validator": validator,
    }