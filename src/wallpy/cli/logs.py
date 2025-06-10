"""
Command group of logs-related commands for the wallpy-sensei CLI
"""

import typer
import logging
import shutil
import time
from pathlib import Path
from rich.console import Console
from typing_extensions import Annotated
from rich.live import Live
from rich.panel import Panel
from rich.text import Text

from wallpy.config import ConfigManager
from wallpy.schedule import ScheduleManager
from wallpy.engine import WallpaperEngine
from wallpy.cli.utils import get_app_state


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
    
    state = get_app_state(False)
    log_file = state["logs_dir"] / "wallpy.log"
    
    if not log_file.exists():
        console.print("[yellow]No log file found[/]")
        return
    
    try:
        with open(log_file, "r") as f:
            # Get last n lines
            all_lines = f.readlines()
            last_lines = all_lines[-lines:]
            
            if follow:
                console.print(f"[bold]Showing last {lines} lines and following...[/]")
                console.print("Press Ctrl+C to stop following")
                
                # Show initial lines
                for line in last_lines:
                    console.print(line.strip())
                
                # Follow new lines
                with Live(auto_refresh=False) as live:
                    while True:
                        with open(log_file, "r") as f:
                            all_lines = f.readlines()
                            if len(all_lines) > lines:
                                new_lines = all_lines[-lines:]
                                text = Text()
                                for line in new_lines:
                                    text.append(line)
                                live.update(Panel(text))
                                live.refresh()
                        time.sleep(1)
            else:
                console.print(f"[bold]Last {lines} lines:[/]")
                for line in last_lines:
                    console.print(line.strip())
                    
    except Exception as e:
        console.print(f"[red]Error reading log file:[/] {str(e)}")


@app.command()
def clear(
    ctx: typer.Context
):
    """Clear all log files"""
    
    state = get_app_state(False)
    log_file = state["logs_dir"] / "wallpy.log"
    
    if not log_file.exists():
        console.print("[yellow]No log file found[/]")
        return
    
    try:
        # Create backup of current log
        backup_file = state["logs_dir"] / f"wallpy.log.{int(time.time())}.bak"
        shutil.copy2(log_file, backup_file)
        
        # Clear the log file
        with open(log_file, "w") as f:
            f.write("")
            
        console.print("[green]Log file cleared successfully[/]")
        console.print(f"[dim]Backup created at: {backup_file}[/]")
        
    except Exception as e:
        console.print(f"[red]Error clearing log file:[/] {str(e)}")


@app.command()
def export(
    ctx: typer.Context,
    output: Annotated[Path, typer.Argument(help="Path to export logs to")] = Path("wallpy-logs.zip")
):
    """Export logs to a zip file"""
    
    state = get_app_state(False)
    logs_dir = state["logs_dir"]
    
    if not logs_dir.exists():
        console.print("[yellow]No logs directory found[/]")
        return
    
    try:
        # Create zip file
        shutil.make_archive(str(output.with_suffix("")), "zip", logs_dir)
        console.print(f"[green]Logs exported successfully to:[/] {output}")
        
    except Exception as e:
        console.print(f"[red]Error exporting logs:[/] {str(e)}")


@app.callback()
def callback(
    ctx: typer.Context
):
    """View and manage logs"""