# A2R Platform - Single Binary Distribution Guide

## Overview

This guide describes the portable distribution system for A2R Platform that creates a near-single-binary experience using a Rust launcher with bundled assets.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         A2R Platform                                     │
│                    (Portable Distribution)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │a2r-desktop  │ │a2rchitech   │ │a2r-launcher │ │a2rchitech   │        │
│  │(Electron)   │ │   -cli      │ │ (Browser)   │ │    -api     │        │
│  │  364KB      │ │   17MB      │ │   346KB     │ │    40MB     │        │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └──────┬──────┘        │
│         │               │               │               │               │
│         │               │               └───────┬───────┘               │
│         │               │                       │                       │
│         │               └───────────┬───────────┘                       │
│         │                           │                                   │
│         └───────────────────┬───────┘                                   │
│                             │                                           │
│                    ┌────────▼────────┐                                  │
│                    │  API Server     │                                  │
│                    │  Port 3010      │                                  │
│                    └────────┬────────┘                                  │
│                             │                                           │
│         ┌───────────────────┼───────────────────┐                       │
│         │                   │                   │                       │
│  ┌──────▼─────┐    ┌────────▼────────┐  ┌──────▼──────┐                │
│  │  Desktop   │    │   Web Browser   │  │  Terminal   │                │
│  │ (Electron) │    │   (React UI)    │  │  (CLI/TUI)  │                │
│  └────────────┘    └─────────────────┘  └─────────────┘                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Build Output

