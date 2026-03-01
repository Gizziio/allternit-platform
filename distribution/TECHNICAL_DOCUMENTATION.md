# A2R Platform Distribution - Technical Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Breakdown](#component-breakdown)
3. [How It Works](#how-it-works)
4. [Build System](#build-system)
5. [Standards for Edits](#standards-for-edits)
6. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          A2R Platform Distribution                          │
│                              (Single Portable)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         THE KERNEL                                  │   │
│  │                    a2rchitech-api (Port 3010)                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  HTTP API    │  │  WebSocket   │  │   SQLite DB  │              │   │
│  │  │  (REST)      │  │  (Realtime)  │  │  (Storage)   │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │Session Mgmt  │  │ Tool Exec    │  │Static Files  │              │   │
│  │  │(State)       │  │ (Skills)     │  │(Web UI)      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              ▲                                              │
│          ┌───────────────────┼───────────────────┐                          │
│          │                   │                   │                          │
│          ▼                   ▼                   ▼                          │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                 │
│  │ Desktop Mode  │   │ Browser Mode  │   │ Terminal Mode │                 │
│  │  (Electron)   │   │    (Web)      │   │   (CLI/TUI)   │                 │
│  └───────────────┘   └───────────────┘   └───────────────┘                 │
│                                                                             │
│  Entry Points:                                                              │
│  • ./start-desktop.sh  • ./start.sh      • ./start-cli.sh                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Design Philosophy

**Single Kernel, Multiple Interfaces**

The architecture follows a **client-server model** where:
- **One Kernel** (`a2rchitech-api`) runs the core logic
- **Multiple Clients** connect to the kernel via HTTP/WebSocket
- All state lives in the kernel
- Clients are stateless (can be restarted without losing data)

This allows:
- **Interchangeable UIs** - Switch between Desktop, Browser, Terminal without losing session
- **Remote Access** - Connect from another machine
- **Headless Operation** - Run kernel on server, connect via CLI

---

## Component Breakdown

### 1. The Kernel: `a2rchitech-api`

**Purpose**: The core engine that runs everything

**Size**: ~40MB

**Stack**: Rust + Axum + SQLite

**Key Responsibilities**:
```rust
// Pseudo-code of kernel responsibilities
fn main() {
    // 1. Initialize storage
    let db = Sqlite::open("a2rchitech.db");
    
    // 2. Load capsules (plugins)
    let capsules = CapsuleStore::load_all();
    
    // 3. Start HTTP server
    let app = Router::new()
        .route("/health", get(health_check))
        .route("/v1/sessions", post(create_session))
        .route("/v1/chat", post(chat_completion))
        .route("/v1/skills", get(list_skills))
        .fallback_service(ServeDir::new("ui/"));  // Static files
    
    // 4. Start WebSocket server for real-time updates
    let ws = WebSocketServer::new();
    
    // 5. Run event loop
    tokio::run(app.bind("127.0.0.1:3010"));
}
```

**API Endpoints**:
- `GET /health` - Health check
- `GET /v1/sessions` - List sessions
- `POST /v1/sessions` - Create session
- `POST /v1/chat` - Chat completion
- `GET /v1/skills` - List available skills
- `WS /v1/stream` - Real-time streaming

**Data Storage**:
- Location: `~/.a2r-platform/` (Linux) or `~/Library/Application Support/A2R Platform/` (macOS)
- Database: `a2rchitech.db` (SQLite)
- Logs: `a2rchitech.jsonl` (JSON Lines)

### 2. The Desktop Client: `a2r-desktop`

**Purpose**: Launches kernel + Electron for native desktop experience

**Size**: ~364KB

**Stack**: Rust + std::process

**Flow**:
```rust
fn main() {
    // 1. Start kernel
    let api = Command::new("./a2rchitech-api").spawn();
    
    // 2. Wait for kernel to be ready
    wait_for_api("http://127.0.0.1:3010");
    
    // 3. Try to launch Electron
    if let Some(electron) = find_electron() {
        Command::new(electron)
            .env("A2R_OPERATOR_URL", "http://127.0.0.1:3010")
            .spawn();
    } else {
        // Fallback: open browser
        open_browser("http://127.0.0.1:3010");
    }
    
    // 4. Wait for either to exit
    wait_for_exit(api, electron);
}
```

**Features**:
- Manages kernel lifecycle
- Auto-finds Electron (system PATH, local node_modules)
- Falls back to browser
- Cleans up on exit

### 3. The Browser Client: `a2r-launcher`

**Purpose**: Launches kernel + opens browser

**Size**: ~346KB

**Stack**: Rust + std::process

**Flow**:
```rust
fn main() {
    // 1. Start kernel
    let api = Command::new("./a2rchitech-api").spawn();
    
    // 2. Wait for kernel
    wait_for_api("http://127.0.0.1:3010");
    
    // 3. Open browser
    open_browser("http://127.0.0.1:3010");
    
    // 4. Wait
    api.wait();
}
```

### 4. The CLI Client: `a2rchitech`

**Purpose**: Command-line interface to the kernel

**Size**: ~17MB

**Stack**: Rust + Clap + Ratatui (TUI)

**Architecture**:
```rust
// CLI is a THIN client - all logic is in the kernel
struct KernelClient {
    base_url: String,
    api_key: String,
}

impl KernelClient {
    async fn health(&self) -> Result<HealthStatus> {
        let resp = reqwest::get(&format!("{}/health", self.base_url)).await?;
        resp.json().await
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        let resp = reqwest::get(&format!("{}/v1/sessions", self.base_url)).await?;
        resp.json().await
    }
}
```

**Modes**:
- **Command Mode**: `./a2rchitech status` (one-shot)
- **TUI Mode**: `./a2rchitech tui` (interactive)

**Important**: The CLI does NOT contain the kernel. It connects to it.

### 5. The Web UI: `ui/`

**Purpose**: React-based web interface

**Size**: ~16MB

**Stack**: React + TypeScript + Vite + Tailwind

**How it works**:
- Static files served by kernel (`A2R_STATIC_DIR`)
- Connects to kernel API via fetch/WebSocket
- Single Page Application (SPA)

**Build from**: `7-apps/shell-ui/`

### 6. The Electron Shell: `electron/`

**Purpose**: Native desktop wrapper around Web UI

**Size**: ~24KB (just wrapper code)

**Stack**: Electron + Node.js

**How it works**:
- Creates native window
- Loads `http://127.0.0.1:3010` (kernel-served UI)
- Adds native features: global hotkeys, system tray, menus

**Note**: Requires Electron runtime (not bundled - too large)

---

## How It Works

### Scenario 1: First-Time User (Desktop Mode)

```bash
$ tar -xzf a2r-platform-0.1.0-darwin-arm64.tar.gz
$ cd a2r-platform
$ ./start-desktop.sh

[A2R Desktop] Starting A2R Platform Desktop...
[A2R Desktop] API: http://127.0.0.1:3010
[A2R Desktop] Data: /Users/user/.a2r-platform
[A2R Desktop] Starting API server...
API server started (PID: 12345)
[A2R Desktop] Waiting for API...
[A2R Desktop] API ready!
[A2R Desktop] Starting Electron...
[A2R Desktop] A2R Platform Desktop is running!
```

**What happens**:
1. `start-desktop.sh` runs `a2r-desktop`
2. `a2r-desktop` spawns `a2rchitech-api` (kernel)
3. Kernel initializes database, loads capsules
4. Kernel starts HTTP server on port 3010
5. `a2r-desktop` detects API is ready
6. `a2r-desktop` spawns Electron (or opens browser)
7. Electron loads `http://127.0.0.1:3010`
8. User sees native desktop app

### Scenario 2: Terminal User

```bash
$ ./start-cli.sh tui

[A2R CLI] Starting API server...
API server started (PID: 12345)
[A2R CLI] API ready!

┌──────────────────────────────────────────────────────────────────────┐
│ A2R Platform Terminal UI                                             │
├──────────────────────────────────────────────────────────────────────┤
│ Sessions: 3 active                                                   │
│                                                                      │
│ user> /skills                                                        │
│ system> Available skills:                                            │
│   • file-reader                                                      │
│   • web-search                                                       │
│   • code-executor                                                    │
│                                                                      │
│ user> Hello, can you help me analyze this code?                      │
│ ...                                                                  │
```

**What happens**:
1. `start-cli.sh` checks if API is running (it's not)
2. `start-cli.sh` spawns `a2rchitech-api`
3. Waits for API to be ready
4. Runs `a2rchitech tui`
5. CLI connects to `http://127.0.0.1:3010`
6. TUI renders interactive interface
7. User interacts with kernel through TUI
8. When user exits, `start-cli.sh` shuts down API

### Scenario 3: Web User

```bash
$ ./start.sh

Starting API server...
API server started (PID: 12345)
API is ready!

Opening browser to: http://127.0.0.1:3010

A2R Platform is running!
API: http://127.0.0.1:3010
Data: /Users/user/.a2r-platform
```

**What happens**:
1. `start.sh` runs `a2r-launcher`
2. `a2r-launcher` spawns `a2rchitech-api`
3. Waits for API
4. Opens default browser to `http://127.0.0.1:3010`
5. Browser loads React app from kernel
6. React app connects to kernel API

---

## Build System

### Build Script: `distribution/build-portable.sh`

**Purpose**: One-command build of entire distribution

**Prerequisites**:
- Rust toolchain
- Node.js + pnpm (for UI build)

**Build Steps**:

```bash
# Step 1: Build Rust binaries
cargo build --release -p a2rchitech-api   # Kernel
cargo build --release -p a2rchitect-cli   # CLI client
cargo build --release (launcher-simplified)   # Browser launcher
cargo build --release (launcher-desktop)      # Desktop launcher

# Step 2: Build/copy UI
cp -r 7-apps/shell-ui/dist/* build/portable/a2r-platform/ui/

# Step 3: Copy Electron files
cp 7-apps/shell-electron/main/* build/portable/a2r-platform/electron/
cp 7-apps/shell-electron/preload/* build/portable/a2r-platform/electron/
cp 7-apps/shell-electron/package.json build/portable/a2r-platform/electron/

# Step 4: Create wrapper scripts
cat > start.sh << 'SCRIPT'
#!/bin/bash
./a2r-launcher
SCRIPT

cat > start-desktop.sh << 'SCRIPT'
#!/bin/bash
./a2r-desktop
SCRIPT

cat > start-cli.sh << 'SCRIPT'
#!/bin/bash
# Auto-starts API if needed
...
SCRIPT

# Step 5: Create macOS app bundle
mkdir -p "A2R Platform.app/Contents/"{MacOS,Resources}
cp a2r-launcher "A2R Platform.app/Contents/MacOS/"
cp a2rchitech-api "A2R Platform.app/Contents/Resources/"
cp -r ui "A2R Platform.app/Contents/Resources/"

# Step 6: Package
tar -czf a2r-platform-VERSION-PLATFORM-ARCH.tar.gz a2r-platform/
zip -r a2r-platform-VERSION-PLATFORM-ARCH.zip a2r-platform/
```

### Output Structure

```
dist/
├── a2r-platform-0.1.0-darwin-arm64.tar.gz    (43MB)
└── a2r-platform-0.1.0-darwin-arm64.zip       (44MB)

build/portable/a2r-platform/
├── a2r-desktop              # 364KB - Desktop launcher
├── a2r-launcher             # 346KB - Browser launcher  
├── a2rchitech-api           # 40MB - THE KERNEL
├── a2rchitech               # 17MB - CLI client
├── ui/                      # 16MB - Web UI assets
│   ├── index.html
│   ├── assets/
│   └── ...
├── electron/                # 24KB - Electron wrapper
│   ├── index.cjs
│   ├── preload.js
│   └── package.json
├── start-desktop.sh         # Desktop entry point
├── start.sh                 # Browser entry point
├── start-cli.sh             # Terminal entry point
├── A2R Platform.app/        # macOS bundle
└── README.txt               # User documentation
```

---

## Standards for Edits

### Code Organization

```
distribution/
├── build-portable.sh           # Main build script (bash)
├── launcher-simplified/        # Browser launcher (Rust)
│   ├── Cargo.toml
│   └── src/main.rs
├── launcher-desktop/           # Desktop launcher (Rust)
│   ├── Cargo.toml
│   └── src/main.rs
├── README.md                   # User-facing quick start
├── SINGLE_BINARY_GUIDE.md      # Technical deep dive
└── TECHNICAL_DOCUMENTATION.md  # This file
```

### Making Changes

#### 1. Changing the Kernel (API)

**Location**: `7-apps/api/src/`

**Standards**:
- Add new endpoints in `main.rs` or appropriate module
- Use Axum routing: `Router::new().route("/path", handler)`
- Document endpoints in code comments
- Update `SINGLE_BINARY_GUIDE.md` if API changes affect clients

**Testing**:
```bash
cd 7-apps/api
cargo run
# In another terminal:
curl http://127.0.0.1:3010/health
```

#### 2. Changing Launchers

**Browser Launcher**: `distribution/launcher-simplified/`
**Desktop Launcher**: `distribution/launcher-desktop/`

**Standards**:
- Keep launchers minimal - they just spawn processes
- Handle cleanup on SIGINT/SIGTERM
- Use environment variables for configuration
- Log to stdout (users see it)

**Pattern**:
```rust
fn main() -> Result<()> {
    // 1. Setup
    let app_dir = get_app_dir()?;
    
    // 2. Start kernel
    let mut api = spawn_api(&app_dir)?;
    
    // 3. Wait for ready
    wait_for_api_ready().await?;
    
    // 4. Start client (Electron or browser)
    let mut client = spawn_client()?;
    
    // 5. Wait for exit
    tokio::select! {
        _ = api.wait() => {},
        _ = client.wait() => {},
    }
    
    // 6. Cleanup
    cleanup()?;
    Ok(())
}
```

#### 3. Changing Wrapper Scripts

**Location**: Generated in `build-portable.sh`

**Standards**:
- Use `#!/bin/bash` (portable)
- Set all required env vars
- Handle cleanup (trap INT TERM)
- Show user-friendly messages with colors
- Check for dependencies

**Template**:
```bash
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

# Colors
BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Config
export A2R_OPERATOR_URL="http://127.0.0.1:3010"
export A2R_DATA_DIR="${A2R_DATA_DIR:-$HOME/.a2r-platform}"

# Functions
log() { echo -e "${BLUE}[A2R]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Cleanup
cleanup() {
    log "Shutting down..."
    kill $API_PID 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# Main
log "Starting..."
./a2rchitech-api &
API_PID=$!
wait
```

#### 4. Changing the Build Script

**Location**: `distribution/build-portable.sh`

**Standards**:
- Use `set -e` (fail on error)
- Define colors for output
- Check prerequisites
- Quote all paths (handles spaces)
- Use `|| true` for optional steps
- Show progress messages

**Structure**:
```bash
#!/bin/bash
set -e

# Config
VERSION="0.1.0"
BUILD_DIR="build/portable"

# Colors
info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[0;32m[OK]\033[0m $1"; }
error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; exit 1; }

# Steps
step1_build_api() { ... }
step2_build_ui() { ... }
step3_build_launchers() { ... }
step4_create_scripts() { ... }
step5_package() { ... }

# Main
main() {
    info "Starting build..."
    step1_build_api
    step2_build_ui
    step3_build_launchers
    step4_create_scripts
    step5_package
    success "Build complete!"
}

main "$@"
```

#### 5. Adding Documentation

**Location**: 
- User docs: `distribution/README.md`
- Technical: `distribution/SINGLE_BINARY_GUIDE.md`
- Deep dive: `distribution/TECHNICAL_DOCUMENTATION.md` (this file)

**Standards**:
- Use clear hierarchy (##, ###)
- Include code examples
- Use ASCII diagrams for architecture
- Keep README short (<100 lines)
- Keep SINGLE_BINARY_GUIDE medium (<300 lines)
- Put deep technical details here

---

## Troubleshooting

### Issue: Port 3010 already in use

**Symptoms**:
```
ERROR: Address already in use (os error 48)
```

**Solution**:
```bash
# Find and kill process
lsof -ti:3010 | xargs kill -9

# Or use different port
PORT=3011 ./a2rchitech-api
```

### Issue: Electron not found

**Symptoms**:
```
WARNING: Electron not found, will use browser mode
```

**Solution**:
```bash
# Install Electron globally
npm install -g electron

# Or use browser mode instead
./start.sh
```

### Issue: API starts but CLI can't connect

**Symptoms**:
```
Error: Connection refused
```

**Causes**:
1. API still initializing (wait 5 seconds)
2. Wrong port configured
3. Firewall blocking localhost

**Solution**:
```bash
# Check if API is running
curl http://127.0.0.1:3010/health

# Check environment
env | grep A2R

# Use full path
./a2rchitech --url http://127.0.0.1:3010 status
```

### Issue: CLI starts but API wasn't running

**Symptoms**:
```
Error: reqwest::Error - connection refused
```

**Solution**:
Use `start-cli.sh` instead of `a2rchitech` directly:
```bash
# Wrong - requires API already running
./a2rchitech status

# Right - auto-starts API
./start-cli.sh status
```

### Issue: Build fails with "electron/node_modules too large"

**Symptoms**:
```
tar: file changed as we read it
# or
distribution size > 500MB
```

**Solution**:
```bash
# Remove node_modules from electron folder
rm -rf build/portable/a2r-platform/electron/node_modules

# The build script should NOT copy node_modules
# Edit build-portable.sh and ensure:
# - DO copy: main/*.cjs, preload/*.js, package.json
# - DO NOT copy: node_modules/
```

### Issue: macOS "App can't be opened" security warning

**Symptoms**:
```
"A2R Platform.app" can't be opened because the developer
cannot be verified.
```

**Solution**:
```bash
# Remove quarantine attribute
xattr -rd com.apple.quarantine "A2R Platform.app"

# Or right-click → Open → "Open anyway"
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2026-02-15 | Initial portable distribution with Desktop, Browser, and Terminal modes |

---

## See Also

- `README.md` - Quick start guide
- `SINGLE_BINARY_GUIDE.md` - Technical overview
- `7-apps/api/README.md` - API documentation
- `7-apps/cli/README.md` - CLI documentation
