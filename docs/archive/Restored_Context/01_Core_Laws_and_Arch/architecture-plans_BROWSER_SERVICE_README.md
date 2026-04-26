# Allternit Browser Service Implementation

Phase 1 implementation: WebRTC-based browser streaming service for Allternit.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Allternit Web App (apps/shell)              │
│                                                         │
│  ┌─────────────────┐      HTTP/WebSocket            │
│  │ BrowserTab UI   │◄────────────────────────────────┤
│  │ (WebRTC video)   │                                 │
│  └─────────────────┘                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          │
                          │ page load, input events
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│  Browser Session Service (port 8000)              │
│  ┌──────────────────────────────────────────────┐       │
│  │ Playwright + WebRTC streaming            │       │
│  │ - X-Frame-Options bypass (no iframes)     │       │
│  │ - Real browser execution                     │       │
│  │ - Video streaming to frontend              │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

## Services

### 1. browser-session-service (port 8000)
WebRTC-based browser streaming service.

**Features:**
- Create/manage browser sessions
- WebRTC video streaming (10-15 FPS)
- Input replay (mouse, keyboard, wheel, paste)
- Screenshot capture (PNG/JPEG)
- Content extraction (readability, plain, DOM, links)

**API:**
- `POST /sessions` - Create session
- `GET /sessions/:id/snapshot` - Capture screenshot
- `GET /sessions/:id/extract` - Extract page content
- `POST /sessions/:id/navigate` - Navigate to URL
- `POST /sessions/:id/input` - Send input events
- `DELETE /sessions/:id` - Close session
- `WS /ws` - WebRTC signaling + data channel

**Setup:**
```bash
cd services/browser-session-service
npm install
npm run build
npm run dev
```

### 2. agui-gateway (port 8010)
AG-UI event stream gateway for dynamic capsule routing.

**Features:**
- Event publication/fanout
- Capsule subscriptions
- Event history retention
- Input routing between capsules

**API:**
- `POST /events` - Publish AG-UI events
- `GET /events/history/:sessionId/:capsuleId` - Get history
- `WS /ws?sessionId=X&capsuleId=Y` - Subscribe to events

**Setup:**
```bash
cd services/agui-gateway
npm install
npm run build
npm run dev
```

### 3. copilot-runtime (port 8011)
Self-hosted CopilotKit runtime endpoint.

**Features:**
- CopilotKit runtime server
- Health check endpoint

**API:**
- `/copilotkit` - CopilotKit runtime endpoint
- `GET /health` - Health check

**Setup:**
```bash
cd services/copilot-runtime
npm install
npm run build
npm run dev
```

### 4. a2a-gateway (port 8012)
Agent2Agent gateway for discovery, tasks, and artifacts.

**Features:**
- Agent registration
- Agent discovery (.well-known/agent.json)
- Task creation and management
- Artifact creation and retrieval
- External agent discovery

**API:**
- `GET /.well-known/agent.json` - Agent discovery
- `POST /agents` - Register agent
- `GET /agents/:id` - Get agent card
- `GET /agents` - List all agents
- `POST /agents/:id/tasks` - Create task for agent
- `GET /tasks/:id` - Get task status
- `GET /tasks` - List tasks
- `POST /tasks/:id/artifacts` - Create artifact
- `GET /tasks/:id/artifacts` - Get artifacts
- `POST /discovery` - Discover external agent
- `GET /health` - Health check

**Setup:**
```bash
cd services/a2a-gateway
npm install
npm run build
npm run dev
```

## Frontend Integration

### BrowserTab Component
Location: `apps/shell/src/tabs/Browser/BrowserTab.tsx`

**Features:**
- WebRTC video display
- URL navigation
- Connection status
- Input capture and replay
- Session management

**Usage:**
```tsx
import { BrowserTab } from './tabs/Browser/index.js';

function App() {
  return (
    <BrowserTab
      initialUrl="https://example.com"
      serviceUrl="/api/browser"
      onNavigate={(url) => console.log('Navigated to:', url)}
    />
  );
}
```

