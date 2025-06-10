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

# Create a new command group for location-related commands
location_app = typer.Typer(
    no_args_is_help=True,
    rich_markup_mode="rich",
    help="Manage global location settings",
)
app.add_typer(location_app, name="location", rich_help_panel="📋 View & Edit")


@app.command(
    rich_help_panel="📋 View & Edit"
)
def show(
    ctx: typer.Context
):
    """Prints the global config in a human-readable format"""
    
    console.print("\n✨ Implemented", end="\n\n")

    config_manager = ctx.obj.get("config_manager")

    # Get all config fields
    config = config_manager.config

    # Active Pack section
    console.print("[bold cyan]Active Pack[/]\n", style="bold cyan")
    if "active" in config:
        active = config["active"]
        if active:
            console.print(f"  ✨ [yellow]{active.get('name', 'Unnamed')}[/] [cyan italic]{active.get('uid', 'N/A')}[/]")
            console.print(f"  📂 [dim]{active.get('path', 'N/A')}[/]")
        else:
            console.print("  ⚠️ No active pack configured")
    else:
        console.print("  ⚠️ No active pack configured")

    # Custom Wallpacks section
    console.print("\n[bold cyan]Custom Wallpacks[/]\n", style="bold cyan")
    if "custom_wallpacks" in config:
        custom_packs = config["custom_wallpacks"]
        if custom_packs:
            for name, path in custom_packs.items():
                console.print(f"  📦 [yellow]{name}[/] [dim]({path})[/]")
        else:
            console.print("  ⚠️ No custom wallpacks configured")
    else:
        console.print("  ⚠️ No custom wallpacks configured")

    # Location section
    console.print("\n[bold cyan]Location[/]\n", style="bold cyan")
    if "location" in config:
        location = config["location"]
        if location:
            console.print(f"  📍 Name: [yellow]{location.get('name', 'Unnamed Location')}[/]")
            console.print(f"  🌍 Region: [yellow]{location.get('region', 'Unknown Region')}[/]")
            console.print(f"  📊 Coordinates: [green]{location.get('latitude', 'N/A')}°N, {location.get('longitude', 'N/A')}°E[/]")
            console.print(f"  🕒 Timezone: [green]{location.get('timezone', 'N/A')}[/]")
        else:
            console.print("  ⚠️ No location configured\n")
    else:
        console.print("  ⚠️ No location configured\n")

    # Validate and show any issues
    validation = config_manager.validate_config()
    if validation.failed or validation.warnings:
        console.print("\n[bold yellow]Configuration Issues:[/]")
        if validation.failed:
            for key, result in validation.errors.items():
                if isinstance(result, list):
                    for item in result:
                        console.print(f"  ❗ [red]{key.upper()}:[/] {item}")
                else:
                    console.print(f"  ❗ [red]{key.upper()}:[/] {result}")
        if validation.warnings:
            for key, result in validation.warnings.items():
                if isinstance(result, list):
                    for item in result:
                        console.print(f"  ⚠️ [yellow]{key.upper()}:[/] {item}")
                else:
                    console.print(f"  ⚠️ [yellow]{key.upper()}:[/] {result}")


@app.command(
    rich_help_panel="📋 View & Edit"
)
def edit(
    ctx: typer.Context
):
    """Opens the global config in editor"""
    
    console.print("\n✨ Implemented", end="\n\n")

    config_manager = ctx.obj.get("config_manager")
    
    # Get the config file path
    config_file = config_manager.config_file_path
    if not config_file.exists():
        console.print(f"🚫 Config file not found at {config_file}")
        return

    # Print warning about direct editing
    console.print("[yellow]⚠️ Warning:[/] Editing the config file directly can lead to invalid configurations.")
    console.print("            Use with caution and prefer using the CLI commands when possible.\n")

    # Open the config file in the default editor
    try:
        import subprocess
        import os
        import platform

        # Get the default editor based on the platform
        if platform.system() == "Windows":
            os.startfile(str(config_file))
        elif platform.system() == "Darwin":  # macOS
            subprocess.run(["open", str(config_file)])
        else:  # Linux and others
            subprocess.run(["xdg-open", str(config_file)])

        console.print(f"✅ Opening global config file")
        console.print(f"📂 [dim]{config_file}[/]")
    except Exception as e:
        console.print(f"🚫 Error opening config file: {str(e)}")


