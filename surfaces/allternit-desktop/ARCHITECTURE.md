# Allternit Desktop Architecture

## Overview

Allternit Desktop is a **cloud-connected client** for self-hosted Allternit backends.

```
┌─────────────────────────────────────────────────────────────────┐
│                      Allternit Desktop                                │
│                    (Electron App)                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Connection Setup Page (static/connect.html)            │   │
│  │  - VPS/Local mode selector                              │   │
│  │  - URL/port configuration                               │   │
│  │  - Connection test                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼ (on connect)                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Platform UI (loaded from user's backend)               │   │
│  │  - Shell UI                                             │   │
│  │  - Agent Hub                                            │   │
│  │  - Projects                                             │   │
│  │  - Chat                                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              User's Allternit Backend (Self-Hosted)                   │
│                                                                  │
│  Runs on:                                                       │
│  • User's VPS (cloud)                                          │
│  • User's local machine                                        │
│  • Docker container                                            │
│                                                                  │
│  Contains:                                                      │
│  • Next.js Platform UI                                        │
│  • Rust API Services (15+ services)                           │
│  • SQLite/PostgreSQL database                                 │
│  • All AI/ML infrastructure                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. No Bundled Services
Unlike the initial design, Allternit Desktop does NOT bundle the backend services. Instead:
- Desktop is a **dumb client** that connects to user's backend
- User installs backend separately on VPS or locally
- Desktop only stores connection configuration

### 2. Connection Flexibility
Users can connect to:
- **Local**: `http://localhost:4096` (backend on same machine)
- **VPS**: `https://allternit.theirdomain.com` (backend on their cloud)

### 3. Auto-Discovery
Desktop automatically scans common ports to find local Allternit instances.

### 4. Separate Update Cycles
- **Desktop UI**: Auto-updates via electron-updater
- **Backend**: User controls when to update their VPS/local instance

## File Structure

```
allternit-desktop/
├── src/
│   ├── main/
│   │   └── index.ts          # Main process with connection mgmt
│   └── preload/
│       └── index.ts          # IPC bridge
├── static/
│   └── connect.html          # Connection setup UI
├── build/
│   ├── entitlements.mac.plist
│   └── installer.nsh
├── package.json              # electron-builder config
└── README.md
```

## Flow

1. **App Launch**
   - Show connection setup page
   - Load saved config (if any)
   - Auto-discover local services

2. **User Connects**
   - Select VPS or Local mode
   - Enter URL/port
   - Click "Test" to verify
   - Click "Connect"

3. **Connection Established**
   - Load platform UI from user's backend
   - Show system tray with connection status
   - Begin normal Allternit usage

4. **Connection Lost**
   - Show error in tray
   - Offer to retry or reconfigure

## Benefits

1. **Small App Size**: ~50MB vs ~500MB bundled
2. **No Local Services**: No port conflicts, no service management
3. **User Control**: User owns their data and infrastructure
4. **Flexible**: Works with VPS or local setups
5. **Simple Updates**: UI updates independently

## Comparison

| Aspect | Bundled (Initial) | Cloud-Connected (Final) |
|--------|-------------------|------------------------|
| Size | ~500MB | ~50MB |
| Services | Bundled | User-hosted |
| Data | Local only | User controls location |
| Setup | One-click | Two-step (backend + UI) |
| Updates | Complex | Simple |
| Target | Local only | VPS or local |

## Future Enhancements

1. **Embedded Backend**: Option to bundle minimal backend for offline use
2. **Multiple Connections**: Switch between different backends
3. **Connection Profiles**: Save multiple VPS configs
4. **Offline Mode**: Cache UI for offline viewing
