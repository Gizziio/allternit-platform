# A2R Cloud Architecture Documentation

## 📁 Document Organization

This folder contains all architecture documentation for the A2R Cloud/BYOD system.

### Quick Navigation

| Document | Purpose | Status |
|----------|---------|--------|
| **[MVP_TASK_BREAKDOWN.md](MVP_TASK_BREAKDOWN.md)** | Complete task breakdown by phase | ✅ Ready |
| **[RESEARCH_TERMINAL_NETWORKING.md](RESEARCH_TERMINAL_NETWORKING.md)** | Terminal & networking research | ✅ Ready |
| **[VISUAL_SYSTEM_ARCHITECTURE.md](VISUAL_SYSTEM_ARCHITECTURE.md)** | Visual system diagrams | ✅ Ready |
| **[BYOD_ARCHITECTURE.md](BYOD_ARCHITECTURE.md)** | Why BYOD is the right model | ✅ Ready |
| **[ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md)** | Technical decision record | ✅ Ready |

---

## 🎯 What We've Built

### 1. Live Provider Integration
**Location:** `a2rchitech/7-apps/api/src/provider_discovery.rs`
- Fetches real pricing from Hetzner API
- 5-minute cache with fallback
- Static data for Contabo/RackNerd (no public API)

### 2. Proper SSH Key Generation
**Location:** `a2rchitech/7-apps/api/src/ssh_keygen.rs`
- Real ED25519/RSA generation using system `ssh-keygen`
- Native Rust crypto fallback
- Encrypts keys at rest

### 3. Enhanced Frontend Components
**Location:** `a2rchitech/6-ui/a2r-platform/src/views/cloud-deploy/`
- ✅ `ProviderComparison` - Live data comparison
- ✅ `SSHKeyManager` - Proper key generation UI
- ✅ `DeploymentProgressEnhanced` - Real-time WebSocket tracking
- ✅ `DeploymentHistoryPage` - Full deployment management

### 4. Node Agent Scaffold
**Location:** `a2rchitech-workspace/a2r-node/`
- Basic project structure
- WebSocket client stub
- Install script (`scripts/install.sh`)

### 5. Architecture Blueprint
**Location:** `a2rchitech/8-cloud/architecture/`
- Complete system design
- Web terminal research
- Visual architecture diagrams

---

## 🚀 MVP Roadmap (10 Weeks)

### Phase 1: Foundation (Week 1-2)
- Control Plane WebSocket endpoint
- Node agent core (Rust)
- Docker runtime integration
- Installation script

### Phase 2: Web Control Surface (Week 3-4)
- Node management UI
- Web terminal (xterm.js)
- File manager
- Session persistence

### Phase 3: Agent Orchestration (Week 5-6)
- Agent system
- DAG workflow engine
- Memory layer

### Phase 4: Intelligence (Week 7-8)
- Policy engine
- Cost optimization
- Mobile responsiveness

### Phase 5: Local Compute (Week 9-10)
- Local node support
- Hybrid routing
- Desktop notifications

**See [MVP_TASK_BREAKDOWN.md](MVP_TASK_BREAKDOWN.md) for detailed tasks.**

---

## 🏗️ Key Architectural Decisions

### 1. Web-First, Not App-First
- Primary access via browser (desktop + mobile)
- Mobile app later (Phase 2)
- Single codebase (React web app)

### 2. Reverse Tunnel Architecture
```
Node (VPS/Local) ──WebSocket──▶ Control Plane
       │                              │
       │ outbound connection          │ routes to
       │ (works through firewalls)    │ users
       │                              │
       └── NO inbound ports required ◀┘
```

### 3. Hybrid Compute
```
User Account
    ├── Node 1: Hetzner VPS (Cloud)
    ├── Node 2: DigitalOcean VPS (Cloud)
    ├── Node 3: Local iMac (Office)
    └── Node 4: Local Laptop (Home)
    
All managed from single web interface
```

### 4. Terminal-First Access
- xterm.js for web terminal
- Persistent sessions (reconnect on refresh)
- File manager (SFTP over WebSocket)
- Eventually: Native mobile app

---

## 💡 The "Aha" Moment

**A2R is NOT:**
- ❌ A VPS provider
- ❌ An SSH client (like Termius)
- ❌ A cloud IDE (like Codespaces)

**A2R IS:**
- ✅ An **agent orchestration platform**
- ✅ **Infrastructure-as-a-Service** (your own VPS)
- ✅ **Intelligence layer** on top of raw compute

**The Pitch:**
> "Bring your own VPS. We'll install the agent, manage it from our web dashboard, and give you persistent agents, workflows, and team coordination. Think Kubernetes for AI agents, but on your infrastructure."

---

## 📊 Success Metrics

### MVP Launch (Week 10)
- [ ] 100 VPS deployments via A2R
- [ ] 50 active nodes (30-day retention)
- [ ] 1,000 jobs executed per day
- [ ] Terminal access works on mobile browsers
- [ ] File upload/download functional

### Post-MVP
- [ ] 1,000 active nodes
- [ ] Mobile app (iOS/Android)
- [ ] 50+ agents in marketplace
- [ ] Enterprise SSO
- [ ] Multi-region control plane

---

## 🔧 Technology Stack

### Frontend
- **React + TypeScript**
- **xterm.js** - Terminal emulator
- **Monaco Editor** - Code editing
- **WebSocket** - Real-time communication

### Backend (Control Plane)
- **Rust + Axum** - API server
- **PostgreSQL** - Primary database
- **Redis** - Cache & pub/sub
- **tokio-tungstenite** - WebSocket server

### Node Agent
- **Rust** - Binary executable
- **Docker** - Container runtime
- **portable-pty** - PTY management

### Infrastructure
- **Cloudflare** - CDN + DDoS protection
- **AWS/GCP/Azure** - Control plane hosting

---

## 🎬 Next Actions

### Immediate (This Week)
1. Review architecture documents with team
2. Prioritize Phase 1 tasks
3. Set up development environment
4. Start Node Agent implementation

### Week 1-2 (Foundation)
1. Implement WebSocket endpoints in Control Plane
2. Build Node Agent WebSocket client
3. Integrate Docker runtime
4. Test install script on Linux/macOS

### Week 3-4 (Web UI)
1. Build Node dashboard
2. Integrate xterm.js
3. Implement file manager
4. Mobile responsiveness

---

## 📞 Support

For questions about architecture:
1. Check the specific docs in this folder
2. Review visual diagrams in VISUAL_SYSTEM_ARCHITECTURE.md
3. See task breakdown in MVP_TASK_BREAKDOWN.md

---

## 📝 Document History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-23 | Initial architecture docs | A2R Team |
| 2026-02-23 | Added terminal research | A2R Team |
| 2026-02-23 | Added visual diagrams | A2R Team |
| 2026-02-23 | Complete MVP breakdown | A2R Team |

---

**Ready to build? Start with Phase 1 in [MVP_TASK_BREAKDOWN.md](MVP_TASK_BREAKDOWN.md)**
