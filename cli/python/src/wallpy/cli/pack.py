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
from rich.table import Table
from rich.box import ROUNDED
from rich.prompt import Confirm
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn
from datetime import datetime, timedelta
import shutil
from collections import defaultdict
from typing import Optional
import sys
import subprocess

from wallpy.config import ConfigManager, generate_uid
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine
from wallpy.validate import Validator
from wallpy.models import ScheduleType, Pack

console = Console()
app = typer.Typer(
    no_args_is_help=True,
    rich_markup_mode="rich",
    help="Manage wallpaper packs",
)


# Basic pack operations
@app.command(
    epilog="✨ shorter alias available: [turquoise4]wallpy list[/]",
    rich_help_panel="📋 View & List"
)
def list(
    ctx: typer.Context,
    search: Annotated[Path, typer.Argument(help="Search for packs in the specified directory", show_default=False, metavar="[PATH]")] = None,
    albums: bool = typer.Option(False, "--albums", "-a", help="Show only albums")
):
    """Lists all available packs"""

    config_manager = ctx.obj.get("config_manager")

    if albums:
        # Show only albums (directories in custom_wallpacks)
        if "custom_wallpacks" not in config_manager.config:
            console.print("🚫 No albums found")
            return

        total_albums = len(config_manager.config['custom_wallpacks'])
        console.print(f"✨ Found [bold]{total_albums} albums[/]")
        found_albums = False
        for album_name, album_path in config_manager.config["custom_wallpacks"].items():
            path = Path(album_path)
            if path.is_dir():
                # Count packs in this album
                album_packs = config_manager.scan_directory(path)
                if album_packs:
                    found_albums = True
                    pack_count = sum(len(packs) for packs in album_packs.values())
                    console.print(f"    📚 {album_name} [dim]({path})[/] - {pack_count} pack(s)")
        
        if not found_albums:
            console.print("🚫 No albums found")
        return

    if search:
        # Search for packs in the specified directory
        console.print(f"🔍 Searching for packs in '{search}'\n")
        results = config_manager.scan_directory(Path(search))
        if not results:
            console.print("🚫 No packs found")
            return
    else:
        # Load all packs (from packs dir, common dirs, and custom configured)
        results = config_manager.load_packs()

    total_packs = sum(len(packs) for packs in results.values())
    
    # Show all packs
    if results:
        console.print(f"✨ Found [bold]{total_packs} packs[/]")
        for name, packs in results.items():
            for pack in packs:
                console.print(f"    📦 {name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
    else:
        console.print("🚫 No packs found")


@app.command(
    rich_help_panel="📋 View & List"
)
def info(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(help="Name of the pack to show info for")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to show info for", show_default=False)
):
    """
    Shows detailed information about a pack.
    
    If no pack is specified, shows info for the active pack.
    """

    config_manager = ctx.obj.get("config_manager")
    schedule_manager = ctx.obj.get("schedule_manager")

    # If UID is provided, try to get pack by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    else:
        # Check if pack_name was provided; if not, use the active pack
        if pack_name == "active":
            active_pack = ctx.obj.get("active")
            if not active_pack:
                console.print("[yellow]No active pack set[/]")
                return
            # Get the pack by its UID to ensure we get the correct instance
            pack = config_manager.get_pack_by_uid(active_pack.uid)
            if not pack:
                console.print(f"🚫 Active pack with UID '{active_pack.uid}' not found")
                return
        else:
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

            # If there are multiple packs with the same name, ask for UID
            if len(results[pack_name]) > 1:
                console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
                for pack in results[pack_name]:
                    console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
                
                console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to show info")
                return

            # Get the pack object
            pack = results[pack_name][0]

    try:
        # Load schedule
        schedule_data = schedule_manager.load_schedule(pack.path / "schedule.toml")

        # Print pack metadata
        author_str = f"by {schedule_data.meta.author}" if schedule_data.meta.author else ""
        console.print(f"📦 [bold]{schedule_data.meta.name}[/] [cyan italic]{pack.uid}[/] [dim italic]{author_str}[/]")
        console.print(f"📁 [dim]{pack.path}[/]\n")

        # Print schedule type
        schedule_type = "Timeblocks" if schedule_data.meta.type == ScheduleType.TIMEBLOCKS else "Days"
        console.print(f"📅 Schedule Type: [bold]{schedule_type}[/]")

        # Count total images
        total_images = 0
        if schedule_data.meta.type == ScheduleType.TIMEBLOCKS:
            for block in schedule_data.timeblocks.values():
                total_images += len(block.images)
        else:
            for day in schedule_data.days.values():
                total_images += len(day.images)
        console.print(f"🖼️ Total Images: [bold]{total_images}[/]")

        # Print schedule details
        if schedule_data.meta.type == ScheduleType.TIMEBLOCKS:
            console.print(f"\n⏰ Timeblocks: [bold]{len(schedule_data.timeblocks)}[/]")
            for block_name, block in schedule_data.timeblocks.items():
                console.print(f"  • {block_name}: {len(block.images)} images")
                if block.shuffle:
                    console.print("    [dim]🔄 Shuffled[/]")
        else:
            console.print(f"\n📅 Days: [bold]{len(schedule_data.days)}[/]")
            for day, day_schedule in schedule_data.days.items():
                console.print(f"  • {day.capitalize()}: {len(day_schedule.images)} images")
                if day_schedule.shuffle:
                    console.print("    [dim]🔄 Shuffled[/]")

        # Show if this is the active pack
        active_pack = ctx.obj.get("active")
        if active_pack and active_pack.uid == pack.uid:
            console.print("\n✨ [green]This is the active pack[/]")

    except Exception as e:
        console.print(f"[red]Error:[/] {str(e)}")


@app.command(
    epilog="✨ shorter alias available: [turquoise4]wallpy preview[/]",
    rich_help_panel="📋 View & List"
)
def preview(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(help="Name of the pack to preview")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to preview", show_default=False)
):
    """
    Previews schedule and wallpapers from the specified pack.  
    
    If no pack is specified, the active pack is previewed.
    """

    config_manager = ctx.obj.get("config_manager")
    schedule_manager = ctx.obj.get("schedule_manager")

    # If UID is provided, try to get pack by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    else:
        # Check if pack_name was provided; if not, use the active pack
        if pack_name == "active":
            active_pack = ctx.obj.get("active")
            if not active_pack:
                console.print("[yellow]No active pack set[/]")
                return
            # Get the pack by its UID to ensure we get the correct instance
            pack = config_manager.get_pack_by_uid(active_pack.uid)
            if not pack:
                console.print(f"🚫 Active pack with UID '{active_pack.uid}' not found")
                return
        else:
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

            # If there are multiple packs with the same name, ask for UID
            if len(results[pack_name]) > 1:
                console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
                for pack in results[pack_name]:
                    console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
                
                console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to preview the pack")
                return

            # Get the pack object
            pack = results[pack_name][0]
    
    try:
        # Load schedule
        schedule_data = schedule_manager.load_schedule(pack.path / "schedule.toml")

        # Print pack metadata
        pack_author = f"[dim italic]by {schedule_data.meta.author}[/]" if schedule_data.meta.author else ""
        console.print(f"📦 {schedule_data.meta.name} [cyan italic]{pack.uid}[/] {pack_author}")
        console.print(f"📁 [dim]{pack.path}[/]\n")
        
        # Create table for schedule preview
        table = Table(
            header_style="bold",
            box=ROUNDED,
            show_header=True,
            border_style="dim"
        )
        
        if schedule_data.meta.type == ScheduleType.TIMEBLOCKS:
            table.add_column("Timeblock", style="cyan", justify="left")
            table.add_column("Time Range", style="dim", justify="left")
            table.add_column("Images", style="yellow", justify="left")
            table.add_column("Settings", style="dim", justify="left")
            
            # Get location for resolving solar times
            location = config_manager.get_location()
            
            # Add each timeblock to the table
            for block in schedule_data.timeblocks.values():
                # Resolve start and end times
                resolved_start = schedule_manager.solar_calculator.resolve_datetime(
                    block.start, 
                    datetime.now().date(), 
                    location
                )
                resolved_end = schedule_manager.solar_calculator.resolve_datetime(
                    block.end, 
                    datetime.now().date(), 
                    location
                )
                
                # Format time range
                time_range = f"{resolved_start.strftime('%H:%M %p')} - {resolved_end.strftime('%H:%M %p')}"
                if resolved_start.strftime('%H:%M') != block.start or resolved_end.strftime('%H:%M') != block.end:
                    time_range += f" [dim]({block.start} → {block.end})[/]"
                
                # Format images list
                images = ", ".join(str(img) for img in block.images)
                if len(block.images) > 3:
                    images = f"{block.images[0]}, {block.images[1]}, ... +{len(block.images)-2} more"
                
                # Format settings
                settings = []
                if block.shuffle:
                    settings.append("🔄 shuffled")
                
                # Add row to table
                table.add_row(
                    block.name,
                    time_range,
                    images,
                    " | ".join(settings) if settings else "-"
                )
        else:  # Days-based schedule
            table.add_column("Day", style="cyan", justify="left")
            table.add_column("Images", style="yellow", justify="left")
            table.add_column("Settings", style="dim", justify="left")
            
            # Add each day to the table
            for day, day_schedule in schedule_data.days.items():
                # Format images list
                images = ", ".join(str(img) for img in day_schedule.images)
                if len(day_schedule.images) > 3:
                    images = f"{day_schedule.images[0]}, {day_schedule.images[1]}, ... +{len(day_schedule.images)-2} more"
                
                # Format settings
                settings = []
                if day_schedule.shuffle:
                    settings.append("🔄 shuffled")
                
                # Add row to table
                table.add_row(
                    day.capitalize(),
                    images,
                    " | ".join(settings) if settings else "-"
                )
        
        # Print the table
        console.print(table)

        # Get current time
        now = datetime.now()
        
        # Show current and next timeblock/day
        if schedule_data.meta.type == ScheduleType.TIMEBLOCKS:
            # Get current timeblock
            current_block = schedule_manager.get_block(schedule_data, location)
            
            if current_block:
                console.print(f"\n✨ [green]{current_block.name}[/] timeblock is active currently")

                if current_block.shuffle:
                    # Format images list
                    images = ", ".join(str(img) for img in current_block.images)
                    if len(current_block.images) > 3:
                        images = f"{current_block.images[0]}, {current_block.images[1]}, ... +{len(current_block.images)-2} more"

                    console.print(f"✅ current wallpaper is shuffled from [yellow]{images}[/]")
                
                else:
                    # Get current wallpaper info
                    current_result = schedule_manager.get_wallpaper(schedule_data, location, include_time=True)
                    if current_result and current_result[0]:
                        current_image, current_start, current_end = current_result
                        
                        # Get next wallpaper to calculate effective duration
                        next_result = schedule_manager.get_wallpaper(schedule_data, location, include_time=True, get_next=True)
                        if next_result and next_result[0]:
                            next_image, next_start, next_end = next_result
                            # If there's a gap between current end and next start, use next start as effective end
                            if next_start > current_end:
                                current_end = next_start
                        
                        console.print(f"✅ [green]{current_image}[/] is the current wallpaper [dim]({current_start.strftime('%H:%M %p')} - {current_end.strftime('%H:%M %p')})[/]")
                    else:
                        console.print("⚠️ [yellow]No current wallpaper[/]")

                # Get next wallpaper info
                next_result = schedule_manager.get_wallpaper(schedule_data, location, include_time=True, get_next=True)
                if next_result and next_result[0]:
                    next_image, next_start, next_end = next_result
                    
                    # Get the wallpaper after next to calculate effective duration
                    next_next_result = schedule_manager.get_wallpaper(schedule_data, location, include_time=True, get_next=True)
                    if next_next_result and next_next_result[0]:
                        next_next_image, next_next_start, next_next_end = next_next_result
                        # If there's a gap between next end and next-next start, use next-next start as effective end
                        if next_next_start > next_end:
                            next_end = next_next_start
                    
                    # Check if next wallpaper will be from current or next block
                    now = datetime.now()
                    if current_block:
                        # Calculate time remaining in current block
                        start, end, image_duration = schedule_manager._get_block_times(current_block, now.date(), location)
                        time_remaining = (end - now).total_seconds()
                        
                        # If there's enough time for another image in current block
                        if time_remaining >= image_duration:
                            # Next wallpaper will be from current block
                            if current_block.shuffle:
                                # Format images list
                                images = ", ".join(str(img) for img in current_block.images)
                                if len(current_block.images) > 3:
                                    images = f"{current_block.images[0]}, {current_block.images[1]}, ... +{len(current_block.images)-2} more"
                                console.print(f"🔀 next wallpaper will be shuffled from current timeblock [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                            else:
                                console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                        else:
                            # Next wallpaper will be from next block
                            next_block = schedule_manager.get_block(schedule_data, location, get_next=True)
                            if next_block and next_block.shuffle:
                                # Format images list
                                images = ", ".join(str(img) for img in next_block.images)
                                if len(next_block.images) > 3:
                                    images = f"{next_block.images[0]}, {next_block.images[1]}, ... +{len(next_block.images)-2} more"
                                console.print(f"🔀 next wallpaper will be shuffled from [yellow]{next_block.name}[/] [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                            else:
                                console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                else:
                    console.print("⚠️ [yellow]No next wallpaper[/]")
            else:
                console.print("\n⚠️ [yellow]No active timeblock[/]")
                
        elif schedule_data.meta.type == ScheduleType.DAYS:  
            # Get current wallpaper info
            current_result = schedule_manager.get_wallpaper(schedule_data, include_time=True)
            if current_result and current_result[0]:
                current_image, current_start, current_end = current_result
                
                # Get current day's schedule
                current_day = now.strftime("%A").lower()
                if current_day in schedule_data.days:
                    day_schedule = schedule_data.days[current_day]
                    
                    if day_schedule.shuffle:
                        # Format images list
                        images = ", ".join(str(img) for img in day_schedule.images)
                        if len(day_schedule.images) > 3:
                            images = f"{day_schedule.images[0]}, {day_schedule.images[1]}, ... +{len(day_schedule.images)-2} more"
                        console.print(f"\n✅ current wallpaper is shuffled from [yellow]{images}[/]")
                    else:
                        console.print(f"\n✅ [green]{current_image}[/] is the current wallpaper [dim]({current_start.strftime('%H:%M %p')} - {current_end.strftime('%H:%M %p')})[/]")
                else:
                    console.print(f"\n✅ [green]{current_image}[/] is the current wallpaper [dim]({current_start.strftime('%H:%M %p')} - {current_end.strftime('%H:%M %p')})[/]")
            else:
                console.print("\n⚠️ [yellow]No current wallpaper[/]")

            # Get next wallpaper info
            next_result = schedule_manager.get_wallpaper(schedule_data, include_time=True, get_next=True)
            if next_result and next_result[0]:
                next_image, next_start, next_end = next_result
                
                # Get current day's schedule for display purposes
                current_day = now.strftime("%A").lower()
                if current_day in schedule_data.days:
                    day_schedule = schedule_data.days[current_day]
                    
                    if day_schedule.shuffle:
                        # Format images list
                        images = ", ".join(str(img) for img in day_schedule.images)
                        if len(day_schedule.images) > 3:
                            images = f"{day_schedule.images[0]}, {day_schedule.images[1]}, ... +{len(day_schedule.images)-2} more"
                        console.print(f"🔀 next wallpaper will be shuffled from [yellow]{current_day}[/] [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                    else:
                        # For non-shuffled days, check if next image is from current day
                        if next_image in day_schedule.images:
                            console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                        else:
                            # Next image is from next day
                            next_day = (now + timedelta(days=1)).strftime("%A").lower()
                            if next_day in schedule_data.days:
                                next_day_schedule = schedule_data.days[next_day]
                                
                                if next_day_schedule.shuffle:
                                    # Format images list
                                    images = ", ".join(str(img) for img in next_day_schedule.images)
                                    if len(next_day_schedule.images) > 3:
                                        images = f"{next_day_schedule.images[0]}, {next_day_schedule.images[1]}, ... +{len(next_day_schedule.images)-2} more"
                                    console.print(f"🔀 next wallpaper will be shuffled from [yellow]{next_day}[/] [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                                else:
                                    console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                            else:
                                console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                else:
                    # If current day has no schedule, next wallpaper is from next day
                    next_day = (now + timedelta(days=1)).strftime("%A").lower()
                    if next_day in schedule_data.days:
                        next_day_schedule = schedule_data.days[next_day]
                        
                        if next_day_schedule.shuffle:
                            # Format images list
                            images = ", ".join(str(img) for img in next_day_schedule.images)
                            if len(next_day_schedule.images) > 3:
                                images = f"{next_day_schedule.images[0]}, {next_day_schedule.images[1]}, ... +{len(next_day_schedule.images)-2} more"
                            console.print(f"🔀 next wallpaper will be shuffled from [yellow]{next_day}[/] [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                        else:
                            console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
                    else:
                        console.print(f"⏭️ [yellow]{next_image}[/] will be the next wallpaper [dim]({next_start.strftime('%H:%M %p')} - {next_end.strftime('%H:%M %p')})[/]")
            else:
                console.print("⚠️ [yellow]No next wallpaper[/]")
        
    except Exception as e:
        console.print(f"[red]Error:[/] {str(e)}")


@app.command(
    rich_help_panel="🔄 Manage"
)
def new(
    ctx: typer.Context
):
    """Creates a new pack using the pack creation wizard"""

    console.print("\n⛔ Not Implemented Yet", end="\n\n")


@app.command(
    no_args_is_help=True,
    epilog="✨ shorter alias available: [turquoise4]wallpy activate[/]",
    rich_help_panel="🔄 Manage"
)
def activate(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to activate", show_default=False)] = None,
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to activate", show_default=False)
):
    """Activates the specified pack (makes it the default)"""

    config_manager = ctx.obj.get("config_manager")
    schedule_manager = ctx.obj.get("schedule_manager")
    engine = ctx.obj.get("engine")

    # Load packs in the config manager
    results = config_manager.load_packs()
    
    # If UID is provided, try to activate by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if pack:
            pack_saved = config_manager.set_active_pack(pack)
            if pack_saved:
                console.print(f"✅ Pack '{pack.name}' activated")
                # Trigger immediate wallpaper change
                # console.print("\n🔄 Changing wallpaper...")
                try:
                    # Get the current wallpaper path
                    schedule_file = pack.path / "schedule.toml"
                    if not schedule_file.exists():
                        console.print(f"⚠️ Schedule file not found at {schedule_file}")
                        return
                        
                    schedule = schedule_manager.load_schedule(schedule_file)
                    wallpaper_path = schedule_manager.get_wallpaper(schedule, config_manager.get_location())
                    
                    if not wallpaper_path:
                        console.print("⚠️ No suitable wallpaper found in schedule")
                        return
                        
                    # Resolve the path relative to pack directory if needed
                    if not wallpaper_path.is_absolute():
                        wallpaper_path = (pack.path / "images" / wallpaper_path).resolve()
                        
                    # Change the wallpaper
                    success = engine.set_wallpaper(wallpaper_path)
                    # if success:
                    #     console.print("✅ Wallpaper changed successfully")
                    # else:
                    #     console.print("⚠️ Failed to change wallpaper")
                except Exception as e:
                    console.print(f"⚠️ Error changing wallpaper: {e}")
            else:
                console.print(f"🚫 Error activating pack '{pack.name}'")
            return
        else:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    
    # If no UID provided, require pack_name
    if not pack_name:
        console.print("🚫 Please provide either a pack name or UID")
        return
        
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
    if len(results[pack_name]) > 1:
        console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
        for pack in results[pack_name]:
            console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
        
        console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to activate the pack")
        return
        
    # Get the pack object from pack_name
    pack = results[pack_name][0]
    
    # Set the active pack in the config manager
    pack_saved = config_manager.set_active_pack(pack)
    if pack_saved:
        console.print(f"✅ Pack '{pack.name}' activated")
        # Trigger immediate wallpaper change
        # console.print("\n🔄 Changing wallpaper...")
        try:
            # Get the current wallpaper path
            schedule_file = pack.path / "schedule.toml"
            if not schedule_file.exists():
                console.print(f"⚠️ Schedule file not found at {schedule_file}")
                return
                
            schedule = schedule_manager.load_schedule(schedule_file)
            wallpaper_path = schedule_manager.get_wallpaper(schedule, config_manager.get_location())
            
            if not wallpaper_path:
                console.print("⚠️ No suitable wallpaper found in schedule")
                return
                
            # Resolve the path relative to pack directory if needed
            if not wallpaper_path.is_absolute():
                wallpaper_path = (pack.path / "images" / wallpaper_path).resolve()
                
            # Change the wallpaper
            success = engine.set_wallpaper(wallpaper_path)
            # if success:
            #     console.print("✅ Wallpaper changed successfully")
            # else:
            #     console.print("⚠️ Failed to change wallpaper")
        except Exception as e:
            console.print(f"⚠️ Error changing wallpaper: {e}")
    else:
        console.print(f"🚫 Error activating pack '{pack.name}'")


@app.command(
    rich_help_panel="🔄 Manage"
)
def validate(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to validate")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to validate", show_default=False)
):
    """
    Validates the active or specified pack (checks schedule, meta, etc.)

    If no pack is specified, the active pack is validated.
    """

    config_manager = ctx.obj.get("config_manager")
    validator = ctx.obj.get("validator")

    # If UID is provided, try to get pack by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    else:
        # Check if pack_name was provided; if not, use the active pack
        if pack_name == "active":
            active_pack = ctx.obj.get("active")
            if not active_pack:
                console.print("[yellow]No active pack set[/]")
                return
            # Get the pack by its UID to ensure we get the correct instance
            pack = config_manager.get_pack_by_uid(active_pack.uid)
            if not pack:
                console.print(f"🚫 Active pack with UID '{active_pack.uid}' not found")
                return
        else:
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

            # If there are multiple packs with the same name, ask for UID
            if len(results[pack_name]) > 1:
                console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
                for pack in results[pack_name]:
                    console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
                
                console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to validate the pack")
                return

            # Get the pack object
            pack = results[pack_name][0]

    # Validate the pack
    result = validator.validate_pack(pack)
    
    # Print validation results
    console.print(f"🔍 Running validation tests for pack '{pack.name}'...")
    
    # Print test categories with status
    console.print("\n📋 Validation Tests:")
    for test_id, test_info in validator.test_results.items():
        status_icon = "✅" if test_info["status"] == "passed" else "❌" if test_info["status"] == "failed" else "⏳"
        console.print(f"  {status_icon} {test_info['message']}")
    
    if result.passed:
        console.print(f"\n✅ Pack '{pack.name}' is valid")
        
        # Show warnings if any
        if result.warnings:
            console.print("\n⚠️ [yellow]Warnings:[/]")
            for check, messages in result.warnings.items():
                for message in messages:
                    console.print(f"  • {message}")
    else:
        console.print(f"\n🚫 [red]Errors:[/]")
        for check, messages in result.errors.items():
            for message in messages:
                console.print(f"  • {message}")
        
        # Show warnings if any
        if result.warnings:
            console.print("\n⚠️ [yellow]Warnings:[/]")
            for check, messages in result.warnings.items():
                for message in messages:
                    console.print(f"  • {message}")


@app.command(
    rich_help_panel="🔄 Manage"
)
def edit(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to edit")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to edit", show_default=False)
):
    """
    Opens the active or specified pack's schedule in an editor

    If no pack is specified, the active pack's schedule is opened.
    """

    config_manager = ctx.obj.get("config_manager")

    # If UID is provided, try to get pack by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    else:
        # If pack_name is "active", get the active pack
        if pack_name == "active":
            active_pack = ctx.obj.get("active")
            if not active_pack:
                console.print("[yellow]No active pack set[/]")
                return
            # Get the pack by its UID to ensure we get the correct instance
            pack = config_manager.get_pack_by_uid(active_pack.uid)
            if not pack:
                console.print(f"🚫 Active pack with UID '{active_pack.uid}' not found")
                return
        else:
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

            # If there are multiple packs with the same name, ask for UID
            if len(results[pack_name]) > 1:
                console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
                for pack in results[pack_name]:
                    console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
                
                console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to edit the pack")
                return

            # Get the pack object
            pack = results[pack_name][0]

    # Get the schedule file path
    schedule_file = pack.path / "schedule.toml"
    if not schedule_file.exists():
        console.print(f"🚫 Schedule file not found at {schedule_file}")
        return

    # Open the schedule file in the default editor
    try:
        import subprocess
        import os
        import platform

        # Get the default editor based on the platform
        if platform.system() == "Windows":
            os.startfile(str(schedule_file))
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(["open", str(schedule_file)])
        else:  # Linux and others
            subprocess.run(["xdg-open", str(schedule_file)])

        console.print(f"✅ Opening schedule file for [yellow]{pack.name}[/]")
        console.print(f"📂 [dim]{schedule_file}[/]")
    except Exception as e:
        console.print(f"🚫 Error opening schedule file: {str(e)}")


# Pack sharing and distribution
@app.command(
    no_args_is_help=True,
    epilog="""
    ✨ shorter alias available: [turquoise4]wallpy download[/]\n\n
    🌐 browse and download packs from [cyan link=https://wallpy.siphyshu.me/gallery]wallpy.siphyshu.me/gallery[/].
    """,
    rich_help_panel="🌐 Import & Export"
)
def download(
    ctx: typer.Context,
    url: Annotated[str, typer.Argument(..., help="URL of the pack to download", show_default=False)],
    location: Annotated[Path, typer.Option(..., "--location", "-l", help="Location to save the pack", show_default=False)] = None
):
    """Downloads a pack from the pack gallery using a pack's URL"""

    config_manager = ctx.obj.get("config_manager")
    validator = ctx.obj.get("validator")
    schedule_manager = ctx.obj.get("schedule_manager")

    # Validate URL
    # if not url.startswith("https://wallpy.siphyshu.me/"):
    #     console.print("🚫 Invalid URL. Only wallpy.siphyshu.me URLs are supported")
    #     return

    try:
        import requests
        import tempfile
        import zipfile
        from urllib.parse import urlparse, unquote

        # Create a temporary directory for downloading and extracting
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)
            
            # Download the ZIP file
            console.print(f"\n📥 Downloading pack from {url}...")
            response = requests.get(url, stream=True)
            response.raise_for_status()

            # Get total file size
            total_size = int(response.headers.get('content-length', 0))
            
            # Get filename from Content-Disposition header
            content_disposition = response.headers.get('content-disposition')
            if content_disposition:
                import re
                filename_match = re.search(r'filename="(.+?)"', content_disposition)
                if filename_match:
                    filename = filename_match.group(1)
                else:
                    filename = "pack.zip"
            else:
                filename = "pack.zip"

            # Save the ZIP file with progress bar
            zip_path = temp_dir_path / filename
            with open(zip_path, "wb") as f:
                with Progress(
                    SpinnerColumn(),
                    TextColumn("[progress.description]{task.description}"),
                    BarColumn(),
                    TaskProgressColumn(),
                    TimeRemainingColumn(),
                    console=console
                ) as progress:
                    task = progress.add_task(f"{filename}...", total=total_size)
                    
                    for chunk in response.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                            progress.update(task, advance=len(chunk))

            # Extract the ZIP file
            console.print("\n📦 Extracting pack...")
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(temp_dir_path)

            # Find the pack directory (should be the only directory in temp_dir)
            pack_dirs = [d for d in temp_dir_path.iterdir() if d.is_dir()]
            if not pack_dirs:
                console.print("\n🚫 No pack directory found in ZIP file")
                return

            pack_dir = pack_dirs[0]

            # Run validation and show errors
            result = validator.validate_pack(Pack(name=pack_dir.name, path=pack_dir, uid=generate_uid(str(pack_dir))))
            if not result.passed:
                console.print("\n🚫 The pack is invalid, the following errors were found:")
                for check, messages in result.errors.items():
                    for message in messages:
                        console.print(f"  • {message}")
                console.print("⚠️ The pack may not work as expected, fix the errors before using it\n")


            # Determine pack name
            if not result.passed and ("schedule_missing" in result.errors.keys() or "schedule_invalid" in result.errors.keys()):
                pack_name = pack_dir.name
            else:
                # Use pack name from schedule.toml
                try:
                    schedule_file = pack_dir / "schedule.toml"
                    schedule = schedule_manager.load_schedule(schedule_file)
                    pack_name = schedule.meta.name
                except:
                    pack_name = pack_dir.name

            # Determine destination path
            if location:
                dest_path = location.expanduser().resolve() / pack_name
            else:
                dest_path = config_manager.packs_dir / pack_name

            # If destination exists, add a number suffix
            if dest_path.exists():
                counter = 1
                original_dest = dest_path
                while dest_path.exists():
                    dest_path = original_dest.parent / f"{original_dest.name} ({counter})"
                    counter += 1

            # Copy the pack to destination
            console.print(f"📋 Copying pack...")
            shutil.copytree(pack_dir, dest_path)

            console.print(f"\n✅ Successfully downloaded and installed pack to [dim]{dest_path}[/]")

    except requests.exceptions.RequestException as e:
        console.print(f"\n🚫 Error downloading pack: {str(e)}")
    except zipfile.BadZipFile:
        console.print("\n🚫 There was an error, please try again.")


@app.command(
    name="import",
    no_args_is_help=True,
    rich_help_panel="🌐 Import & Export"
)
def pack_import(
    ctx: typer.Context,
    location: Annotated[Path, typer.Argument(..., help="Location of the pack(s) to import", show_default=False)],
    copy: bool = typer.Option(False, "--copy", "-c", help="Copy pack(s) to wallpy packs directory instead of adding to config"),
    album: bool = typer.Option(False, "--album", help="Treat the location as an album (folder of packs) in config"),
    album_name: str = typer.Option(None, "--name", "-n", help="Name for the album (defaults to folder name)")
):
    """
    Imports pack(s) from the specified location into the global config

    If a directory is provided, all packs in the directory are imported.
    Use --copy to copy the pack(s) to the wallpy packs directory instead of adding to config.
    Use --album to add the entire directory as an album in the config.
    Use --name to specify a custom name for the album.
    """

    config_manager = ctx.obj.get("config_manager")
    validator = ctx.obj.get("validator")

    # Check if location exists
    if not location.exists():
        console.print(f"🚫 Location '{location}' does not exist")
        return

    # If location is a directory, check if it contains multiple packs
    if location.is_dir():
        packs = config_manager.scan_directory(location)
        is_album = len(packs) > 1

        # If it looks like an album but --album wasn't specified, ask the user
        if is_album and not album and not copy:
            console.print(f"🔍 Found multiple packs in '{location.name}':")
            for pack_name, pack_list in packs.items():
                for pack in pack_list:
                    console.print(f"    • {pack.name} [cyan italic]{pack.uid}[/]")
            
            if Confirm.ask("\nWould you like to import this as an album?"):
                album = True
                if not album_name:
                    album_name = location.name
                    if Confirm.ask(f"Use '{album_name}' as the album name?"):
                        pass
                    else:
                        album_name = typer.prompt("Enter album name", default=location.name)
                        console.print("")
            else:
                # User chose not to import as album, proceed with individual pack import
                pass
        elif is_album and copy:
            # If copy flag is enabled and we found multiple packs, ask about copying all
            console.print(f"🔍 Found {sum(len(packs) for packs in packs.values())} packs in '{location.name}':")
            for pack_name, pack_list in packs.items():
                for pack in pack_list:
                    console.print(f"    • {pack.name} [cyan italic]{pack.uid}[/]")
            
            if not Confirm.ask("\nWould you like to copy all packs?"):
                return
            
            console.print("")

    # Handle album import
    if album:
        if not location.is_dir():
            console.print(f"🚫 '{location}' is not a directory. Albums must be directories.")
            return

        # Use provided name or folder name
        album_name = album_name or location.name

        try:
            # Add album to config
            if "custom_wallpacks" not in config_manager.config:
                config_manager.config["custom_wallpacks"] = {}

            # Use relative path if possible
            try:
                rel_path = location.relative_to(config_manager.config_dir)
                config_manager.config["custom_wallpacks"][album_name] = str(rel_path)
            except ValueError:
                # If not possible to make relative, use absolute path
                config_manager.config["custom_wallpacks"][album_name] = str(location)

            # Save config
            config_manager._save_config(config_manager.config)

            console.print(f"✅ Added album '{album_name}' to config [dim]({location})[/]")
            return
        except Exception as e:
            console.print(f"🚫 Error importing album '{album_name}': {str(e)}")
            return

    # Handle individual pack import
    if location.is_dir():
        # If it's a directory, scan for packs
        packs = config_manager.scan_directory(location)
    else:
        # If it's a single file/directory, check if it's a pack
        if validator.is_pack(location):
            pack = Pack(
                name=location.name,
                path=location.resolve(),
                uid=generate_uid(str(location.resolve()))
            )
            packs = defaultdict(list)
            packs[location.name].append(pack)
        else:
            console.print(f"🚫 '{location}' is not a valid wallpaper pack")
            return

    if not packs:
        console.print(f"🚫 No valid packs found in '{location}'")
        return

    # Process each pack
    imported_count = 0

    for pack_name, pack_list in packs.items():
        for pack in pack_list:
            try:
                if copy:
                    # Copy pack to wallpy packs directory
                    dest_path = config_manager.packs_dir / pack.name
                    
                    # If pack already exists, add a number suffix
                    counter = 1
                    while dest_path.exists():
                        dest_path = config_manager.packs_dir / f"{pack.name}_{counter}"
                        counter += 1
                    
                    # Copy the pack
                    shutil.copytree(pack.path, dest_path)
                    
                    # Create new pack object with new path
                    new_pack = Pack(
                        name=dest_path.name,
                        path=dest_path,
                        uid=generate_uid(str(dest_path))
                    )
                    
                    console.print(f"✅ Copied pack '{pack.name}' to [dim]{dest_path}[/]")
                    imported_count += 1
                else:
                    # Add pack to custom paths in config
                    if "custom_wallpacks" not in config_manager.config:
                        config_manager.config["custom_wallpacks"] = {}

                    # Use relative path if possible
                    try:
                        rel_path = pack.path.relative_to(config_manager.config_dir)
                        config_manager.config["custom_wallpacks"][pack.name] = str(rel_path)
                    except ValueError:
                        # If not possible to make relative, use absolute path
                        config_manager.config["custom_wallpacks"][pack.name] = str(pack.path)
                    
                    # Save config
                    config_manager._save_config(config_manager.config)
                    
                    console.print(f"✅ Added pack '{pack.name}' to config [dim]({pack.path})[/]")
                    imported_count += 1
            except Exception as e:
                console.print(f"🚫 Error importing pack '{pack.name}': {str(e)}")

    if imported_count > 0:
        console.print(f"\n✨ Successfully imported {imported_count} pack(s)")
    else:
        console.print("\n🚫 No packs were imported")


@app.command(
    no_args_is_help=True,
    rich_help_panel="🌐 Import & Export"
)
def remove(
    ctx: typer.Context,
    name: Annotated[str, typer.Argument(..., help="Name of the pack or album to remove", show_default=False)],
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to remove", show_default=False),
    force: bool = typer.Option(False, "--force", "-f", help="Force removal without confirmation")
):
    """
    Removes a pack or album from the global config.
    
    If the pack is in the wallpy packs directory, it will be deleted.
    If the pack is referenced from another location, it will only be removed from the config.
    """

    config_manager = ctx.obj.get("config_manager")

    # Check if it's an album first (directory in custom_wallpacks)
    if "custom_wallpacks" in config_manager.config and name in config_manager.config["custom_wallpacks"]:
        album_path = Path(config_manager.config["custom_wallpacks"][name])
        if album_path.is_dir():
            # Confirm album removal
            if not force:
                if not Confirm.ask(f"Are you sure you want to remove album '{name}'?"):
                    return
                else:
                    console.print("")

            try:
                # Remove album from config
                del config_manager.config["custom_wallpacks"][name]
                config_manager._save_config(config_manager.config)
                console.print(f"✅ Removed album '{name}' from config")
                return
            except Exception as e:
                console.print(f"🚫 Error removing album '{name}': {str(e)}")
                return

    # Load all packs
    packs = config_manager.load_packs()

    # If UID is provided, try to remove by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
        
        # Check if it's the active pack
        active_pack = ctx.obj.get("active")
        if active_pack and active_pack.uid == pack_uid:
            console.print(f"🚫 Cannot remove active pack '{pack.name}'")
            return

        # Check if the pack is in the wallpy packs directory
        is_in_packs_dir = pack.path.is_relative_to(config_manager.packs_dir)
        
        # Check if pack is directly in custom_wallpacks
        is_direct_pack = False
        if "custom_wallpacks" in config_manager.config:
            custom_wallpacks = dict(config_manager.config["custom_wallpacks"])
            for pack_name, path in custom_wallpacks.items():
                if Path(path).resolve() == pack.path:
                    is_direct_pack = True
                    break

        # If pack is not directly in custom_wallpacks and not in packs_dir, it's part of an album
        if not is_direct_pack and not is_in_packs_dir:
            console.print(f"🚫 Cannot remove pack '{pack.name}' as it is part of an album")
            console.print("✨ To remove this pack, remove the album it belongs to")
            return
        
        # Confirm removal
        if not force:
            if is_in_packs_dir:
                if not Confirm.ask(f"Are you sure you want to remove and delete pack '{pack.name}'?"):
                    return
            else:
                if not Confirm.ask(f"Are you sure you want to remove pack '{pack.name}' from config?"):
                    return
                else:
                    console.print("")

        try:
            # Remove from config if it's a direct pack
            if is_direct_pack:
                custom_wallpacks = dict(config_manager.config["custom_wallpacks"])
                for pack_name, path in custom_wallpacks.items():
                    if Path(path).resolve() == pack.path:
                        del config_manager.config["custom_wallpacks"][pack_name]
                        break

            # If in packs directory, delete the pack
            if is_in_packs_dir:
                shutil.rmtree(pack.path)
                console.print(f"\n✅ Removed and deleted pack '{pack.name}'")
            else:
                console.print(f"✅ Removed pack '{pack.name}' from config")

            # Save config
            config_manager._save_config(config_manager.config)
            return
        except Exception as e:
            console.print(f"🚫 Error removing pack '{pack.name}': {str(e)}")
            return

    # If no UID provided, check if it's a pack or album name
    if name not in packs:
        console.print(f"🚫 Pack or album '{name}' not found")

        # Find similar names
        available_names = list(packs.keys())
        similar_names = config_manager.find_similar_pack(name, available_names)

        if similar_names and len(similar_names) > 0:
            if len(similar_names) == 1:
                console.print(f"🔍 Did you mean '{similar_names[0]}'?")
            else:
                console.print(f"🔍 Did you mean one of these?")
                for pack_name in similar_names:
                    console.print(f"    📦 {pack_name}")
        else:
            # Print 3 names randomly from the available packs
            console.print(f"🔍 Did you mean one of these?")
            random.shuffle(available_names)
            for pack_name in available_names[:3]:
                console.print(f"    📦 {pack_name}")
        
        # Suggest the user to list all packs
        console.print("\n✨ Use 'wallpy list' to view all available packs")
        return

    # If there are multiple packs with the same name, ask for UID
    if len(packs[name]) > 1:
        console.print(f"🔍 Found {len(packs[name])} packs named '{name}'")
        for pack in packs[name]:
            console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
        
        console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to remove the pack")
        return

    # Get the pack object
    pack = packs[name][0]

    # Check if it's the active pack
    active_pack = ctx.obj.get("active")
    if active_pack and active_pack.uid == pack.uid:
        console.print(f"🚫 Cannot remove active pack '{pack.name}'")
        return

    # Check if the pack is in the wallpy packs directory
    is_in_packs_dir = pack.path.is_relative_to(config_manager.packs_dir)
    
    # Check if pack is directly in custom_wallpacks
    is_direct_pack = False
    if "custom_wallpacks" in config_manager.config:
        custom_wallpacks = dict(config_manager.config["custom_wallpacks"])
        for pack_name, path in custom_wallpacks.items():
            if Path(path).resolve() == pack.path:
                is_direct_pack = True
                break

    # If pack is not directly in custom_wallpacks and not in packs_dir, it's part of an album
    if not is_direct_pack and not is_in_packs_dir:
        console.print(f"🚫 Cannot remove pack '{pack.name}' as it is part of an album")
        console.print("✨ To remove this pack, remove the album it belongs to")
        return
    
    # Confirm removal
    if not force:
        if is_in_packs_dir:
            if not Confirm.ask(f"Are you sure you want to remove and delete pack '{pack.name}'?"):
                return
        else:
            if not Confirm.ask(f"Are you sure you want to remove pack '{pack.name}' from config?"):
                return
            else:
                console.print("")

    try:
        # Remove from config if it's a direct pack
        if is_direct_pack:
            custom_wallpacks = dict(config_manager.config["custom_wallpacks"])
            for pack_name, path in custom_wallpacks.items():
                if Path(path).resolve() == pack.path:
                    del config_manager.config["custom_wallpacks"][pack_name]
                    break

        # If in packs directory, delete the pack
        if is_in_packs_dir:
            shutil.rmtree(pack.path)
            console.print(f"\n✅ Removed and deleted pack '{pack.name}'")
        else:
            console.print(f"✅ Removed pack '{pack.name}' from config")

        # Save config
        config_manager._save_config(config_manager.config)
    except Exception as e:
        console.print(f"🚫 Error removing pack '{pack.name}': {str(e)}")


@app.command(
    name="open",
    rich_help_panel="🔄 Manage"
)
def pack_open(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(help="Name of the pack to open")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to open", show_default=False)
):
    """
    Opens the pack's folder in the system's file explorer.
    
    If no pack is specified, opens the active pack's folder.
    """

    config_manager = ctx.obj.get("config_manager")

    # If UID is provided, try to get pack by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if not pack:
            console.print(f"🚫 Pack with UID '{pack_uid}' not found")
            return
    else:
        # Check if pack_name was provided; if not, use the active pack
        if pack_name == "active":
            active_pack = ctx.obj.get("active")
            if not active_pack:
                console.print("[yellow]No active pack set[/]")
                return
            # Get the pack by its UID to ensure we get the correct instance
            pack = config_manager.get_pack_by_uid(active_pack.uid)
            if not pack:
                console.print(f"🚫 Active pack with UID '{active_pack.uid}' not found")
                return
        else:
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

            # If there are multiple packs with the same name, ask for UID
            if len(results[pack_name]) > 1:
                console.print(f"🔍 Found {len(results[pack_name])} packs named '{pack_name}'")
                for pack in results[pack_name]:
                    console.print(f"    📦 {pack.name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
                
                console.print(f"\n✨ Supply the pack's UID using '--uid PACK_UID' to open the pack")
                return

            # Get the pack object
            pack = results[pack_name][0]

    try:
        # Open the pack folder in the system's file explorer
        import subprocess
        import os
        import platform

        # Get the default file explorer based on the platform
        if platform.system() == "Windows":
            os.startfile(str(pack.path))
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(["open", str(pack.path)])
        else:  # Linux and others
            subprocess.run(["xdg-open", str(pack.path)])

        console.print(f"✅ Opening folder for [yellow]{pack.name}[/]")
        console.print(f"📂 [dim]{pack.path}[/]")
    except Exception as e:
        console.print(f"🚫 Error opening folder: {str(e)}")


@app.callback()
def callback(
    ctx: typer.Context
):
    """Manage wallpaper packs"""