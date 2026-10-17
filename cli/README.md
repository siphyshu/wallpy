# wallpy

Dynamic wallpapers for your desktop: packs of wallpapers that follow the sun,
the week, or a schedule of their own. Find packs at
[wallpy.siphyshu.me](https://wallpy.siphyshu.me).

```sh
wallpy browse                 # pick a pack from the gallery
wallpy use zelda-wind-waker   # or name one; it's set now and keeps changing
wallpy                        # what's showing, today's schedule, what's next
```

## Install

| | |
|---|---|
| macOS, Linux | `brew install siphyshu/tap/wallpy` |
| Windows | `winget install siphyshu.Wallpy` or `scoop bucket add siphyshu https://github.com/siphyshu/scoop-bucket && scoop install wallpy` |
| Debian, Fedora, Alpine | `.deb`, `.rpm` or `.apk` from the [releases](https://github.com/siphyshu/wallpy/releases) |
| Arch | `yay -S wallpy-bin` |

One binary, no runtime. To remove it, run `wallpy uninstall`: it removes the
background agent (and, if you like, your packs) and shows the command that
removes wallpy itself.

Once a day wallpy asks GitHub whether there's a newer release and, if so,
says so in one line with the upgrade command. `WALLPY_NO_UPDATE_CHECK=1`
turns that off.

## Commands

| | |
|---|---|
| `wallpy` | What's showing, today's slots on the sky, the next change |
| `wallpy use <pack>` | Make a pack your wallpaper: a name, a gallery link or a folder |
| `wallpy browse [search]` | The gallery, with previews; Enter uses a pack |
| `wallpy show <pack> [--at 18:45]` | A pack's credit and schedule, now or at another time |
| `wallpy list` / `get` / `update` / `remove` | Manage installed packs |
| `wallpy location [city \| auto \| lat,lon]` | Where you are, for real sunrise and sunset |
| `wallpy pause` / `resume` | Hold the current wallpaper for a while, then carry on |
| `wallpy uninstall [--all]` | Remove Wallpy from this computer |
| `wallpy doctor` | Check everything, with a fix for anything wrong |
| `wallpy check <folder>` | Check a pack you're making against the [pack spec](../spec/README.md) |

## How it works

A small agent (`wallpy run`) sleeps until the next scheduled change and sets
the wallpaper: a launchd agent on macOS, an XDG autostart entry on Linux, a
logon task on Windows. Packs and settings live in
`~/Library/Application Support/Wallpy`, `%LOCALAPPDATA%\Wallpy` or
`~/.local/share/wallpy`.

| | Sets the wallpaper with |
|---|---|
| macOS | AppKit (every display; the current Space on each) |
| Windows | SystemParametersInfo |
| Linux | GNOME, Cinnamon, MATE, KDE Plasma, Xfce, LXQt, sway, Hyprland (swww or hyprpaper), or feh |

## Develop

```sh
go test ./...                                        # includes spec/vectors
WALLPY_SITE=http://localhost:3000 WALLPY_HOME=$(mktemp -d) go run ./cmd/wallpy browse
WALLPY_TEST_DESKTOP=1 go test ./internal/wallpaper   # really sets (and restores) the wallpaper
goreleaser release --snapshot --clean                # every platform, nothing published
```

Layout: `cmd/wallpy` (entry), `internal/app` (commands), `internal/ui` (the
terminal design system; all output goes through it), `internal/spec` (the pack
format), `internal/engine`, `library`, `remote`, `state`, `wallpaper`,
`service`, `geo`. The retired Python CLI is in `python/`.

City data: [GeoNames](https://www.geonames.org) (cities of 15,000+ people,
CC BY 4.0), built into `internal/geo/cities.tsv.gz` by `internal/geo/gen`.
Smaller places are searched online with [Open-Meteo](https://open-meteo.com).
