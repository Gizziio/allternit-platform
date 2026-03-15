# A2R System Installer

One-command installer for the complete A2R stack.

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
~/.a2r/start-cloud.sh

# Desktop (with Cowork mode)
~/.a2r/start-desktop.sh

# Thin Client
~/.a2r/start-thin-client.sh
```

### Start Everything at Once
```bash
~/.a2r/start-all.sh
```

### Load Chrome Extension
1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select: `~/.config/a2r/chrome-extension` (macOS/Linux) or `%LOCALAPPDATA%\a2r\chrome-extension` (Windows)

## Configuration

Edit `~/.config/a2r/config.json` to customize:
- Port numbers
- Backend URLs
- Default connection mode

## Directory Structure

```
~/.a2r/                      # Installation directory
├── start-cloud.sh          # Cloud Backend launcher
├── start-desktop.sh        # Desktop launcher
├── start-thin-client.sh    # Thin Client launcher
└── start-all.sh            # Start everything

~/.config/a2r/              # Configuration
├── config.json             # Main configuration
└── chrome-extension/       # Built extension

~/.logs/a2r/                # Log files
```

## Requirements

- Node.js 18+
- npm or pnpm
- Google Chrome (for extension)
- macOS, Linux, or Windows

## Troubleshooting

### Port Already in Use
Edit `~/.config/a2r/config.json` and change port numbers.

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
rm -rf ~/.a2r ~/.config/a2r ~/.logs/a2r

# Remove Chrome extension
# Manually remove from chrome://extensions

# Windows
rmdir /s "%USERPROFILE%\.a2r"
rmdir /s "%LOCALAPPDATA%\a2r"
```
