""" 
Command group of config-related commands for the wallpy-sensei CLI
"""

import typer
import logging
from pathlib import Path
from rich.console import Console
from typing_extensions import Annotated

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine


console = Console()
app = typer.Typer(
    no_args_is_help=True,
    rich_markup_mode="rich",
    help="Manage wallpy configuration",
)


@app.command(
    rich_help_panel="📋 View & Edit"
)
def show(
    ctx: typer.Context
):
    """Prints the global config in a human-readable format"""
    
    console.print("🚧 Work In Progress", end="\n\n")

    config_manager = ctx.obj.get("config_manager")

    # Get all config fields
    config = config_manager.config

    # Print all config fields
    for key, value in config.items():
        console.print(f"[bold]{key}[/]: {value}")


@app.command(
    rich_help_panel="📋 View & Edit"
)
def edit(
    ctx: typer.Context
):
    """Opens the global config in editor"""
    
    console.print("🚧 Work In Progress")

    # config_manager = ctx.obj.get("config_manager")
    
    # location = str(config_manager.config_dir)
    # # location = str(Path("C://Users//SIPHYSHU//Downloads//cyberpunk.mp4"))
    # # location = "https://siphyshu.me"
    
    # console.print(f"Opening {location} in editor")
    # rc = typer.launch(location,locate=True)
    # console.print(rc)


@app.command(
    no_args_is_help=True,
    rich_help_panel="📋 View & Edit"
)
def set(
    ctx: typer.Context,
    field: Annotated[str, typer.Argument(..., help="The config field to set")],
    value: Annotated[str, typer.Argument(..., help="The new value for the config field")]
):
    """Sets a specific config field to a new value"""
    
    console.print("⛔ Not Implemented Yet")
    console.print(f"Setting {field} to {value}")


@app.callback()
def callback(
    ctx: typer.Context
):
    """Manage wallpy configuration"""