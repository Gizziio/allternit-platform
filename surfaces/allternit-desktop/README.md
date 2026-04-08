# A2R Desktop

Self-hosted AI platform desktop client. Connect to your own A2R instance running on VPS or locally.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     A2R Desktop (This App)                       │
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
│              Your A2R Backend (Self-Hosted)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  • A2R Platform (Next.js UI)                            │   │
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
| macOS | [A2R-Desktop.dmg](https://github.com/a2r/desktop/releases/latest) |
| Windows | [A2R-Desktop-Setup.exe](https://github.com/a2r/desktop/releases/latest) |
| Linux | [A2R-Desktop.AppImage](https://github.com/a2r/desktop/releases/latest) |

```bash
# macOS (Homebrew)
brew tap a2r/desktop
brew install --cask a2r-desktop

# Windows (Winget)
winget install A2R.Desktop
```

## Setup

### First Launch

1. **Install A2R Backend** (if you haven't):
   ```bash
   # On your VPS or local machine
   curl -fsSL https://a2r.io/install-backend.sh | bash
   ```

2. **Open A2R Desktop**

3. **Configure Connection**:
   - **Local Mode**: Connect to `localhost:4096` (backend running on same machine)
   - **VPS Mode**: Connect to your VPS URL (e.g., `https://a2r.yourdomain.com`)

4. **Click "Connect"**

## Connection Modes

### Local Mode
Run the full A2R stack on your local machine:

```bash
# Start all services
./dev/scripts/start-all-services.sh

# Or use the simplified start
a2r start
```

Then in A2R Desktop, select **Local** mode with port `4096`.

### VPS Mode
Host A2R on your own VPS:

```bash
# On your VPS
ssh user@your-vps
curl -fsSL https://a2r.io/install-backend.sh | bash
# Configure HTTPS with your domain
```

Then in A2R Desktop, select **VPS** mode and enter your URL.

## Updating

### Desktop App (UI)
Auto-updates automatically via electron-updater.

### Backend (Your Server)
You control when to update your backend:

```bash
# SSH to your VPS
ssh user@your-vps

# Update A2R backend
cd ~/a2r
./scripts/update.sh

# Or with Docker
docker pull a2r/backend:latest
docker-compose up -d
```

## Configuration

Settings stored in:
- **macOS**: `~/Library/Application Support/A2R Desktop/`
- **Windows**: `%APPDATA%/A2R Desktop/`
- **Linux**: `~/.config/A2R Desktop/`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `A2R_DESKTOP_LOG_LEVEL` | Log level (debug, info, warn, error) |

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
rm ~/Library/Application\ Support/A2R\ Desktop/config.json

# Windows
rmdir /s "%APPDATA%\A2R Desktop"

# Linux
rm -rf ~/.config/A2R\ Desktop
```

## Development

```bash
cd 7-apps/a2r-desktop

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

- **Documentation**: https://docs.a2r.io/desktop
- **Backend Setup**: https://docs.a2r.io/self-host
- **Issues**: https://github.com/a2r/desktop/issues

## License

MIT License
