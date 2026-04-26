# Allternit Chrome Streaming Gateway - Standard Setup Process

## Overview

Chrome Streaming is **automatically integrated** into the Allternit Platform. When you run `./start-platform.sh`, it will:

1. ✅ Check if Chrome Streaming is installed
2. ❓ Offer to install it if missing (recommended)
3. 🚀 Start all services including Chrome streaming

---

## Standard Installation Process

### On Any Linux VPS/Server

**Step 1: Clone and Setup Platform**

```bash
# Clone the platform
cd ~
git clone <your-repo-url>/allternit-workspace.git
cd allternit-workspace

# Copy environment file
cp .env.example .env
nano .env  # Edit TURN_SECRET with a random value
```

**Step 2: Run Platform Startup**

```bash
./start-platform.sh
```

**Step 3: Chrome Streaming Installation (Automatic Prompt)**

If Chrome Streaming is not installed, you'll see:

```
╔═══════════════════════════════════════════════════════════╗
║        Chrome Streaming Gateway - Not Installed          ║
╚═══════════════════════════════════════════════════════════╝

Chrome Streaming enables:
  • Real Google Chrome in browser capsule
  • Full Chrome Web Store access
  • Native extension installation
  • WebRTC video streaming

Install Chrome Streaming now? (recommended) [Y/n]
```

**Press `Y`** (or just Enter) to install automatically.

**Step 4: Installation Runs Automatically**

The installer will:
- ✅ Install Docker (if missing)
- ✅ Install Docker Compose (if missing)
- ✅ Install coturn (TURN server)
- ✅ Generate secure TURN secret
- ✅ Build Chrome Docker image
- ✅ Configure systemd services
- ✅ Configure firewall
- ✅ Start all services

**Step 5: Open Electron App**

Once installation completes:
```bash
# The Electron app will start automatically
# Or manually:
cd 7-apps/shell/desktop
npm start
```

**Step 6: Use Chrome Streaming**

In the Electron app:
1. Look for the **"🌐 Chrome"** or **"Open Chrome Browser"** button in the URL bar
2. Click it
3. A new tab opens with **real Chrome streaming via WebRTC**
4. Navigate to Chrome Web Store
5. Install extensions normally

---

## Manual Installation (If Needed)

If you skipped the automatic installation or need to install later:

```bash
# Run the installer directly
sudo ./scripts/install-chrome-streaming.sh
```

This runs the same installer as the automatic prompt.

---

## What Gets Installed

| Component | Purpose | Port |
|-----------|---------|------|
| **Docker** | Container runtime | - |
| **Docker Compose** | Multi-container orchestration | - |
| **coturn** | WebRTC TURN server | 3478/udp, 3478/tcp, 5349/tcp |
| **allternit/chrome-stream** | Chrome container | 8080, 8081 |
| **systemd services** | Auto-start on boot | - |

---

## Verification

After installation, verify everything is working:

```bash
# Check Docker container
docker ps | grep chrome

# Expected output:
# allternit-chrome-stream   Up   0.0.0.0:8080-8081->8080-8081/tcp

# Check coturn
sudo systemctl status coturn

# Expected: active (running)

# Test Chrome sidecar API
curl http://localhost:8081/health

# Expected: {"chrome":"ok","version":"Chrome/145.0...","status":"healthy"}

# Test TURN server
curl http://localhost:3478

# Expected: (no response is OK, means port is open)
```

---

## Uninstall

To remove Chrome Streaming:

```bash
# Stop services
docker compose --profile chrome down

# Remove Docker image
docker rmi allternit/chrome-stream

# Remove systemd services
sudo systemctl disable allternit-chrome-streaming
sudo rm /etc/systemd/system/allternit-chrome-streaming.service

# Remove coturn (optional)
sudo apt-get remove coturn

# Remove TURN config
sudo rm /etc/turnserver.conf
```

---

## Troubleshooting

### "Docker not found" during installation

```bash
# Install Docker manually
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### "coturn failed to start"

```bash
# Check coturn logs
sudo journalctl -u coturn -n 50

# Common fix: edit /etc/turnserver.conf
sudo nano /etc/turnserver.conf
# Set external-ip to your server's public IP
# Restart: sudo systemctl restart coturn
```

### Chrome container won't start

```bash
# Check logs
docker logs allternit-chrome-stream

# Restart container
docker compose --profile chrome restart

# Rebuild image if needed
cd 8-cloud/chrome-stream
docker build -t allternit/chrome-stream .
```

### WebRTC connection fails in browser

```bash
# Check firewall
sudo ufw status

# Open required ports
sudo ufw allow 3478/udp
sudo ufw allow 3478/tcp
sudo ufw allow 5349/tcp
sudo ufw allow 8080/tcp
sudo ufw allow 8081/tcp
```

---

## Production Deployment Checklist

For deploying to customer VPS:

- [ ] SSH into server
- [ ] Clone platform repository
- [ ] Run `cp .env.example .env`
- [ ] Edit `.env` with secure secrets
- [ ] Run `./start-platform.sh`
- [ ] Answer `Y` to Chrome Streaming prompt
- [ ] Wait for installation (5-10 minutes)
- [ ] Verify with `curl http://localhost:8081/health`
- [ ] Open Electron app on client machine
- [ ] Test Chrome button in browser capsule
- [ ] Verify Chrome Web Store loads
- [ ] Test extension installation

---

## Architecture

```
User's Browser (Electron App)
        │
        │ WebRTC (video stream)
        │ WebSocket (signaling)
        ▼
┌───────────────────────────────────────┐
│  Allternit API (port 3000)                  │
│  - Session broker                     │
│  - TURN credential generation         │
└──────────────┬────────────────────────┘
               │
               │ TURN (port 3478)
               ▼
┌───────────────────────────────────────┐
│  coturn TURN Server                   │
│  - NAT traversal                      │
│  - ICE candidate exchange             │
└───────────────────────────────────────┘
               │
               │ WebRTC media
               ▼
┌───────────────────────────────────────┐
│  Chrome Container (port 8080-8081)    │
│  ┌─────────────────────────────────┐  │
│  │  Google Chrome 145              │  │
│  │  selkies-gstreamer (WebRTC)     │  │
│  │  FastAPI Sidecar (CDP)          │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
               │
               │ Internet access (egress only)
               ▼
        [ Public Internet ]
```

---

## Support

For issues or questions:

1. Check logs: `docker logs allternit-chrome-stream`
2. Check coturn: `sudo journalctl -u coturn -n 50`
3. Check API: `curl http://localhost:3000/health`
4. Review installer log: `/tmp/chrome-install.log` (if exists)

---

## Next Steps

After Chrome Streaming is installed:

1. **Test in Electron app** - Click Chrome button
2. **Configure extension catalog** - For managed mode
3. **Set up GPU encoding** - For better performance
4. **Enable HTTPS/TLS** - For production security
5. **Monitor usage** - Via Prometheus metrics

---

**This is the STANDARD process for ALL deployments.**
Every customer/user follows these same steps.
