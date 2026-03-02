# Chrome Streaming Integration with Onboarding

## ✅ What Was Integrated

Chrome Streaming Gateway is now **fully integrated** into the A2R Platform onboarding process.

---

## 📁 Files Modified

### 1. `scripts/onboarding-setup.sh`

**Added:**
- `install_chrome_streaming()` function (lines 285-328)
- Called in `main()` after `install_docker` (line 979)

**What it does:**
```bash
# After Docker installation, user is prompted:
"Install Chrome Streaming now? (y/N)"

If YES:
  → Runs scripts/install-chrome-streaming.sh
  → Installs coturn (TURN server)
  → Builds Chrome Docker image
  → Configures systemd services
  → Starts services

If NO:
  → Skips installation
  → Shows how to install later
```

---

## 🚀 Complete Onboarding Flow

### For New User/Machine

```bash
# 1. Run onboarding
curl -fsSL https://raw.githubusercontent.com/a2rchitech/a2rchitech/main/scripts/onboarding-setup.sh | bash

# 2. Script runs through:
   ✓ Install Node.js
   ✓ Install Rust
   ✓ Install Python
   ✓ Install Docker (optional but recommended)
   → Install Chrome Streaming (optional but recommended) ← NEW!
   ✓ Clone repository
   ✓ Install project dependencies
   ✓ Create .env files
   ✓ Setup API keys
   ✓ Create helper scripts

# 3. User is prompted twice:
   1. "Install Docker? (y/N)" - for container support
   2. "Install Chrome Streaming? (y/N)" - for real Chrome
```

---

## 📋 Chrome Streaming Installation Steps

When user answers YES to Chrome Streaming:

```bash
install_chrome_streaming() {
  1. Check if Docker is installed
  2. Check if already installed (skip if yes)
  3. Show benefits:
     • Real Google Chrome in browser capsule
     • Full Chrome Web Store access
     • Native extension installation
     • WebRTC video streaming
  4. Prompt: "Install Chrome Streaming now? (y/N)"
  5. If YES:
     → Run scripts/install-chrome-streaming.sh
     → Installs Docker (if missing)
     → Installs Docker Compose (if missing)
     → Installs coturn (TURN server)
     → Generates TURN secret
     → Builds a2r/chrome-stream image
     → Configures systemd services
     → Configures firewall
     → Starts services
  6. If NO:
     → Shows how to install later
}
```

---

## 🔄 Later Installation

If user skipped Chrome Streaming during onboarding:

```bash
# Can install anytime with:
sudo ./scripts/install-chrome-streaming.sh
```

---

## 📚 Documentation Added

| File | Purpose |
|------|---------|
| `8-cloud/chrome-stream/README_SETUP.md` | User setup guide |
| `8-cloud/chrome-stream/DEPLOYMENT_LINUX.md` | Technical docs |
| `8-cloud/chrome-stream/IMPLEMENTATION_SUMMARY.md` | Complete summary |
| `scripts/install-chrome-streaming.sh` | Automated installer |
| `ENVIRONMENT.md` | Updated with Chrome Streaming section |

---

## ✅ Integration Points

| Component | Integration |
|-----------|-------------|
| **Onboarding Script** | ✓ Prompts for Chrome Streaming |
| **Start Platform** | ✓ Auto-checks + offers install |
| **Documentation** | ✓ Full setup guide in ENVIRONMENT.md |
| **Systemd Services** | ✓ Auto-start on boot |
| **Firewall** | ✓ Auto-configures ports |

---

## 🎯 Standard Process (Updated)

### For ANY New Deployment

```bash
# 1. Clone and run onboarding
git clone <repo-url>
cd a2rchitech-workspace
./scripts/onboarding-setup.sh

# 2. Answer prompts:
#    - Install Docker? Y
#    - Install Chrome Streaming? Y  ← NEW!

# 3. Wait for installation (5-10 min)

# 4. Start platform
./start-platform.sh

# 5. Open Electron app
cd 7-apps/shell/desktop
npm start

# 6. Click "Open Chrome Browser"
#    Chrome streams INSIDE browser capsule!
```

---

## 🔍 Verification

After onboarding completes:

```bash
# Check Chrome Streaming is installed
docker image ls | grep chrome
# Expected: a2r/chrome-stream

# Check coturn
sudo systemctl status coturn
# Expected: active (running)

# Test Chrome sidecar
curl http://localhost:8081/health
# Expected: {"chrome":"ok","version":"Chrome/...","status":"healthy"}
```

---

## 📊 Complete Dependency Checklist (Updated)

### Core Runtimes (REQUIRED)

| Component | Version | Purpose | Install |
|-----------|---------|---------|---------|
| Node.js | 18+ | Shell UI, build tools | `brew install node@20` |
| pnpm | 8+ | Package manager | `curl -fsSL https://get.pnpm.io/install.sh` |
| Bun | 1.0+ | Terminal server | `curl -fsSL https://bun.sh/install` |
| Rust | Stable | API server, kernel | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs` |
| Python | 3.10+ | Voice/Operator | `brew install python@3.11` |

### Optional but Recommended

| Component | Purpose | Install |
|-----------|---------|---------|
| **Docker** | Chrome streaming, containers | `curl -fsSL https://get.docker.com` |
| **coturn** | WebRTC TURN server | Included in Chrome installer |
| Playwright | Browser automation | `pnpm exec playwright install` |
| Ollama | Local LLM | `curl -fsSL https://ollama.com/install.sh` |

---

## ✅ Summary

**Chrome Streaming is NOW fully integrated into:**

1. ✅ `scripts/onboarding-setup.sh` - Automatic prompt + install
2. ✅ `start-platform.sh` - Auto-check + offer to install
3. ✅ `ENVIRONMENT.md` - Complete documentation
4. ✅ `docker-compose.yml` - Production deployment
5. ✅ Systemd services - Auto-start on boot

**Standard process for ANY new machine:**
```bash
./scripts/onboarding-setup.sh  # Includes Chrome Streaming prompt
./start-platform.sh            # Auto-checks Chrome Streaming
```

**This is the COMPLETE, PRODUCTION-READY onboarding flow.**
