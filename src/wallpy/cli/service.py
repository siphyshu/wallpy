"""
Command group of service-related commands for the wallpy-sensei CLI
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
    help="Control wallpy service",
)


@app.command()
def install(
    ctx: typer.Context
):
    """Installs and sets up the wallpy service (system-level)"""
    
    console.print("⛔ Not Implemented Yet")


@app.command()
def start(
    ctx: typer.Context
):
    """Starts the wallpy service"""
    
    console.print("⛔ Not Implemented Yet")


@app.command()
def stop(
    ctx: typer.Context
):
    """Stops the wallpy service"""
    
    console.print("⛔ Not Implemented Yet")


@app.command()
def restart(
    ctx: typer.Context
):
    """Restarts the wallpy service"""
    
    console.print("⛔ Not Implemented Yet")


@app.command()
def status(
    ctx: typer.Context
):
    """Shows the status of the wallpy service"""
    
    console.print("⛔ Not Implemented Yet")


@app.callback()
def callback(
    ctx: typer.Context
):
    """Control wallpy service"""