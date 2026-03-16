# A2R Visual System Architecture

## Complete System Overview

```
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                              USER ACCESS LAYER                                        ║
║  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ║
║  │   🖥️ Desktop    │  │   💻 Laptop     │  │   📱 Phone      │  │   📱 Tablet     │  ║
║  │   Chrome/Firefox│  │   Safari        │  │   Mobile Safari │  │   Chrome Mobile │  ║
║  │                 │  │                 │  │                 │  │                 │  ║
║  │  • Terminal     │  │  • Terminal     │  │  • Terminal     │  │  • Terminal     │  ║
║  │  • Files        │  │  • Files        │  │  • Files        │  │  • Files        │  ║
║  │  • Agents       │  │  • Agents       │  │  • Agents       │  │  • Agents       │  ║
║  │  • DAG Builder  │  │  • DAG Builder  │  │  • Dashboard    │  │  • Dashboard    │  ║
║  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  ║
╚═══════════┼════════════════════┼════════════════════┼════════════════════┼═══════════╝
            │                    │                    │                    │
            └────────────────────┴────────────────────┴────────────────────┘
                                     │
                        HTTPS/WSS (Cloudflare/CDN)
                                     │
                                     ▼
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                           A2R CONTROL PLANE                                          ║
║                    (Multi-region, Auto-scaling)                                      ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────┐    ║
║  │                         LOAD BALANCER / CDN                                 │    ║
║  │                 (DDoS Protection, SSL Termination)                           │    ║
║  └─────────────────────────────────────────────────────────────────────────────┘    ║
║                                      │                                                ║
║  ┌───────────────────────────────────┴───────────────────────────────────────────┐   ║
║  │                           API GATEWAY (Axum)                                  │   ║
║  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   ║
║  │  │  Auth       │  │  Rate       │  │  WebSocket  │  │  Request            │  │   ║
║  │  │  (JWT)      │  │  Limiting   │  │  Router     │  │  Router             │  │   ║
║  │  └─────────────┘  └─────────────┘  └──────┬──────┘  └─────────────────────┘  │   ║
║  └───────────────────────────────────────────┼───────────────────────────────────┘   ║
║                                              │                                        ║
║  ┌───────────────────────────────────────────┼──────────────────────────────────────┐║
║  │                    CORE SERVICES            │                                      │║
║  │  ┌────────────────────────────────────────┴──────────────────────────────────┐   │║
║  │  │                         SESSION MANAGER                                     │   │║
║  │  │  • Terminal sessions     • File sessions     • Agent sessions             │   │║
║  │  │  • Persistence           • Reconnection      • Multiplexing               │   │║
║  │  └───────────────────────────────────────────────────────────────────────────┘   │║
║  │                                                                                   │║
║  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │║
║  │  │  Scheduler  │  │  DAG Engine │  │   Policy    │  │    Memory Layer     │      │║
║  │  │             │  │             │  │   Engine    │  │                     │      │║
║  │  │ • Queue     │  │ • Parse WIH │  │ • Allowlist │  │ • Shared Context    │      │║
║  │  │ • Route     │  │ • Execute   │  │ • Quotas    │  │ • Cross-agent       │      │║
║  │  │ • Retry     │  │ • Parallel  │  │ • Audit     │  │ • Persistence       │      │║
║  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘      │║
║  │                                                                                   │║
║  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │║
║  │  │   Billing   │  │  Telemetry  │  │   Node      │  │   Agent Registry    │      │║
║  │  │             │  │             │  │   Registry  │  │                     │      │║
║  │  │ • Usage     │  │ • Metrics   │  │ • Health    │  │ • Marketplace       │      │║
║  │  │ • Invoices  │  │ • Logs      │  │ • Discovery │  │ • Versions          │      │║
║  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘      │║
║  └───────────────────────────────────────────────────────────────────────────────────┘║
║                                                                                       ║
║  ┌──────────────────────────────────────────────────────────────────────────────────┐ ║
║  │                           DATA LAYER                                              │ ║
║  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐       │ ║
║  │  │ PostgreSQL  │  │    Redis    │  │   SQLite    │  │   Object Storage    │       │ ║
║  │  │             │  │             │  │   (per      │  │   (S3/MinIO)        │       │ ║
║  │  │ • Users     │  │ • Sessions  │  │   node)     │  │   • Artifacts       │       │ ║
║  │  │ • Nodes     │  │ • Cache     │  │ • State     │  │   • Logs            │       │ ║
║  │  │ • Jobs      │  │ • Pub/Sub   │  │ • Queue     │  │   • Backups         │       │ ║
║  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘       │ ║
║  └───────────────────────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
         ┌──────────┴──────────┐ ┌────────┴────────┐ ┌─────────┴─────────┐
         │   WEBSOCKET HUB     │ │  WEBSOCKET HUB  │ │   WEBSOCKET HUB   │
         │   (US-East)         │ │  (EU-Central)   │ │   (AP-South)      │
         └──────────┬──────────┘ └────────┬────────┘ └─────────┬─────────┘
                    │                     │                     │
         ┌──────────┴──────────┐ ┌────────┴────────┐ ┌─────────┴─────────┐
         │                     │ │                 │ │                   │
╔════════┴═════════════════════╧═╧═════════════════╧═╧═══════════════════╧════════════╗
║                              COMPUTE LAYER (BYOD)                                    ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐ ║
║  │                          VPS NODES (Cloud)                                       │ ║
║  │                                                                                  │ ║
║  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │ ║
║  │   │  🟢 Hetzner  │    │  🔷 Digital  │    │  🔵 Contabo  │    │  🔴 RackNerd │  │ ║
║  │   │     CX21     │    │   Ocean      │    │    VPS-10    │    │   Budget-2   │  │ ║
║  │   │  $4.51/mo    │    │  $6/mo       │    │   $5.50/mo   │    │  $15.98/mo   │  │ ║
║  │   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │ ║
║  │          │                   │                   │                   │          │ ║
║  │          └───────────────────┴───────────────────┴───────────────────┘          │ ║
║  │                                    │                                             │ ║
║  │                    ┌───────────────┴───────────────┐                            │ ║
║  │                    │        A2R NODE AGENT         │                            │ ║
║  │                    │        (Docker Container)     │                            │ ║
║  │                    │                               │                            │ ║
║  │                    │  ┌─────────────────────────┐  │                            │ ║
║  │                    │  │     WebSocket Client    │  │                            │ ║
║  │                    │  │  (Persistent Connection)│◄─┼──► Control Plane          │ ║
║  │                    │  └─────────────────────────┘  │                            │ ║
║  │                    │  ┌─────────────────────────┐  │                            │ ║
║  │                    │  │      PTY Manager        │  │                            │ ║
║  │                    │  │   (Terminal Sessions)   │  │                            │ ║
║  │                    │  └─────────────────────────┘  │                            │ ║
║  │                    │  ┌─────────────────────────┐  │                            │ ║
║  │                    │  │     Docker Runtime      │  │                            │ ║
║  │                    │  │  (Agent Sandboxes)      │  │                            │ ║
║  │                    │  └─────────────────────────┘  │                            │ ║
║  │                    │  ┌─────────────────────────┐  │                            │ ║
║  │                    │  │    WIH Executor         │  │                            │ ║
║  │                    │  │  (Job Runner)           │  │                            │ ║
║  │                    │  └─────────────────────────┘  │                            │ ║
║  │                    └───────────────────────────────┘                            │ ║
║  └─────────────────────────────────────────────────────────────────────────────────┘ ║
║                                                                                       ║
║  ┌─────────────────────────────────────────────────────────────────────────────────┐ ║
║  │                         LOCAL NODES (On-Prem)                                    │ ║
║  │                                                                                  │ ║
║  │   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │ ║
║  │   │   🖥️ iMac    │    │  💻 MacBook  │    │  🐧 Linux    │    │  🪟 Windows  │  │ ║
║  │   │   Studio     │    │   Pro        │    │   Workstation│    │   Desktop    │  │ ║
║  │   │  (Home/Office│    │  (Coffee Shop│    │   (Office)   │    │   (Gaming)   │  │ ║
║  │   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │ ║
║  │          │                   │                   │                   │          │ ║
║  │          └───────────────────┴───────────────────┴───────────────────┘          │ ║
║  │                                    │                                             │ ║
║  │                    ┌───────────────┴───────────────┐                            │ ║
║  │                    │        A2R NODE AGENT         │                            │ ║
║  │                    │        (Same as VPS)          │                            │ ║
║  │                    │                               │                            │ ║
║  │                    │  • Auto-detects local resources│                            │ ║
║  │                    │  • Direct file system access   │                            │ ║
║  │                    │  • GPU support                 │                            │ ║
║  │                    │  • Desktop notifications       │                            │ ║
║  │                    └───────────────────────────────┘                            │ ║
║  └─────────────────────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

---

## Data Flow Examples

### 1. User Opens Terminal

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │────▶│   Browser   │────▶│   API GW    │────▶│   Session   │────▶│   Node      │
│         │     │             │     │             │     │   Manager   │     │   Agent     │
└─────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
    │                  │                   │                   │                   │
    │  1. Click        │                   │                   │                   │
    │  "Terminal"      │                   │                   │                   │
    │─────────────────▶│                   │                   │                   │
    │                  │  2. POST          │                   │                   │
    │                  │  /sessions        │                   │                   │
    │                  │──────────────────▶│                   │                   │
    │                  │                   │  3. Create        │                   │
    │                  │                   │  session          │                   │
    │                  │                   │──────────────────▶│                   │
    │                  │                   │                   │  4. Open          │
    │                  │                   │                   │  PTY              │
    │                  │                   │                   │──────────────────▶│
    │                  │  5. Return        │                   │                   │
    │                  │  session_id       │                   │                   │
    │                  │◀──────────────────│                   │                   │
    │                  │                   │                   │                   │
    │  6. Connect      │                   │                   │                   │
    │  WebSocket       │                   │                   │                   │
    │  wss://...       │                   │                   │                   │
    │─────────────────▶│                   │                   │                   │
    │                  │  7. Upgrade       │                   │                   │
    │                  │  WebSocket        │                   │                   │
    │                  │──────────────────▶│                   │                   │
    │                  │                   │  8. Route to      │                   │
    │                  │                   │  node             │                   │
    │                  │                   │──────────────────▶│                   │
    │                  │                   │                   │  9. Pipe to       │
    │                  │                   │                   │  PTY              │
    │                  │                   │                   │──────────────────▶│
    │                  │◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─◀─│
    │  10. Terminal    │                   │                   │                   │
    │  Data Stream     │                   │                   │                   │
    │◀═══════════════════════════════════════════════════════════════════════════════▶│
```

