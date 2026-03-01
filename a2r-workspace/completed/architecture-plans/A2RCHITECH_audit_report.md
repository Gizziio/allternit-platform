# A2rchitech Platform - Comprehensive Technical Audit Report

## Executive Summary

**A2rchitect** (A2R) is an enterprise-grade **Agentic Operating System** designed to provide a complete backend infrastructure for AI agents. This audit reveals a sophisticated, multi-layered architecture with ~100+ Rust crates, TypeScript/React frontends, Python services, and a comprehensive governance framework.

---

## 1. PROJECT OVERVIEW

| Attribute | Value |
|-----------|-------|
| **Repository** | `/Users/macbook/Desktop/a2rchitech-workspace/a2rchitech` |
| **Primary Languages** | Rust (~70%), TypeScript (~20%), Python (~10%) |
| **Workspace Members** | 99 Rust crates |
| **Architecture** | Layered Microservices with Strict Dependency Hierarchy |
| **Status** | Production Ready (Version 2026-02-06) |

---

## 2. LAYER ARCHITECTURE (7 Layers)

The platform follows a **strict unidirectional dependency model** where higher layers may import from lower layers, but never vice versa.

### 2.1 Layer 0: Substrate (`0-substrate/`)
**Purpose**: Foundational infrastructure and shared primitives

| Component | Path | Purpose |
|-----------|------|---------|
| `a2r-substrate` | `0-substrate/a2r-substrate/` | Core runtime, ProcessResult, ToolRequest/Response |
| `a2r-intent-graph-kernel` | `0-substrate/a2r-intent-graph-kernel/` | Persistent, queryable graph of intent nodes |
| `a2r-presentation-kernel` | `0-substrate/a2r-presentation-kernel/` | UI presentation helpers, CanvasProtocol |
| `a2r-agent-system-rails` | `0-substrate/a2r-agent-system-rails/` | Work execution under policy gates (DAG/WIH/Leases/Ledger/Vault) |
| `a2r-embodiment` | `0-substrate/a2r-embodiment/` | Agent identity and presence management |
| `a2r-skill-portability` | `0-substrate/a2r-skill-portability/` | Cross-platform skill definitions |
| **SDK** | `0-substrate/sdk/` | 5 SDK crates: core, apps, functions, policy, transport |
| **Types** | `0-substrate/types/` | Shared TypeScript contracts (capsule-spec, a2ui-types) |
| **Protocols** | `0-substrate/protocols/` | Communication protocols (canvas-protocol) |

**Key Architectural Principle**: This layer provides the **bedrock** upon which all higher layers are built. It ensures interface stability with backward compatibility.

---

### 2.2 Layer 1: Kernel (`1-kernel/`)
**Purpose**: Execution engine, sandboxing, process management