### WebRTC Client Module
Location: `apps/shell/src/tabs/Browser/webrtcClient.ts`

**Features:**
- WebRTC connection management
- Signaling via WebSocket
- Data channel for input
- Session management

### InputOverlay Component
Location: `apps/shell/src/tabs/Browser/InputOverlay.tsx`

**Features:**
- Pointer capture (move, down, up, click)
- Keyboard capture (down, up, paste)
- Wheel event capture
- Modifier key tracking

## One-Page Agent Command List

### Install Dependencies

```bash
# FRONTEND
cd apps/shell
npm install @copilotkit/react-core @copilotkit/react-ui @ag-ui/client @ag-ui/core

# COPILOT RUNTIME
cd services
mkdir copilot-runtime && cd copilot-runtime
npm init -y
npm install @copilotkit/runtime express cors

# AGUI GATEWAY
cd ../
mkdir agui-gateway && cd agui-gateway
npm init -y
npm install express ws cors @ag-ui/core

# BROWSER SESSION SERVICE
cd ../
mkdir browser-session-service && cd browser-session-service
npm init -y
npm install express ws cors playwright werift uuid

# A2A GATEWAY
cd ../
mkdir a2a-gateway && cd a2a-gateway
npm init -y
npm install express cors @a2a-js/sdk uuid
```

### Boot Services

```bash
# Terminal 1 - Browser Service
cd services/browser-session-service
npm install
npm run dev

# Terminal 2 - AG-UI Gateway
cd services/agui-gateway
npm install
npm run dev

# Terminal 3 - Copilot Runtime
cd services/copilot-runtime
npm install
npm run dev

# Terminal 4 - A2A Gateway
cd services/a2a-gateway
npm install
npm run dev

# Terminal 5 - Shell App
cd apps/shell
npm run dev
```

### UI-TARS Reference (Optional)

```bash
cd /path/to/repo
git clone https://github.com/bytedance/UI-TARS.git
git clone https://github.com/bytedance/UI-TARS-desktop.git
```

### Linux System Packages (if deploying on Linux)

```bash
sudo apt-get update
sudo apt-get install -y xvfb ffmpeg
sudo apt-get install -y coturn  # Optional TURN server for NAT traversal
```

## Configuration

### Vite Proxy (apps/shell/vite.config.ts)
Already configured with:
```typescript
'/api/browser': {
  target: 'http://127.0.0.1:8000',
  changeOrigin: true,
  ws: true,
  rewrite: (path) => path.replace(/^\/api\/browser/, '')
}
```

### Environment Variables
```bash
# Browser Service
export BROWSER_SERVICE_PORT=8000

# AG-UI Gateway
export AGUI_GATEWAY_PORT=8010

# Copilot Runtime
export COPILOT_RUNTIME_PORT=8011

# A2A Gateway
export A2A_GATEWAY_PORT=8012
```

## Testing

### Manual Test
1. Start all services (see "Boot Services" above)
2. Open browser to http://localhost:5173
3. Navigate to https://example.com
4. Verify video stream loads
5. Test input (click, type, scroll)

### Integration Test
1. Create session via POST to /api/browser/sessions
2. Navigate via POST to /api/browser/sessions/:id/navigate
3. Capture screenshot via GET /api/browser/sessions/:id/snapshot
4. Extract content via GET /api/browser/sessions/:id/extract?mode=readability

## Next Steps (Phase 2-5)

- [ ] Phase 2: Dynamic capsules via AG-UI gateway
- [ ] Phase 3: CopilotKit surfaces in BrowserTab
- [ ] Phase 4: Agent types (text, vision, computer-use)
- [ ] Phase 5: A2A interoperability

## Notes

- WebRTC signaling uses simplified implementation (no full ICE negotiation)
- Production deployment requires TURN server for NAT traversal
- Video streaming at 10-15 FPS (adjust in WebRTCVideoTrack.ts)
- Input coordinates are viewport-relative (scale before sending)
