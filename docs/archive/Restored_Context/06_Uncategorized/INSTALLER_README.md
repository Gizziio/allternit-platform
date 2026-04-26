# Allternit System Installer

One-command installer for the complete Allternit stack.

## Quick Install

### macOS / Linux
```bash
./install.sh
```

### Windows (PowerShell as Administrator)
```powershell
.\install.ps1
```

## What It Installs

1. **Cloud Backend** (port 8080)
   - WebSocket server for cloud mode
   - Session management and message routing
   - Health check endpoint

2. **Desktop App** (port 3010)
   - Electron application with Cowork mode
   - Native messaging host (port 3011)
   - WebSocket server for Thin Client connections

3. **Chrome Extension**
   - Built and copied to config directory
   - Three modes: Cloud, Local, Cowork
   - Ready to load in Chrome

4. **Thin Client**
   - Built from source
   - Pre-built packages copied if available

## Post-Installation

### Start Individual Components
```bash
# Cloud Backend
~/.allternit/start-cloud.sh

# Desktop (with Cowork mode)
~/.allternit/start-desktop.sh

# Thin Client
~/.allternit/start-thin-client.sh
```

### Start Everything at Once
```bash
~/.allternit/start-all.sh
```

### Load Chrome Extension
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `~/.config/allternit/chrome-extension` (macOS/Linux) or `%LOCALAPPDATA%\allternit\chrome-extension` (Windows)

## Configuration

Edit `~/.config/allternit/config.json` to customize:
- Port numbers
- Backend URLs
- Default connection mode

## Directory Structure

```
~/.allternit/                      # Installation directory
├── start-cloud.sh          # Cloud Backend launcher
├── start-desktop.sh        # Desktop launcher
├── start-thin-client.sh    # Thin Client launcher
└── start-all.sh            # Start everything

~/.config/allternit/              # Configuration
├── config.json             # Main configuration
└── chrome-extension/       # Built extension

~/.logs/allternit/                # Log files
```

## Requirements

- Node.js 18+
- npm or pnpm
- Google Chrome (for extension)
- macOS, Linux, or Windows

## Troubleshooting

### Port Already in Use
Edit `~/.config/allternit/config.json` and change port numbers.

### Extension Not Connecting
1. Verify Native Host is registered
2. Check Desktop is running
3. Look at Chrome DevTools console

### Thin Client Won't Connect
1. Check Cloud Backend is running: `curl http://localhost:8080/health`
2. Verify correct backend mode in settings
3. Check firewall settings

## Uninstall

```bash
# Remove installation
rm -rf ~/.allternit ~/.config/allternit ~/.logs/allternit

# Remove Chrome extension
# Manually remove from chrome://extensions

# Windows
rmdir /s "%USERPROFILE%\.allternit"
rmdir /s "%LOCALAPPDATA%\allternit"
```