| Subsystem | Components |
|-----------|------------|
| **a2r-kernel/** | `kernel-contracts/`, `runtime-execution-core/`, `runtime-local-executor/`, `tools-gateway/`, `wasm-runtime/` |
| **Capsule System** | `a2r-capsule/`, `a2r-capsule-compiler/`, `a2r-capsule-runtime/` |
| **Control Plane** | `a2r-agent-orchestration/` (agents, agent-router, hooks, model-router, workflows), `a2r-control/`, `unified-registry/` |
| **Execution** | `a2r-local-compute/` (executor, local-inference, mlx-inference), `a2r-ops/packaging` |
| **Data** | `a2r-memory-provider/`, `history-ledger/` |
| **Communication** | `kernel-messaging/`, `a2r-transports/` |
| **Infrastructure** | `a2r-openclaw-host/`, `a2r-parity/`, `a2r-providers/`, `a2r-acp-driver/`, `a2r-runtime/`, `a2r-rlm/` |

**Key Capabilities**:
- WebAssembly sandboxed execution
- Local compute with MLX inference support
- Capsule compilation and runtime
- Agent orchestration with hooks system

---

### 2.3 Layer 2: Governance (`2-governance/`)
**Purpose**: Policy enforcement, WIH (Work Identity Handle), receipts, audit trails

| Component | Path | Purpose |
|-----------|------|---------|
| `core-policy` | `identity-access-control/core-policy/` | Policy engine and evaluation |
| `policy-engine` | `identity-access-control/policy-engine/` | Advanced policy compilation |
| `core-audit` | `audit-logging/core-audit/` | Append-only audit logging |
| `core-evidence` | `evidence-management/core-evidence/` | Evidence management |
| `core-governance` | `governance-workflows/core-governance/` | Governance workflows |
| `rust-governor` | `governance-workflows/rust-governor/` | High-performance Rust governance |
| `evals` | `security-quality-assurance/evals/` | Quality assurance evaluations |
| `worktree-manager` | `worktree-manager/` | Git worktree management |
| `security-network` | `security-network/` | Network security controls |

**Key Features**:
- Policy DSL (Domain Specific Language)
- Immutable audit trails
- Compliance checking and legal framework support
- Tamper-evident ledger events

---

### 2.4 Layer 3: Adapters (`3-adapters/`)
**Purpose**: Runtime boundary, vendor integration, protocol adapters

| Component | Path | Purpose |
|-----------|------|---------|
| **Bridge Systems** | `bridge-systems/` | `a2r-webvm/`, `a2r-native-bridge/`, `io-daemon/` |
| **MCP** | `mcp/` | Model Context Protocol client implementation |
| **Rust Adapters** | `rust/` | `skills/`, `marketplace/`, `provider-adapter/`, `extension-adapter/` |
| **Channel Systems** | `channel-systems/` | Secure communication channels |
| **Runtime Adapters** | `runtime-adapters/` | Multi-runtime environment support |
| **Search Integration** | `search-integration/` | Web search and document retrieval |

**Key Integration**: MCP (Model Context Protocol) client enables standardized AI model interactions.

---

### 2.5 Layer 4: Services (`4-services/`)
**Purpose**: Orchestration services, schedulers, coordinators (long-running daemons)

#### Core Services

| Service | Port | Language | Purpose |
|---------|------|----------|---------|
| **Gateway** | 8013 (Public) | Python (FastAPI) | Single entry point, auth, rate limiting |
| **Public API** | 3000 | Rust (Axum) | Business logic, workflow orchestration |
| **Kernel Service** | 3004 | Rust | Brain session management, tool execution |
| **Memory Service** | 3200 | Rust | State/context management |
| **Registry Service** | 8080 | Rust | Agent/skill/tool definitions |

#### AI/ML Services

| Service | Port | Language | Purpose |
|---------|------|----------|---------|
| **Voice Service** | 8001 | Python (FastAPI) + Rust | TTS, voice cloning (XTTS v2, Piper, Chatterbox) |
| **WebVM Bridge** | 8002 | Rust (Axum) | Browser-based Linux VMs via WebAssembly |
| **A2R Operator** | 3010 | Python (FastAPI) | Browser automation, computer-use, desktop automation |
| **A2R Rails** | 3011 | Rust (Axum) | Agent task planning under policy gates |

#### Additional Services
- **Pattern Service**: Pattern recognition and analysis
- **Prompt Pack Service**: Prompt management and optimization
- **Platform Orchestration Service**: Cross-service coordination
- **Workspace Service**: Workspace management

---

### 2.6 Layer 5: Agents (`5-agents/`)
**Purpose**: Agent implementations and behaviors

| Component | Purpose |
|-----------|---------|
| `cookbooks/` | Reusable agent recipes |
| `packs/` | Agent capability packs |
| `primitives/` | Core agent primitives |
| `roles/` | Agent role definitions |
| `spec/` | Agent specifications |

---

### 2.7 Layer 6: UI (`6-ui/`)
**Purpose**: Application entrypoints, UI components, distribution targets

| Component | Path | Technology | Purpose |
|-----------|------|------------|---------|
| **a2r-platform** | `a2r-platform/` | TypeScript/React | UI platform primitives and vendor wrappers |
| **Canvas Monitor** | `canvas-monitor/` | Rust | Canvas state visualization |
| **Shell UI** | `shell-ui/` | TypeScript/React | Shell application components |

---

### 2.8 Layer 7: Apps (`7-apps/`)
**Purpose**: Top-level packaged applications

| Application | Path | Technology | Purpose |
|-------------|------|------------|---------|
| **API** | `api/` | Rust (Axum) | HTTP endpoints for orchestration |
| **CLI** | `cli/` | Rust | Command-line interface |
| **Shell Electron** | `shell-electron/` | Electron/TypeScript | Desktop application |
| **Shell UI** | `shell-ui/` | TypeScript/React | Rich web-based UI |
| **OpenWork** | `openwork/` | TypeScript | Experimental fleet orchestration |
| **Launcher** | `launcher/` | Rust | Application launcher |
| **UI** | `ui/` | TypeScript/React | UI components |

---

## 3. SERVICE ARCHITECTURE & DATA FLOW

### 3.1 Request Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         LAYER 6: UI                                     │
│                    Shell Electron (Desktop App)                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYER 5: GATEWAY                                   │
│              API Gateway (Port 8013 - Public)                           │
│  • SSL/TLS Termination  • JWT/API Key Auth  • Rate Limiting (120/min)   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────┐          ┌─────────────────┐         ┌──────────────────┐
│   Voice      │          │   Public API    │         │  WebVM/Operator  │
│  :8001       │          │   (Port 3000)   │         │   :8002/:3010    │
└──────────────┘          └─────────────────┘         └──────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌──────────────┐          ┌─────────────────┐         ┌──────────────────┐
│   Kernel     │          │     Memory      │         │    Registry      │
│   :3004      │          │    :3200        │         │    :8080         │
└──────────────┘          └─────────────────┘         └──────────────────┘
```

### 3.2 Environment Configuration

```bash
# Core Service URLs
A2R_KERNEL_URL=http://127.0.0.1:3004
A2R_REGISTRY_URL=http://127.0.0.1:8080
A2R_MEMORY_URL=http://127.0.0.1:3200
A2R_POLICY_URL=http://127.0.0.1:3003
A2R_VOICE_URL=http://127.0.0.1:8001
A2R_WEBVM_URL=http://127.0.0.1:8002
A2R_OPERATOR_URL=http://127.0.0.1:3010
A2R_RAILS_URL=http://127.0.0.1:3011
A2R_EXECUTOR_URL=http://127.0.0.1:3510
```

---

## 4. A2R AGENT SYSTEM RAILS (Core Orchestration)

The **A2R Agent System Rails** (Port 3011) is a unified work execution system under policy gates.

### 4.1 Core Concepts

| Concept | Description |
|---------|-------------|
| **DAG** | Directed Acyclic Graph of work items (tasks/subtasks) |
| **WIH** | Work Identity Handle - active execution context |
| **Gate** | Policy enforcer for transitions and tool execution |
| **Ledger** | Append-only event log (JSONL) - authoritative source |
| **Leases** | Atomic reservations for file paths/resources |
| **Vault** | End-of-line bundling and compaction |
| **Mail** | Threaded messaging between agents |

### 4.2 Key API Endpoints

```
# Planning
POST /v1/plan              # Create new plan from text
POST /v1/plan/refine       # Refine existing plan
GET  /v1/plan/:dag_id      # Show DAG details

# WIH (Work Identity Handle)
POST /v1/wihs              # List WIHs
POST /v1/wihs/pickup       # Pick up work
POST /v1/wihs/:id/close    # Close WIH with status

# Leases
POST /v1/leases            # Request lease for paths
DELETE /v1/leases/:id      # Release lease

# Ledger
POST /v1/ledger/tail       # Query recent events
POST /v1/ledger/trace      # Trace events by node/wih

# Mail
POST /v1/mail/send         # Send message to thread
GET  /v1/mail/inbox        # List messages

# Gate
POST /v1/gate/check        # Check if action is allowed
GET  /v1/gate/verify       # Verify ledger chain
```

---

## 5. AI SERVICES INTEGRATION

### 5.1 Voice Service (Port 8001)

| Engine | Description | Use Case |
|--------|-------------|----------|
| **Chatterbox Turbo** | Resemble AI with paralinguistic tags | Premium voice output |
| **XTTS v2** | Coqui voice cloning | Clone voices from samples |
| **Piper** | Local fast TTS | Low-latency responses |

**Paralinguistic Tags**: `[laugh]`, `[chuckle]`, `[cough]`

### 5.2 A2R Operator (Port 3010)

| Mode | Description |
|------|-------------|
| **Browser-Use** | Agent-based browser automation with LLM reasoning |
| **Playwright** | Fast headless browser control |
| **Computer-Use** | Vision-based computer control |
| **Desktop-Use** | Desktop automation via A2R Vision |
| **Parallel Execution** | Multi-variant task execution |

### 5.3 WebVM Bridge (Port 8002)

- Browser-based Linux VMs via WebAssembly
- Sandboxed code execution for agents
- Terminal access from UI
- Isolated development environments

---

## 6. MCP (MODEL CONTEXT PROTOCOL) INTEGRATION

**Location**: `crates/mcp-client/` and `3-adapters/mcp/`

The platform implements MCP for standardized AI model interactions:

- **Client Implementation**: Rust-based MCP client
- **Transport**: Stdio and HTTP transports
- **Capabilities**: Tool calling, resource access, prompt handling

---

## 7. DATABASE & STORAGE

| Store | Location | Purpose |
|-------|----------|---------|
| **SQLite** | `a2rchitech.db` | Primary application database |
| **JSONL Ledger** | `a2rchitech.jsonl` | Append-only event log |
| **A2R Directory** | `.a2r/` | Hidden runtime stores (Rails ledger, DAGs, WIHs) |

---

## 8. KEY INTEGRATION POINTS FOR FEATURE DEVELOPMENT

### 8.1 Adding New Services

1. **Create in appropriate layer**:
   - Core logic: `1-kernel/` or `4-services/`
   - External integration: `3-adapters/`
   - UI: `6-ui/`
   - Apps: `7-apps/`

2. **Add to workspace** in root `Cargo.toml`

3. **Register in Gateway** (`4-services/gateway/src/main.py`)

4. **Add environment variables** to configuration

### 8.2 Adding New Tools/Skills

1. Define in `0-substrate/a2r-skill-portability/` (if shared)
2. Implement adapter in `3-adapters/rust/skills/`
3. Register in Registry Service (`4-services/registry/`)

### 8.3 Adding New UI Components

1. Add to `6-ui/a2r-platform/` for shared primitives
2. Use `0-substrate/types/` for TypeScript contracts
3. Consume Gate/Ledger event stream (not direct kernel calls)

### 8.4 Policy Integration

All actions flow through the **Gate**:
1. Policy evaluation at `2-governance/policy-engine/`
2. WIH tracking in Rails system
3. Ledger events for audit trail

---

## 9. SECURITY ARCHITECTURE

| Layer | Security Mechanism |
|-------|-------------------|
| **Gateway** | JWT/API Key auth, rate limiting (120 req/min), CORS |
| **Kernel** | Binds to localhost ONLY (127.0.0.1) |
| **Execution** | WebAssembly sandboxing, resource limits |
| **Governance** | Policy DSL, tamper-evident audit trails |
| **Communications** | TLS encryption, certificate pinning |

---

## 10. PERFORMANCE TARGETS

| Metric | Target |
|--------|--------|
| Local Execution | <10ms for simple operations |
| WASM Execution | <50ms for module instantiation |
| Policy Evaluation | <5ms for simple checks |
| Gateway Processing | <10ms for authenticated requests |
| Concurrent Executions | 1000+ simultaneous |
| Tool Invocations | 10,000 ops/sec |

---

## 11. BUILD & DEPLOYMENT

### 11.1 Build Commands

```bash
# Build all Rust crates
cargo build --release

# Run API service
cd 7-apps/api && cargo run

# Run development environment
pnpm dev

# Run Electron shell
pnpm shell
```

### 11.2 Docker Support

```bash
docker-compose up -d
# Services: intent-graph-kernel, capsule-runtime, voice-service, 
#           webvm-service, api
```

---

## 12. SUMMARY FOR FEATURE INTEGRATION

### 12.1 To Build Core Features:

1. **Understand the layer hierarchy** - Respect unidirectional dependencies
2. **Use Substrate types** - Import from `0-substrate/` for compatibility
3. **Integrate with Rails** - For work execution, use Gate/Vault patterns
4. **Follow the policy model** - All actions pass through policy enforcement
5. **Emit ledger events** - All services must emit events for audit trails

### 12.2 To Build UI Features:

1. **Consume from services** - Use API Gateway (port 8013)
2. **Use A2R Platform components** - Base on `6-ui/a2r-platform/`
3. **Follow canvas protocol** - For visual workflows
4. **Type safety** - Use shared TypeScript contracts

### 12.3 To Build External Integrations:

1. **Use Adapter layer** - Implement in `3-adapters/`
2. **Create bridges** - For external runtimes (WebVM, Native)
3. **MCP compatibility** - Consider MCP for AI model integration

---

## Appendix A: Directory Structure Summary

```
a2rchitech/
├── 0-substrate/          # Foundational infrastructure
│   ├── a2r-substrate/
│   ├── a2r-intent-graph-kernel/
│   ├── a2r-presentation-kernel/
│   ├── a2r-agent-system-rails/
│   ├── a2r-embodiment/
│   ├── a2r-skill-portability/
│   ├── sdk/              # 5 SDK crates
│   ├── types/            # TypeScript contracts
│   └── protocols/
├── 1-kernel/             # Execution engine
│   ├── a2r-kernel/
│   ├── capsule-system/
│   ├── control-plane/
│   ├── execution/
│   ├── communication/
│   └── infrastructure/
├── 2-governance/         # Policy and compliance
│   ├── identity-access-control/
│   ├── audit-logging/
│   ├── governance-workflows/
│   └── security-network/
├── 3-adapters/           # External integrations
│   ├── bridge-systems/
│   ├── mcp/
│   └── rust/
├── 4-services/           # Platform services
│   ├── gateway/
│   ├── orchestration/
│   ├── registry/
│   ├── memory/
│   ├── ml-ai-services/
│   └── a2r-operator/
├── 5-agents/             # Agent implementations
├── 6-ui/                 # UI components
│   ├── a2r-platform/
│   └── canvas-monitor/
├── 7-apps/               # Applications
│   ├── api/
│   ├── cli/
│   ├── shell-electron/
│   ├── shell-ui/
│   └── openwork/
├── crates/               # Additional crates
│   └── mcp-client/
└── bin/                  # Utility scripts
```

---

## Appendix B: Service Port Reference

| Service | Port | Access |
|---------|------|--------|
| API Gateway | 8013 | Public |
| Public API | 3000 | Internal |
| Kernel Service | 3004 | Localhost only |
| Memory Service | 3200 | Internal |
| Registry Service | 8080 | Internal |
| Voice Service | 8001 | Internal |
| WebVM Bridge | 8002 | Internal |
| A2R Operator | 3010 | Internal |
| A2R Rails | 3011 | Internal |
| Task Executor | 3510 | On-demand |

---

**Report Compiled**: 2026-02-17  
**Auditor**: Senior Software Engineer Analysis  
**Project Status**: Production-Ready Enterprise Agentic OS  
**Version**: 2026-02-06
