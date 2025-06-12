# Wallpy

A dynamic wallpaper engine that changes your wallpaper based on the time of day and your location.

<p float="left">
  <img src="https://user-images.githubusercontent.com/52672162/190454797-375ca1fa-8864-4aa5-b7d7-b2d689b862df.gif" width="300" />⠀
  <img src="https://user-images.githubusercontent.com/52672162/190465231-2199d54c-72fc-4f69-900a-88d64307f5d1.gif" width="300" />
</p>
<p float="left">
  <img src="https://user-images.githubusercontent.com/52672162/190468715-e7f1a6e8-95b8-4845-8082-9fc7168638b0.gif" width="300" />⠀
  <img src="https://user-images.githubusercontent.com/52672162/190470111-9d209b42-d571-422c-a901-5288056e3c31.gif" width="300" /> 
</p>

## Installation

Wallpy requires Python 3.9 or higher. You can install it using pip:

```bash
pip install wallpy
```

## Quick Start

1. List available wallpaper packs:
```bash
wallpy list
```

2. Install a wallpaper pack:
```bash
wallpy activate [pack_name]
```

3. Install the Wallpy service (runs automatically at startup and updates wallpaper based on time):
```bash
wallpy install
```

## Features

- 🌅 Dynamic wallpapers that change based on time of day
- 📍 Location-aware solar events (sunrise, sunset, etc.)
- 🎨 Support for custom wallpaper packs
- 🔄 Automatic wallpaper updates
- 🪟 Windows support (macOS and Linux coming soon)

## Configuration

Wallpy can be configured using the following commands:

```bash
# View current configuration
wallpy config show

# Set your location (for solar events)
wallpy config location auto

# List all available packs
wallpy pack list

# Install a new pack
wallpy pack activate [pack_name]

# Create a new pack (under development)
wallpy pack new [pack_name]
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---
Made with ❤️ by [siphyshu](https://siphyshu.me/)