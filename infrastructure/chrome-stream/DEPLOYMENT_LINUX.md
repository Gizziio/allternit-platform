# Allternit Chrome Streaming Gateway - Linux Production Deployment

## Overview

Real Google Chrome browser streaming embedded in Allternit Browser Capsule via WebRTC.

**Platform:** Linux (Ubuntu 22.04+ recommended)
**Backend:** Firecracker microVMs (production) or Docker containers (development)
**Streaming:** WebRTC via selkies-gstreamer
**NAT Traversal:** coturn TURN server

---

## Quick Start (Linux)

### 1. Prerequisites

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Firecracker (production only)
wget https://github.com/firecracker-microvm/firecracker/releases/download/v1.5.0/firecracker-v1.5.0-x86_64.tgz
tar -xzf firecracker-v1.5.0-x86_64.tgz
sudo mv firecracker-v1.5.0-x86_64 /usr/local/bin/firecracker
sudo chmod +x /usr/local/bin/firecracker

# Install coturn
sudo apt-get install -y coturn

# Clone and setup
cd ~/Desktop/allternit-workspace/allternit
cp .env.example .env
# Edit .env: set TURN_SECRET to a random 32+ char string
```

### 2. Start Platform

```bash
# Start ALL services including Chrome streaming
./start-platform.sh

# Or start Chrome streaming only
docker-compose --profile chrome up -d
```

### 3. Verify Services

```bash
# Check Chrome container
docker ps | grep chrome

# Check coturn
sudo systemctl status coturn

# Test sidecar API
curl http://localhost:8081/health
# Expected: {"chrome":"ok","version":"Chrome/...","status":"healthy"}

# Test TURN server
curl http://localhost:3478
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Allternit Electron App (Desktop)                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Browser Capsule                                      │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  ChromeStreamView                               │  │  │
│  │  │  - WebRTC video element                         │  │  │
│  │  │  - Mouse/keyboard/touch input                   │  │  │
│  │  │  - DataChannel for input events                 │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebRTC (TURN via coturn :3478)
┌───────────────────────────▼─────────────────────────────────┐
│  Chrome Session (Firecracker microVM or Docker)             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Google Chrome 145 (real, full extension support)     │  │
│  │  selkies-gstreamer (WebRTC encoder)                   │  │
│  │  Allternit Sidecar (FastAPI CDP control)                    │  │
│  └───────────────────────────────────────────────────────┘  │
│  Network: chrome-egress (egress-only, blocked RFC1918)      │
└─────────────────────────────────────────────────────────────┘
```

---

## API Usage

### Create Chrome Session

```bash
curl -X POST http://localhost:3000/api/v1/chrome-sessions \
  -H "Content-Type: application/json" \
  -d '{
    "resolution": "1920x1080",
    "extension_mode": "power",
    "initial_url": "https://chromewebstore.google.com"
  }'

# Response:
{
  "session_id": "uuid",
  "status": "provisioning",
  "ice_servers": [
    {
      "urls": ["turn:localhost:3478?transport=udp"],
      "username": "...",
      "credential": "..."
    }
  ],
  "signaling_url": "ws://localhost:3000/api/v1/chrome-sessions/{id}/signaling"
}
```

### Poll Until Ready

```bash
curl http://localhost:3000/api/v1/chrome-sessions/{session_id}

# Response when ready:
{
  "status": "ready",
  "signaling_url": "ws://...",
  "ice_servers": [...]
}
```

### Navigate

```bash
curl -X POST http://localhost:3000/api/v1/chrome-sessions/{session_id}/navigate \
  -H "Content-Type: application/json" \
  -d '{"url": "https://google.com"}'
```

### Get Screenshot

```bash
curl http://localhost:3000/api/v1/chrome-sessions/{session_id}/screenshot
# Returns: {"data": "base64 PNG"}
```

### Destroy Session

```bash
curl -X DELETE http://localhost:3000/api/v1/chrome-sessions/{session_id}
```

---

## Frontend Integration

The Allternit Browser Capsule already has Chrome streaming integrated:

**Files:**
- `6-ui/allternit-platform/src/capsules/browser/BrowserCapsuleEnhanced.tsx`
- `6-ui/allternit-platform/src/capsules/browser/ChromeStreamView.tsx`
- `6-ui/allternit-platform/src/capsules/browser/useChromeSession.ts`

**Usage in Electron App:**

1. Start platform: `./start-platform.sh`
2. Open Electron app
3. Click **"Open Chrome Browser"** button in URL bar
4. Chrome stream tab opens with real Chrome
5. Navigate to Chrome Web Store
6. Install extensions normally

---

## Configuration

### Environment Variables (.env)

```bash
# Chrome Streaming Gateway
TURN_SECRET=your-random-32-char-secret-here
TURN_REALM=allternit.io

