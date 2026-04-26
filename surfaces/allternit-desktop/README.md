# Allternit Desktop

Self-hosted AI platform desktop client. Connect to your own Allternit instance running on VPS or locally.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Allternit Desktop (This App)                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Electron UI (~50MB)                                   │   │
│  │  • Connection management                                 │   │
│  │  • Auto-updater (UI only)                               │   │
│  │  • System tray                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │ HTTPS/WebSocket                                      │
│         ▼                                                        │
└─────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              Your Allternit Backend (Self-Hosted)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • Allternit Platform (Next.js UI)                            │   │
│  │  • API Server (Rust)                                    │   │
│  │  • Kernel Service                                       │   │
│  │  • All other services                                   │   │
│  │  • SQLite/PostgreSQL database                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Runs on:                                                        │
│  • Your VPS (cloud)                                             │
│  • Your local machine                                           │
│  • Docker container                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

### Download

| Platform | Download |
|----------|----------|
| macOS | [Allternit-Desktop.dmg](https://github.com/allternit/desktop/releases/latest) |
| Windows | [Allternit-Desktop-Setup.exe](https://github.com/allternit/desktop/releases/latest) |
| Linux | [Allternit-Desktop.AppImage](https://github.com/allternit/desktop/releases/latest) |

```bash
# macOS (Homebrew)
brew tap allternit/desktop
brew install --cask allternit-desktop

# Windows (Winget)
winget install Allternit.Desktop
```

## Setup

### First Launch

1. **Install Allternit Backend** (if you haven't):
   ```bash
   # On your VPS or local machine
   curl -fsSL https://allternit.com/install-backend.sh | bash
   ```

2. **Open Allternit Desktop**

3. **Configure Connection**:
   - **Local Mode**: Connect to `localhost:4096` (backend running on same machine)
   - **VPS Mode**: Connect to your VPS URL (e.g., `https://allternit.yourdomain.com`)

4. **Click "Connect"**

## Connection Modes

### Local Mode
Run the full Allternit stack on your local machine:

```bash
# Start all services
./dev/scripts/start-all-services.sh

# Or use the simplified start
allternit start
```

Then in Allternit Desktop, select **Local** mode with port `4096`.

### VPS Mode
Host Allternit on your own VPS:

```bash
# On your VPS
ssh user@your-vps
curl -fsSL https://allternit.com/install-backend.sh | bash
# Configure HTTPS with your domain
```

Then in Allternit Desktop, select **VPS** mode and enter your URL.

## Updating

### Desktop App (UI)
Auto-updates automatically via electron-updater.

### Backend (Your Server)
You control when to update your backend:

```bash
# SSH to your VPS
ssh user@your-vps

# Update Allternit backend
cd ~/allternit
./scripts/update.sh

# Or with Docker
docker pull allternit/backend:latest
docker-compose up -d
```

## Configuration

Settings stored in:
- **macOS**: `~/Library/Application Support/Allternit Desktop/`
- **Windows**: `%APPDATA%/Allternit Desktop/`
- **Linux**: `~/.config/Allternit Desktop/`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ALLTERNIT_DESKTOP_LOG_LEVEL` | Log level (debug, info, warn, error) |

## Troubleshooting

### "Cannot connect to backend"

1. Check if backend is running:
   ```bash
   curl http://localhost:4096/health
   ```

2. Check firewall/VPS security groups

3. Verify HTTPS certificate (for VPS mode)

### Reset Connection

Delete the config file to reset:
```bash
# macOS
rm ~/Library/Application\ Support/Allternit\ Desktop/config.json

# Windows
rmdir /s "%APPDATA%\Allternit Desktop"

# Linux
rm -rf ~/.config/Allternit\ Desktop
```

## Development

```bash
cd surfaces/allternit-desktop

# Install dependencies
npm install

# Run in dev mode
npm run dev

# Build for production
npm run build:prod
```

## Data & Privacy

- **Desktop app**: Only stores connection settings locally
- **Your data**: Stored on YOUR backend (VPS or local)
- **No telemetry**: We don't track usage
- **No central servers**: You control everything

## Support

- **Documentation**: https://docs.allternit.com/desktop
- **Backend Setup**: https://docs.allternit.com/self-host
- **Issues**: https://github.com/allternit/desktop/issues

## License

MIT License
