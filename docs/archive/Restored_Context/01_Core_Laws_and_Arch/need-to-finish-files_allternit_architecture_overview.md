# allternit Platform - Comprehensive Technical Audit Report

## Executive Summary

**allternit** (Allternit) is an enterprise-grade **Agentic Operating System** designed to provide a complete backend infrastructure for AI agents. This audit reveals a sophisticated, multi-layered architecture with ~100+ Rust crates, TypeScript/React frontends, Python services, and a comprehensive governance framework.

---

## 1. PROJECT OVERVIEW

| Attribute | Value |
|-----------|-------|
| **Repository** | `/Users/macbook/Desktop/allternit-workspace/allternit` |
| **Primary Languages** | Rust (~70%), TypeScript (~20%), Python (~10%) |
| **Workspace Members** | 99 Rust crates |
| **Architecture** | Layered Microservices with Strict Dependency Hierarchy |
| **Status** | Production Ready (Version 2026-02-06) |

---

## 2. LAYER ARCHITECTURE (7 Layers)

The platform follows a **strict unidirectional dependency model** where higher layers may import from lower layers, but never vice versa.

### 2.1 Layer 0: Substrate (`infrastructure/`)
**Purpose**: Foundational infrastructure and shared primitives

| Component | Path | Purpose |
|-----------|------|---------|
| `allternit-substrate` | `infrastructure/allternit-substrate/` | Core runtime, ProcessResult, ToolRequest/Response |
| `allternit-intent-graph-kernel` | `infrastructure/allternit-intent-graph-kernel/` | Persistent, queryable graph of intent nodes |
| `allternit-presentation-kernel` | `infrastructure/allternit-presentation-kernel/` | UI presentation helpers, CanvasProtocol |
| `allternit-agent-system-rails` | `infrastructure/allternit-agent-system-rails/` | Work execution under policy gates (DAG/WIH/Leases/Ledger/Vault) |
| `allternit-embodiment` | `infrastructure/allternit-embodiment/` | Agent identity and presence management |
| `allternit-skill-portability` | `infrastructure/allternit-skill-portability/` | Cross-platform skill definitions |
| **SDK** | `infrastructure/sdk/` | 5 SDK crates: core, apps, functions, policy, transport |
| **Types** | `infrastructure/types/` | Shared TypeScript contracts (capsule-spec, a2ui-types) |
| **Protocols** | `infrastructure/protocols/` | Communication protocols (canvas-protocol) |

**Key Architectural Principle**: This layer provides the **bedrock** upon which all higher layers are built. It ensures interface stability with backward compatibility.

---

### 2.2 Layer 1: Kernel (`domains/kernel/`)
**Purpose**: Execution engine, sandboxing, process management

