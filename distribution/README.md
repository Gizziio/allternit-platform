# A2R Platform Distribution

Portable distribution of A2R Platform with three interface modes.

## Quick Start

```bash
# Download and extract
tar -xzf a2r-platform-0.1.0-darwin-arm64.tar.gz
cd a2r-platform

# Choose your mode:
./start-desktop.sh    # Desktop app (Electron)
./start.sh            # Web browser
./start-cli.sh tui    # Terminal UI
```

## Three Modes

| Mode | Command | Best For | Requirements |
|------|---------|----------|--------------|
| **Desktop** | `./start-desktop.sh` | Daily use | Electron* |
| **Browser** | `./start.sh` | Quick access | Any browser |
| **Terminal** | `./start-cli.sh tui` | Power users | Terminal |

*Electron: `npm install -g electron` (optional - falls back to browser)

## Architecture

All modes connect to the **same kernel** (`a2rchitech-api` on port 3010):

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Desktop    │    │   Browser    │    │   Terminal   │
│  (Electron)  │    │    (Web)     │    │  (CLI/TUI)   │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   KERNEL    │
                    │a2rchitech-api
                    │  Port 3010  │
                    └─────────────┘
```

## Documentation

- **[SINGLE_BINARY_GUIDE.md](./SINGLE_BINARY_GUIDE.md)** - Technical overview
- **[TECHNICAL_DOCUMENTATION.md](./TECHNICAL_DOCUMENTATION.md)** - Deep dive & standards

## Build

```bash
./distribution/build-portable.sh
```

Output: `dist/a2r-platform-0.1.0-PLATFORM-ARCH.tar.gz`

## File Structure

```
a2r-platform/
├── start-desktop.sh      # Desktop entry point
├── start.sh              # Browser entry point  
├── start-cli.sh          # Terminal entry point
├── a2r-desktop           # Desktop launcher
├── a2r-launcher          # Browser launcher
├── a2rchitech-api        # Kernel (API server)
├── a2rchitech            # CLI client
├── ui/                   # Web UI assets
├── electron/             # Electron shell
└── A2R Platform.app/     # macOS bundle
```

## License

Copyright (c) 2026 A2R Platform Contributors
