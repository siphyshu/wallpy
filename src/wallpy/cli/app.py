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

from wallpy.cli import pack, config, service, logs
from wallpy.cli.utils import get_app_state


console = Console()

app = typer.Typer(
    no_args_is_help=True,
    rich_markup_mode="rich",
    epilog="made with ❤️ by [cyan link=https://siphyshu.me/]siphyshu[/]",
)

# Main command groups
app.add_typer(pack.app, name="pack", help="Manage wallpaper packs", rich_help_panel="📋 Main Commands")
app.add_typer(config.app, name="config", help="Manage wallpy configuration", rich_help_panel="📋 Main Commands")
app.add_typer(service.app, name="service", help="Control wallpy service", rich_help_panel="📋 Main Commands")
# app.add_typer(logs.app, name="logs", help="View and manage logs", rich_help_panel="📋 Main Commands")


# aliases for commonly used subcommands
@app.command(
        name="list", 
        rich_help_panel="✨ Quick Access",
        epilog="📝 this is an alias for [turquoise4]wallpy pack list[/]"
)
def alias_list(
    ctx: typer.Context,
    search: Annotated[Path, typer.Argument(..., help="Search directory for packs", show_default=False, metavar="[PATH]")] = None,
    albums: bool = typer.Option(False, "--albums", "-a", help="Show only albums")
):
    """Lists all available wallpaper packs"""
    
    pack.list(ctx, search, albums)


@app.command(
        name="activate", 
        rich_help_panel="✨ Quick Access",
        no_args_is_help=True,
        epilog="📝 this is an alias for [turquoise4]wallpy pack activate[/]"
)
def alias_activate(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(..., help="Name of the pack to activate", show_default=False)] = None,
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to activate", show_default=False)
):
    """Activates the specified pack (makes it the default)"""    
    
    pack.activate(ctx, pack_name, pack_uid)


@app.command(
        name="preview", 
        rich_help_panel="✨ Quick Access",
        epilog="📝 this is an alias for [turquoise4]wallpy pack preview[/]"
)
def alias_preview(
    ctx: typer.Context,
    pack_name: Annotated[str, typer.Argument(help="Name of the pack to preview")] = "active",
    pack_uid: str = typer.Option(None, "--uid", "-u", help="UID of the pack to preview", show_default=False)
):
    """Previews schedule and wallpapers from the specified pack"""
    
    pack.preview(ctx, pack_name, pack_uid)


@app.command(
        name="download", 
        rich_help_panel="✨ Quick Access",
        no_args_is_help=True,
        epilog="""
        📝 this is an alias for [turquoise4]wallpy pack download[/]\n\n
        🌐 browse and download packs from [cyan link=https://wallpy.siphyshu.me/gallery]wallpy.siphyshu.me/gallery[/]."""
)
def alias_download(
    ctx: typer.Context,
    uid: Annotated[str, typer.Argument(..., help="UID of the pack to download", show_default=False)]
):
    """Downloads a pack from the pack gallery using a pack's UID"""
    
    pack.download(ctx, uid)


@app.callback(invoke_without_command=True)
def main(
    help: bool = typer.Option(False, "--help", "-h", help="Show this help message"),
    verbose: bool = typer.Option(False, "--verbose", "-V", help="Enable verbose output"),
    version: bool = typer.Option(False, "--version", "-v", help="Show version information"),
    ctx: typer.Context = typer.Context
    ):
     
    if version:
        from importlib.metadata import version
        console.print(f"wallpy v{version('wallpy-sensei')}")
        raise typer.Exit()

    if help:
        console.print(ctx.get_help())
        raise typer.Exit()

    if ctx.invoked_subcommand is None:
        console.print("Hello, world!")

    # Initialize the application state
    state = get_app_state(verbose=verbose)
    ctx.obj = state

    # Set the active pack's name and uid in the context object according to the config file
    config_manager = ctx.obj.get("config_manager")
    ctx.obj["active"] = config_manager.get_active_pack()


if __name__ == "__main__":
    app()