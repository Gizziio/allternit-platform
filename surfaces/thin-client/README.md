# Gizzi Thin Client

A lightweight, floating AI chat interface for macOS, Windows, and Linux. The Thin Client provides instant access to Gizzi's AI capabilities through a global hotkey (Cmd/Ctrl+Shift+A) while connecting to your local A2R Terminal Server.

![Gizzi Thin Client](./docs/screenshot.png)

## Features

- ⚡ **Instant Access** - Global hotkey (Cmd/Ctrl+Shift+A) to toggle from anywhere
- 💬 **Streaming Chat** - Real-time AI responses with markdown support
- 🔌 **Local-First** - Connects to your own Terminal Server (port 4096)
- 🤖 **Agent Mode** - Enable autonomous agent capabilities
- 🖥️ **Computer Use** - Browser and desktop automation integration
- 🎨 **Theme Support** - Light, dark, and system theme modes
- 💾 **Persistent Settings** - Remembers your preferences
- 🔒 **Privacy Focused** - All data stays on your machine

## Quick Start

### Prerequisites

1. **A2R Terminal Server** must be running:
   ```bash
   cd /path/to/a2rchitech
   ./dev/scripts/start-all.sh
   ```

2. **Node.js 18+** and **npm**

### Installation

```bash
# Clone the repository
git clone https://github.com/a2r/thin-client.git
cd thin-client

# Install dependencies
npm install

# Start development
npm run dev
```

### Building for Production

```bash
# Build for all platforms
npm run build:prod

# Or build for specific platform
npm run build:prod -- --mac
npm run build:prod -- --win
npm run build:prod -- --linux
```

Built applications will be in the `release/` directory.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Gizzi Thin Client                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Renderer   │  │  Main Process│  │    Preload   │       │
│  │  (React UI)  │◄─┤   (Electron) │◄─┤   (Bridge)   │       │
│  └──────┬───────┘  └──────────────┘  └──────────────┘       │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP/WebSocket
          ▼
┌─────────────────────────────────────────────────────────────┐
│              A2R Terminal Server (localhost:4096)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  gizzi-code  │  │   OpenClaw   │  │  Chat Store  │       │
│  │   Server     │  │   Gateway    │  │   (SQLite)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl+Shift+A` | Toggle window visibility |
| `Esc` | Hide window |
| `Cmd/Ctrl+K` | Focus input field |
| `Cmd/Ctrl+,` | Open settings |
| `Enter` | Send message |
| `Shift+Enter` | New line |

## Configuration

Settings are automatically persisted to localStorage. You can also configure via environment variables:

```bash
# Backend configuration
REACT_APP_API_URL=http://localhost:4096
REACT_APP_COMPUTER_USE_URL=http://localhost:8080

# Feature flags
REACT_APP_ENABLE_AGENT_MODE=true
REACT_APP_ENABLE_COMPUTER_USE=true
```

## Development

```bash
# Start in development mode
npm run dev

# Type check
npm run typecheck

# Lint
npm run lint

# Clean build artifacts
npm run clean
```

## Project Structure

```
thin-client/
├── build/                  # Build resources (icons, entitlements)
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point, window management
│   │   ├── app-discovery.ts    # Detect frontmost applications
│   │   └── connection-manager.ts  # Backend connection handling
│   ├── preload/           # Electron preload script
│   │   └── index.ts       # IPC bridge setup
│   └── renderer/          # React frontend
│       ├── components/    # UI components
│       ├── hooks/         # React hooks
│       ├── stores/        # Zustand stores
│       └── styles/        # Global CSS
├── docs/                  # Documentation
├── package.json
└── README.md
```

## Platform-Specific Notes

### macOS
- Requires macOS 10.15 (Catalina) or later
- Notarized and stapled for distribution
- Uses `hardenedRuntime` and entitlements

### Windows
- Supports Windows 10 and 11
- NSIS installer and portable builds
- Auto-updater support

### Linux
- AppImage and .deb packages
- Tested on Ubuntu 20.04+, Fedora 34+

## Troubleshooting

### "Gizzi Terminal Server Not Running"
The thin client requires the Terminal Server to be running:
```bash
./dev/scripts/start-all.sh
```

### Window doesn't appear
Check if another instance is already running (single instance lock):
```bash
# macOS
pkill -f "Gizzi Thin Client"

# Windows (PowerShell)
Get-Process "Gizzi Thin Client" | Stop-Process

# Linux
killall "gizzi-thin-client"
```

### Connection issues
Check if port 4096 is available:
```bash
lsof -i :4096
```

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for more.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- Documentation: [docs/](./docs/)
- Issues: [GitHub Issues](https://github.com/a2r/thin-client/issues)
- Discussions: [GitHub Discussions](https://github.com/a2r/thin-client/discussions)

---

Built with ❤️ by the A2R Team
