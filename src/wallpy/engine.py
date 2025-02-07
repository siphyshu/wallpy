# engine.py
import sys
import logging
from pathlib import Path
from typing import Literal

class WallpaperEngine:
    def __init__(self):
        self.platform: Literal["win32", "darwin", "linux"] = sys.platform
        self.logger = logging.getLogger("wallpaper_engine")
        
    def set_wallpaper(self, image_path: Path) -> bool:
        """Returns True on success, False on failure"""
        try:
            image_path = image_path.expanduser().resolve()
            if not image_path.exists():
                self.logger.error(f"Image not found: {image_path}")
                return False

            if self.platform == "win32":
                return self._set_windows_wallpaper(image_path)
            elif self.platform == "darwin":
                return self._set_macos_wallpaper(image_path)
            elif self.platform == "linux":
                return self._set_linux_wallpaper(image_path)
            
            self.logger.error(f"Unsupported platform: {sys.platform}")
            return False
        except Exception as e:
            self.logger.error(f"Wallpaper change failed: {str(e)}")
            return False

    def _set_windows_wallpaper(self, path: Path) -> bool:
        try:
            import ctypes
            SPI_SETDESKWALLPAPER = 20
            ctypes.windll.user32.SystemParametersInfoW(
                SPI_SETDESKWALLPAPER, 0, str(path), 3
            )
            return True
        except Exception as e:
            self.logger.error(f"Windows API error: {e}")
            return False

    # todo: Verify if this works on macOS
    def _set_macos_wallpaper(self, path: Path) -> bool:
        try:
            import subprocess
            script = f'''
            tell application "System Events"
                set desktopCount to count of desktops
                repeat with desktopNumber from 1 to desktopCount
                    tell desktop desktopNumber
                        set picture to "{path}"
                    end tell
                end repeat
            end tell
            '''
            subprocess.run(["osascript", "-e", script], check=True)
            return True
        except subprocess.CalledProcessError as e:
            self.logger.error(f"AppleScript error: {e}")
            return False

    # todo: verify if this works on KDE and other desktop environments
    def _set_linux_wallpaper(self, path: Path) -> bool:
        """Handles GNOME, KDE, and generic X11"""
        try:
            import subprocess
            # Try GNOME first
            if self._check_gnome():
                subprocess.run([
                    "gsettings", "set", 
                    "org.gnome.desktop.background", 
                    "picture-uri", f"file://{path}"
                ], check=True)
                return True
            
            # Try KDE
            if self._check_kde():
                subprocess.run([
                    "dbus-send", "--session", "--dest=org.kde.plasmashell",
                    "--type=method_call", "/PlasmaShell", 
                    "org.kde.PlasmaShell.evaluateScript", 
                    f"string:var allDesktops = desktops(); for (i=0;i<allDesktops.length;i++) {{ \
                    d = allDesktops[i]; d.wallpaperPlugin = 'org.kde.image'; \
                    d.currentConfigGroup = Array('Wallpaper', 'org.kde.image', 'General'); \
                    d.writeConfig('Image', 'file://{path}')}}"
                ], check=True)
                return True
            
            # Fallback to feh for minimal setups
            subprocess.run(["feh", "--bg-fill", str(path)], check=True)
            return True
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            self.logger.error(f"Linux command failed: {e}")
            return False

    def _check_gnome(self) -> bool:
        """Check if GNOME desktop is running"""
        try:
            import subprocess
            return "GNOME" in subprocess.check_output(
                ["echo", "$XDG_CURRENT_DESKTOP"], 
                shell=True
            ).decode().upper()
        except:
            return False

    def _check_kde(self) -> bool:
        """Check if KDE Plasma is running"""
        try:
            import subprocess
            return "KDE" in subprocess.check_output(
                ["echo", "$XDG_CURRENT_DESKTOP"], 
                shell=True
            ).decode().upper()
        except:
            return False