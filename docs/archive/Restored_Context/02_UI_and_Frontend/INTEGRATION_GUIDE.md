# Allternit Product Integration Guide

## Overview

Complete integration of three products working together:
- **Gizzi Thin Client** - Lightweight chat interface (Electron)
- **Allternit Desktop** - Full desktop workspace with Cowork mode
- **Gizzi Web Extension** - Browser automation (Chrome/Edge)
- **Allternit Cloud Backend** - WebSocket server for cloud connections

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Allternit ECOSYSTEM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │  GIZZI THIN      │    WebSocket (port 3010)                              │
│  │  CLIENT          │ ◄──────────────────────────────┐                       │
│  │  (Electron)      │     Cowork Mode                │                       │
│  │                  │                                │                       │
│  │  • System tray   │                                │                       │
│  │  • Cmd+Shift+A   │                                ▼                       │
│  │  • Chat UI       │                    ┌──────────────────┐               │
│  └──────────────────┘                    │  Allternit DESKTOP     │               │
│                                          │  (Electron)      │               │
│  ┌──────────────────┐                    │                  │               │
│  │  GIZZI WEB       │    Native Messaging│  • Full workspace│               │
│  │  EXTENSION       │ ◄─────────────────│  • Sidecar API   │               │
│  │  (Chrome)        │    (port 3011)     │  • Cowork ctrl   │               │
│  │                  │                    │                  │               │
│  │  • Cloud mode    │                    └──────────────────┘               │
│  │  • Local mode    │                                                       │
│  │  • Cowork mode   │                                                       │
│  └────────┬─────────┘                                                       │
│           │                                                                  │
│           │ Chrome Extension API                                             │
│           ▼                                                                  │
│  ┌──────────────────┐                                                       │
│  │  CHROME BROWSER  │                                                       │
│  │                  │                                                       │
│  │  • BROWSER.NAV   │                                                       │
│  │  • BROWSER.ACT   │                                                       │
│  │  • BROWSER.EXTRACT│                                                      │
│  └──────────────────┘                                                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Allternit CLOUD BACKEND                                 │   │
│  │                    (WebSocket Server)                                │   │
│  │                                                                      │   │
│  │  ws://localhost:8080/ws/extension                                    │   │
│  │                                                                      │   │
│  │  • Authentication                                                    │   │
│  │  • Session management                                                │   │
│  │  • Message routing                                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Port Mapping

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Cloud Backend | 8080 | WebSocket | Cloud connections from Thin Client/Extension |
| Desktop Cowork | 3010 | WebSocket | Thin Client ↔ Desktop communication |
| Native Messaging | 3011 | TCP | Desktop ↔ Chrome Extension |
| Desktop Sidecar | 3000 | HTTP/WebSocket | Local API server |

## Setup Instructions

### 1. Start Cloud Backend

```bash
cd cmd/cloud-backend
npm install  # If not already done
npm start
```

Verify it's running:
```bash
curl http://localhost:8080/health
# Expected: {"status":"ok","connections":0,"uptime":...}
```

### 2. Start Allternit Desktop

```bash
cd cmd/shell/desktop
npm run dev
# Or for production:
# npm start
```

The Desktop app will automatically:
- Start the sidecar API on port 3000
- Start Cowork mode controller on port 3010
- Start native messaging host listener on port 3011

### 3. Register Native Messaging Host

```bash
cd cmd/shell/desktop/native-host
./register.sh
```

This registers the native messaging host with Chrome/Edge.

### 4. Load Web Extension

1. Open Chrome/Edge and navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select `cmd/chrome-extension/dist/`

### 5. Run Thin Client

```bash
cd cmd/thin-client
# macOS:
open release/mac-arm64/Gizzi\ Thin\ Client.app
# Or from source:
# npm run dev
```

## Testing the Integration

### Test 1: Cloud Mode

1. **Extension**: Click extension icon, select "Cloud" mode
2. **Thin Client**: Press Cmd+Shift+A, verify it shows "Disconnected"
3. Both should attempt to connect to `ws://localhost:8080/ws/extension`

### Test 2: Local Mode

1. **Extension**: Select "Local" mode
2. Should connect to Desktop sidecar on port 3000

### Test 3: Cowork Mode

1. **Desktop**: Running with Cowork controller (port 3010)
2. **Extension**: Select "Cowork" mode
3. **Thin Client**: Connect to port 3010
4. Send a message from Thin Client → routes through Desktop → Extension → Browser

## Connection Flows

### Cloud Mode Flow
```
Thin Client ──► Cloud Backend ◄──► Extension ──► Browser
```

### Cowork Mode Flow
```
Thin Client ──► Desktop ──► Native Messaging ──► Extension ──► Browser
     ▲                                                              │
     └──────────────────────────────────────────────────────────────┘
                         (results flow back)
```

## Troubleshooting

### Port Conflicts

If ports are already in use:

```bash
# Find what's using port 3010
lsof -i :3010

# Kill the process
kill -9 <PID>
```

### Native Messaging Issues

Check if the host is registered:
```bash
# macOS Chrome
cat ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.allternit.native_host.json

# Should show the path to the native host
```

### Extension Not Connecting

1. Check extension popup for connection status
2. Open Chrome DevTools (background page) for extension logs
3. Verify Desktop is running with Cowork mode started

## File Locations

### Products

| Product | Location | Build Output |
|---------|----------|--------------|
| Thin Client | `cmd/thin-client/` | `release/` |
| Desktop | `cmd/shell/desktop/` | `dist/` |
| Extension | `cmd/chrome-extension/` | `dist/` |
| Cloud Backend | `cmd/cloud-backend/` | `dist/` |

### Key Files

| Component | File | Purpose |
|-----------|------|---------|
| Desktop Cowork | `main/cowork-controller.ts` | WebSocket server for Thin Client |
| Desktop Native | `native-host/native-host.ts` | Native messaging bridge |
| Extension Cloud | `background/cloud-connector.ts` | Cloud WebSocket client |
| Extension Manager | `background/connection-manager.ts` | Mode switching |
| Cloud Server | `src/index.ts` | WebSocket server |

## Next Steps

1. **Package Desktop** with Cowork mode
2. **Submit Extension** to Chrome Web Store
3. **Deploy Cloud Backend** to production (allternit.com)
4. **Create installer** for native messaging host registration

## Status

| Component | Status | Notes |
|-----------|--------|-------|
| Thin Client | ✅ Ready | Packaged for all platforms |
| Desktop | ✅ Ready | Cowork mode integrated |
| Extension | ✅ Ready | All three modes implemented |
| Cloud Backend | ✅ Ready | Running on localhost:8080 |
| Integration | ✅ Ready | All components can communicate |