| Subsystem | Components |
|-----------|------------|
| **allternit-kernel/** | `kernel-contracts/`, `runtime-execution-core/`, `runtime-local-executor/`, `tools-gateway/`, `wasm-runtime/` |
| **Capsule System** | `allternit-capsule/`, `allternit-capsule-compiler/`, `allternit-capsule-runtime/` |
| **Control Plane** | `allternit-agent-orchestration/` (agents, agent-router, hooks, model-router, workflows), `allternit-control/`, `unified-registry/` |
| **Execution** | `allternit-local-compute/` (executor, local-inference, mlx-inference), `allternit-ops/packaging` |
| **Data** | `allternit-memory-provider/`, `history-ledger/` |
| **Communication** | `kernel-messaging/`, `allternit-transports/` |
| **Infrastructure** | `allternit-openclaw-host/`, `allternit-parity/`, `allternit-providers/`, `allternit-acp-driver/`, `allternit-runtime/`, `allternit-rlm/` |

**Key Capabilities**:
- WebAssembly sandboxed execution
- Local compute with MLX inference support
- Capsule compilation and runtime
- Agent orchestration with hooks system

---

### 2.3 Layer 2: Governance (`domains/governance/`)
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

### 2.4 Layer 3: Adapters (`services/`)
**Purpose**: Runtime boundary, vendor integration, protocol adapters

| Component | Path | Purpose |
|-----------|------|---------|
| **Bridge Systems** | `bridge-systems/` | `allternit-webvm/`, `allternit-native-bridge/`, `io-daemon/` |
| **MCP** | `mcp/` | Model Context Protocol client implementation |
| **Rust Adapters** | `rust/` | `skills/`, `marketplace/`, `provider-adapter/`, `extension-adapter/` |
| **Channel Systems** | `channel-systems/` | Secure communication channels |
| **Runtime Adapters** | `runtime-adapters/` | Multi-runtime environment support |
| **Search Integration** | `search-integration/` | Web search and document retrieval |

**Key Integration**: MCP (Model Context Protocol) client enables standardized AI model interactions.

---

### 2.5 Layer 4: Services (`services/`)
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
| **Allternit Operator** | 3010 | Python (FastAPI) | Browser automation, computer-use, desktop automation |
| **Allternit Rails** | 3011 | Rust (Axum) | Agent task planning under policy gates |

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

### 2.7 Layer 6: UI (`surfaces/`)
**Purpose**: Application entrypoints, UI components, distribution targets

| Component | Path | Technology | Purpose |
|-----------|------|------------|---------|
| **allternit-platform** | `allternit-platform/` | TypeScript/React | UI platform primitives and vendor wrappers |
| **Canvas Monitor** | `canvas-monitor/` | Rust | Canvas state visualization |
| **Shell UI** | `shell-ui/` | TypeScript/React | Shell application components |

---

### 2.8 Layer 7: Apps (`cmd/`)
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
ALLTERNIT_KERNEL_URL=http://127.0.0.1:3004
ALLTERNIT_REGISTRY_URL=http://127.0.0.1:8080
ALLTERNIT_MEMORY_URL=http://127.0.0.1:3200
ALLTERNIT_POLICY_URL=http://127.0.0.1:3003
ALLTERNIT_VOICE_URL=http://127.0.0.1:8001
ALLTERNIT_WEBVM_URL=http://127.0.0.1:8002
ALLTERNIT_OPERATOR_URL=http://127.0.0.1:3010
ALLTERNIT_RAILS_URL=http://127.0.0.1:3011
ALLTERNIT_EXECUTOR_URL=http://127.0.0.1:3510
```

---

## 4. Allternit AGENT SYSTEM RAILS (Core Orchestration)

The **Allternit Agent System Rails** (Port 3011) is a unified work execution system under policy gates.

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

### 5.2 Allternit Operator (Port 3010)

| Mode | Description |
|------|-------------|
| **Browser-Use** | Agent-based browser automation with LLM reasoning |
| **Playwright** | Fast headless browser control |
| **Computer-Use** | Vision-based computer control |
| **Desktop-Use** | Desktop automation via Allternit Vision |
| **Parallel Execution** | Multi-variant task execution |

### 5.3 WebVM Bridge (Port 8002)

- Browser-based Linux VMs via WebAssembly
- Sandboxed code execution for agents
- Terminal access from UI
- Isolated development environments

---

## 6. MCP (MODEL CONTEXT PROTOCOL) INTEGRATION

**Location**: `crates/mcp-client/` and `services/mcp/`

The platform implements MCP for standardized AI model interactions:

- **Client Implementation**: Rust-based MCP client
- **Transport**: Stdio and HTTP transports
- **Capabilities**: Tool calling, resource access, prompt handling

---

## 7. DATABASE & STORAGE

| Store | Location | Purpose |
|-------|----------|---------|
| **SQLite** | `allternit.db` | Primary application database |
| **JSONL Ledger** | `allternit.jsonl` | Append-only event log |
| **Allternit Directory** | `.allternit/` | Hidden runtime stores (Rails ledger, DAGs, WIHs) |

---

## 8. KEY INTEGRATION POINTS FOR FEATURE DEVELOPMENT

### 8.1 Adding New Services

1. **Create in appropriate layer**:
   - Core logic: `domains/kernel/` or `services/`
   - External integration: `services/`
   - UI: `surfaces/`
   - Apps: `cmd/`

2. **Add to workspace** in root `Cargo.toml`

3. **Register in Gateway** (`services/gateway/src/main.py`)

4. **Add environment variables** to configuration

### 8.2 Adding New Tools/Skills

1. Define in `infrastructure/allternit-skill-portability/` (if shared)
2. Implement adapter in `services/rust/skills/`
3. Register in Registry Service (`services/registry/`)

### 8.3 Adding New UI Components

1. Add to `surfaces/allternit-platform/` for shared primitives
2. Use `infrastructure/types/` for TypeScript contracts
3. Consume Gate/Ledger event stream (not direct kernel calls)

### 8.4 Policy Integration

All actions flow through the **Gate**:
1. Policy evaluation at `domains/governance/policy-engine/`
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
cd cmd/api && cargo run

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
2. **Use Substrate types** - Import from `infrastructure/` for compatibility
3. **Integrate with Rails** - For work execution, use Gate/Vault patterns
4. **Follow the policy model** - All actions pass through policy enforcement
5. **Emit ledger events** - All services must emit events for audit trails

### 12.2 To Build UI Features:

1. **Consume from services** - Use API Gateway (port 8013)
2. **Use Allternit Platform components** - Base on `surfaces/allternit-platform/`
3. **Follow canvas protocol** - For visual workflows
4. **Type safety** - Use shared TypeScript contracts

### 12.3 To Build External Integrations:

1. **Use Adapter layer** - Implement in `services/`
2. **Create bridges** - For external runtimes (WebVM, Native)
3. **MCP compatibility** - Consider MCP for AI model integration

---

## Appendix A: Directory Structure Summary

```
allternit/
├── infrastructure/          # Foundational infrastructure
│   ├── allternit-substrate/
│   ├── allternit-intent-graph-kernel/
│   ├── allternit-presentation-kernel/
│   ├── allternit-agent-system-rails/
│   ├── allternit-embodiment/
│   ├── allternit-skill-portability/
│   ├── sdk/              # 5 SDK crates
│   ├── types/            # TypeScript contracts
│   └── protocols/
├── domains/kernel/             # Execution engine
│   ├── allternit-kernel/
│   ├── capsule-system/
│   ├── control-plane/
│   ├── execution/
│   ├── communication/
│   └── infrastructure/
├── domains/governance/         # Policy and compliance
│   ├── identity-access-control/
│   ├── audit-logging/
│   ├── governance-workflows/
│   └── security-network/
├── services/           # External integrations
│   ├── bridge-systems/
│   ├── mcp/
│   └── rust/
├── services/           # Platform services
│   ├── gateway/
│   ├── orchestration/
│   ├── registry/
│   ├── memory/
│   ├── ml-ai-services/
│   └── allternit-operator/
├── 5-agents/             # Agent implementations
├── surfaces/                 # UI components
│   ├── allternit-platform/
│   └── canvas-monitor/
├── cmd/               # Applications
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
| Allternit Operator | 3010 | Internal |
| Allternit Rails | 3011 | Internal |
| Task Executor | 3510 | On-demand |

---

**Report Compiled**: 2026-02-17  
**Auditor**: Senior Software Engineer Analysis  
**Project Status**: Production-Ready Enterprise Agentic OS  
**Version**: 2026-02-06
