"""Wallpy 2.x is retired. This last version only says where Wallpy went."""

import sys

__version__ = "2.26.0"

SITE = "https://wallpy.siphyshu.me"


def _install_command() -> str:
    if sys.platform == "win32":
        return "winget install siphyshu.Wallpy"
    return "brew install siphyshu/tap/wallpy"


def _remove_command() -> str:
    # pipx keeps each app in its own venv under a "pipx" folder.
    return "pipx uninstall wallpy" if "pipx" in sys.prefix.lower() else "pip uninstall wallpy"


def _step(n: int, label: str, command: str) -> str:
    return f"  {n}. {label:<22}{command}"


def _note(text: str) -> str:
    return f"     {text}"


def message() -> str:
    lines = [
        "",
        "  Wallpy has moved.",
        "",
        "  This Python version (2.x) is no longer updated. The new Wallpy is one",
        "  small app, no Python needed, with a gallery of packs to pick from.",
        "",
        _step(1, "Remove this version", _remove_command()),
    ]
    if sys.platform == "win32":
        lines += [
            _note("and its background task (PowerShell, as administrator):"),
            _note("Unregister-ScheduledTask -TaskName WallpyService -Confirm:$false"),
        ]
    lines.append(_step(2, "Install the new one", _install_command()))
    if sys.platform == "win32":
        lines.append(_note("or with Scoop: scoop bucket add siphyshu https://github.com/siphyshu/scoop-bucket; scoop install wallpy"))
    elif sys.platform.startswith("linux"):
        lines.append(_note(f"or a .deb, .rpm or .apk: {SITE}/docs#install"))
    lines += [
        _step(3, "Run it", "wallpy"),
        "",
        "  Packs from this version use the old format, so get them again from",
        f"  the gallery: {SITE}/gallery",
        "",
        f"  More: {SITE}/docs",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    if sys.argv[1:] in (["--version"], ["-v"]):
        print(f"wallpy {__version__} (retired; see {SITE})")
        return
    print(message(), file=sys.stderr)
    sys.exit(1)
