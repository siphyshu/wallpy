"""
Main application entry point for the wallpy-sensei CLI
"""

import typer
import logging
from pathlib import Path
from rich.console import Console
from typing_extensions import Annotated

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine


app = typer.Typer(
    no_args_is_help=True,
    rich_markup_mode="rich",
    epilog="made with ❤️ by [cyan link=https://siphyshu.me/]siphyshu[/]",
)

console = Console()

@app.callback(invoke_without_command=True)
def main(
    version: bool = typer.Option(False, "--version", "-v", help="Show version information"),
    help: bool = typer.Option(False, "--help", "-h", help="Show this help message"),
    ctx: typer.Context = typer.Context
    ):
    """
    [bold]wallpy-sensei 🥷🌆[/]

    A dynamic wallpaper engine with time-based scheduling
    """
    if version:
        from importlib.metadata import version
        console.print(f"wallpy v{version('wallpy-sensei')}")
        raise typer.Exit()

    if help:
        console.print(ctx.get_help())
        raise typer.Exit()

    if ctx.invoked_subcommand is None:
        console.print("Hello, world!")


if __name__ == "__main__":
    app()