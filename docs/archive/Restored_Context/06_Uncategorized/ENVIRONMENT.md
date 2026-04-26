# allternit Platform - Environment Requirements

## Overview

This document details all dependencies, services, and configurations required to run the allternit platform on a new computer.

## System Requirements

### Minimum Hardware
- **CPU**: 4 cores (8 cores recommended)
- **RAM**: 8 GB (16 GB recommended)
- **Disk**: 20 GB free space (SSD recommended)
- **Network**: Internet connection for API calls

### Supported Operating Systems
- **macOS**: 12.0+ (Monterey or later)
- **Linux**: Ubuntu 20.04+, Debian 11+, CentOS 8+
- **Windows**: 10/11 with WSL2 (not natively supported)

## Core Dependencies

### 1. Node.js Runtime
- **Version**: 18.x or higher (20.x recommended)
- **Package Manager**: pnpm 8.x or higher
- **Usage**: Shell UI, build tools, web applications

```bash
# macOS
brew install node@20

# Linux (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

### 2. Rust Toolchain
- **Version**: Stable (1.75+ recommended)
- **Components**: cargo, rustc, rustfmt, clippy
- **Targets**: wasm32-unknown-unknown (for WebAssembly)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustup target add wasm32-unknown-unknown
```

### 3. Python Runtime
- **Version**: 3.10 or higher (3.11 recommended)
- **Package Manager**: uv (recommended) or pip
- **Virtual Environment**: Required for isolation

```bash
# Install uv (fast Python package manager)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or use system Python
# macOS
brew install python@3.11

# Linux
sudo apt-get install python3.11 python3.11-venv python3-pip
```

### 4. Bun Runtime (Required)
- **Version**: 1.0 or higher
- **Usage**: Terminal server, fast TypeScript execution

```bash
curl -fsSL https://bun.sh/install | bash
```

### 5. Docker (Optional but Recommended)
- **Version**: 24.x or higher
- **Usage**: Chrome streaming gateway, containerized services
- **Compose**: v2 plugin required

```bash
# macOS: Install Docker Desktop
# Linux:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 6. Git
- **Version**: 2.30 or higher

```bash
# macOS
brew install git

# Linux
sudo apt-get install git
```

## AI Provider API Keys (Required for AI Features)

The platform supports multiple AI providers. At least one is required:

| Provider | Environment Variable | Models Available |
|----------|---------------------|------------------|
| OpenAI | `OPENAI_API_KEY` | GPT-4, GPT-3.5, DALL-E |
| Anthropic | `ANTHROPIC_API_KEY` | Claude 3 Opus/Sonnet/Haiku |
| Google | `GOOGLE_API_KEY` | Gemini Pro/Ultra |
| Mistral | `MISTRAL_API_KEY` | Mistral Large/Medium/Small |
| Groq | `GROQ_API_KEY` | Llama 3, Mixtral (fast inference) |
| DeepSeek | `DEEPSEEK_API_KEY` | DeepSeek Coder/Chat |
| Azure | `AZURE_OPENAI_API_KEY` | GPT-4, GPT-3.5 (enterprise) |

### Getting API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys
- **Google**: https://makersuite.google.com/app/apikey
- **Mistral**: https://console.mistral.ai/api-keys/
- **Groq**: https://console.groq.com/keys
- **DeepSeek**: https://platform.deepseek.com/api_keys

## Service Architecture & Ports

### Core Services

| Service | Port | Language | Description | Required? |
|---------|------|----------|-------------|-----------|
| API Server | 3010 | Rust | Main API backend | **Yes** |
| Shell UI (Dev) | 5177 | TypeScript | Vite dev server | **Yes** |
| Electron Shell | - | TypeScript | Desktop application | Optional |
| Terminal Server | 3000 | TypeScript (Bun) | AI model gateway | Optional |

### Optional Services

| Service | Port | Language | Description |
|---------|------|----------|-------------|
| Voice Service | 8001 | Python | TTS/STT processing |
| WebVM Service | 8002 | Rust | WebAssembly VM execution |
| Operator Service | 3010 | Python | Browser automation |
| Memory Service | 3200 | Rust | State/context management |
| Registry Service | 8080 | Rust | Agent/skill registry |
| Policy Service | - | Rust | Policy enforcement |
| Chrome Stream | 8081 | Docker | Chrome via WebRTC |
| TURN Server | 3478 | Docker | WebRTC NAT traversal |

## Python Services

### Browser Use Service
```bash
cd services/browser-use-service
uv venv .venv  # or: python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Dependencies**: FastAPI, uvicorn, pydantic, browser-use, playwright