### 2. User Uploads File

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │────▶│   Browser   │────▶│   Node      │────▶│   Docker    │
│         │     │   (Chunked  │     │   Agent     │     │   Volume    │
└─────────┘     │   Upload)   │     │             │     │             │
                └─────────────┘     └─────────────┘     └─────────────┘

1. User selects file (drag & drop)
2. Browser chunks file (64KB chunks)
3. WebSocket sends chunks with metadata
4. Node assembles file
5. File written to Docker volume or host filesystem
```

### 3. DAG Workflow Execution

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────────────────┐
│   User      │────▶│   Control   │────▶│   Execution Flow                     │
│   Triggers  │     │   Plane     │     │                                     │
│   Workflow  │     │   (DAG)     │     │  ┌─────────┐                       │
└─────────────┘     └─────────────┘     │  │  Step 1 │──┐                    │
                                        │  │  Review │  │                    │
                                        │  └─────────┘  │  ┌─────────┐       │
                                        │       │       └──▶│  Step 2 │       │
                                        │       ▼          │   Test  │──┐    │
                                        │  ┌─────────┐     │         │  │    │
                                        │  │  Node   │     └─────────┘  │    │
                                        │  │ Hetzner │◀─────────────────┘    │
                                        │  └────┬────┘                       │
                                        │       │                            │
                                        │       ▼                            │
                                        │  ┌─────────┐     ┌─────────┐       │
                                        │  │  Step 3 │◀────│  Step 4 │       │
                                        │  │ Deploy  │     │  Notify │       │
                                        │  │(Contabo)│     │         │       │
                                        │  └─────────┘     └─────────┘       │
                                        └─────────────────────────────────────┘
```

