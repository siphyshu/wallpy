""" 
Command group of pack-related commands for the wallpy-sensei CLI
"""

import typer
import random
import logging
import hashlib
from pathlib import Path
from rich.console import Console
from typing_extensions import Annotated

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine
from wallpy.validate import Validator

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
    ctx: typer.Context,
    search: Annotated[Path, typer.Argument(..., help="Search directory for packs", show_default=False, metavar="[PATH]")] = None
):
    """Lists all available wallpaper packs"""

    console.print("\n✨ Implemented", end="\n\n")

    config_manager = ctx.obj.get("config_manager")

    if search:
        # Search for packs in the specified directory
        console.print(f"🔍 Searching for packs in [bright_black]{Path(search).resolve()}[/]")
        results = config_manager.scan_directory(search)
    else:
        # Load all packs normally (from packs dir, common dirs, and custom configured)
        results = config_manager.load_packs()
    
    total_packs = sum(len(packs) for packs in results.values())

    # Print all packs
    if results:
        console.print(f"✨ Found [bold]{total_packs} packs[/]")
        for name, packs in results.items():
            for pack in packs:
                    console.print(f"    📦 {name} [cyan italic]{pack.uid}[/] [bright_black]({pack.path})[/]")
    else:
        console.print(f"⭕ Found [bold]{len(packs)}[/] packs")


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
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to activate", show_default=False)],
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to activate", show_default=False)
):
    """Activates the specified pack (makes it the default)"""

    console.print("\n✨ Implemented", end="\n\n")

    config_manager = ctx.obj.get("config_manager")

    # Load packs in the config manager
    results = config_manager.load_packs()
        
    # Check if the pack exists
    if pack_name not in results:
        console.print(f"🚫 Pack '{pack_name}' not found")

        # Find similar pack names
        available_packs = [pack for pack in results.keys() if pack.lower() != "default"]
        similar_packs = config_manager.find_similar_pack(pack_name, available_packs)

        if similar_packs and len(similar_packs) > 0:
            if len(similar_packs) == 1:
                console.print(f"🔍 Did you mean '{similar_packs[0]}'?")
            else:
                console.print(f"🔍 Did you mean one of these?")
                for pack in similar_packs:
                    console.print(f"    📦 {pack}")
        else:
            # Print 3 pack names randomly from the available packs
            console.print(f"🔍 Did you mean one of these?")
            random.shuffle(available_packs)
            for pack in available_packs[:3]:
                console.print(f"    📦 {pack}")
        
        # Suggest the user to list all packs
        console.print("\n✨ Use 'wallpy list' to view all available packs")
        return
    
    # If there are duplicate packs, ask the user to use the UID
    if len(results[pack_name]) > 1 and not pack_uid:
        console.print(f"🔍 Found 2 packs named '{pack_name}'")
        for pack in results[pack_name]:
            console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [bright_black]({pack.path})[/]")
        
        console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to activate the pack")
        # console.print(f"📋 wallpy activate [white]\"{pack_name}\"[/] --uid [PACK_ID]\n")
        return
        
    # Get the pack object from pack_name or UID
    if len(results[pack_name]) == 1:
        pack = results[pack_name][0]
    else:
        # Get the pack by UID
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    
    # Set the active pack in the config manager
    pack_saved = config_manager.set_active_pack(pack)
    if pack_saved:
        console.print(f"✅ Pack '{pack.name}' activated")
    else:
        console.print(f"🚫 Error activating pack '{pack.name}'")


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