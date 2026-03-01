# A2R Command - Global Platform Control

**The unified command for managing the A2rchitect platform.**

---

## Quick Start

### 1. Install the Command

```bash
# Navigate to project
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech

# Install the a2r command
./scripts/install-a2r-alias.sh

# Reload your shell
source ~/.bash_profile  # or ~/.zshrc
```

### 2. Start the Platform

```bash
# Start everything (backend services + Electron shell)
a2r start
```

**Note**: First run compiles Rust services (5-10 minutes). Subsequent starts are fast.

### 3. Daily Commands

```bash
a2r status   # Check if running
a2r logs     # View logs
a2r stop     # Stop everything
```

---

## How It Works

The `a2r start` command delegates to the platform orchestrator:

```
a2r start
    ↓
cargo run -p a2rchitech-platform
    ↓
Reads .a2r/services.json
    ↓
Starts services in order:
  1. Policy (3003)
  2. Memory (3200)
  3. Registry (8080)
  4. Kernel (3004)
  5. API (3000)
  6. Gateway (8013)
  7. Electron Shell
```

The platform orchestrator handles:
- Service dependencies
- Compilation (on first run)
- Process management
- **Electron app launch**

---

## Installation

### Automatic Installation

```bash
cd /Users/macbook/Desktop/a2rchitech-workspace/a2rchitech
./scripts/install-a2r-alias.sh
```

### Manual Installation

Add to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
export PATH="/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech/bin:$PATH"
```

Then reload:
```bash
source ~/.zshrc  # or ~/.bash_profile
```

---

## Commands Reference

### Core Commands

| Command | Description |
|---------|-------------|
| `a2r start` | Start platform (backend services + Electron) |
| `a2r stop` | Stop all services |
| `a2r restart` | Restart platform |
| `a2r status` | Show service status |

### Development Commands

| Command | Description |
|---------|-------------|
| `a2r build` | Build production binaries (optional) |
| `a2r logs` | View logs |
| `a2r help` | Show help |

---

## Architecture

When you run `a2r start`:

```
┌─────────────────────────────────────────────────────────────┐
│  Platform Orchestrator (Rust)                               │
│  - Reads services.json                                      │
│  - Starts services in order                                 │
│  - Handles dependencies                                     │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Backend    │    │   Gateway    │    │   Electron   │
│   Services   │───▶│   (8013)     │◀───│   Shell      │
│   (Rust)     │    │   Python     │    │   (UI)       │
└──────────────┘    └──────────────┘    └──────────────┘
```

**Data Flow**:
```
Electron UI → Gateway (8013) → API (3000) → Kernel (3004)
```

---

## First Run

### What Happens

1. **Cargo compiles** all Rust services (5-10 min)
2. **Services start** in dependency order
3. **Gateway** starts (Python - fast)
4. **Electron** launches automatically

### Expected Timeline

| Time | Event |
|------|-------|
| 0:00 | Compilation begins |
| 5:00 | Services start launching |
| 8:00 | Gateway ready |
| 10:00 | **Electron window opens** |

### Subsequent Runs

After first run, compilation is cached:
- **Startup time**: 30-60 seconds
- No recompilation unless code changes

---

## Production Mode (Optional)

For instant startup without compilation:

```bash
# 1. Build binaries (one time, 10-20 min)
a2r build

# 2. Start with binaries (instant)
A2R_MODE=prod a2r start
```

---

## Troubleshooting

### "Command not found: a2r"

```bash
# Check PATH
echo $PATH | grep a2rchitech

# Reinstall
./scripts/install-a2r-alias.sh
source ~/.bash_profile
```

### Slow Startup

**Normal on first run** - Rust compilation takes 5-10 minutes.

To speed up:
```bash
# Build once, run many
a2r build
A2R_MODE=prod a2r start  # Instant startup
```

### Electron Not Opening

Check if Electron is installed:
```bash
cd 6-apps/shell-electron && npm install
```

Then restart:
```bash
a2r restart
```

### Port Already in Use

```bash
# Kill everything
a2r stop

# Or manually
for port in 3003 3200 8080 3004 3000 8013; do
  lsof -ti:$port | xargs kill -9
done

# Then restart
a2r start
```

---

## Comparison: Old vs New

### Old Way

```bash
# Start backend
cargo run -p a2rchitech-platform

# In another terminal, start Electron
cd 6-apps/shell-electron && npm run dev:electron
```

### New Way

```bash
# Everything in one command
a2r start
```

**Benefits**:
- Single command
- Global availability
- Status checking
- Log aggregation
- Consistent interface

---

## Files

| File | Purpose |
|------|---------|
| `bin/a2r` | Main command script |
| `scripts/install-a2r-alias.sh` | Installation |
| `scripts/build-services.sh` | Build binaries |
| `.a2r/services.json` | Service configuration |
| `A2R_COMMAND_GUIDE.md` | This document |

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Electron Shell (Desktop App)                          │ │
│  │  Loads from shell-electron/                            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     EDGE GATEWAY                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Gateway (Port 8013) - Python/FastAPI                  │ │
│  │  • Authentication • Rate Limiting • Routing            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     PUBLIC API                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Service (Port 3000) - Rust/Axum                   │ │
│  │  • Business Logic • Orchestration                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│Kernel │ │Registry│ │Memory │
│(3004) │ │(8080) │ │(3200) │
└───────┘ └───────┘ └───────┘
```

---

## Summary

✅ **One command**: `a2r start` launches everything  
✅ **Electron included**: Desktop app opens automatically  
✅ **Global access**: Use from any directory  
✅ **Platform integration**: Works with existing orchestrator  
✅ **Production ready**: Optional pre-built binaries

**Happy building with A2rchitect!** 🚀
