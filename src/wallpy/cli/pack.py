""" 
Command group of pack-related commands for the wallpy-sensei CLI
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
    help="Manage wallpaper packs",
)


# Basic pack operations
@app.command(
    epilog="✨ shorter alias available: [turquoise4]wallpy list[/]",
    rich_help_panel="📋 Basic Operations"
)
def list(
    ctx: typer.Context
):
    """Lists all available wallpaper packs"""

    console.print("⛔ Not Implemented Yet")


@app.command(
    rich_help_panel="📋 Basic Operations"
)
def new(
    ctx: typer.Context
):
    """Creates a new pack using the pack creation wizard"""

    console.print("⛔ Not Implemented Yet")


@app.command(
    no_args_is_help=True,
    epilog="✨ shorter alias available: [turquoise4]wallpy activate[/]",
    rich_help_panel="📋 Basic Operations"
)
def activate(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to activate", show_default=False)]
):
    """Activates the specified pack (makes it the default)"""

    console.print("⛔ Not Implemented Yet")
    console.print(f"Activating pack: {pack_name}")


# Pack management
@app.command(
    epilog="✨ shorter alias available: [turquoise4]wallpy preview[/]",
    rich_help_panel="🔍 Management"
)
def preview(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to preview")] = "active",
):
    """
    Previews schedule and wallpapers from the specified pack.  
    
    If no pack is specified, the active pack is previewed.
    """

    # Check if pack_name was provided; if not, use the active pack
    if pack_name == "active":
        pack_name = ctx.obj.get("active")
    console.print("⛔ Not Implemented Yet")
    console.print(f"Previewing pack: {pack_name}")


@app.command(
    rich_help_panel="🔍 Management"
)
def validate(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to validate")] = "active",
):
    """
    Validates the active or specified pack (checks schedule, meta, etc.)

    If no pack is specified, the active pack is validated.
    """

    # Check if pack_name was provided; if not, use the active pack
    if pack_name == "active":
        pack_name = ctx.obj.get("active")
    console.print("⛔ Not Implemented Yet")
    console.print(f"Validating pack: {pack_name}")


@app.command(
    rich_help_panel="🔍 Management"
)
def edit(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to edit")] = "active",
):
    """
    Opens the active or specified pack's schedule in an editor

    If no pack is specified, the active pack's schedule is opened.
    """

    # Check if pack_name was provided; if not, use the active pack
    if pack_name == "active":
        pack_name = ctx.obj.get("active")
    console.print("⛔ Not Implemented Yet")
    console.print(f"Editing pack: {pack_name}")


# Pack sharing and distribution
@app.command(
    no_args_is_help=True,
    epilog="""
    ✨ shorter alias available: [turquoise4]wallpy download[/]\n\n
    🌐 browse and download packs from [cyan link=https://wallpy.siphyshu.me/gallery]wallpy.siphyshu.me/gallery[/].
    """,
    rich_help_panel="🌐 Sharing & Distribution"
)
def download(
    ctx: typer.Context,
    uid: Annotated[str, typer.Argument(..., help="UID of the pack to download", show_default=False)]
):
    """Downloads a pack from the pack gallery using a pack's UID"""

    console.print("⛔ Not Implemented Yet")
    console.print(f"Downloading pack: {uid}")


@app.command(
    name="import",
    no_args_is_help=True,
    rich_help_panel="🌐 Sharing & Distribution"
)
def pack_import(
    ctx: typer.Context,
    location: Annotated[Path, typer.Argument(..., help="Location of the pack(s) to import", show_default=False)]
):
    """
    Imports pack(s) from the specified location into the global config

    If a directory is provided, all packs in the directory are imported.
    """

    console.print("⛔ Not Implemented Yet")
    console.print(f"Importing pack(s) from: {location}")


@app.command(
    no_args_is_help=True,
    rich_help_panel="🌐 Sharing & Distribution"
)
def remove(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to remove", show_default=False)]
):
    """Removes a pack from the global config"""
    
    console.print("⛔ Not Implemented Yet")
    console.print(f"Removing pack: {pack_name}")


@app.callback()
def callback(
    ctx: typer.Context
):
    """Manage wallpaper packs"""
    
    # Initialize the application state
    # state = get_app_state()
    # ctx.obj = state
    ctx.obj = {"active": "test-active-pack"}