# A2rchitech Services Integration

This document describes the integration of various services in the A2rchitech ecosystem.

## Services Overview

### 1. Browser Session Service (Port 8000)
- Provides WebRTC + Playwright browser streaming
- Frame-based streaming (15 FPS) via WebSocket
- Full input replay (mouse, keyboard, wheel, paste)
- Screenshot capture and content extraction

### 2. AGUI Gateway (Port 8010)
- WebSocket-based event streaming
- Real-time communication between UI components
- Event broadcasting mechanism

### 3. CopilotKit Runtime (Port 8011)
- Implements CopilotKit API structure
- Handles agent properties and messaging
- Provides stub implementation awaiting official SDK

### 4. A2A Gateway (Port 8012)
- Agent and service discovery
- Connection establishment between agents
- Registry for agent capabilities

## Architecture Flow

```
┌──────────────────────────────────────────────────┐
│  A2rchitech Shell UI (5173)             │
│                                                     │
│  ┌──────────────────┐                           │
│  │ Left Rail         │                           │
│  │ Browser (🌐) → spawns capsule   │           │
│  └──────────────────┘                           │
│                                                     │
│  ┌──────────────────────────────────────────┐    │
│  │ Browser Capsule (canvas-browser)    │     │
│  │ ┌───────────────────────────────┐    │
│  │ │ BrowserTab UI          │     │
│  │ │ - URL input             │     │
│  │ │ - Video display (WS)    │     │
│  │ │ - Input capture          │     │
│  │ │ - Connection status      │     │
│  │ └───────────────────────────────┘    │
│  └──────────────────────────────────────────┘    │
│                                                     │
│  WebSocket (signaling + frames)        │
│  HTTP (REST API)                 │
│  ┌──────────────────────────────────────────┐    │
│  │ Browser Session Service (8000)         │
│  │ ┌────────────────────────────────┐    │
│  │ │ Playwright Headless     │     │
│  │ │ - Captures 15 FPS       │     │
│  │ │ - Replays input        │     │
│  │ │ - Extracts content      │     │
│  │ └────────────────────────────────┘    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

## Integration Points

### Browser Tab Integration
- Located at: `apps/shell/src/components/tabs/Browser/BrowserTab.tsx`
- Connects to browser service via WebSocket proxy
- Handles input events and forwards to browser service
- Displays video stream from browser service

### CopilotKit Integration
- Dependencies added to `apps/shell/package.json`
- Runtime service at `services/copilot-runtime/src/index.ts`
- API endpoints match CopilotKit specification
- Proxy configured in Vite config to port 8011

### Service Proxies
Vite configuration includes proxy routes for all services:
- `/api/browser` → Port 8000 (Browser Session Service)
- `/api/agui` → Port 8010 (AGUI Gateway)
- `/api/copilot` → Port 8011 (CopilotKit Runtime)
- `/api/a2a` → Port 8012 (A2A Gateway)

## Starting Services

### 1. Browser Session Service
```bash
cd services/browser-session-service
npm run dev
```

### 2. AGUI Gateway
```bash
cd services/agui-gateway
npm run dev
```

### 3. CopilotKit Runtime
```bash
cd services/copilot-runtime
npm run dev
```

### 4. A2A Gateway
```bash
cd services/a2a-gateway
npm run dev
```

### 5. Shell UI
```bash
cd apps/shell
npm run dev
```

## Testing Browser Functionality

1. Navigate to http://localhost:5173
2. Click 🌐 Browser button in left rail
3. Enter URL and navigate
4. Test input (click, scroll, type)
5. Verify connection status indicator

## What Works

- ✅ Browser loads any website (no X-Frame-Options blocking)
- ✅ Full input support (click, scroll, keyboard, paste)
- ✅ Connection status indicator
- ✅ URL navigation
- ✅ Session management
- ✅ API endpoints ready for agents

## Future Integration

Infrastructure is in place for:
- **Dynamic capsules** via AGUI gateway
- **CopilotKit surfaces** (add `<CopilotKit>` provider to shell app)
- **Agent integration** (text, vision, computer-use)
- **A2A interoperability** between agents