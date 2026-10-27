# Wallpy has moved

Wallpy is now a standalone app: one small program, no Python needed, with a
gallery of wallpaper packs that follow the sun, the days of the week, or a
schedule of their own.

**Get it at [wallpy.siphyshu.me](https://wallpy.siphyshu.me)**

| | |
|---|---|
| macOS, Linux | `brew install siphyshu/tap/wallpy` |
| Windows | `winget install siphyshu.Wallpy` |
| Debian, Fedora, Alpine | a `.deb`, `.rpm` or `.apk` from the [releases](https://github.com/siphyshu/wallpy/releases) |

## Coming from this Python version

1. Remove it: `pip uninstall wallpy` (or `pipx uninstall wallpy`).
2. On Windows, also remove its background task, in PowerShell as
   administrator: `Unregister-ScheduledTask -TaskName WallpyService -Confirm:$false`
3. Install the new app (above) and run `wallpy`.

Packs from this version use the old format, so get them again from the
[gallery](https://wallpy.siphyshu.me/gallery).

This package (2.26.0) is the last release on PyPI. Running it only prints
these steps. The Python CLI's code is archived in the repository
([python-v2.25.0](https://github.com/siphyshu/wallpy/releases/tag/python-v2.25.0)).