---

## Network Topology

### Connection Types

#### 1. Browser to Control Plane
- **Protocol:** HTTPS/WSS
- **Auth:** JWT token
- **Latency requirement:** <100ms (for interactive terminal)
- **CDN:** Yes (Cloudflare/CloudFront)

#### 2. Control Plane to Node
- **Protocol:** WebSocket (persistent)
- **Auth:** mTLS + token
- **Direction:** Outbound from node (reverse tunnel)
- **Firewall:** No inbound ports required
- **Reconnect:** Exponential backoff

#### 3. Node to Local Resources
- **Protocol:** Unix socket / Localhost
- **Access:** Direct (for local nodes)
- **Isolation:** Docker containers

---

## Security Zones

```
┌─────────────────────────────────────────────────────────────────┐
│                    PUBLIC ZONE (Internet)                       │
│  • Browsers                                                       │
│  • Mobile apps                                                    │
│  • CDN                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  CONTROL PLANE ZONE (DMZ)                       │
│  • Load balancer                                                  │
│  • API gateway                                                    │
│  • WebSocket hub                                                  │
│  • No customer data stored here                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA ZONE (Secure)                         │
│  • PostgreSQL (encrypted)                                         │
│  • Redis (encrypted)                                              │
│  • Object storage (encrypted)                                     │
│  • Access logs                                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CUSTOMER ZONE (BYOD)                         │
│  • VPS nodes (Hetzner, DO, etc.)                                  │
│  • Local machines (Home/office)                                   │
│  • Customer data lives here                                       │
│  • A2R has limited access (job execution only)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Scaling Strategy

### Control Plane Scaling
```
Single Region → Multi-Region → Edge Nodes

