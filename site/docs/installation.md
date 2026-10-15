---
sidebar_position: 2
---

# Installation

This guide will help you install Wallpy on your Windows system.

## Prerequisites

Before installing Wallpy, make sure you have:

- Windows 10 or later
- Python 3.9 or later
- pip (Python package manager)

## Installation Steps

### 1. Install Python

If you don't have Python installed:

1. Download Python from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. Make sure to check "Add Python to PATH" during installation

### 2. Install Wallpy

Open a command prompt or PowerShell and run:

```bash
pip install wallpy
```

### 3. Verify Installation

To verify the installation, run:

```bash
wallpy --version
```

You should see the Wallpy version number displayed.

## First Run

After installation, you can start Wallpy with:

```bash
wallpy start
```

This will:
1. Start the Wallpy service
2. Open the configuration wizard
3. Guide you through initial setup

## Configuration

During first run, you'll be asked to:

1. Set your location (for sunrise/sunset calculations)
2. Choose a default wallpaper pack
3. Configure update intervals

You can modify these settings later using:

```bash
wallpy config
```

## Troubleshooting

### Common Issues

1. **Python not found**
   - Make sure Python is added to your PATH
   - Try restarting your terminal

2. **Permission errors**
   - Run the command prompt as administrator
   - Check your antivirus settings

3. **Service won't start**
   - Check if another instance is running
   - Verify your firewall settings

### Getting Help

If you encounter any issues:

1. Check the [troubleshooting guide](/docs/troubleshooting)
2. Join our [Discord community](https://discord.gg/wallpy)
3. Report issues on [GitHub](https://github.com/siphyshu/wallpy)

## Next Steps

Now that you have Wallpy installed:

1. [Configure your settings](/docs/configuration)
2. [Browse the wallpaper gallery](/docs/gallery)
3. [Learn about creating custom packs](/docs/custom-packs) 