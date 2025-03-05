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
    
    console.print("⛔ Not Implemented Yet")


@app.command(
    rich_help_panel="📋 View & Edit"
)
def edit(
    ctx: typer.Context
):
    """Opens the global config in editor"""
    
    console.print("⛔ Not Implemented Yet")


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

    # Initialize the application state
    # state = get_app_state()
    # ctx.obj = state