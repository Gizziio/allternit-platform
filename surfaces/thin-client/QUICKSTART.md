# Quick Start Guide

Get up and running with Gizzi Thin Client in 5 minutes.

## Prerequisites

1. **Terminal Server Running**
   ```bash
   cd /path/to/a2rchitech
   ./dev/scripts/start-all.sh
   ```
   Wait for "Server ready on port 4096"

2. **Node.js 18+** installed

## Installation

```bash
# Clone repository
git clone https://github.com/a2r/thin-client.git
cd thin-client

# Install dependencies
npm install

# Start development
npm run dev
```

The app will open automatically.

## Basic Usage

### Open/Close
- **Global Hotkey**: `Cmd/Ctrl+Shift+A`
- **Close**: `Esc` or click ✕ button

### Send a Message
1. Press hotkey to open
2. Type your message
3. Press `Enter` to send

### Switch Models
1. Click the model selector (bottom left)
2. Choose a provider and model
3. Your preference is saved automatically

### Enable Agent Mode
1. Click the 🤖 toggle
2. Orange glow indicates agent mode is active

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+A` | Toggle window |
| `Esc` | Hide window |
| `Cmd/Ctrl+K` | Focus input |
| `Cmd/Ctrl+,` | Settings |
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Troubleshooting

### "Server Not Running"
```bash
# Start Terminal Server
./dev/scripts/start-all.sh

# Check if port 4096 is free
lsof -i :4096
```

### Window Won't Appear
```bash
# Kill existing process
pkill -f "Gizzi Thin Client"  # macOS/Linux
taskkill /F /IM "Gizzi Thin Client.exe"  # Windows
```

### Reset Everything
```bash
# macOS
rm -rf ~/Library/Application\ Support/gizzi-thin-client

# Windows
rmdir /s "%APPDATA%\gizzi-thin-client"

# Linux
rm -rf ~/.config/gizzi-thin-client
```

## Next Steps

- Read [README.md](../README.md) for full documentation
- Check [API docs](API_DOCUMENTATION.md) for integration
- See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for issues

## Build for Production

```bash
# Build for your platform
npm run build:prod

# Find installer in:
# macOS: release/*.dmg
# Windows: release/*.exe
# Linux: release/*.AppImage
```

---

**Need help?** Open an issue on GitHub or join our Discord.