The build produces:
- **a2r-platform-0.1.0-darwin-arm64.tar.gz** (43MB) - Portable archive
- **a2r-platform-0.1.0-darwin-arm64.zip** (43MB) - Windows-friendly archive
- **A2R Platform.app/** - macOS app bundle (browser mode)

### Size Breakdown
| Component | Size | Purpose |
|-----------|------|---------|
| a2r-desktop | 364KB | Desktop launcher (API + Electron) |
| a2r-launcher | 346KB | Browser launcher (API + browser) |
| a2rchitech-api | 40MB | API server |
| a2rchitech | 17MB | CLI/TUI tool |
| ui/ | 16MB | Web UI assets |
| electron/ | 24KB | Electron shell files |
| **Total** | **~73MB** | Uncompressed |

### Distribution Contents
```
a2r-platform/
├── a2r-desktop              # Desktop launcher (Electron mode)
├── a2r-launcher             # Browser launcher (Browser mode)
├── a2rchitech-api           # API server binary (THE KERNEL)
├── a2rchitech               # CLI/TUI client (connects to API)
├── ui/                      # Web UI assets
├── electron/                # Electron shell files
├── start-desktop.sh         # Desktop mode entry point
├── start.sh                 # Browser mode entry point
├── start-cli.sh             # CLI mode entry point (auto-starts API)
├── A2R Platform.app/        # macOS app bundle
└── README.txt               # Documentation
```

**The Kernel**: `a2rchitech-api` is the actual kernel - it runs the HTTP API,
manages the database, handles sessions, etc. All other components are clients
that connect to it.

## Components

### 1. Rust Launcher (350KB)
- **Source**: `distribution/launcher-simplified/`
- **Purpose**: Manages API lifecycle, opens browser
- **Features**:
  - Auto-detects bundled API binary
  - Sets up environment variables
  - Opens default browser automatically
  - Handles cleanup on exit

### 2. API Binary (40MB)
- **Source**: `7-apps/api/`
- **Features**:
  - Axum-based HTTP server
  - Serves static UI files
  - REST API endpoints
  - WebSocket support
  - SQLite database

### 3. UI Assets (16MB)
- **Source**: `7-apps/shell-ui/dist/`
- **Framework**: React + Vite
- **Features**:
  - Agent management
  - Model selection
  - Chat interface
  - Settings panel

### 4. CLI/TUI Binary (17MB)
- **Source**: `7-apps/cli/`
- **Binary**: `a2rchitech`
- **Features**:
  - Command-line interface for all operations
  - Terminal UI mode (`a2rchitech tui`)
  - Session management
  - Health checks and diagnostics
  - OpenClaw-compatible commands

### 5. Desktop Launcher (364KB)
- **Source**: `distribution/launcher-desktop/`
- **Binary**: `a2r-desktop`
- **Purpose**: Manages API + Electron together
- **Features**:
  - Starts API server
  - Launches Electron shell
  - Falls back to browser if Electron unavailable

## User Experience

### Three Ways to Run

#### 1. Desktop Mode (Electron) - RECOMMENDED
```bash
./start-desktop.sh
# or
./a2r-desktop
```
- **Native desktop window** - looks like a real app
- System tray integration
- Global hotkeys (Cmd/Ctrl+Shift+A)
- Native menus and window chrome
- Falls back to browser if Electron not installed

**Requirements**: Electron (`npm install -g electron`)

#### 2. Browser Mode (Web UI)
```bash
./start.sh
# or
./a2r-launcher
```
- Opens your **default browser**
- Full web interface (React/Vite)
- Works on any system with a browser
- No additional dependencies

#### 3. Terminal Mode (CLI/TUI)

**Important**: The CLI/TUI is a **client** that connects to the API/kernel.

**Self-contained (recommended):**
```bash
# These commands auto-start the API if needed
./start-cli.sh tui               # Interactive terminal UI
./start-cli.sh status            # Check system status  
./start-cli.sh health            # Check API health
./start-cli.sh sessions          # List active sessions
./start-cli.sh doctor            # Run diagnostics
```

**Direct CLI (requires API already running):**
```bash
./a2rchitech tui                 # TUI (fails if API not running)
./a2rchitech status              # Status command
./a2rchitech --help              # Show all commands
```

**Architecture:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ start-cli.sh│────▶│  API (3010) │────▶│  CLI/TUI    │
│  wrapper    │     │   kernel    │     │   client    │
└─────────────┘     └─────────────┘     └─────────────┘
  Auto-starts           Runs the          Interactive
  API if not            actual            terminal
  already running       kernel            interface
```

- The CLI (`a2rchitech`) is a **client**, not the kernel itself
- It connects to `a2rchitech-api` (the actual kernel) on port 3010
- `start-cli.sh` wrapper makes it self-contained by auto-starting the API
- All three modes (Desktop, Browser, Terminal) share the **same kernel**

### TUI Mode (Terminal UI)

### First Launch
```bash
# Extract
tar -xzf a2r-platform-0.1.0-darwin-arm64.tar.gz
cd a2r-platform

# Run
./start.sh
```

### What Happens
1. Launcher starts
2. API server starts on port 3010
3. Browser opens automatically
4. User sees the A2R Platform UI
5. Data stored in `~/Library/Application Support/A2R Platform`

### Daily Use
```bash
# Just run the launcher
./a2r-launcher
```

Or double-click `A2R Platform.app` on macOS.

## Build Process

```bash
# One-command build
./distribution/build-portable.sh

# Steps:
# 1. Build Rust API (cargo build --release)
# 2. Copy UI assets (from shell-ui/dist/)
# 3. Build Rust launcher
# 4. Create wrapper scripts
# 5. Create macOS app bundle
# 6. Package into tar.gz and zip
```

## CLI Commands Reference

### Essential Commands
```bash
# System operations
./a2rchitech up              # Start the API daemon
./a2rchitech down            # Stop the API daemon
./a2rchitech status          # Check system status
./a2rchitech health          # Check API health
./a2rchitech doctor          # Run diagnostics

# Session management
./a2rchitech sessions        # List active sessions
./a2rchitech tui             # Launch Terminal UI
./a2rchitech repl            # Interactive chat mode

# Agent operations
./a2rchitech skills          # Manage skills
./a2rchitech tools           # Manage tools
./a2rchitech cap             # Capsule operations
./a2rchitech task            # Task graph operations

# Configuration
./a2rchitech config          # View/edit configuration
./a2rchitech auth            # Authentication setup
./a2rchitech model           # Model selection
```

### TUI Mode (Terminal UI)
The TUI provides a rich terminal interface with:
- Chat-first operator workspace
- Animated intro wizard
- Slash commands (`/skills`, `/path`, `/cd`, `/shell`)
- Prompt queue controls
- Telemetry footer

```bash
./a2rchitech tui --help      # TUI options
./a2rchitech tui --url http://localhost:3010
```

## Distribution Options Comparison

| Approach | Size | Pros | Cons | Best For |
|----------|------|------|------|----------|
| **Portable (Current)** | ~43MB | Fast, CLI+GUI, native feel | Multiple files | Daily use |
| True Single Binary | ~200MB | One file only | Slow extraction, large | USB drives |
| WASM-only | ~5MB | Tiny, fast | Limited UI, no CLI | Embedded systems |
| App Bundle | ~30MB | Native macOS feel | macOS only | macOS users |

## Why Not True Single Binary?

We evaluated a true single binary using `include_bytes!` with compression:
- **Size**: ~200MB (with embedded Electron + API)
- **First-run delay**: ~500ms extraction time
- **Complexity**: Complex build.rs, temp file management

The portable approach is preferred because:
1. **Faster builds** - No embedding step
2. **Faster startup** - No extraction needed
3. **Smaller size** - 43MB vs 200MB (with CLI)
4. **Same UX** - Still feels like one app
5. **Easier updates** - Replace individual components
6. **Includes CLI** - Full terminal interface included

## Future Improvements

### Code Signing (Required for distribution)
```bash
# macOS
codesign --force --deep --sign "Developer ID" "A2R Platform.app"

# Create notarized DMG
hdiutil create -volname "A2R Platform" -srcfolder "A2R Platform.app" a2r-platform.dmg
xcrun notarytool submit a2r-platform.dmg --wait
```

### Auto-Updater
- Integrate Tauri updater or similar
- Check for updates on startup
- Download and apply patches

### Cross-Platform Builds
```bash
# Windows (from Linux/macOS with cross)
cargo build --target x86_64-pc-windows-gnu

# Linux ARM64
cargo build --target aarch64-unknown-linux-gnu
```

## File Structure

```
distribution/
├── build-portable.sh           # Main build script
├── launcher-simplified/        # Rust launcher source
│   ├── Cargo.toml
│   └── src/main.rs
├── build/
│   └── portable/               # Build output
│       └── a2r-platform/
│           ├── a2r-launcher
│           ├── a2rchitech-api
│           ├── a2rchitech      # CLI binary
│           ├── ui/
│           ├── start.sh
│           ├── start-cli.sh    # CLI launcher
│           ├── start.bat
│           ├── README.txt
│           └── A2R Platform.app/
└── dist/                       # Packaged releases
    ├── a2r-platform-0.1.0-darwin-arm64.tar.gz
    └── a2r-platform-0.1.0-darwin-arm64.zip
```

## Testing

```bash
# Test the launcher
cd build/portable/a2r-platform
./a2r-launcher

# Verify API
curl http://127.0.0.1:3010/health

# Clean up
pkill -f a2r-launcher
pkill -f a2rchitech-api
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3010 | API server port |
| `A2R_OPERATOR_URL` | http://127.0.0.1:3010 | API base URL |
| `A2R_DATA_DIR` | Platform-specific | Data storage location |
| `A2R_STATIC_DIR` | ./ui | Static UI assets path |
| `RUST_LOG` | info | Logging level |

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port 3010
lsof -ti:3010 | xargs kill -9
```

### Permission Denied
```bash
chmod +x a2r-launcher a2rchitech-api
```

### Missing UI Files
```bash
# Ensure UI assets exist
ls ui/index.html
```

## License

Copyright (c) 2026 A2R Platform Contributors