@location_app.command(
    rich_help_panel="📍 Location Commands",
    no_args_is_help=True,
    epilog="✨ use [turquoise4]'wallpy config location auto'[/] to auto-detect location"
)
def set(
    ctx: typer.Context,
    latitude: float = typer.Option(..., "--lat", "-l", help="Latitude coordinate"),
    longitude: float = typer.Option(..., "--lon", "-g", help="Longitude coordinate"),
    timezone: str = typer.Option(..., "--tz", "-t", help="Timezone (e.g., 'America/New_York')"),
    name: str = typer.Option("Custom Location", "--name", "-n", help="Location name"),
    region: str = typer.Option("Custom Region", "--region", "-r", help="Region name"),
):
    """Manually set location coordinates and timezone"""
    
    console.print("\n✨ Implemented", end="\n\n")
    
    try:
        from wallpy.models import Location
        from rich.table import Table
        from rich.box import ROUNDED
        
        # Create Location object
        loc = Location(
            latitude=latitude,
            longitude=longitude,
            timezone=timezone,
            name=name,
            region=region
        )

        # Set the location
        config_manager = ctx.obj.get("config_manager")
        config_manager.set_location(loc)

        # Create table for location details
        table = Table(
            header_style="bold",
            box=ROUNDED,
            show_header=False,
            border_style="dim"
        )
        
        table.add_column("Property", style="cyan", justify="left")
        table.add_column("Value", style="yellow", justify="left")
        
        table.add_row("📍 Name", loc.name)
        table.add_row("🌍 Region", loc.region)
        table.add_row("📊 Coordinates", f"{loc.latitude}°N, {loc.longitude}°E")
        table.add_row("🕒 Timezone", loc.timezone)
        
        console.print(table)
        console.print("\n✅ Location has been saved to your configuration")
        
    except Exception as e:
        console.print(f"❌ Error setting location: {str(e)}")
        raise typer.Exit(1)


@location_app.command(
    rich_help_panel="📍 Location Commands"
)
def auto(
    ctx: typer.Context,
    yes: bool = typer.Option(False, "--yes", "-y", help="Skip confirmation prompt")
):
    """Auto-detect location using IP geolocation [dim](recommended)[/]"""
    
    console.print("\n✨ Implemented", end="\n\n")
    try:
        import requests
        from wallpy.models import Location
        from rich.prompt import Confirm
        from rich.table import Table
        from rich.box import ROUNDED
        
        console.print("🔍 Auto-detecting location...")
        
        # Get location from IP
        response = requests.get('http://ipapi.co/json/')
        if response.status_code == 200:
            data = response.json()
            # Create Location object
            loc = Location(
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                timezone=data.get('timezone'),
                name=data.get('city', 'Unknown'),
                region=data.get('country_name')
            )

            console.print("✅ Auto-detected location from IP\n")
            
            # Create table for location details
            table = Table(
                header_style="bold",
                box=ROUNDED,
                show_header=False,
                border_style="dim"
            )
            
            table.add_column("Property", style="cyan", justify="left")
            table.add_column("Value", style="yellow", justify="left")
            
            table.add_row("📍 Name", loc.name)
            table.add_row("🌍 Region", loc.region)
            table.add_row("📊 Coordinates", f"{loc.latitude}°N, {loc.longitude}°E")
            table.add_row("🕒 Timezone", loc.timezone)
            
            console.print(table)
            
            # Ask for confirmation unless --yes flag is used
            if yes or Confirm.ask("\n🤔 Set this as your location?"):
                # Set the location
                config_manager = ctx.obj.get("config_manager")
                config_manager.set_location(loc)

                console.print("\n✅ Location has been saved to your configuration")
            else:
                console.print("\n❌ Location not saved")
        else:
            console.print("⚠️ Could not auto-detect location")
            
    except Exception as e:
        console.print(f"❌ Error auto-detecting location: {str(e)}")
        raise typer.Exit(1)