# Session defaults
Allternit_RESOLUTION=1920x1080
Allternit_EXTENSION_MODE=managed  # or "power"
Allternit_DISABLE_BACKGROUND_THROTTLING=false
SELKIES_ENCODER=x264enc  # or "nvh264enc" for GPU
```

### Extension Modes

**Managed Mode (default):**
- Extensions controlled via Chrome enterprise policy
- Only approved extensions can be installed
- Policy applied via `/api/v1/chrome-sessions/{id}/policy`

**Power Mode:**
- Full Chrome Web Store access
- Any extension can be installed
- No policy restrictions

### Network Isolation

Chrome sessions run with egress-only networking:
- ✅ Outbound HTTP/HTTPS allowed
- ✅ DNS allowed
- ❌ RFC1918 (internal networks) blocked
- ❌ Cloud metadata endpoints blocked
- ✅ Tenant-specific allowlist configurable

---

## Production Deployment

### Firecracker Mode (Recommended)

Edit `chrome_session_routes.rs`:

```rust
// Use Firecracker microVMs for hardware-level isolation
#[cfg(target_os = "linux")]
let spawn_result = create_firecracker_session(
    &container_id,
    &tenant_id,
    firecracker_driver,
    // ...
).await;
```

### GPU Encoding (NVIDIA)

```bash
# Install nvidia-docker2
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/libnvidia-container/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker

# Set encoder
export SELKIES_ENCODER=nvh264enc
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chrome-stream
spec:
  replicas: 10
  template:
    spec:
      runtimeClassName: kata  # Or gvisor
      containers:
      - name: chrome
        image: allternit/chrome-stream:latest
        resources:
          limits:
            cpu: "2"
            memory: 4Gi
        volumeMounts:
        - name: profile
          mountPath: /data/chrome-profile
      networkPolicy:
        egress:
        - to:
          - ipBlock:
              cidr: 0.0.0.0/0
              except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
```

---

## Troubleshooting

### Chrome fails to start

```bash
# Check logs
docker logs allternit-chrome-stream

# Verify seccomp profile
docker inspect allternit-chrome-stream | grep -i seccomp

# Test without sandbox (dev only)
docker run --rm -it allternit/chrome-stream bash
/usr/bin/google-chrome-stable --no-sandbox
```

### WebRTC connection fails

```bash
# Check coturn
sudo tail -f /var/log/turnserver.log

# Test TURN
turnutils-uclient -u test -w test -T turn.example.com

# Verify firewall
sudo iptables -L -n | grep 3478
```

### Extensions won't install

```bash
# Check extension mode
curl http://localhost:3000/api/v1/chrome-sessions/{id} | jq .extension_mode

# Apply policy (managed mode)
curl -X POST http://localhost:3000/api/v1/chrome-sessions/{id}/policy \
  -H "Content-Type: application/json" \
  -d '{
    "extension_settings": {
      "*": {"installation_mode": "blocked"},
      "cjpalhdlnbpafiamejdnhcphjbkeiagm": {
        "installation_mode": "normal_installed"
      }
    }
  }'
```

---

## Monitoring

### Prometheus Metrics

```bash
# Session count
curl http://localhost:3000/metrics | grep chrome_sessions_total

# Latency
curl http://localhost:3000/metrics | grep chrome_session_duration

# Frame rate (from sidecar)
curl http://localhost:8081/metrics
```

### Health Checks

```bash
# API health
curl http://localhost:3000/health

# Chrome sidecar
curl http://localhost:8081/health

# TURN server
curl http://localhost:3478
```

---

## Security

### Seccomp Profile

Production uses custom seccomp at `8-cloud/chrome-stream/seccomp/chrome-sandbox.json`:
- Allows Chrome sandbox syscalls (clone, unshare, pivot_root)
- Blocks dangerous syscalls
- Applied via `security_opt` in docker-compose.yml

### Network Policy

Chrome sessions run on isolated network `chrome-egress`:
- Egress-only (no inbound connections)
- RFC1918 blocked by default
- Cloud metadata endpoints blocked
- Tenant allowlist configurable via `Allternit_INTERNAL_ALLOWLIST`

### Profile Persistence

Chrome profiles mounted at `/data/chrome-profile`:
- Persistent across sessions (encrypted at rest)
- Per-tenant isolation
- Reset via "Reset Profile" button in UI

---

## Next Steps

1. **Test WebRTC streaming** in Allternit Electron app
2. **Configure extension catalog** for managed mode
3. **Set up GPU encoding** for reduced latency
4. **Deploy to Kubernetes** with Kata Containers
5. **Enable TLS** for TURN and signaling
