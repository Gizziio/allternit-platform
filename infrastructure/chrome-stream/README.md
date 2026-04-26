# Chrome Streaming Gateway - Platform Integration

## Overview

Real Chrome browser streaming embedded in Allternit Browser Capsule via WebRTC.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Allternit Electron App                                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Browser Capsule                                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  ChromeStreamView (WebRTC video + input)        │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebRTC (TURN via coturn)
┌───────────────────────────▼─────────────────────────────────┐
│  Chrome Session (Firecracker microVM or Docker container)   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Google Chrome (real, full Web Store)                 │  │
│  │  selkies-gstreamer (WebRTC streaming)                 │  │
│  │  Allternit Sidecar (CDP control)                            │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Startup Integration

Chrome streaming is now part of the platform startup:

```bash
./start-platform.sh
```

This starts:
1. **coturn** (TURN server for WebRTC NAT traversal)
2. **Chrome Session Broker** (via API)
3. **Electron Desktop App** (with Chrome button)

## Usage

### 1. Start Platform

```bash
cd /Users/macbook/Desktop/allternit-workspace/allternit
./start-platform.sh
```

### 2. Launch Chrome Session

In the Electron app:
1. Click the **`🌐 Chrome`** button in the URL bar
2. A new tab opens with Chrome streaming
3. Navigate to Chrome Web Store
4. Install extensions normally

### 3. API Usage

```bash
# Create Chrome session
curl -X POST http://localhost:3000/api/v1/chrome-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "extension_mode": "power",
    "resolution": "1920x1080"
  }'

# Response:
# {
#   "session_id": "uuid",
#   "status": "provisioning",
#   "ice_servers": [...],
#   "signaling_url": "ws://..."
# }

# Poll until ready
curl http://localhost:3000/api/v1/chrome-sessions/{session_id}

# Navigate
curl -X POST http://localhost:3000/api/v1/chrome-sessions/{session_id}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://chromewebstore.google.com"}'
```

## Runtime Options

### Docker (Default)
- Uses Docker containers
- Good for development and single-tenant

### Firecracker (Production)
- Uses Firecracker microVMs
- Hardware-level isolation
- Multi-tenant safe
- Kata Containers support

Configure in `chrome_session_routes.rs`:
```rust
// Use Firecracker instead of Docker
let runtime = ChromeRuntime::Firecracker(firecracker_driver);
```

## Enterprise Features

| Feature | Status |
|---------|--------|
| Real Chrome (Web Store) | ✅ |
| Extension Installation | ✅ |
| WebRTC Streaming | ✅ |
| TURN (Mobile Support) | ✅ |
| Network Isolation | ✅ |
| Sandbox ON | ✅ |
| Audit Logging | ✅ |
| Power/Managed Modes | ✅ |
| Firecracker Support | ✅ |
| Kata Containers | ✅ |

## Files

### Backend
- `8-cloud/chrome-stream/` - Docker image + sidecar
- `7-apps/api/src/chrome_session_routes.rs` - Session broker
- `start-platform.sh` - Startup integration

### Frontend
- `6-ui/allternit-platform/src/capsules/browser/ChromeStreamView.tsx` - WebRTC client
- `6-ui/allternit-platform/src/capsules/browser/useChromeSession.ts` - Session hook
- `6-ui/allternit-platform/src/capsules/browser/BrowserCapsuleEnhanced.tsx` - Integration

## Troubleshooting

### Chrome button doesn't work
- Check API is running: `curl http://localhost:3000/health`
- Check API logs: `tail -f .logs/api.log`

### WebRTC connection fails
- Check coturn is running: `ps aux | grep turn`
- Check TURN logs: `tail -f .logs/coturn.log`

### Extensions won't install
- Ensure Power Mode: `"extension_mode": "power"`
- Check Chrome container logs: `docker logs {container_id}`
