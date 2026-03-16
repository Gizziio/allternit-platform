# A2R MVP Task Breakdown

**Vision:** Web-based control plane for agent orchestration on user-owned infrastructure (VPS + Local)

**Access Model:**
- Primary: Web Browser (any device)
- Future: Mobile App (iOS/Android)
- Networking: Termius-style persistent connections
- Compute: VPS (cloud) + Local (on-prem) hybrid

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER DEVICES                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Desktop   │  │   Laptop    │  │    Phone    │  │      Tablet         │ │
│  │   Browser   │  │   Browser   │  │   Browser   │  │      Browser        │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼────────────────┼────────────────┼────────────────────┼────────────┘
          │                │                │                    │
          └────────────────┴────────────────┴────────────────────┘
                                   │
                         HTTPS / WebSocket
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         A2R CONTROL PLANE                                    │
│                     (Cloud-hosted, lightweight)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Web UI    │  │   API GW    │  │   Router    │  │   Session Manager   │ │
│  │   (React)   │  │   (Axum)    │  │  (WSS Hub)  │  │   (Termius-style)   │ │
│  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌──────┴──────┐  ┌─────────────────────┐ │
│  │  Scheduler  │  │  DAG Engine │  │   Policy    │  │     Memory Layer    │ │
│  │             │  │             │  │   Engine    │  │                     │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────┴──────────┐       ┌─────────┴──────────┐
         │   VPS NODES         │       │   LOCAL NODES      │
         │   (Cloud)           │       │   (On-Prem)        │
         │                     │       │                    │
         │  ┌──────────────┐   │       │  ┌──────────────┐  │
         │  │  A2R Agent   │   │       │  │  A2R Agent   │  │
         │  │  (Docker)    │   │       │  │  (Docker)    │  │
         │  └──────────────┘   │       │  └──────────────┘  │
         │                     │       │                    │
         │  Hetzner/DigitalOcean│      │  Mac/Windows/Linux │
         │  Contabo/RackNerd    │      │  Home/Office       │
         └─────────────────────┘       └────────────────────┘