@location_app.command(
    rich_help_panel="📍 Location Commands"
)
def search(ctx: typer.Context):
    """Search for a location interactively"""
    console.print("\n✨ Implemented", end="\n\n")
    _run_location_wizard(ctx)


@location_app.command(
    rich_help_panel="📍 Location Commands"
)
def info(
    ctx: typer.Context
):
    """Show the current global location settings"""
    
    console.print("\n✨ Implemented", end="\n\n")

    console.print("🔍 Showing current location settings...\n")

    config_manager = ctx.obj.get("config_manager")
    location = config_manager.get_location()

    if location:
        from rich.table import Table
        from rich.box import ROUNDED
        
        # Create table for location details
        table = Table(
            header_style="bold",
            box=ROUNDED,
            show_header=False,
            border_style="dim"
        )
        
        table.add_column("Property", style="cyan", justify="left")
        table.add_column("Value", style="yellow", justify="left")
        
        table.add_row("📍 Name", location.name)
        table.add_row("🌍 Region", location.region)
        table.add_row("📊 Coordinates", f"{location.latitude}°N, {location.longitude}°E")
        table.add_row("🕒 Timezone", location.timezone)
        
        console.print(table)
    else:
        console.print("⚠️ No location configured")
        console.print("\n✨ Use 'wallpy config location set' to configure a location")


@app.callback()
def callback(
    ctx: typer.Context
):
    """Manage wallpy configuration"""