### Operator Service
```bash
cd services/allternit-operator
uv venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**Dependencies**: FastAPI, uvicorn, pydantic, openai, browser-use, playwright

## Environment Variables

### Core Configuration
```bash
# API Server
Allternit_API_BIND=127.0.0.1:3010
Allternit_LEDGER_PATH=./data/allternit.jsonl
Allternit_DB_PATH=./data/allternit.db
Allternit_API_IDENTITY=api-service
Allternit_API_TENANT=default
Allternit_API_BOOTSTRAP_POLICY=true
Allternit_API_POLICY_ENFORCE=true

# Shell UI
VITE_ALLTERNIT_GATEWAY_URL=http://127.0.0.1:8013
VITE_ALLTERNIT_API_VERSION=v1
VITE_ENABLE_DEBUG_LOGS=true
VITE_ENABLE_MOCK_SERVICES=false
```

### AI Provider Keys
```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
MISTRAL_API_KEY=...
GROQ_API_KEY=...
DEEPSEEK_API_KEY=...
```

### Chrome Streaming (Optional)
```bash
TURN_SECRET=change-this-secret-in-production
TURN_REALM=allternit.com
ALLTERNIT_SESSION_ID=
ALLTERNIT_TENANT_ID=
ALLTERNIT_RESOLUTION=1920x1080
ALLTERNIT_EXTENSION_MODE=managed
```

### Ollama (Local LLM - Optional)
```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

## File Structure

```
allternit/
├── .env                    # Environment configuration
├── .logs/                  # Service logs
├── data/                   # SQLite database, ledger files
├── recordings/             # Browser recordings
├── node_modules/           # Node.js dependencies
├── target/                 # Rust build artifacts
├── infrastructure/            # Layer 0: Foundational infrastructure
├── domains/kernel/               # Layer 1: Execution engine
├── domains/governance/           # Layer 2: Policy enforcement
├── services/             # Layer 3: Runtime boundaries
├── services/             # Layer 4: Orchestration services
├── 5-agents/               # Layer 5: Agent implementations
├── surfaces/                   # Layer 6: UI components
│   └── allternit-platform/       # Main UI library
├── cmd/                 # Layer 7: Applications
│   ├── api/                # Rust API server
│   └── shell/              # Shell applications
│       ├── desktop/        # Electron app
│       ├── web/            # Web shell
│       └── terminal/       # TUI
└── cloud/                # Layer 8: Cloud infrastructure
```

## Quick Start Commands

```bash
# 1. Clone repository
git clone https://github.com/allternit/allternit.git
cd allternit

# 2. Install dependencies
pnpm install

# 3. Build Rust API
cargo build --release --bin allternit-api

# 4. Configure environment
cp .env.example .env
# Edit .env and add your API keys

# 5. Start the platform
./allternit.sh start

# Or use pnpm
pnpm dev
```

## Verification Checklist

After setup, verify these are working:

- [ ] Node.js 18+ installed (`node -v`)
- [ ] pnpm installed (`pnpm -v`)
- [ ] Bun installed (`bun -v`)
- [ ] Rust installed (`rustc --version`)
- [ ] Python 3.10+ installed (`python3 --version`)
- [ ] API server builds (`cargo build --release --bin allternit-api`)
- [ ] Node dependencies installed (`pnpm install`)
- [ ] Environment file configured (`.env` exists with API keys)
- [ ] Ports available (3010, 5177, 8001, 8002)
- [ ] API server starts (`./target/release/allternit-api`)
- [ ] Shell UI accessible (http://localhost:5177)

## Troubleshooting

### Port Conflicts
If ports are already in use:
1. Stop existing services: `lsof -ti :3010 | xargs kill -9`
2. Or change ports in `.env` file

### Build Errors
```bash
# Clean and rebuild
cargo clean
pnpm install
cargo build --release
```

### Missing Dependencies
```bash
# Reinstall Node.js dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Reinstall Rust dependencies
cargo clean
cargo build
```

### API Key Issues
- Ensure keys are set in `.env` file
- Verify keys are valid by testing directly with provider
- Check for rate limiting or quota issues

## Security Notes

1. **Never commit `.env` file** - It contains sensitive API keys
2. **Use strong TURN_SECRET** in production for WebRTC
3. **Restrict API bind address** - Use `127.0.0.1` instead of `0.0.0.0` for local dev
4. **Regularly rotate API keys** - Set calendar reminders

## Support

- Documentation: `docs/` directory
- Architecture: `ARCHITECTURE.md`
- Agent Guide: `AGENTS.md`
- Issues: GitHub Issues
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
cd cmd/shell/desktop
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
cd cloud/chrome-stream
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
