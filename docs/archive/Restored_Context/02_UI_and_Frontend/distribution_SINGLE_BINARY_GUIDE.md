# Allternit Platform - Single Binary Distribution Guide

## Overview

This guide describes the portable distribution system for Allternit Platform that creates a near-single-binary experience using a Rust launcher with bundled assets.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Allternit Platform                                     │
│                    (Portable Distribution)                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │allternit-desktop  │ │allternit   │ │allternit-launcher │ │allternit   │        │
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
- **allternit-platform-0.1.0-darwin-arm64.tar.gz** (43MB) - Portable archive
- **allternit-platform-0.1.0-darwin-arm64.zip** (43MB) - Windows-friendly archive
- **Allternit Platform.app/** - macOS app bundle (browser mode)

### Size Breakdown
| Component | Size | Purpose |
|-----------|------|---------|
| allternit-desktop | 364KB | Desktop launcher (API + Electron) |
| allternit-launcher | 346KB | Browser launcher (API + browser) |
| allternit-api | 40MB | API server |
| allternit | 17MB | CLI/TUI tool |
| ui/ | 16MB | Web UI assets |
| electron/ | 24KB | Electron shell files |
| **Total** | **~73MB** | Uncompressed |

### Distribution Contents
```
allternit-platform/
├── allternit-desktop              # Desktop launcher (Electron mode)
├── allternit-launcher             # Browser launcher (Browser mode)
├── allternit-api           # API server binary (THE KERNEL)
├── allternit               # CLI/TUI client (connects to API)
├── ui/                      # Web UI assets
├── electron/                # Electron shell files
├── start-desktop.sh         # Desktop mode entry point
├── start.sh                 # Browser mode entry point
├── start-cli.sh             # CLI mode entry point (auto-starts API)
├── Allternit Platform.app/        # macOS app bundle
└── README.txt               # Documentation
```

**The Kernel**: `allternit-api` is the actual kernel - it runs the HTTP API,
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
- **Source**: `cmd/api/`
- **Features**:
  - Axum-based HTTP server
  - Serves static UI files
  - REST API endpoints
  - WebSocket support
  - SQLite database

### 3. UI Assets (16MB)
- **Source**: `cmd/shell-ui/dist/`
- **Framework**: React + Vite
- **Features**:
  - Agent management
  - Model selection
  - Chat interface
  - Settings panel

### 4. CLI/TUI Binary (17MB)
- **Source**: `cmd/cli/`
- **Binary**: `allternit`
- **Features**:
  - Command-line interface for all operations
  - Terminal UI mode (`allternit tui`)
  - Session management
  - Health checks and diagnostics
  - OpenClaw-compatible commands

### 5. Desktop Launcher (364KB)
- **Source**: `distribution/launcher-desktop/`
- **Binary**: `allternit-desktop`
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
./allternit-desktop
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
./allternit-launcher
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
./allternit tui                 # TUI (fails if API not running)
./allternit status              # Status command
./allternit --help              # Show all commands
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

- The CLI (`allternit`) is a **client**, not the kernel itself
- It connects to `allternit-api` (the actual kernel) on port 3010
- `start-cli.sh` wrapper makes it self-contained by auto-starting the API
- All three modes (Desktop, Browser, Terminal) share the **same kernel**

### TUI Mode (Terminal UI)

### First Launch
```bash
# Extract
tar -xzf allternit-platform-0.1.0-darwin-arm64.tar.gz
cd allternit-platform

# Run
./start.sh
```

### What Happens
1. Launcher starts
2. API server starts on port 3010
3. Browser opens automatically
4. User sees the Allternit Platform UI
5. Data stored in `~/Library/Application Support/Allternit Platform`

### Daily Use
```bash
# Just run the launcher
./allternit-launcher
```

Or double-click `Allternit Platform.app` on macOS.

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
./allternit up              # Start the API daemon
./allternit down            # Stop the API daemon
./allternit status          # Check system status
./allternit health          # Check API health
./allternit doctor          # Run diagnostics

# Session management
./allternit sessions        # List active sessions
./allternit tui             # Launch Terminal UI
./allternit repl            # Interactive chat mode

# Agent operations
./allternit skills          # Manage skills
./allternit tools           # Manage tools
./allternit cap             # Capsule operations
./allternit task            # Task graph operations

# Configuration
./allternit config          # View/edit configuration
./allternit auth            # Authentication setup
./allternit model           # Model selection
```

### TUI Mode (Terminal UI)
The TUI provides a rich terminal interface with:
- Chat-first operator workspace
- Animated intro wizard
- Slash commands (`/skills`, `/path`, `/cd`, `/shell`)
- Prompt queue controls
- Telemetry footer

```bash
./allternit tui --help      # TUI options
./allternit tui --url http://localhost:3010
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
codesign --force --deep --sign "Developer ID" "Allternit Platform.app"

# Create notarized DMG
hdiutil create -volname "Allternit Platform" -srcfolder "Allternit Platform.app" allternit-platform.dmg
xcrun notarytool submit allternit-platform.dmg --wait
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
│       └── allternit-platform/
│           ├── allternit-launcher
│           ├── allternit-api
│           ├── allternit      # CLI binary
│           ├── ui/
│           ├── start.sh
│           ├── start-cli.sh    # CLI launcher
│           ├── start.bat
│           ├── README.txt
│           └── Allternit Platform.app/
└── dist/                       # Packaged releases
    ├── allternit-platform-0.1.0-darwin-arm64.tar.gz
    └── allternit-platform-0.1.0-darwin-arm64.zip
```

## Testing

```bash
# Test the launcher
cd build/portable/allternit-platform
./allternit-launcher

# Verify API
curl http://127.0.0.1:3010/health

# Clean up
pkill -f allternit-launcher
pkill -f allternit-api
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3010 | API server port |
| `ALLTERNIT_OPERATOR_URL` | http://127.0.0.1:3010 | API base URL |
| `ALLTERNIT_DATA_DIR` | Platform-specific | Data storage location |
| `ALLTERNIT_STATIC_DIR` | ./ui | Static UI assets path |
| `RUST_LOG` | info | Logging level |

## Troubleshooting

### Port Already in Use
```bash
# Find and kill process using port 3010
lsof -ti:3010 | xargs kill -9
```

### Permission Denied
```bash
chmod +x allternit-launcher allternit-api
```

### Missing UI Files
```bash
# Ensure UI assets exist
ls ui/index.html
```

## License

Copyright (c) 2026 Allternit Platform Contributors
