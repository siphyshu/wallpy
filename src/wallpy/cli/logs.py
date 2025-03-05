"""
Command group of logs-related commands for the wallpy-sensei CLI
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
    help="View and manage logs",
)


@app.command()
def show(
    ctx: typer.Context,
    lines: Annotated[int, typer.Option("--lines", "-n", help="Number of lines to show")] = 50,
    follow: Annotated[bool, typer.Option("--follow", "-f", help="Follow log output")] = False
):
    """Show recent log entries"""
    
    console.print("⛔ Not Implemented Yet")
    console.print(f"Showing last {lines} lines")
    if follow:
        console.print("Following log output...")


@app.command()
def clear(
    ctx: typer.Context
):
    """Clear all log files"""
    
    console.print("⛔ Not Implemented Yet")


@app.command()
def export(
    ctx: typer.Context,
    output: Annotated[Path, typer.Argument(help="Path to export logs to")] = Path("wallpy-logs.zip")
):
    """Export logs to a zip file"""
    
    console.print("⛔ Not Implemented Yet")
    console.print(f"Exporting logs to {output}")


@app.callback()
def callback(
    ctx: typer.Context
):
    """View and manage logs"""

    # Initialize the application state
    # state = get_app_state()
    # ctx.obj = state