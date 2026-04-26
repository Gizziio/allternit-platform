# Allternit Unified Platform - Quick Start

## Current Status

✅ Desktop foundation exists (`cmd/allternit-desktop/`)
✅ Backend Rust code exists (`cmd/allternit-api/`)
✅ Connection management exists

## What We Just Created

✅ Version manifest (`src/main/manifest.ts`)
✅ Backend manager (`src/main/backend-manager.ts`)
✅ Unified main process (`src/main/unified-main.ts`)

## Immediate Next Steps

### Step 1: Build Backend Binaries (Today)

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit

# Build backend for current platform
cd cmd/allternit-api
cargo build --release

# The binary will be at:
# target/release/allternit-api (or check what the actual binary name is)
```

### Step 2: Create Bundled Backend Directory

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit/cmd/allternit-desktop

# Create bundled-backend structure
mkdir -p bundled-backend/darwin/arm64/bin
mkdir -p bundled-backend/darwin/arm64/web

# Copy your built backend binary
cp ../allternit-api/target/release/allternit-api bundled-backend/darwin/arm64/bin/

# If you have other binaries (kernel, memory), copy them too:
# cp ../allternit-kernel/target/release/allternit-kernel bundled-backend/darwin/arm64/bin/
# cp ../allternit-memory/target/release/allternit-memory bundled-backend/darwin/arm64/bin/
```

### Step 3: Update package.json for Bundled Backend

Edit `cmd/allternit-desktop/package.json`:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "bundled-backend/${platform}/${arch}",
        "to": "backend",
        "filter": ["**/*"]
      }
    ]
  }
}
```

### Step 4: Switch to Unified Main

Replace `src/main/index.ts` with `src/main/unified-main.ts`:

```bash
cd cmd/allternit-desktop
mv src/main/index.ts src/main/index.ts.old
cp src/main/unified-main.ts src/main/index.ts
```

### Step 5: Test Development Mode

```bash
# In terminal 1: Start your existing backend
cd cmd/allternit-api
cargo run

# In terminal 2: Start Desktop in dev mode
cd cmd/allternit-desktop
BACKEND_MODE=development npm run dev
```

### Step 6: Test Bundled Mode

```bash
# Build backend first
cd cmd/allternit-api
cargo build --release

# Setup bundled backend
cd ../allternit-desktop
mkdir -p bundled-backend/darwin/arm64/bin
cp ../allternit-api/target/release/allternit-api bundled-backend/darwin/arm64/bin/

# Run Desktop (it will extract and start backend)
npm run dev
```

You should see:
1. Splash screen appears
2. "Setting up Allternit for the first time..."
3. Backend extracts
4. "Starting Allternit Backend..."
5. Main window opens with Platform UI

## Directory Structure After Setup

```
cmd/allternit-desktop/
├── src/
│   ├── main/
│   │   ├── index.ts              # Unified main (renamed from unified-main)
│   │   ├── manifest.ts           # Version lock
│   │   ├── backend-manager.ts    # Backend lifecycle
│   │   └── connection-manager.ts # (your existing file)
│   └── preload/
├── bundled-backend/              # ← NEW
│   └── darwin/arm64/
│       ├── bin/
│       │   └── allternit-api           # ← Your built binary
│       └── web/
├── package.json
└── ...
```

## What This Achieves

1. **First run**: Splash screen → Extract backend → Start → Ready (~10s)
2. **Second run**: Instant (backend already running)
3. **Updates**: Desktop auto-updates → Restarts backend → Seamless

## Next Milestones

### Week 1: MVP Local-Only
- [x] Version manifest
- [x] Backend manager
- [x] Unified main
- [ ] Build scripts for all platforms
- [ ] GitHub Actions workflow
- [ ] Test on macOS/Windows/Linux

### Week 2: VPS Support
- [ ] SSH connection manager
- [ ] Remote backend installation
- [ ] Version sync for remote

### Week 3: Polish
- [ ] Error handling
- [ ] Logging
- [ ] Auto-updater integration

## Common Issues

### "Bundled backend not found"
Check path in `backend-manager.ts`:
```typescript
// Development path:
path.join(__dirname, '..', '..', '..', 'bundled-backend', ...)

// Packaged path:
path.join(process.resourcesPath, 'backend')
```

### "Backend won't start"
- Check binary is executable: `chmod +x allternit-api`
- Check config file is created: `~/Library/Application Support/Allternit/config/backend.yaml`
- Check logs: `~/Library/Application Support/Allternit/logs/allternit.log`

### "Port already in use"
Backend manager should detect this - check if another process is using port 4096:
```bash
lsof -i :4096
```

## Need Help?

Check these files:
- `ARCHITECTURE_UNIFIED_NAMING.md` - Full architecture spec
- `IMPLEMENTATION_ROADMAP.md` - 16-week plan
- `distribution/unified/` - Additional reference files