```

---

## Phase 1: Foundation (Week 1-2)

### 1.1 Control Plane API
**Location:** `a2rchitech/7-apps/api/src/cloud_deploy_routes.rs` (extend)

#### Tasks:
- [x] **1.1.1** WebSocket endpoint for node connections
  - Path: `/ws/nodes/{node_id}`
  - Auth: JWT token validation
  - Protocol: Binary or JSON messages
  - Subtasks:
    - [x] 1.1.1.1 Create WebSocket upgrade handler (test-server.rs)
    - [x] 1.1.1.2 Implement connection authentication
    - [x] 1.1.1.3 Add connection state tracking
    - [x] 1.1.1.4 Implement heartbeat protocol
    
- [x] **1.1.2** Node registration (via WebSocket)
  - Protocol: JSON message
  - Returns: Node ID, auth token, config
  - Subtasks:
    - [x] 1.1.2.1 Node metadata schema (hostname, capabilities, labels)
    - [x] 1.1.2.2 Token validation
    - [ ] 1.1.2.3 Node state persistence (SQLite)
    
- [x] **1.1.3** Job dispatch system
  - Path: WebSocket push (test-server → node)
  - Features: Basic job assignment
  - Subtasks:
    - [x] 1.1.3.1 Job assignment message protocol
    - [ ] 1.1.3.2 Job queue implementation
    - [ ] 1.1.3.3 Job routing by node capabilities
    - [ ] 1.1.3.4 Job state machine (pending → running → completed)
    
- [ ] **1.1.4** Live provider data endpoint
  - Path: `GET /api/v1/providers/{id}/live`
  - Returns: Real pricing, regions, availability
  - Status: ✅ Partially done (need to integrate)

### 1.2 Node Agent (A2R Node)
**Location:** `a2rchitech-workspace/a2r-node/`

#### Tasks:
- [x] **1.2.1** Core agent binary
  - Language: Rust
  - Binary name: `a2r-node`
  - Subtasks:
    - [x] 1.2.1.1 Project structure (Cargo.toml, modules)
    - [x] 1.2.1.2 Configuration loading (env + file)
    - [x] 1.2.1.3 Logging and telemetry
    - [x] 1.2.1.4 Error handling and recovery
    
- [x] **1.2.2** WebSocket client
  - Features: Auto-reconnect, heartbeat
  - Subtasks:
    - [x] 1.2.2.1 Connection management
    - [x] 1.2.2.2 Message serialization (JSON)
    - [x] 1.2.2.3 Reconnection with exponential backoff
    - [x] 1.2.2.4 Connection health monitoring
    
- [x] **1.2.3** Docker runtime integration
  - Features: Pull images, run containers, stream logs
  - Subtasks:
    - [x] 1.2.3.1 Docker client setup (bollard)
    - [x] 1.2.3.2 Container lifecycle management
    - [ ] 1.2.3.3 Volume mounting for persistence
    - [ ] 1.2.3.4 Network isolation
    - [x] 1.2.3.5 Resource limits (CPU, memory)
    
- [x] **1.2.4** Job executor
  - Features: WIH support, streaming logs, timeout, cancellation
  - Subtasks:
    - [x] 1.2.4.1 WIH parser (TaskDefinition enum)
    - [x] 1.2.4.2 Job execution in container
    - [x] 1.2.4.3 Real-time log streaming to control plane
    - [ ] 1.2.4.4 Artifact upload
    - [x] 1.2.4.5 Job timeout and cancellation

### 1.3 Installation & Provisioning
**Location:** `a2rchitech-workspace/a2r-node/scripts/`

#### Tasks:
- [ ] **1.3.1** Universal install script
  - File: `install.sh`
  - Supports: Linux (systemd), macOS (launchd), Windows (service)
  - Subtasks:
    - [ ] 1.3.1.1 OS detection
    - [ ] 1.3.1.2 Architecture detection (x64, arm64)
    - [ ] 1.3.1.3 Docker installation check/auto-install
    - [ ] 1.3.1.4 Binary download from GitHub releases
    - [ ] 1.3.1.5 Service registration (systemd/launchd/Windows)
    - [ ] 1.3.1.6 Configuration file generation
    
- [ ] **1.3.2** Cloud-init integration
  - For: Hetzner, DigitalOcean, AWS, etc.
  - Subtasks:
    - [ ] 1.3.2.1 Cloud-init template
    - [ ] 1.3.2.2 Auto-registration with token
    - [ ] 1.3.2.3 First-boot configuration

---

## Phase 2: Web Control Surface (Week 3-4)

### 2.1 Node Management UI
**Location:** `a2rchitech/6-ui/a2r-platform/src/views/nodes/`

#### Tasks:
- [ ] **2.1.1** Node dashboard
  - Features: List all nodes, status, actions
  - Subtasks:
    - [ ] 2.1.1.1 Node list component
    - [ ] 2.1.1.2 Status indicators (online/offline/busy)
    - [ ] 2.1.1.3 Resource usage display (CPU, memory, disk)
    - [ ] 2.1.1.4 Node details panel
    - [ ] 2.1.1.5 Node actions (restart, update, remove)
    
- [ ] **2.1.2** Node registration flow
  - Features: Generate token, show install command
  - Subtasks:
    - [ ] 2.1.2.1 "Add Node" wizard
    - [ ] 2.1.2.2 Token generation UI
    - [ ] 2.1.2.3 Copy-paste install command
    - [ ] 2.1.2.4 QR code for mobile (future)
    - [ ] 2.1.2.5 Auto-detection of new nodes

### 2.2 Terminal Access (Termius-Style)
**Location:** `a2rchitech/6-ui/a2r-platform/src/components/terminal/`

#### Tasks:
- [ ] **2.2.1** Web-based terminal
  - Library: xterm.js
  - Features: Full PTY, colors, history
  - Subtasks:
    - [ ] 2.2.1.1 xterm.js integration
    - [ ] 2.2.1.2 WebSocket for terminal data
    - [ ] 2.2.1.3 Session management
    - [ ] 2.2.1.4 Multi-tab support
    - [ ] 2.2.1.5 Terminal theming
    
- [ ] **2.2.2** Session persistence
  - Features: Reconnect on refresh, session history
  - Subtasks:
    - [ ] 2.2.2.1 Session ID management
    - [ ] 2.2.2.2 Reconnection logic
    - [ ] 2.2.2.3 Scrollback buffer
    - [ ] 2.2.2.4 Command history

### 2.3 File Manager
**Location:** `a2rchitech/6-ui/a2r-platform/src/views/files/`

#### Tasks:
- [ ] **2.3.1** Web-based file browser
  - Features: Browse, upload, download, edit
  - Subtasks:
    - [ ] 2.3.1.1 File tree navigation
    - [ ] 2.3.1.2 File upload (drag & drop)
    - [ ] 2.3.1.3 File download
    - [ ] 2.3.1.4 Basic text editor integration
    - [ ] 2.3.1.5 File permissions display

---

## Phase 3: Agent Orchestration (Week 5-6)

### 3.1 Agent System
**Location:** `a2rchitech/8-cloud/a2r-cloud-core/`

#### Tasks:
- [ ] **3.1.1** Agent registry
  - Features: CRUD for agent definitions
  - Subtasks:
    - [ ] 3.1.1.1 Agent schema (name, description, docker image, config)
    - [ ] 3.1.1.2 Agent CRUD API
    - [ ] 3.1.1.3 Agent versioning
    - [ ] 3.1.1.4 Agent marketplace structure
    
- [ ] **3.1.2** Agent runner
  - Features: Deploy agents to nodes, manage lifecycle
  - Subtasks:
    - [ ] 3.1.2.1 Agent deployment to node
    - [ ] 3.1.2.2 Agent start/stop/restart
    - [ ] 3.1.2.3 Agent logs streaming
    - [ ] 3.1.2.4 Agent health checks
    - [ ] 3.1.2.5 Agent auto-restart on failure

### 3.2 Workflow Engine (DAG)
**Location:** `a2rchitech/2-governance/dag-engine/`

#### Tasks:
- [ ] **3.2.1** DAG parser and validator
  - Features: Parse WIH DAG, validate dependencies
  - Subtasks:
    - [ ] 3.2.1.1 DAG YAML/JSON schema
    - [ ] 3.2.1.2 Dependency graph validation
    - [ ] 3.2.1.3 Cycle detection
    - [ ] 3.2.1.4 Parallel execution planning
    
- [ ] **3.2.2** DAG executor
  - Features: Execute workflows across nodes
  - Subtasks:
    - [ ] 3.2.2.1 Step scheduler
    - [ ] 3.2.2.2 State persistence
    - [ ] 3.2.2.3 Retry logic with backoff
    - [ ] 3.2.2.4 Rollback on failure
    - [ ] 3.2.2.5 Progress tracking

### 3.3 Memory Layer
**Location:** `a2rchitech/8-cloud/a2r-cloud-core/src/memory/`

#### Tasks:
- [ ] **3.3.1** Shared context store
  - Features: Key-value with TTL, cross-agent access
  - Subtasks:
    - [ ] 3.3.1.1 Context schema
    - [ ] 3.3.1.2 Read/write API
    - [ ] 3.3.1.3 TTL and cleanup
    - [ ] 3.3.1.4 Access control (which agents can access what)
    - [ ] 3.3.1.5 Persistence (SQLite/Redis)

---

## Phase 4: Intelligence & Polish (Week 7-8)

### 4.1 Policy Engine
**Location:** `a2rchitech/2-governance/policy-engine/`

#### Tasks:
- [ ] **4.1.1** Policy definition
  - Features: Allowlists, quotas, restrictions
  - Subtasks:
    - [ ] 4.1.1.1 Policy schema (YAML)
    - [ ] 4.1.1.2 Tool allowlist
    - [ ] 4.1.1.3 Network restrictions
    - [ ] 4.1.1.4 Resource quotas
    - [ ] 4.1.1.5 Forbidden patterns
    
- [ ] **4.1.2** Policy enforcement
  - Features: Validate before execution
  - Subtasks:
    - [ ] 4.1.2.1 Pre-execution validation
    - [ ] 4.1.2.2 Runtime monitoring
    - [ ] 4.1.2.3 Kill switch for violations

### 4.2 Cost Optimization
**Location:** `a2rchitech/8-cloud/a2r-cloud-core/src/scheduler/`

#### Tasks:
- [ ] **4.2.1** Smart scheduler
  - Features: Place jobs on optimal nodes
  - Subtasks:
    - [ ] 4.2.1.1 Node capability matching
    - [ ] 4.2.1.2 Cost-based placement
    - [ ] 4.2.1.3 Load balancing
    - [ ] 4.2.1.4 Spot/preemptible instance support

### 4.3 Mobile Responsiveness
**Location:** `a2rchitech/6-ui/a2r-platform/`

#### Tasks:
- [ ] **4.3.1** Responsive UI
  - Features: Works on phone/tablet browsers
  - Subtasks:
    - [ ] 4.3.1.1 Mobile navigation
    - [ ] 4.3.1.2 Touch-friendly controls
    - [ ] 4.3.1.3 Responsive tables
    - [ ] 4.3.1.4 Bottom sheet for actions

---

## Phase 5: Local Compute (Week 9-10)

### 5.1 Local Node Support
**Location:** `a2r-node/` + `a2rchitech/7-apps/api/`

#### Tasks:
- [ ] **5.1.1** Local installation
  - Features: Run agent on local machine
  - Subtasks:
    - [ ] 5.1.1.1 Local installer (not just VPS)
    - [ ] 5.1.1.2 Desktop notifications
    - [ ] 5.1.1.3 Auto-start on login
    - [ ] 5.1.1.4 Local resource detection
    
- [ ] **5.1.2** Hybrid routing
  - Features: Route jobs to VPS or local based on policy
  - Subtasks:
    - [ ] 5.1.2.1 Local vs cloud routing rules
    - [ ] 5.1.2.2 Data locality preferences
    - [ ] 5.1.2.3 Fallback (local → cloud)

### 5.2 Offline Support (Future)
**Location:** Research phase

#### Tasks:
- [ ] **5.2.1** Local queueing
  - Features: Queue jobs when offline, sync when back
  - Status: Future research

---

## File Locations Summary

| Component | Location | Status |
|-----------|----------|--------|
| Architecture docs | `a2rchitech/8-cloud/architecture/` | ✅ Organized |
| Node Agent | `8-cloud/a2r-node/` | ✅ Core + WebSocket Working |
| Control Plane API | `a2rchitech/7-apps/api/src/` | 🔄 In Progress |
| Web UI | `a2rchitech/6-ui/a2r-platform/` | 🔄 Enhanced |
| Provider Discovery | `a2rchitech/7-apps/api/src/provider_discovery.rs` | ✅ Created |
| SSH Keygen | `a2rchitech/7-apps/api/src/ssh_keygen.rs` | ✅ Created |
| Install Script | `a2r-node/scripts/install.sh` | ✅ Created |

---

## Success Criteria

### MVP Launch (Week 8)
- [ ] User can buy VPS via A2R (1-click)
- [ ] VPS auto-registers with control plane
- [ ] User can access terminal via web browser
- [ ] User can browse files via web browser
- [ ] User can deploy at least 3 agent types
- [ ] User can create and run a simple DAG workflow
- [ ] Mobile browser access works

### Post-MVP
- [ ] Mobile app (iOS/Android)
- [ ] 10+ agents in marketplace
- [ ] Advanced policy engine
- [ ] Team collaboration features
- [ ] Enterprise SSO

---

## Research Needed

1. **Termius-style networking:**
   - How do they maintain persistent connections?
   - What protocols for low-latency terminal?
   - Mobile app architecture

2. **Web-based terminal performance:**
   - xterm.js vs alternatives
   - WebSocket vs WebRTC for data
   - Clipboard integration on mobile

3. **Local compute discovery:**
   - mDNS for local node discovery
   - NAT traversal for home networks
   - Local vs cloud job routing

4. **Security model:**
   - Zero-trust architecture
   - mTLS for node authentication
   - Secret management (Vault integration)
