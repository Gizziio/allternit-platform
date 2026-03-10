# A2RCHITECH Platform Services

## Quick Start

```bash
# Start all core services (API, Workspace, Rails)
./dev/scripts/start-all-services.sh core --detach

# Check status
./dev/scripts/check-services.sh

# Stop all services
./dev/scripts/stop-all-services.sh
```

## Service Registry

| Service | Port | Purpose | Binary | Status |
|---------|------|---------|--------|--------|
| **API** | 3000 | Main API service | `a2rchitech-api` | ✅ Running |
| **Workspace** | 3021 | Terminal workspace with tmux | `workspace-service` | ✅ Running |
| **Rails** | 3011 | Agent system rails | `a2r-rails-service` | ✅ Running |
| Kernel | 3004 | Orchestration kernel | `kernel` | ⏸️ Not started |
| Policy | 3003 | Policy enforcement | `policy-service` | ⏸️ Not started |
| Voice | 8001 | AI Voice/TTS | `voice-service` | ⏸️ Not started |
| WebVM | 8002 | Browser automation | `webvm-service` | ⏸️ Not started |
| Gateway | 8013 | Main gateway | `gateway` | ⏸️ Not started |

## Console Drawer Requirements

For the **Console Drawer Terminal** to work fully, you need:

### Required (Now Running)
1. **API Service** (port 3000) - Provides `/api/agents` endpoint
2. **Workspace Service** (port 3021) - Provides terminal sessions via WebSocket
3. **Rails Service** (port 3011) - Provides agent orchestration

### Optional (for extended features)
- **Kernel** (3004) - For advanced orchestration
- **Voice** (8001) - For voice interactions
- **WebVM** (8002) - For browser automation

## Testing the Console Drawer

1. Open the Shell UI: http://127.0.0.1:5177
2. Open the Console Drawer (bottom panel)
3. Click on the **Terminal** tab
4. You should see the terminal with multi-pane support

## Manual Service Management

### Start individual services

```bash
# API (already running)
export A2RCHITECH_API_BIND="0.0.0.0:3000"
./target/release/a2rchitech-api

# Workspace (already running)
export WORKSPACE_SERVICE_PORT=3021
./target/release/workspace-service

# Rails (already running)
export A2R_RAILS_PORT=3011
./target/release/a2r-rails-service
```

### Check logs

```bash
# View all logs
tail -f .logs/*.log

# View specific service
tail -f .logs/workspace.log
tail -f .logs/rails.log
```

### Environment Variables

Source the service config to get all ports:

```bash
source ./dev/scripts/service-config.sh
echo $A2R_API_PORT      # 3000
echo $A2R_RAILS_PORT    # 3011
echo $WORKSPACE_SERVICE_PORT  # 3021 (not in config, defaults to 3021)
```

## Port Conflicts

If a port is already in use:

```bash
# Find what's using port 3021
lsof -Pi :3021 -sTCP:LISTEN

# Kill it
kill $(lsof -ti :3021)
```

## Troubleshooting

### Service won't start

1. Check logs: `cat .logs/workspace.log`
2. Verify binary exists: `ls -la target/release/workspace-service`
3. Rebuild if needed: `cargo build --release -p workspace-service`

### Console Drawer shows no terminal

1. Verify workspace service: `curl http://127.0.0.1:3021/`
2. Check UI logs: `tail -f .logs/ui.log`
3. Verify WebSocket connection in browser DevTools

### Build failures

If workspace-service or a2r-agent-system-rails fail to build:

```bash
# Ensure they're in workspace members
grep "workspace-service" Cargo.toml
grep "a2r-agent-system-rails" Cargo.toml

# Build from project root
cargo build --release -p workspace-service
cargo build --release -p a2r-agent-system-rails
```
