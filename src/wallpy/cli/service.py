"""
Command group of service-related commands for the wallpy-sensei CLI
"""

import typer
import os
import sys
import subprocess
from pathlib import Path
from rich import box
from rich.table import Table
from rich.console import Console
from rich.prompt import Confirm
from wallpy.engine import WallpaperEngine
from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.elevate import isUserAdmin, runAsAdmin

console = Console()
app = typer.Typer(
    no_args_is_help=True,
    name="service",
    help="Manage the Wallpy background service",
)


def install_service(pythonw_exe: str, task_name: str):
    """Install the service with admin privileges"""
    # Get the platform-specific script path
    platform = sys.platform
    if platform == "win32":
        script_path = Path(__file__).parent.parent / "scripts" / "windows" / "install_task.ps1"
    elif platform == "darwin":
        console.print("🚫 MacOS is not supported yet")
        return None, False
    elif platform.startswith("linux"):
        console.print("🚫 Linux is not supported yet")
        return None, False
    else:
        console.print(f"🚫 Unsupported platform: {platform}")
        return None, False

    if platform == "win32":
        # Run the platform-specific installation script
        cmd = ["powershell", "-ExecutionPolicy", "Bypass", "-File", str(script_path), pythonw_exe]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Check if the task was actually created
        task_created = False
        try:
            check_result = subprocess.run(
                ["powershell", "-Command", f"Get-ScheduledTask -TaskName '{task_name}' -ErrorAction SilentlyContinue"],
                capture_output=True,
                text=True
            )
            task_created = check_result.returncode == 0
        except:
            task_created = False
        
        return result, task_created
    else:
        console.print("🚫 Only supported on Windows for now.")
        return None, False