def _run_location_wizard(ctx: typer.Context):
    """Interactive location wizard using astral geocoder"""
    
    from astral.geocoder import database, lookup
    from rich.prompt import Prompt, Confirm
    from rich.table import Table
    from rich.live import Live
    from rich.text import Text
    from rich.panel import Panel
    from rich.console import Console
    from rich.box import ROUNDED
    import difflib
    import sys
    import msvcrt  # For Windows key reading

    console = Console()

    # Get all locations from astral database
    db = database()
    
    def search_locations(query: str) -> list:
        """Search locations by name, region, or timezone"""
        if not query:
            return []
            
        query = query.lower()
        matches = []
        
        # First try to match continent/region
        if query in [k.lower() for k in db.keys()]:
            # If exact match for continent, show all cities in that continent
            continent = next(k for k in db.keys() if k.lower() == query)
            for city, locations in db[continent].items():
                for loc in locations:
                    matches.append((loc.name, {
                        "region": loc.region,
                        "timezone": loc.timezone,
                        "latitude": loc.latitude,
                        "longitude": loc.longitude
                    }))
            return matches[:10]

        # Search across all continents
        for continent, cities in db.items():
            for city, locations in cities.items():
                for loc in locations:
                    # Search in name
                    if query in loc.name.lower():
                        matches.append((loc.name, {
                            "region": loc.region,
                            "timezone": loc.timezone,
                            "latitude": loc.latitude,
                            "longitude": loc.longitude
                        }))
                        continue
                    
                    # Search in region
                    if query in loc.region.lower():
                        matches.append((loc.name, {
                            "region": loc.region,
                            "timezone": loc.timezone,
                            "latitude": loc.latitude,
                            "longitude": loc.longitude
                        }))
                        continue
                    
                    # Search in timezone
                    if query in loc.timezone.lower():
                        matches.append((loc.name, {
                            "region": loc.region,
                            "timezone": loc.timezone,
                            "latitude": loc.latitude,
                            "longitude": loc.longitude
                        }))
                        continue
        
        # If no direct matches, try fuzzy matching on city names
        if not matches:
            all_cities = []
            for continent in db.values():
                for city in continent.keys():
                    all_cities.append(city.replace('_', ' ').title())
            
            fuzzy_matches = difflib.get_close_matches(query, all_cities, n=5, cutoff=0.6)
            if fuzzy_matches:
                for match in fuzzy_matches:
                    # Find the continent and city for this match
                    for continent, cities in db.items():
                        for city, locations in cities.items():
                            if city.replace('_', ' ').title() == match:
                                for loc in locations:
                                    matches.append((loc.name, {
                                        "region": loc.region,
                                        "timezone": loc.timezone,
                                        "latitude": loc.latitude,
                                        "longitude": loc.longitude
                                    }))
        
        return matches[:10]  # Limit to 10 results

    def generate_table(matches: list) -> Table:
        """Generate a table from location matches"""
        table = Table(
            header_style="bold",
            box=ROUNDED,
            show_header=True,
            border_style="dim"
        )
        table.add_column("#", style="dim", width=3)
        table.add_column("Name", style="yellow")
        table.add_column("Region", style="green")
        table.add_column("Timezone", style="cyan")

        for i, (name, data) in enumerate(matches, 1):
            table.add_row(
                str(i),
                name,
                data["region"],
                data["timezone"]
            )
        
        return table

    def get_search_results(query: str) -> Table:
        """Get search results as a table"""
        matches = search_locations(query)
        if not matches:
            return Table(
                header_style="bold",
                box=ROUNDED,
                show_header=True,
                border_style="dim"
            )
        
        return generate_table(matches)

    def get_search_display(query: str):
        """Get the complete search display including query and results"""
        from rich.console import Group
        from rich.text import Text
        
        search_text = Text(f"\nSearch: {query}\n", style="dim")
        results_table = get_search_results(query)
        
        return Group(search_text, results_table)

    # Main search loop
    while True:
        console.print("🔍 Search for a location by name, region, or timezone...")
        
        query = ""
        
        with Live(get_search_display(""), refresh_per_second=4, console=console) as live:
            while True:
                if msvcrt.kbhit():
                    char = msvcrt.getch()
                    if char == b'\r':  # Enter
                        break
                    elif char == b'\x08':  # Backspace
                        if query:
                            query = query[:-1]
                    elif char == b'\x1b':  # Escape
                        return
                    else:
                        try:
                            char = char.decode('utf-8')
                            query += char
                        except UnicodeDecodeError:
                            continue
                    
                    # Update the entire display
                    live.update(get_search_display(query))

        console.print()  # New line after search

        # Let user select a location
        choice = Prompt.ask(
            "🔍 Select a location from search results (#) to set or (q)uit"
        )

        if choice.lower() == "q" or choice.lower() == "quit" or choice.lower() == "exit" or choice.lower() == "":
            return

        try:
            idx = int(choice) - 1
            matches = search_locations(query)
            if 0 <= idx < len(matches):
                name, data = matches[idx]
                
                # Create Location object
                from wallpy.models import Location
                loc = Location(
                    latitude=data["latitude"],
                    longitude=data["longitude"],
                    timezone=data["timezone"],
                    name=name,
                    region=data["region"]
                )

                # Set the location
                config_manager = ctx.obj.get("config_manager")
                config_manager.set_location(loc)

                console.print("")

                # Create table for location details
                table = Table(
                    header_style="bold",
                    box=ROUNDED,
                    show_header=False,
                    border_style="dim"
                )
                
                table.add_column("Property", style="cyan", justify="left")
                table.add_column("Value", style="yellow", justify="left")
                
                table.add_row("📍 Name", loc.name)
                table.add_row("🌍 Region", loc.region)
                table.add_row("📊 Coordinates", f"{loc.latitude}°N, {loc.longitude}°E")
                table.add_row("🕒 Timezone", loc.timezone)
                
                console.print(table)
                console.print("\n✅ Location has been saved to your configuration")
                return
            else:
                console.print("❌ Invalid selection")
        except ValueError:
            console.print("❌ Please enter a number")