Phase 1: Single Region
- 1x Postgres primary
- 1x Redis
- 2x API servers
- Handles: 1,000 active nodes

Phase 2: Multi-Region
- US-East, EU-West, AP-South
- Postgres read replicas
- Regional WebSocket hubs
- Handles: 10,000 active nodes

Phase 3: Edge Nodes
- WebSocket hubs in 20+ cities
- Sub-50ms latency globally
- Handles: 100,000+ active nodes
```

### Node Agent Scaling
```
Per-Node Resources:
- CPU: 0.5 cores (baseline)
- Memory: 512MB (baseline)
- Network: WebSocket connection only

Auto-Scaling:
- Vertical: More resources on bigger VPS
- Horizontal: Multiple nodes per account
- Smart routing: Scheduler picks best node
```

---

## Cost Model

### Control Plane Costs (A2R)
| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| API servers | $200 | 2x medium instances |
| Database | $100 | Managed Postgres |
| Cache | $50 | Managed Redis |
| Bandwidth | $100 | WebSocket traffic |
| Storage | $50 | Logs, artifacts |
| **Total** | **$500/mo** | For 1,000 active nodes |

### Node Costs (Customer)
| Provider | Instance | Monthly |
|----------|----------|---------|
| Hetzner | CX21 | $4.51 |
| DigitalOcean | Basic | $6.00 |
| Contabo | VPS 10 | $5.50 |
| Local | Own hardware | $0 |

**Unit Economics:**
- A2R cost per node: $0.50/mo
- Customer cost per node: $5-15/mo
- Margin: N/A (customer pays for compute)
- Revenue: SaaS subscription ($10-50/user/mo)

---

## File Locations in Repo

```
a2rchitech/
├── 6-ui/a2r-platform/
│   ├── src/
│   │   ├── components/
│   │   │   ├── terminal/
│   │   │   │   ├── Terminal.tsx          # xterm.js wrapper
│   │   │   │   ├── TerminalManager.tsx   # Multi-tab support
│   │   │   │   └── FileManager.tsx       # SFTP web UI
│   │   │   └── ...
│   │   └── views/
│   │       ├── nodes/
│   │       │   ├── NodeList.tsx          # Node dashboard
│   │       │   └── NodeDetail.tsx        # Single node view
│   │       └── ...
│   └── ...
│
├── 7-apps/api/
│   └── src/
│       ├── cloud_deploy_routes.rs        # VPS deployment
│       ├── node_routes.rs                # Node management
│       ├── terminal_routes.rs            # Terminal WebSocket
│       ├── file_routes.rs                # File operations
│       ├── provider_discovery.rs         # Live pricing
│       └── ssh_keygen.rs                 # SSH key generation
│
├── 8-cloud/
│   ├── a2r-cloud-core/
│   │   └── src/
│   │       ├── scheduler.rs              # Job routing
│   │       ├── dag_engine.rs             # Workflow engine
│   │       ├── policy_engine.rs          # Security policies
│   │       └── memory/
│   │           └── context_store.rs      # Shared memory
│   │
│   ├── architecture/
│   │   ├── MVP_TASK_BREAKDOWN.md         # This file
│   │   ├── RESEARCH_TERMINAL_NETWORKING.md
│   │   ├── VISUAL_SYSTEM_ARCHITECTURE.md
│   │   ├── BYOD_ARCHITECTURE.md
│   │   └── ARCHITECTURE_DECISION.md
│   │
│   └── a2r-cloud-deploy/                 # Cloud provisioning
│
└── 0-substrate/
    └── a2r-protocol/                     # Shared protocol types
        └── src/
            └── lib.rs                    # Message definitions

└── 8-cloud/
    └── a2r-node/                         # Node agent
        ├── src/
        │   ├── main.rs                   # Entry point
    │   ├── websocket.rs                  # WSS client
    │   ├── pty.rs                        # PTY management
    │   ├── docker.rs                     # Container runtime
    │   └── executor.rs                   # Job execution
    ├── scripts/
    │   └── install.sh                    # Universal installer
    └── Cargo.toml
```

---

## Summary

This architecture enables:

1. ✅ **Web-based access** to terminals and files from any browser
2. ✅ **Mobile support** via responsive web (app later)
3. ✅ **Termius-style networking** with persistent WebSocket connections
4. ✅ **Hybrid compute** (VPS + Local) with unified control plane
5. ✅ **Zero inbound firewall rules** (reverse tunnel from nodes)
6. ✅ **BYOD economics** (users pay for their own compute)

**Next:** Build the core components in priority order (see MVP_TASK_BREAKDOWN.md)