def uninstall_service(task_name: str):
    """Uninstall the service with admin privileges"""
    if sys.platform == "win32":
        # Run the uninstall command
        cmd = ["powershell", "-Command", f"Unregister-ScheduledTask -TaskName '{task_name}' -Confirm:$false"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        # Check if the task was actually removed
        task_removed = False
        try:
            check_result = subprocess.run(
                ["powershell", "-Command", f"Get-ScheduledTask -TaskName '{task_name}' -ErrorAction SilentlyContinue"],
                capture_output=True,
                text=True
            )
            task_removed = check_result.returncode != 0
        except:
            task_removed = True
        
        return result, task_removed
    else:
        # For non-Windows platforms, run directly
        console.print("🚫 Only supported on Windows for now.")
        return None, False


@app.command(
    rich_help_panel="📋 Main Commands"
)
def install(ctx: typer.Context):
    """Install the Wallpy background service"""
    
    # Get the path to the Python executable
    python_exe = sys.executable
    pythonw_exe = str(Path(python_exe).parent / "pythonw.exe")
    
    # Create the scheduled task
    task_name = "WallpyService"
    
    console.print("✨ Installing wallpy service...")
    
    if sys.platform == "win32":
        if not isUserAdmin():
            # if not Confirm.ask("⚠️ Need admin privileges. Proceed?"):
            #     console.print("🚫 Installation cancelled")
            #     raise typer.Exit(1)
            console.print("⚠️ Need admin privileges. Proceeding...")
        
            result = runAsAdmin(['wallpy', 'install'], showCmd=False, showOutput=False)
            if result is None:
                console.print("⚠️ [yellow]Failed to elevate privileges. Try again.[/]")
                task_created = False
            else:
                task_created = True
        else:    
            result, task_created = install_service(pythonw_exe, task_name)
    else:
        result, task_created = install_service(pythonw_exe, task_name)
    
    if task_created:
        console.print("\n✅ Successfully installed wallpy service")
        
        # Auto-detect location if not configured
        config_manager = ctx.obj.get("config_manager")
        if not config_manager.get_location():
            try:
                import requests
                from wallpy.models import Location
                
                # Get location from IP silently
                response = requests.get('http://ipapi.co/json/')
                if response.status_code == 200:
                    data = response.json()
                    # Create Location object
                    loc = Location(
                        latitude=data.get('latitude'),
                        longitude=data.get('longitude'),
                        timezone=data.get('timezone'),
                        name=data.get('city', 'Unknown'),
                        region=data.get('country_name', 'Unknown Region')
                    )
                    
                    # Set the location silently
                    config_manager.set_location(loc)
            except:
                pass  # Silently ignore any errors in location detection
        
        # Trigger an immediate wallpaper change
        # console.print("\n🔄 Changing wallpaper...")
        try:
            config_manager = ctx.obj.get("config_manager")
            schedule_manager = ctx.obj.get("schedule_manager")
            engine = ctx.obj.get("engine")
            
            # Get the active pack
            active_pack = config_manager.get_active_pack()
            if not active_pack:
                # console.print("⚠️ [yellow]No active pack found[/]")
                return
                
            # Get the current wallpaper path
            schedule_file = active_pack.path / "schedule.toml"
            if not schedule_file.exists():
                # console.print(f"⚠️ [yellow]Schedule file not found at {schedule_file}[/]")
                return
                
            schedule = schedule_manager.load_schedule(schedule_file)
            wallpaper_path = schedule_manager.get_wallpaper(schedule, config_manager.get_location())
            
            if not wallpaper_path:
                # console.print("⚠️ [yellow]No suitable wallpaper found in schedule[/]")
                return
                
            # Resolve the path relative to pack directory if needed
            if not wallpaper_path.is_absolute():
                wallpaper_path = (active_pack.path / "images" / wallpaper_path).resolve()
                
            # Change the wallpaper
            success = engine.set_wallpaper(wallpaper_path)
            if success:
                # console.print("✅ Wallpaper changed successfully")
                pass
            else:
                # console.print("⚠️ [yellow]Failed to change wallpaper[/]")
                pass
        except Exception as e:
            # console.print(f"⚠️ [yellow]Error changing wallpaper: {e}[/]")
            pass
    else:
        console.print("🚫 Failed to install wallpy service")
        raise typer.Exit(1)


@app.command(
    rich_help_panel="📋 Main Commands"
)
def uninstall(ctx: typer.Context):
    """Uninstall the Wallpy background service"""

    # Create the scheduled task
    task_name = "WallpyService"
    
    console.print("✨ Uninstalling wallpy service...")
    
    if sys.platform == "win32":
        if not isUserAdmin():
            # if not Confirm.ask("⚠️ Need admin privileges. Proceed?"):
            #     console.print("🚫 Uninstallation cancelled")
            #     raise typer.Exit(1)
            console.print("⚠️ Need admin privileges. Proceeding...")
            
            result = runAsAdmin(['wallpy', 'uninstall'], showCmd=False, showOutput=False)
            if result is None:
                console.print("⚠️ [yellow]Failed to elevate privileges. Try again.[/]")
                task_removed = False
            else:
                task_removed = True
        else:    
            result, task_removed = uninstall_service(task_name)
    else:
        result, task_removed = uninstall_service(task_name)
    
    if task_removed:
        console.print("✅ Successfully uninstalled wallpy service")
    else:
        console.print("🚫 Failed to uninstall wallpy service")
        raise typer.Exit(1)


@app.command(
    rich_help_panel="📋 Main Commands"
)
def status():
    """Check the status of the Wallpy background service"""
    
    task_name = "WallpyService"
    
    # Query the task
    if sys.platform == "win32":
        result = subprocess.run(
            ["powershell", "-Command", f"Get-ScheduledTask -TaskName '{task_name}' | Get-ScheduledTaskInfo"],
            capture_output=True,
            text=True
        )
    else:
        console.print("🚫 Only supported on Windows for now.")
        return
    
    if result.returncode == 0:
        # Parse the output
        lines = result.stdout.strip().split('\n')
        status_info = {}
        
        for line in lines:
            line = line.strip()
            if ':' in line:
                key, value = line.split(':', 1)
                key = key.strip()
                value = value.strip()
                status_info[key] = value
        
        # Create a table for status display
        table = Table(
            show_header=False,
            box=box.ROUNDED,
            border_style="bright_black",
            title="[bold]Service Status[/]",
            title_style="bold",
            title_justify="left",
            padding=(0, 1)
        )
        
        # Add rows to the table
        # table.add_row("📌 Task Name", task_name)
        
        # Next Run Time
        if 'NextRunTime' in status_info:
            next_run = status_info['NextRunTime']
            if next_run and next_run != 'N/A':
                # If we have a next run time, the task is ready
                table.add_row("🟢 State", "[green]Ready[/]")
                table.add_row("✨ Next Run", next_run)
            else:
                table.add_row("⚪ State", "[yellow]Disabled[/]")
                table.add_row("✨ Next Run", "Not scheduled")
        
        # Last Run Time
        if 'LastRunTime' in status_info:
            last_run = status_info['LastRunTime']
            if last_run and last_run != 'N/A':
                table.add_row("🕒 Last Run", last_run)
            else:
                table.add_row("🕒 Last Run", "Never")
        
        # Last Task Result
        if 'LastTaskResult' in status_info:
            result_code = status_info['LastTaskResult']
            if result_code == '0':
                table.add_row("✅ Last Result", "[green]Success[/]")
            else:
                table.add_row("⚠️ Last Result", f"[yellow]Error (Code: {result_code})[/]")
        
        # Display the table
        console.print(table)
    else:
        # Create a table for not installed status
        table = Table(
            show_header=False,
            box=box.ROUNDED,
            border_style="bright_black",
            title="[bold]Service Status[/]",
            title_style="bold",
            title_justify="left",
            padding=(0, 1)
        )
        
        table.add_row("❌ State", "[red]Not Installed[/]")
        table.add_row("✨ Next Run", "N/A")
        table.add_row("🕒 Last Run", "N/A")
        table.add_row("✅ Last Result", "N/A")
        
        console.print(table)

        console.print("\n✨ Run [turquoise4]'wallpy install'[/] to install it")
        raise typer.Exit(1)