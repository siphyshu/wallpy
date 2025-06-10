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
from datetime import datetime, timedelta

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine
from wallpy.validate import Validator
from wallpy.models import ScheduleType

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
        console.print(f"🔍 Searching for packs in [dim]{Path(search).resolve()}[/]")
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
                    console.print(f"    📦 {name} [cyan italic]{pack.uid}[/] [dim]({pack.path})[/]")
    else:
        console.print(f"⭕ Found [bold]0[/] packs")


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
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to activate", show_default=False)] = None,
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to activate", show_default=False)
):
    """Activates the specified pack (makes it the default)"""

    console.print("\n✨ Implemented", end="\n\n")

    config_manager = ctx.obj.get("config_manager")

    # Load packs in the config manager
    results = config_manager.load_packs()
    
    # If UID is provided, try to activate by UID first
    if pack_uid:
        pack = config_manager.get_pack_by_uid(pack_uid)
        if pack:
            pack_saved = config_manager.set_active_pack(pack)
            if pack_saved:
                console.print(f"✅ Pack '{pack.name}' activated")
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
    else:
        console.print(f"🚫 Error activating pack '{pack.name}'")


# Pack management
@app.command(
    epilog="✨ shorter alias available: [turquoise4]wallpy preview[/]",
    rich_help_panel="🔍 Management"
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

    console.print("\n✨ Implemented", end="\n\n")

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


@app.command(
    rich_help_panel="🔍 Management"
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

    console.print("\n✨ Implemented", end="\n\n")

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