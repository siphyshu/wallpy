# Wallpy

Dynamic wallpapers for your desktop: wallpapers that follow the sun, the days
of the week, or a schedule of their own. A small command-line app for macOS,
Windows and Linux, with a gallery of packs made by the community at
[wallpy.siphyshu.me](https://wallpy.siphyshu.me).

<p float="left">
  <img src="https://user-images.githubusercontent.com/52672162/190454797-375ca1fa-8864-4aa5-b7d7-b2d689b862df.gif" width="300" />⠀
  <img src="https://user-images.githubusercontent.com/52672162/190465231-2199d54c-72fc-4f69-900a-88d64307f5d1.gif" width="300" />
</p>

## Install

| | |
|---|---|
| macOS, Linux | `brew install siphyshu/tap/wallpy` |
| Windows | `winget install siphyshu.Wallpy` or `scoop bucket add siphyshu https://github.com/siphyshu/scoop-bucket; scoop install wallpy` |
| Debian, Fedora, Alpine | `.deb`, `.rpm` or `.apk` from the [releases](https://github.com/siphyshu/wallpy/releases) |
| Arch | `yay -S wallpy-bin` |

Then run `wallpy`: it asks roughly where you are (for your real sunrise and
sunset) and opens the gallery in your terminal. The
[docs](https://wallpy.siphyshu.me/docs) have every command.

## What's here

| Path | What |
|---|---|
| [`cli/`](cli) | The Wallpy app (Go) |
| [`site/`](site) | The website and gallery (Next.js, Supabase, Cloudflare R2) |
| [`spec/`](spec) | The pack format: a folder of images and a `schedule.toml` |
| [`supabase/`](supabase) | Database migrations and security checks |
| [`samples/`](samples) | Sample packs |

Make your own pack on the site with **Create wallpack**, or by hand following
the [spec](spec/README.md) and check it with `wallpy check ./my-pack`.

## The Python version

Wallpy started as a Python CLI (`pip install wallpy`). Its last version,
2.25.0, is archived at the
[`python-v2.25.0`](https://github.com/siphyshu/wallpy/releases/tag/python-v2.25.0)
release. The Go app continues from v3.0.0.

## License

[MIT](LICENSE)
