# Allternit Platform Distribution

Portable distribution of Allternit Platform with three interface modes.

## Quick Start

```bash
# Download and extract
tar -xzf allternit-platform-0.1.0-darwin-arm64.tar.gz
cd allternit-platform

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

All modes connect to the **same kernel** (`allternit-api` on port 3010):

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
                    │allternit-api
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

Output: `dist/allternit-platform-0.1.0-PLATFORM-ARCH.tar.gz`

## File Structure

```
allternit-platform/
├── start-desktop.sh      # Desktop entry point
├── start.sh              # Browser entry point  
├── start-cli.sh          # Terminal entry point
├── allternit-desktop           # Desktop launcher
├── allternit-launcher          # Browser launcher
├── allternit-api        # Kernel (API server)
├── allternit            # CLI client
├── ui/                   # Web UI assets
├── electron/             # Electron shell
└── Allternit Platform.app/     # macOS bundle
```

## License

Copyright (c) 2026 Allternit Platform Contributors
