# Gizzi Web Extension - Cloud & Cowork Mode

## Overview

The web extension now supports three connection modes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    GIZZI WEB EXTENSION                           │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  CLOUD MODE │  │  LOCAL MODE │  │ COWORK MODE │              │
│  │             │  │             │  │             │              │
│  │ ☁️ Connect  │  │ 💻 Connect  │  │ 🤝 Desktop  │              │
│  │ to a2r.io   │  │ to Desktop  │  │ controls    │              │
│  │             │  │ on localhost│  │ extension   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         ▼                ▼                ▼                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Cloud VPS  │  │ A2R Desktop │  │ A2R Desktop │              │
│  │  (a2r.io)   │  │ (localhost) │  │ (native     │              │
│  │             │  │             │  │  messaging) │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## New Files Created

### Connection Management
- `src/background/cloud-connector.ts` - WebSocket client for cloud VPS
- `src/background/connection-manager.ts` - Manages switching between modes

### UI Components
- `src/popup/popup.html` - Extension popup UI
- `src/popup/popup.ts` - Popup logic
- `src/background/service-worker-enhanced.ts` - Enhanced service worker

## Connection Modes

### 1. Cloud Mode (☁️)
Connects to A2R cloud backend at `wss://api.a2r.io/v1/extension`

**Use Case:** Users without local Desktop app
- Full agent capabilities
- Requires internet connection
- Authentication via API token

**Implementation:**
```typescript
const connector = new CloudConnector({
  url: 'wss://api.a2r.io/v1/extension',
  authToken: 'user-api-token'
}, callbacks);
```

### 2. Local Mode (💻)
Connects to A2R Desktop via WebSocket at `ws://localhost:3000/ws/extension`

**Use Case:** Users with local Desktop app
- Full agent capabilities
- Local network only
- Lower latency

**Implementation:**
```typescript
const wsClient = new WebSocketClient({ 
  url: 'ws://localhost:3000/ws/extension' 
});
```

### 3. Cowork Mode (🤝)
Desktop controls the extension via Native Messaging

**Use Case:** Collaborative agent workflows
- Desktop is the "driver"
- Extension executes browser commands from Desktop
- Shared context between Desktop and browser

**Implementation:**
```typescript
// Desktop sends execute request via native messaging
const request: ExecuteRequest = {
  tabId: 123,
  url: 'https://example.com',
  actions: [...]
};
executeViaNativeHost(request);
```

## Architecture

```
Extension Popup UI
       │
       │ getState / switchMode
       ▼
Connection Manager
       │
       ├──────────┬──────────┐
       │          │          │
       ▼          ▼          ▼
  Cloud      Local WS    Native Host
  Connector   Client    (Cowork Mode)
       │          │          │
       ▼          ▼          ▼
   a2r.io    localhost    Desktop
```

## Popup UI Features

1. **Mode Selection** - Three buttons to switch modes
2. **Status Display** - Shows current connection state
3. **Reconnect Button** - Force reconnection
4. **Settings Button** - Open options page

## Security Features

1. **Host Allowlist** - URLs must be explicitly allowed
2. **Circuit Breaker** - Prevents runaway automation
3. **Authentication** - Cloud mode requires API token
4. **Native Messaging** - Only connects to registered host

## Message Flow (Cowork Mode)

```
Desktop App                    Extension
     │                             │
     │ 1. Native Messaging Connect │
     │◄────────────────────────────►│
     │                             │
     │ 2. Execute Request          │
     │────────────────────────────►│
     │   {                         │
     │     type: 'execute',        │
     │     tabId: 123,             │
     │     actions: [...]          │
     │   }                         │
     │                             │
     │ 3. Execute in Browser       │
     │   [BROWSER.NAV,             │
     │    BROWSER.ACT,             │
     │    BROWSER.EXTRACT]         │
     │                             │
     │ 4. Return Results           │
     │◄────────────────────────────│
     │   {                         │
     │     type: 'result',         │
     │     success: true,          │
     │     data: {...}             │
     │   }                         │
```

## Building the Extension

```bash
cd 7-apps/chrome-extension

# Development build
npm run dev

# Production build
npm run build:prod

# Load extension in Chrome:
# 1. Open chrome://extensions
# 2. Enable Developer Mode
# 3. Click "Load unpacked"
# 4. Select the dist/ folder
```

## Configuration

Connection settings are stored in `chrome.storage.local`:

```json
{
  "a2rConnection": {
    "mode": "cloud",
    "cloudUrl": "wss://api.a2r.io/v1/extension",
    "localUrl": "ws://localhost:3000/ws/extension",
    "authToken": "..."
  }
}
```

## Testing

### Test Cloud Mode
1. Switch to Cloud mode in popup
2. Enter API token in settings
3. Verify connection badge turns green

### Test Local Mode
1. Start A2R Desktop locally
2. Switch to Local mode
3. Verify connection to localhost:3000

### Test Cowork Mode
1. Start A2R Desktop with native messaging
2. Switch to Cowork mode
3. Send commands from Desktop
4. Verify browser executes commands

## Next Steps

1. **Build the extension:** `npm run build:prod`
2. **Test on Chrome/Edge:** Load unpacked extension
3. **Firefox support:** Add manifest v2 compatibility
4. **Store submission:** Prepare for Chrome Web Store

## Integration with Thin Client

The Thin Client can now control the extension via Cowork mode:

```
Thin Client ──► Desktop App ──► Native Messaging ──► Extension
     │                                              │
     │         User issues command                  │
     │                                              │
     │◄─────────────────────────────────────────────┘
               Extension returns results
```
