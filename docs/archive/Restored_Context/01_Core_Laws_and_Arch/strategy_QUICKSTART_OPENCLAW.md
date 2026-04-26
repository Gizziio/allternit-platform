# Quick Start: OpenClaw in Shell UI

**Goal**: See OpenClaw's Control UI running inside Allternit immediately.

---

## Step 1: Start OpenClaw Gateway

Open a terminal and run:

```bash
# Option A: Use the helper script
./scripts/start-openclaw.sh start

# Option B: Run directly (if openclaw is installed)
openclaw gateway --port 18789
```

**Verify it's running**:
```bash
./scripts/start-openclaw.sh status
# Should show: "✅ OpenClaw is running"
```

---

## Step 2: Access OpenClaw Control UI

### Option A: Standalone Page (Quickest)

Open your browser to:
```
file:///Users/macbook/Desktop/allternit-workspace/allternit/openclaw-bridge.html
```

Or serve it:
```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
python3 -m http.server 8080
# Then visit: http://localhost:8080/openclaw-bridge.html
```

### Option B: In Shell UI

1. Start Shell UI:
```bash
cd 6-apps/shell-ui
pnpm dev
```

2. Navigate to: `http://localhost:5177/openclaw`

---

## What You'll See

If OpenClaw is running on port 18789:
- ✅ Header shows "Connected (v2026.1.29)"
- 🦞 OpenClaw's Control UI loads in the iframe
- You can use OpenClaw's native interface

If OpenClaw is NOT running:
- ❌ Shows "Disconnected"
- 📋 Instructions to start it
- Retry button

---

## Architecture

```
┌─────────────────────────────────────────┐
│  Shell UI / Browser Tab                 │
│  ┌─────────────────────────────────┐    │
│  │  OpenClaw Bridge (iframe)       │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │  OpenClaw Control UI    │    │    │
│  │  │  (port 18789)           │    │    │
│  │  └─────────────────────────┘    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Key Point**: This is the QUARANTINE phase. We're hosting OpenClaw as-is,
not modifying it. Gradually, we'll replace iframe content with native Allternit
components.

---

## Troubleshooting

### "OpenClaw is not installed"

```bash
npm install -g openclaw@latest
```

### "Port 18789 already in use"

```bash
# Find what's using it
lsof -i :18789

# Kill it or use different port
openclaw gateway --port 18790
# Then update openclaw-bridge.html with new port
```

### "CORS errors in browser console"

The iframe should work for localhost. If issues persist:
```bash
# Open browser with CORS disabled (development only)
# Chrome:
open -na "Google Chrome" --args --disable-web-security --user-data-dir=/tmp/chrome-dev
```

---

## Next Steps

Once you see OpenClaw working:

1. **Explore the Control UI** - See what OpenClaw offers
2. **Review the Migration Plan** - `.migration/openclaw-absorption/`
3. **Decide on Integration** - Which components to port first?

---

## Files Involved

| File | Purpose |
|------|---------|
| `openclaw-bridge.html` | Standalone bridge page |
| `5-ui/shell-ui/src/views/openclaw/OpenClawControlUI.tsx` | Shell UI component |
| `scripts/start-openclaw.sh` | Helper script to start OpenClaw |
| `QUICKSTART_OPENCLAW.md` | This file |

---

**Status**: Ready to use NOW. No migration work needed to see OpenClaw running.
