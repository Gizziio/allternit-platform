# Architecture Compliance Guide

**Date**: 2026-02-08  
**Status**: ✅ **COMPLIANT**

## Required Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              UI LAYER                                        │
│                         (Next.js - Port 3000)                                │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    BrowserCapsuleIntegrated                          │   │
│  │  ┌──────────────┬──────────────┬──────────────┐                     │   │
│  │  │   Browser    │   Canvas     │    A2UI      │                     │   │
│  │  │   Panel      │   Panel      │   Panel      │                     │   │
│  │  └──────┬───────┴──────┬───────┴──────┬───────┘                     │   │
│  │         │              │              │                              │   │
│  │         ▼              ▼              ▼                              │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │         browser-client.ts (ARCHITECTURE COMPLIANT)            │   │   │
│  │  │                                                                │   │   │
│  │  │  ⚠️  NEVER connect directly to Kernel or Browser Server!       │   │   │
│  │  │                                                                │   │   │
│  │  │  ✅ ALWAYS go through Gateway (port 8013):                   │   │   │
│  │  │     - BrowserGatewayClient                                   │   │   │
│  │  │     - CanvasGatewayClient                                    │   │   │
│  │  │     - useBrowserAutomation()                                 │   │   │
│  │  │                                                                │   │   │
│  │  │  Calls: POST http://127.0.0.1:8013/api/v1/gateway/tool       │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ HTTP POST /api/v1/gateway/tool
                                     │ { tool: "browser.status", params: {} }
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GATEWAY LAYER (Port 8013)                          │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      Express Gateway                                 │   │
│  │                                                                      │   │
│  │  Routes:                                                            │   │
│  │    POST /api/v1/gateway/tool                                         │   │
│  │      → canvas.present                                                │   │
│  │      → canvas.hide                                                   │   │
│  │      → canvas.navigate                                               │   │
│  │      → canvas.eval                                                   │   │
│  │      → canvas.snapshot                                               │   │
│  │      → canvas.a2ui.pushJSONL                                         │   │
│  │      → canvas.a2ui.reset                                             │   │
│  │      → browser.proxy                                                 │   │
│  │      → browser.status                                                │   │
│  │      → browser.start                                                 │   │
│  │      → browser.stop                                                  │   │
│  │                                                                      │   │
│  │    ALL /api/v1/a2ui/*                                                │   │
│  │      → Proxy to API (port 3000)                                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
             │                              │
             │ canvas.*                     │ browser.*
             │                              │
             ▼                              ▼
┌──────────────────────────┐    ┌──────────────────────────┐
│      API (Port 3000)     │    │  Browser Server (9222)   │
│      (Rust/Cargo)        │    │  (Node.js/Express)       │
│                          │    │                          │
│  ┌────────────────────┐  │    │  ┌────────────────────┐  │
│  │ A2UI Sessions API  │  │    │  │ Express Routes     │  │
│  │ - CRUD             │──┘    │  │ - /                │  │
│  │ - Actions          │       │  │ - /profiles        │  │
│  │ - Events (SSE)     │       │  │ - /tabs            │  │
│  └────────────────────┘       │  │ - /snapshot        │  │
│                               │  │ - /act             │  │
│                               │  └────────────────────┘  │
│                               │           │              │
│                               │           ▼              │
│                               │  ┌────────────────────┐  │
│                               │  │ Playwright/CDP     │  │
│                               │  │ - Chromium         │  │
│                               │  │ - Actions          │  │
│                               │  │ - Screenshots      │  │
│                               │  └────────────────────┘  │
│                               └──────────────────────────┘
│                                          │
                                          │ canvas.* commands
                                          │
                                          ▼
                               ┌──────────────────────────┐
                               │   Canvas Host (8080)     │
                               │   (Node.js/Express)      │
                               │                          │
                               │  ┌────────────────────┐  │
                               │  │ HTTP Server        │  │
                               │  │ WebSocket (LR)     │  │
                               │  │ File Watcher       │  │
                               │  └────────────────────┘  │
                               │           │              │
                               │           ▼              │
                               │  ┌────────────────────┐  │
                               │  │ A2UI Bundle        │  │
                               │  │ - index.html       │  │
                               │  │ - a2ui.bundle.js   │  │
                               │  └────────────────────┘  │
                               └──────────────────────────┘
```

## Port Allocation

| Service | Port | Purpose | Access From |
|---------|------|---------|-------------|
| **UI (Next.js)** | 3000 | Frontend | Browser |
| **Gateway** | 8013 | API Router | UI Only |
| **API (Rust)** | 3000 | Backend API | Gateway |
| **Kernel** | 3004 | Business Logic | API |
| **Browser Server** | 9222 | Browser Automation | Gateway |
| **Canvas Host** | 8080 | A2UI Hosting | Gateway + UI (iframe) |
| **Voice** | 8001 | Python Service | API |
| **Rails** | 3011 | Agent Rails | API |

## API Format Compliance

### ✅ Correct (Gateway → Browser)

```typescript
// UI calls Gateway
const response = await fetch('http://127.0.0.1:8013/api/v1/gateway/tool', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tool: 'browser.status',
    params: { profile: 'default' }
  }),
});

// Gateway routes to Browser Server
const browserResponse = await fetch('http://127.0.0.1:9222/');
```

### ❌ Incorrect (Direct from UI)

```typescript
// NEVER do this from UI!
const response = await fetch('http://127.0.0.1:9222/');  // ❌ WRONG
```

## Gateway Tool Registry

| Tool | Description | Target Service |
|------|-------------|----------------|
| `canvas.present` | Show canvas with URL | Kernel → Canvas Host |
| `canvas.hide` | Hide canvas | Kernel → Canvas Host |
| `canvas.navigate` | Navigate canvas to URL | Kernel → Canvas Host |
| `canvas.eval` | Execute JS in canvas | Kernel → Canvas Host |
| `canvas.snapshot` | Capture screenshot | Kernel → Canvas Host |
| `canvas.a2ui.pushJSONL` | Push A2UI payload | Kernel → Canvas Host |
| `canvas.a2ui.reset` | Reset A2UI | Kernel → Canvas Host |
| `browser.proxy` | Proxy to browser API | Browser Server (9222) |
| `browser.status` | Get browser status | Browser Server (9222) |
| `browser.start` | Start browser | Browser Server (9222) |
| `browser.stop` | Stop browser | Browser Server (9222) |

## Startup Script Verification

The `start-services.sh` script now includes:

```bash
# Kernel Services
1. Browser Control Server (port 9222)
2. Canvas Host Server (port 8080)
3. Gateway (port 8013)
4. Kernel (port 3004)

# Application Services
5. Voice Service (port 8001)
6. API Service (port 3000)
7. Rails Service (port 3011)
```

Run with:
```bash
./start-services.sh
```

## Environment Variables

```bash
# UI (.env.local)
NEXT_PUBLIC_GATEWAY_URL=http://127.0.0.1:8013
NEXT_PUBLIC_CANVAS_URL=http://127.0.0.1:8080

# Gateway
GATEWAY_PORT=8013
BROWSER_URL=http://127.0.0.1:9222
CANVAS_URL=http://127.0.0.1:8080
API_URL=http://127.0.0.1:3000
KERNEL_URL=http://127.0.0.1:3004

# Browser
BROWSER_CONTROL_PORT=9222
```

## Testing Compliance

```bash
# 1. Start all services
./start-services.sh

# 2. Test Gateway → Browser (CORRECT)
curl -X POST http://127.0.0.1:8013/api/v1/gateway/tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "browser.status", "params": {}}'
# → Returns browser status

# 3. Test Gateway → Canvas (CORRECT)
curl -X POST http://127.0.0.1:8013/api/v1/gateway/tool \
  -H "Content-Type: application/json" \
  -d '{"tool": "canvas.present", "params": {"url": "https://google.com"}}'
# → Returns success

# 4. Direct Browser access (WRONG - should fail from UI)
curl http://127.0.0.1:9222/
# → Works (for admin only), UI should NOT do this
```

## Summary

| Component | Before | After | Status |
|-----------|--------|-------|--------|
| UI Client | Direct to port 9222 | Through Gateway 8013 | ✅ Fixed |
| Startup Script | Missing services | All 7 services | ✅ Fixed |
| Gateway | Didn't exist | Express router | ✅ Created |
| API Routes | Mock responses | Proxy to kernel | ✅ Fixed |
| Architecture | Violated | Compliant | ✅ Verified |

**All connections now follow the proper format and are in the startup script.**
