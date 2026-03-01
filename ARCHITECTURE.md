# A2rchitect Platform Architecture

> **Enterprise Agentic OS Backend Services Architecture**
> Version: 2026-02-06
> Status: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Layer Architecture](#layer-architecture)
3. [Service Architecture](#service-architecture)
4. [Core Services](#core-services)
5. [AI Services](#ai-services)
6. [Infrastructure Services](#infrastructure-services)
7. [Data Flow](#data-flow)
8. [API Integration](#api-integration)
9. [Configuration](#configuration)
10. [Development](#development)
11. [Appendix](#appendix)

---

## Overview

The A2rchitect platform is an **enterprise agentic operating system** that provides a complete backend infrastructure for AI agents. It follows a layered microservices architecture with clear separation of concerns.

### Key Design Principles

- **Single Entry Point**: All traffic flows through the API Gateway
- **Internal Service Isolation**: Core services bind to localhost only
- **On-Demand Compute**: Task executor is invoked dynamically
- **Modular AI Services**: Voice, WebVM, Operator, and other AI capabilities are pluggable
- **Policy-First**: All actions pass through the policy engine

---

## Layer Architecture

The A2rchitect platform is organized into distinct layers, each serving a specific purpose in the system architecture. The layers follow a strict dependency hierarchy where higher layers may import from lower layers, but never vice versa.

### Layer 0: Substrate (0-substrate/)

| Attribute | Value |
|-----------|-------|
| **Path** | `0-substrate/` |
| **Purpose** | Foundational infrastructure and shared primitives |
| **Language(s)** | Rust, TypeScript |

**Overview:**
The substrate layer serves as the foundational infrastructure for the entire A2R platform. This layer contains low-level, shared primitives and protocols that form the bedrock upon which all higher layers are built.

**Key Components:**

#### Rust Crates

**`a2r-substrate`**
- **Location**: `0-substrate/a2r-substrate/`
- **Purpose**: Core runtime and helper utilities
- **Key Features**:
  - ProcessResult: Standardized process execution results with stdout/stderr/exit codes
  - ToolRequest/ToolResponse: Standardized tool invocation and response patterns
  - PolicyContext: Security and policy evaluation contexts

**`a2r-intent-graph-kernel`**
- **Location**: `0-substrate/a2r-intent-graph-kernel/`
- **Purpose**: Persistent, queryable graph of intent nodes and edges
- **Key Features**:
  - Single Reality: No forking, one node per real-world entity
  - Append-Only Provenance: All changes cite source objects
  - Policy-Gated Mutation: AI proposes; policy commits
  - No Silent State: Every state change is citeable
  - Node types: Intent, Task, Goal, Decision, Plan, Artifact, Memory
  - Edge types: DependsOn, Blocks, PartOf, Implements, ContextFor

**`a2r-presentation-kernel`**
- **Location**: `0-substrate/a2r-presentation-kernel/`
- **Purpose**: Presentation helpers for orchestrator UI
- **Key Features**:
  - IntentTokenizer: Parses and categorizes intent tokens
  - SituationResolver: Resolves contextual situations for UI presentation
  - CanvasProtocol: Communication and rendering protocol for canvas-based UIs
  - Layout strategies and interaction specifications

**`a2r-agent-system-rails`**
- **Location**: `0-substrate/a2r-agent-system-rails/`
- **Purpose**: Agent system infrastructure and utilities
- **Key Features**:
  - Agent lifecycle management
  - System integration utilities
  - Rail-based execution patterns

**`a2r-embodiment`**
- **Location**: `0-substrate/a2r-embodiment/`
- **Purpose**: Agent embodiment and presence systems
- **Key Features**:
  - Agent identity and presence management
  - Embodiment protocols and representations

**`a2r-canvas-protocol`**
- **Location**: `0-substrate/protocols/a2r-canvas-protocol/`
- **Purpose**: Canvas execution metadata and serialization protocols
- **Key Features**:
  - Canvas specification serialization
  - Execution metadata handling
  - Protocol versioning and validation

#### Type Definitions

**TypeScript Contracts**
- **Location**: `0-substrate/types/`
- **Key Files**:
  - `capsule-spec.ts`: Capsule specification types and interfaces
  - `a2ui-types.ts`: A2UI payload and component definitions
- **Purpose**: Shared TypeScript interfaces ensuring type safety across the platform

#### Configuration Systems

**Config Management**
- **Location**: `0-substrate/configs/`
- **Purpose**: Shared configuration schemas and defaults for the substrate layer

#### Protocol Definitions

**Communication Protocols**
- **Location**: `0-substrate/protocols/`
- **Purpose**: Standardized communication patterns between substrate components

#### Schema Definitions

**Data Schemas**
- **Location**: `0-substrate/schemas/`
- **Purpose**: Shared data structure definitions and validation schemas

#### SDK Components

**Substrate SDK**
- **Location**: `0-substrate/sdk/`
- **Purpose**: Client-side libraries for interacting with substrate components

#### Utility Libraries

**Helper Functions**
- **Location**: `0-substrate/utils/`
- **Purpose**: Shared utility functions and algorithms used across substrate components

#### Template System

**Code Generation Templates**
- **Location**: `0-substrate/_templates/`
- **Purpose**: Code generation templates for substrate components

#### Contract Definitions

**Interface Contracts**
- **Location**: `0-substrate/contracts/`
- **Purpose**: Interface contracts between layers

#### Stub Implementations

**Mock Implementations**
- **Location**: `0-substrate/stubs/`
- **Purpose**: Mock implementations for testing and development

**Architectural Principles:**
- Strict unidirectional dependencies (higher layers may import from lower layers, but never vice versa)
- Minimal external dependencies to reduce complexity
- Interface stability with backward compatibility across minor versions
- Low latency and memory efficiency
- Principle of least privilege with input validation

**Integration Points:**
- With Layer 1-Kernel: Imports substrate types for process management and execution
- With Layer 2-Governance: Consumes policy contexts from substrate
- With Layer 3-Adapters: Utilizes substrate protocols for adapter communication

### Layer 1: Kernel (1-kernel/)

| Attribute | Value |
|-----------|-------|
| **Path** | `1-kernel/` |
| **Purpose** | Execution engine, sandboxing, process management |
| **Language** | Rust |

**Overview:**
The kernel layer provides the execution engine for the platform, managing process execution, sandboxing, and resource allocation.

### Layer 2: Governance (2-governance/)

| Attribute | Value |
|-----------|-------|
| **Path** | `2-governance/` |
| **Purpose** | Policy enforcement, WIH, receipts, audit trails |
| **Language** | Rust |

**Overview:**
The governance layer handles policy enforcement, work item handling (WIH), receipts, and audit trails.

### Layer 3: Adapters (3-adapters/)

| Attribute | Value |
|-----------|-------|
| **Path** | `3-adapters/` |
| **Purpose** | Runtime boundary, vendor integration, protocol adapters |
| **Language** | Rust, Python |

**Overview:**
The adapters layer manages runtime boundaries, vendor integrations, and protocol adapters.

### Layer 4: Services (4-services/)

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/` |
| **Purpose** | Orchestration services, schedulers, coordinators |
| **Language** | Rust, Python |

**Overview:**
The services layer provides orchestration services, schedulers, and coordinators.

### Layer 5: Agents (5-agents/)

| Attribute | Value |
|-----------|-------|
| **Path** | `5-agents/` |
| **Purpose** | Agent implementations and behaviors |
| **Language** | Rust, Python |

**Overview:**
The agents layer contains agent implementations and their behaviors.

### Layer 6: Apps/UI (6-apps/, 6-ui/)

| Attribute | Value |
|-----------|-------|
| **Path** | `6-apps/`, `6-ui/` |
| **Purpose** | Application entrypoints, UI components, distribution targets |
| **Language** | Rust, TypeScript/React, Python |

**Overview:**
The apps/ui layer provides application entrypoints, UI components, and distribution targets.

---

## Service Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LAYER 6: UI                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Shell Electron (6-apps/shell-electron/)                              │  │
│  │  - Desktop application built with Electron                            │  │
│  │  - Communicates via Gateway REST API                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LAYER 5: GATEWAY                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  API Gateway (4-services/gateway/src/main.py)                         │  │
│  │  Port: 8013 (Public)                                                  │  │
│  │                                                                       │  │
│  │  Responsibilities:                                                    │  │
│  │  • SSL/TLS Termination (future)                                       │  │
│  │  • JWT/API Key Authentication                                         │  │
│  │  • Rate Limiting (120 req/min default)                                │  │
│  │  • Request Routing                                                    │  │
│  │  • CORS Handling                                                      │  │
│  │  • Audit Logging                                                      │  │
│  │                                                                       │  │
│  │  Routes:                                                              │  │
│  │  • /api/v1/*              → API Service (3000)                        │  │
│  │  • /api/v1/voice/*        → Voice Service (8001)                      │  │
│  │  • /api/v1/browser/*      → A2R Operator (3010)                       │  │
│  │  • /api/v1/vision/*       → A2R Operator (3010)                       │  │
│  │  • /api/v1/parallel/*     → A2R Operator (3010)                       │  │
│  │  • /api/v1/plan*          → A2R Rails (3011)                          │  │
│  │  • /api/v1/dags/*         → A2R Rails (3011)                          │  │
│  │  • /api/v1/wihs/*         → A2R Rails (3011)                          │  │
│  │  • /webvm/*               → WebVM Bridge (8002)                       │  │
│  │  • /api/v1/gate/check     → A2R Rails (3011)                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAYER 4: API LAYER                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Public API (6-apps/api/)                                             │  │
│  │  Port: 3000 (Internal)                                                │  │
│  │  Language: Rust (Axum)                                                │  │
│  │                                                                       │  │
│  │  Responsibilities:                                                    │  │
│  │  • Business Logic & Orchestration                                     │  │
│  │  • Workflow Validation & Compilation                                  │  │
│  │  • Session Management                                                 │  │
│  │  • Registry Operations                                                │  │
│  │  • Policy Enforcement                                                 │  │
│  │                                                                       │  │
│  │  External Clients:                                                    │  │
│  │  • VoiceClient (voice.rs)         → Voice Service                     │  │
│  │  • WebVmClient (webvm.rs)         → WebVM Bridge                      │  │
│  │  • OperatorClient (operator.rs)   → A2R Operator                      │  │
│  │  • RailsClient (rails.rs)         → A2R Rails                         │  │
│  │  • TerminalSessionManager         → Terminal/WebVM                    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────────┬───────────────┐
        ▼           ▼           ▼               ▼               ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐
│  Kernel   │ │  Memory   │ │ Registry  │ │   Voice   │ │    WebVM      │
│  :3004    │ │  :3200    │ │  :8080    │ │  :8001    │ │    :8002      │
└───────────┘ └───────────┘ └───────────┘ └───────────┘ └───────────────┘
                                                                │
                                                                ▼
                                                      ┌─────────────────┐
                                                      │  A2R Operator   │
                                                      │     :3010       │
                                                      └─────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 3: IO LAYER (LAW-ONT-002)                      │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  IO Service (4-services/io-service/)                              │  │
│  │  Port: 3510 (Internal)                                            │  │
│  │  Language: Rust (Axum)                                            │  │
│  │                                                                   │  │
│  │  LAW-ONT-002: ONLY permitted side-effect path                     │  │
│  │                                                                   │  │
│  │  Responsibilities:                                                │  │
│  │  • Tool execution (local, HTTP, MCP, SDK, subprocess)             │  │
│  │  • IO capture and logging                                         │  │
│  │  • Policy enforcement BEFORE execution                            │  │
│  │  • Resource isolation and limits                                  │  │
│  │  • Execution telemetry and audit trails                           │  │
│  │  • Retry and backoff mechanisms                                   │  │
│  │  • Idempotency support (LAW-ONT-008)                              │  │
│  │                                                                   │  │
│  │  Invocation: HTTP POST /v1/tools/execute                          │  │
│  │  Integration: All tool calls flow through IO Service              │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

The service architecture diagram above shows how the different layers interact. Layer 3 is now the **IO Layer** - the ONLY permitted side-effect path per LAW-ONT-002.

---

## Core Services

### 1. Policy Service

| Attribute | Value |
|-----------|-------|
| **Path** | `2-governance/policy/` |
| **Port** | 3003 |
| **Language** | Rust |
| **Purpose** | Authorization and policy enforcement |

**Responsibilities:**
- Policy evaluation and enforcement
- Permission checks for all operations
- Risk level assessment
- Confirmation requirements for high-risk actions

**Dependencies:** None (foundational service)

---

### 2. Memory Service

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/memory/` |
| **Port** | 3200 |
| **Language** | Rust |
| **Purpose** | State and context management |

**Responsibilities:**
- Working memory storage
- Episodic memory (conversation history)
- Knowledge memory (facts, entities)
- Context aggregation and slicing

**Dependencies:** Policy Service

---

### 3. Registry Service

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/registry/registry-server/` |
| **Port** | 8080 |
| **Language** | Rust |
| **Purpose** | Agent, skill, and tool definitions |

**Responsibilities:**
- Agent registration and discovery
- Skill catalog management
- Tool definitions and schemas
- Framework registry

**Dependencies:** Policy Service, Memory Service

---

### 4. Kernel Service

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/orchestration/kernel-service/` |
| **Port** | 3004 |
| **Language** | Rust |
| **Purpose** | Tool execution and brain session management |
| **Binding** | 127.0.0.1 ONLY (internal) |

**Responsibilities:**
- Brain session lifecycle
- Tool execution orchestration
- Agent runtime management
- Session compression and forking

**Dependencies:** 
- Policy Service (3003)
- Memory Service (3200) 
- Registry Service (8080)
- **Substrate Layer** (0-substrate/) - Uses substrate types and protocols

**⚠️ Security Note:** Kernel binds to localhost only and cannot be accessed externally.

---

### 5. Public API

| Attribute | Value |
|-----------|-------|
| **Path** | `6-apps/api/` |
| **Port** | 3000 |
| **Language** | Rust (Axum) |
| **Purpose** | Business logic and orchestration layer |

**Responsibilities:**
- Workflow validation and compilation
- Session management
- Registry operations
- RLM (Recursive Language Model) execution
- Capsule management
- Policy middleware

**Dependencies:**
- All core services (Kernel, Memory, Registry, Policy)
- **Substrate Layer** (0-substrate/) - Imports substrate types for standardized communication
- Rails Client (3011) - Uses substrate protocols for rail operations
- Voice Client (8001) - Leverages substrate types for voice operations
- WebVM Client (8002) - Uses substrate protocols for VM operations
- Operator Client (3010) - Leverages substrate types for automation operations

**Environment Variables:**
```bash
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

**API Modules:**
- `routes.rs` - Core API routes (RLM, Data Fabric, Control Plane)
- `terminal_session.rs` - Terminal session management
- `voice.rs` - Voice service client integration
- `webvm.rs` - WebVM bridge client integration
- `rails.rs` - A2R Rails client integration (uses substrate protocols)
- `operator.rs` - A2R Operator client integration (uses substrate types)

---

## AI Services

### 6. Voice Service

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/ai/voice-service/` |
| **Port** | 8001 |
| **Language** | Python (FastAPI) + Rust client |
| **Purpose** | Text-to-Speech and Voice Cloning |

**Supported Engines:**

| Engine | Description | Use Case |
|--------|-------------|----------|
| **Chatterbox Turbo** | Resemble AI - High quality with paralinguistic tags | Premium voice output |
| **XTTS v2** | Coqui - Voice cloning | Clone voices from samples |
| **Piper** | Local fast TTS | Low-latency responses |

**API Endpoints:**
```http
GET  /health                 # Health check
GET  /v1/voice/models        # List TTS models
GET  /v1/voice/voices        # List voice presets
POST /v1/voice/tts           # Generate speech
POST /v1/voice/clone         # Clone voice
POST /v1/voice/upload        # Upload reference audio
```

**Backend Integration:**
```rust
// 6-apps/api/src/voice.rs
pub struct VoiceClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl VoiceClient {
    pub async fn text_to_speech(&self, request: TTSRequest) -> Result<TTSResponse, VoiceError>;
    pub async fn clone_voice(&self, request: VoiceCloneRequest) -> Result<TTSResponse, VoiceError>;
}
```

**Gateway Routes:**
```
/api/v1/voice/*  →  voice-service:8001
```

**Environment Variables:**
```bash
PORT=8001
AUDIO_OUTPUT_DIR=/tmp/voice-service
PRELOAD_MODEL=false
PRELOAD_VOICE_PROMPTS=true
XTTS_DEVICE=cpu
```

**Paralinguistic Tags (Chatterbox):**
- `[laugh]` - Add laughter
- `[chuckle]` - Add chuckle
- `[cough]` - Add cough

Example: `"Hi there [chuckle], how can I help?"`

---

### 7. WebVM Bridge

| Attribute | Value |
|-----------|-------|
| **Path** | `3-adapters/bridges/a2r-webvm/` |
| **Port** | 8002 |
| **Language** | Rust (Axum) |
| **Purpose** | Browser-based Linux VMs via WebAssembly |

**Responsibilities:**
- WebAssembly VM session management
- Browser-based terminal emulation
- Sandboxed code execution
- Disk image management

**Use Cases:**
- Sandboxed code execution for agents
- Terminal access from the UI
- Running untrusted code safely
- Isolated development environments

**API Endpoints:**
```http
GET  /                       # WebVM terminal UI (HTML)
GET  /health                 # Health check
GET  /api/v1/status          # Service status
GET  /api/v1/sessions        # List active sessions
POST /api/v1/sessions        # Create new session
GET  /api/v1/sessions/:id    # Get session details
POST /api/v1/sessions/:id    # Send terminal input
DELETE /api/v1/sessions/:id  # Stop session
```

**Backend Integration:**
```rust
// 6-apps/api/src/webvm.rs
pub struct WebVmClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl WebVmClient {
    pub async fn create_session(&self, disk_image: Option<String>) -> Result<SessionCreateResponse, WebVmError>;
    pub async fn list_sessions(&self) -> Result<Vec<SessionInfo>, WebVmError>;
    pub async fn send_input(&self, session_id: &str, input: String) -> Result<(), WebVmError>;
    pub async fn stop_session(&self, session_id: &str) -> Result<(), WebVmError>;
}
```

**Gateway Routes:**
```
/webvm/*  →  webvm-bridge:8002
```

**Environment Variables:**
```bash
HOST=127.0.0.1
PORT=8002
WEBVM_BASE_URL=http://127.0.0.1:8002
RUST_LOG=info
```

---

### 8. A2R Operator

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/a2r-operator/` |
| **Port** | 3010 |
| **Language** | Python (FastAPI) |
| **Purpose** | Browser automation, Computer-Use, Desktop automation, and Parallel execution |

**Capabilities:**

| Mode | Description | Use Case |
|------|-------------|----------|
| **Browser-Use** | Agent-based browser automation with LLM reasoning | Web scraping, form filling, research |
| **Playwright** | Fast headless browser control | Quick scraping, simple interactions |
| **Computer-Use** | Vision-based computer control | GUI automation with visual reasoning |
| **Desktop-Use** | Desktop automation via A2R Vision | Native app control, OS-level automation |
| **Parallel Execution** | Multi-variant task execution | A/B testing, variant comparison |

**Browser Automation Endpoints:**
```http
GET  /v1/browser/health           # Browser health check
POST /v1/browser/tasks            # Create browser task
POST /v1/browser/tasks/{id}/execute  # Execute task
GET  /v1/browser/tasks/{id}       # Get task status
POST /v1/browser/search           # Search web (free, no API keys)
POST /v1/browser/retrieve         # Retrieve URL (free, no API keys)
```

**Vision/Desktop Endpoints:**
```http
POST /v1/vision/propose           # Propose actions from screenshot
POST /v1/sessions/{id}/desktop/execute   # Execute desktop task
POST /v1/sessions/{id}/computer/execute  # Execute computer-use task
```

**Parallel Execution Endpoints:**
```http
POST /v1/parallel/runs            # Create parallel run
GET  /v1/parallel/runs/{id}/status     # Get run status
GET  /v1/parallel/runs/{id}/results    # Get results
GET  /v1/parallel/runs/{id}/events     # Stream events
```

**Backend Integration:**
```rust
// 6-apps/api/src/operator.rs
pub struct OperatorClient {
    base_url: String,
    api_key: String,
    http_client: reqwest::Client,
}

impl OperatorClient {
    pub async fn create_browser_task(&self, request: BrowserTaskRequest) -> Result<BrowserTaskResponse, OperatorError>;
    pub async fn browser_search(&self, request: BrowserSearchRequest) -> Result<Value, OperatorError>;
    pub async fn browser_retrieve(&self, request: BrowserRetrieveRequest) -> Result<Value, OperatorError>;
    pub async fn vision_propose(&self, request: VisionProposeRequest) -> Result<VisionProposeResponse, OperatorError>;
    pub async fn execute_desktop_task(&self, session_id: &str, request: DesktopExecuteRequest) -> Result<Value, OperatorError>;
    pub async fn create_parallel_run(&self, request: ParallelRunRequest) -> Result<ParallelRunResponse, OperatorError>;
}
```

**Gateway Routes:**
```
/api/v1/browser/*   →  a2r-operator:3010
/api/v1/vision/*    →  a2r-operator:3010
/api/v1/parallel/*  →  a2r-operator:3010
/api/v1/operator/*  →  a2r-operator:3010
```

**Environment Variables:**
```bash
A2R_OPERATOR_PORT=3010
A2R_OPERATOR_HOST=127.0.0.1
A2R_OPERATOR_API_KEY=a2r-operator-key
BRAIN_GATEWAY_URL=http://127.0.0.1:3000
A2R_BROWSER_MODEL=gpt-4o
A2R_VISION_MODEL_NAME=a2r-vision-7b
OPENAI_API_KEY=sk-...
A2R_VISION_INFERENCE_KEY=sk-...
```

**Benefits Over External APIs:**

| Feature | A2R Operator | Firecrawl/Tavily |
|---------|--------------|------------------|
| Cost | Free (local) | Paid per request |
| Rate Limits | None | Strict limits |
| Privacy | Local | External service |
| JS Rendering | Full | Limited |
| Custom Actions | Complete | API-limited |
| CDP Protocol | Yes | No |

---

### 8. A2R Agent System Rails

| Attribute | Value |
|-----------|-------|
| **Path** | `a2r-agent-system-rails/` |
| **Port** | 3011 |
| **Language** | Rust (Axum) |
| **Purpose** | Agent task planning and work execution under policy gates |

**Overview:**

The A2R Agent System Rails provides unified work execution under policy gates across DAG/WIH/runs/leases/ledger/vault. It reimplements the best logic from Beads + MCP Agent Mail for agent task planning and execution.

**Key Concepts:**

| Concept | Description |
|---------|-------------|
| **DAG** | Directed Acyclic Graph of work items (tasks/subtasks) |
| **WIH** | Work Identity Handle - active execution context for a node |
| **Gate** | Policy enforcer for dag/node/run transitions and tool execution |
| **Ledger** | Append-only event log (JSONL) - authoritative source |
| **Leases** | Atomic reservations for file paths/resources |
| **Vault** | End-of-line bundling and compaction |
| **Mail** | Threaded messaging between agents |

**API Endpoints:**

```http
# Health
GET  /health               # Service health check

# Planning
POST /v1/plan              # Create new plan from text
POST /v1/plan/refine       # Refine existing plan with delta
GET  /v1/plan/:dag_id      # Show DAG details

# DAG
GET  /v1/dags/:dag_id/render   # Render DAG as JSON or Markdown

# WIH (Work Identity Handle)
POST /v1/wihs              # List WIHs (optionally filtered)
POST /v1/wihs/pickup       # Pick up work (creates WIH)
GET  /v1/wihs/:id/context  # Get WIH context pack
POST /v1/wihs/:id/sign     # Sign open WIH
POST /v1/wihs/:id/close    # Close WIH with status/evidence

# Leases
POST /v1/leases            # Request lease for paths
DELETE /v1/leases/:id      # Release lease

# Ledger
POST /v1/ledger/tail       # Query recent events
POST /v1/ledger/trace      # Trace events by node/wih/prompt

# Index
POST /v1/index/rebuild     # Rebuild index from ledger

# Mail
POST /v1/mail/threads      # Ensure/create thread
POST /v1/mail/send         # Send message to thread
POST /v1/mail/review       # Request review
POST /v1/mail/decide       # Approve/reject review
GET  /v1/mail/inbox        # List messages (optionally by thread)
POST /v1/mail/ack          # Acknowledge message
POST /v1/mail/reserve      # Reserve via mail
POST /v1/mail/release/:id  # Release via mail
POST /v1/mail/share        # Share asset to thread
POST /v1/mail/archive      # Archive thread
POST /v1/mail/guard        # Guard action

# Gate
GET  /v1/gate/status       # Gate status
POST /v1/gate/check        # Check if action is allowed
GET  /v1/gate/rules        # Get GATE_RULES.md
GET  /v1/gate/verify       # Verify ledger chain and DAGs
POST /v1/gate/decision     # Record agent decision
POST /v1/gate/mutate       # Mutate DAG with decision

# Vault
POST /v1/vault/archive     # Archive WIH to vault
GET  /v1/vault/status      # Get vault job status

# Init
POST /v1/init              # Initialize workspace stores
```

**Backend Integration:**

```rust
// 6-apps/api/src/rails.rs
pub struct RailsClient {
    base_url: String,
    http_client: reqwest::Client,
}

impl RailsClient {
    // Health
    pub async fn health_check(&self) -> Result<bool, reqwest::Error>;
    
    // Plan
    pub async fn plan_new(&self, request: PlanNewRequest) -> Result<PlanNewResponse, RailsError>;
    pub async fn plan_refine(&self, request: PlanRefineRequest) -> Result<PlanRefineResponse, RailsError>;
    pub async fn plan_show(&self, dag_id: &str) -> Result<PlanShowResponse, RailsError>;
    
    // DAG
    pub async fn dag_render(&self, dag_id: &str, format: Option<&str>) -> Result<DagRenderResponse, RailsError>;
    
    // WIH
    pub async fn wih_list(&self, request: WihListRequest) -> Result<WihListResponse, RailsError>;
    pub async fn wih_pickup(&self, request: WihPickupRequest) -> Result<WihPickupResponse, RailsError>;
    pub async fn wih_context(&self, wih_id: &str) -> Result<WihContextResponse, RailsError>;
    pub async fn wih_sign_open(&self, wih_id: &str, request: WihSignOpenRequest) -> Result<WihSignOpenResponse, RailsError>;
    pub async fn wih_close(&self, wih_id: &str, request: WihCloseRequest) -> Result<WihCloseResponse, RailsError>;
    
    // Lease
    pub async fn lease_request(&self, request: LeaseRequest) -> Result<LeaseResponse, RailsError>;
    pub async fn lease_release(&self, lease_id: &str) -> Result<LeaseReleaseResponse, RailsError>;
    
    // Ledger
    pub async fn ledger_tail(&self, request: LedgerTailRequest) -> Result<Vec<Event>, RailsError>;
    pub async fn ledger_trace(&self, request: LedgerTraceRequest) -> Result<Vec<Event>, RailsError>;
    
    // Index
    pub async fn index_rebuild(&self) -> Result<IndexRebuildResponse, RailsError>;
    
    // Mail
    pub async fn mail_ensure_thread(&self, request: MailEnsureThreadRequest) -> Result<MailEnsureThreadResponse, RailsError>;
    pub async fn mail_send(&self, request: MailSendRequest) -> Result<MailSendResponse, RailsError>;
    pub async fn mail_request_review(&self, request: MailRequestReviewRequest) -> Result<Value, RailsError>;
    pub async fn mail_decide(&self, request: MailDecideRequest) -> Result<Value, RailsError>;
    pub async fn mail_inbox(&self, thread_id: Option<&str>, limit: Option<usize>) -> Result<Vec<Value>, RailsError>;
    pub async fn mail_ack(&self, request: MailAckRequest) -> Result<Value, RailsError>;
    pub async fn mail_reserve(&self, request: MailReserveRequest) -> Result<Value, RailsError>;
    pub async fn mail_release(&self, lease_id: &str) -> Result<Value, RailsError>;
    pub async fn mail_share(&self, request: MailShareRequest) -> Result<Value, RailsError>;
    pub async fn mail_archive(&self, request: MailArchiveRequest) -> Result<Value, RailsError>;
    pub async fn mail_guard(&self, request: MailGuardRequest) -> Result<Value, RailsError>;
    
    // Gate
    pub async fn gate_status(&self) -> Result<GateStatusResponse, RailsError>;
    pub async fn gate_check(&self, request: GateCheckRequest) -> Result<GateCheckResponse, RailsError>;
    pub async fn gate_rules(&self) -> Result<GateRulesResponse, RailsError>;
    pub async fn gate_verify(&self, json: bool) -> Result<GateVerifyResponse, RailsError>;
    pub async fn gate_decision(&self, request: GateDecisionRequest) -> Result<GateDecisionResponse, RailsError>;
    pub async fn gate_mutate(&self, request: GateMutateRequest) -> Result<GateMutateResponse, RailsError>;
    
    // Vault
    pub async fn vault_archive(&self, request: VaultArchiveRequest) -> Result<VaultArchiveResponse, RailsError>;
    pub async fn vault_status(&self) -> Result<VaultStatusResponse, RailsError>;
    
    // Init
    pub async fn init_system(&self) -> Result<InitResponse, RailsError>;
}
```

**Gateway Routes:**

```
/api/v1/rails/*         →  a2r-rails:3011
/api/v1/plan*           →  a2r-rails:3011
/api/v1/dags/*          →  a2r-rails:3011
/api/v1/wihs/*          →  a2r-rails:3011
/api/v1/leases*         →  a2r-rails:3011
/api/v1/ledger/*        →  a2r-rails:3011
/api/v1/index/*         →  a2r-rails:3011
/api/v1/mail/*          →  a2r-rails:3011
/api/v1/gate/*          →  a2r-rails:3011
/api/v1/vault/*         →  a2r-rails:3011
/api/v1/init            →  a2r-rails:3011
```

**Environment Variables:**

```bash
A2R_RAILS_HOST=127.0.0.1
A2R_RAILS_PORT=3011
A2R_RAILS_ROOT=.a2r/rails
RUST_LOG=info
```

**System Layers:**

1. **Work Surface** - DAG plans with hard dependencies (`blocked_by`) and soft links (`related_to`)
2. **Logistics** - Threaded mail between agents
3. **Ledger** - Authoritative append-only event log
4. **Vault** - End-of-line bundling and workspace compaction

**Gate (Policy Enforcer):**

The Gate owns:
- Preconditions/postconditions for transitions
- WIH open/close signatures
- Lease checks
- Required evidence checks

---

## Infrastructure Services

### 10. API Gateway

| Attribute | Value |
|-----------|-------|
| **Path** | `4-services/gateway/src/main.py` |
| **Port** | 8013 (Public) |
| **Language** | Python (FastAPI) |
| **Purpose** | Single entry point for all external traffic |

**Responsibilities:**
- SSL/TLS Termination (future)
- JWT/API Key Authentication
- Rate Limiting (120 requests/minute default)
- Request Routing
- CORS Handling
- Request/Response Logging

**Routing Table:**
```python
# Request routing logic
if path.startswith("api/v1/voice/"):
    target_base = VOICE_URL         # http://127.0.0.1:8001
elif path.startswith("api/v1/browser/") or path.startswith("api/v1/vision/") or path.startswith("api/v1/parallel/") or path.startswith("api/v1/operator/"):
    target_base = OPERATOR_URL      # http://127.0.0.1:3010
elif path.startswith("webvm/"):
    target_base = WEBVM_URL         # http://127.0.0.1:8002
elif path.startswith("api/"):
    target_base = API_URL           # http://127.0.0.1:3000
else:
    target_base = API_URL
```

**Middleware Stack:**
1. CORS Middleware
2. Authentication Middleware
3. Logging Middleware
4. Rate Limit Middleware

**Environment Variables:**
```bash
HOST=0.0.0.0
PORT=8013
API_URL=http://127.0.0.1:3000
VOICE_URL=http://127.0.0.1:8001
WEBVM_URL=http://127.0.0.1:8002
OPERATOR_URL=http://127.0.0.1:3010
CORS_ORIGINS=http://localhost:5177,http://127.0.0.1:5177
LOG_LEVEL=info
```

---

### 11. Shell Electron

| Attribute | Value |
|-----------|-------|
| **Path** | `6-apps/shell-electron/` |
| **Type** | Desktop Application |
| **Language** | JavaScript/TypeScript (Electron) |
| **Purpose** | Desktop UI for the platform |

**Responsibilities:**
- Desktop application shell
- Gateway API client
- Voice output integration
- WebVM terminal embedding
- A2R Operator automation integration
- Agent interaction UI

**Build:**
```bash
npm run dev:electron  # Development
npm run build:electron # Production
```

---

## Data Flow

### Agent Request Flow

```
User Input
    ↓
Shell Electron (UI)
    ↓ POST /api/v1/rlm/execute
Gateway (8013)
    ↓
API Service (3000)
    ↓
├─→ Policy Check (3003) ─┐
├─→ Memory Context (3200) │
├─→ Registry Lookup (8080)│
├─→ Substrate Types (0-substrate) ──→ Standardized communication
└─→ Kernel Session (3004)─┘
    ↓
Response Aggregation
    ↓
Gateway
    ↓
Shell Electron (UI Display)
```

### TTS Request Flow

```
Agent Response (text)
    ↓
Shell Electron
    ↓ POST /api/v1/voice/tts
Gateway (8013)
    ↓ Route to voice/*
API Service (3000) - Uses substrate types for standardized communication
    ↓
Voice Service (8001)
    ↓
TTS Generation (Chatterbox/XTTS/Piper)
    ↓
Audio File URL
    ↓
Shell Electron (Audio Playback)
```

### WebVM Session Flow

```
User: "Create a Python sandbox"
    ↓
Shell Electron
    ↓ POST /api/v1/webvm/sessions
Gateway (8013)
    ↓ Route to webvm/*
API Service (3000) - Uses substrate protocols for VM operations
    ↓
WebVM Client
    ↓
WebVM Bridge (8002)
    ↓
Session Created → Session ID
    ↓
Shell Electron (Embed terminal iframe)
```

### Browser Automation Flow

```
User: "Search for quantum computing news"
    ↓
Shell Electron
    ↓ POST /api/v1/operator/browser/search
Gateway (8013)
    ↓ Route to browser/*
API Service (3000) - Uses substrate types for standardized communication
    ↓
A2R Operator (3010) - Leverages substrate types for automation operations
    ↓
Chromium + CDP
    ↓
Search Results
    ↓
Shell Electron (Display results)
```

### Desktop Automation Flow

```
User: "Open Calculator and compute 123 * 456"
    ↓
Shell Electron
    ↓ POST /api/v1/operator/vision/propose
Gateway (8013)
    ↓ Route to vision/*
API Service (3000) - Uses substrate types for standardized communication
    ↓
A2R Operator (3010) - Leverages substrate types for automation operations
    ↓
Vision Model (A2R Vision)
    ↓
Action Proposals (click, type, etc.)
    ↓
Execute Actions
    ↓
Shell Electron (Show result)
```

### Parallel Execution Flow

```
User: "Generate code variants"
    ↓
Shell Electron
    ↓ POST /api/v1/operator/parallel/runs
Gateway (8013)
    ↓ Route to parallel/*
API Service (3000) - Uses substrate types for standardized communication
    ↓
A2R Operator (3010) - Leverages substrate types for automation operations
    ↓
Multiple Variants (Claude, GPT-4, etc.)
    ↓
Parallel Execution
    ↓
Shell Electron (Compare results)
```

### Tool Execution Flow

```
Agent decides to use tool
    ↓
Kernel (3004) - Uses substrate types and protocols
    ↓ POST /execute
API Service (3000) - Uses substrate types for standardized communication
    ↓
Task Executor (3510)
    ↓
├─→ Policy Check (3003)
├─→ Execute Tool
├─→ Substrate Types (0-substrate) ──→ Standardized tool responses
└─→ Audit Log
    ↓
Result + UI Card
    ↓
Kernel
    ↓
Agent continues...
```

### Intent Processing Flow (Substrate Layer)

```
User expresses intent
    ↓
UI Layer
    ↓
API Service (3000) - Uses substrate types for standardized communication
    ↓
├─→ Presentation Kernel (0-substrate/a2r-presentation-kernel) ──→ Parse and tokenize intent
├─→ Intent Graph Kernel (0-substrate/a2r-intent-graph-kernel) ──→ Create/update nodes
└─→ Substrate Types (0-substrate/types) ──→ Validate and structure data
    ↓
Processed intent with context
    ↓
Kernel (3004) - Uses substrate types and protocols
    ↓
Appropriate service execution
    ↓
Results stored in intent graph
```

### Canvas Rendering Flow (Substrate Layer)

```
UI requests canvas
    ↓
API Service (3000) - Uses substrate protocols for canvas operations
    ↓
Presentation Kernel (0-substrate/a2r-presentation-kernel)
    ↓
├─→ Canvas Protocol (0-substrate/protocols/a2r-canvas-protocol) ──→ Validate and process spec
├─→ Layout Strategy Selection (0-substrate/a2r-presentation-kernel) ──→ Select layout
└─→ View Rendering (0-substrate/a2r-presentation-kernel) ──→ Render individual views
    ↓
Combined HTML
    ↓
UI Layer
    ↓
Canvas displayed to user
```

---

## API Integration

### Substrate Integration

**Modules:** Various substrate components integrated throughout the API layer

The API layer extensively uses substrate components for standardized communication, data structures, and protocols:

**Substrate Types Integration:**
```rust
// Import substrate types for standardized communication
use a2r_substrate::{ProcessResult, ToolRequest, ToolResponse, PolicyContext};

// In API handlers, substrate types ensure consistent communication:
let tool_request = ToolRequest {
    tool: "file_write".to_string(),
    arguments: serde_json::json!({"path": "/tmp/file.txt", "content": "hello"}),
    context: Some(serde_json::json!({"session_id": "sess-123"})),
};

let tool_response: ToolResponse = ToolResponse {
    success: true,
    output: "File written successfully".to_string(),
    error: None,
    metadata: Some(serde_json::json!({"bytes_written": 5})),
};
```

**Intent Graph Kernel Integration:**
```rust
// Using intent graph kernel for state tracking
use intent_graph_kernel::{Node, NodeType, Edge, EdgeType, NodeStatus};

// Create nodes for tracking work items
let task_node = Node {
    node_id: uuid::Uuid::new_v4(),
    node_type: NodeType::Task,
    status: NodeStatus::Active,
    priority: 1,
    owner: "agent-001".to_string(),
    source_refs: vec![],
    attributes: serde_json::json!({"description": "Implement login feature"}),
    created_at: chrono::Utc::now(),
    updated_at: chrono::Utc::now(),
};

// Connect nodes with edges
let edge = Edge {
    edge_id: uuid::Uuid::new_v4(),
    from_node_id: parent_goal_node.node_id,
    to_node_id: task_node.node_id,
    edge_type: EdgeType::PartOf,
    metadata: serde_json::json!({}),
    created_at: chrono::Utc::now(),
};
```

**Presentation Kernel Integration:**
```rust
// Using presentation kernel for UI rendering
use presentation_kernel::{CanvasProtocol, CanvasSpec, ViewSpec, LayoutStrategy, InteractionSpec};

// Create canvas specifications for UI rendering
let canvas_spec = CanvasSpec {
    canvas_id: uuid::Uuid::new_v4(),
    title: "Authentication Dashboard".to_string(),
    views: vec![
        ViewSpec {
            view_id: uuid::Uuid::new_v4(),
            view_type: "form_view".to_string(),
            title: "Login Form".to_string(),
            bindings: vec!["login_form_data".to_string()],
            region_id: None,
            position: None,
            size: None,
            permissions: None,
            metadata: None,
        }
    ],
    layout_strategy: None,
    interaction_spec: None,
    theme: None,
    permissions: None,
    metadata: None,
};

// Use canvas protocol for rendering
let canvas_protocol = CanvasProtocol::new();
let html_output = canvas_protocol.render_canvas(&canvas_spec)?;
```

### Voice Service Client

**Module:** `6-apps/api/src/voice.rs`

```rust
use crate::voice::VoiceClient;

// In API handler:
let voice_client = VoiceClient::from_env();
let response = voice_client.text_to_speech(TTSRequest {
    text: "Hello, I'm your AI assistant".to_string(),
    voice: "default".to_string(),
    format: Some("wav".to_string()),
    use_paralinguistic: Some(true),
}).await?;

// response.audio_url contains the generated audio file URL
```

### WebVM Client

**Module:** `6-apps/api/src/webvm.rs`

```rust
use crate::webvm::WebVmClient;

// In API handler:
let webvm_client = WebVmClient::from_env();
let session = webvm_client.create_session(Some("python-dev".to_string())).await?;

// session.session_id contains the new VM session ID
// session.url contains the terminal URL
```

### A2R Operator Client

**Module:** `6-apps/api/src/operator.rs`

```rust
use crate::operator::OperatorClient;

// In API handler:
let operator_client = OperatorClient::from_env();

// Browser automation
let task = operator_client.create_browser_task(BrowserTaskRequest {
    goal: "Search for quantum computing news".to_string(),
    url: Some("https://duckduckgo.com".to_string()),
    mode: "browser-use".to_string(),
}).await?;

// Browser search (free, no API keys)
let results = operator_client.browser_search(BrowserSearchRequest {
    query: "latest AI developments".to_string(),
    search_engine: "duckduckgo".to_string(),
}).await?;

// Vision-based desktop automation
let proposals = operator_client.vision_propose(VisionProposeRequest {
    session_id: "desktop-session".to_string(),
    task: "Click the Calculator icon".to_string(),
    screenshot: base64_screenshot,
    viewport: Viewport { w: 1920, h: 1080 },
    constraints: None,
}).await?;

// Parallel execution
let run = operator_client.create_parallel_run(ParallelRunRequest {
    job_id: "run-123".to_string(),
    goal: "Implement responsive navbar".to_string(),
    variants: vec![
        ParallelVariant { variant_id: "v1".to_string(), model: "claude-3.5-sonnet".to_string(), agent_type: Some("code".to_string()) },
        ParallelVariant { variant_id: "v2".to_string(), model: "gpt-4o".to_string(), agent_type: Some("code".to_string()) },
    ],
}).await?;
```

### A2R Rails Client

**Module:** `6-apps/api/src/rails.rs`

```rust
use crate::rails::RailsClient;

// In API handler:
let rails_client = RailsClient::from_env();

// Create a new plan
let plan = rails_client.plan_new(PlanNewRequest {
    text: "Implement user authentication system".to_string(),
    dag_id: None,
}).await?;

// Refine an existing plan
let delta = rails_client.plan_refine(PlanRefineRequest {
    dag_id: plan.dag_id,
    delta: "Add OAuth2 support".to_string(),
    reason: Some("Product requirement".to_string()),
}).await?;

// Get DAG state
let dag = rails_client.dag_get(&plan.dag_id).await?;

// Pick up work
let wih = rails_client.wih_pickup(WihPickupRequest {
    dag_id: plan.dag_id,
    node_id: "node-123".to_string(),
    agent_id: "agent-001".to_string(),
    role: Some("implementer".to_string()),
    fresh: true,
}).await?;

// Check gate policy before tool execution
let check = rails_client.gate_check(GateCheckRequest {
    wih_id: wih.wih_id,
    tool: "file_write".to_string(),
    paths: vec!["src/auth.rs".to_string()],
}).await?;

if check.allowed {
    // Execute tool...
}

// Close WIH with evidence
rails_client.wih_close(&wih.wih_id, WihCloseRequest {
    status: "completed".to_string(),
    evidence: vec!["commit-abc123".to_string()],
}).await?;
```

### API Routes

**Core Routes:**
```rust
// 6-apps/api/src/main.rs Router
let app = Router::new()
    // Health & Docs
    .route("/health", get(health))
    .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", openapi))

    // Workflows
    .route("/api/v1/workflows/validate", post(validate_workflow))
    .route("/api/v1/workflows/compile", post(compile_workflow))

    // Events
    .route("/api/v1/events/stream", get(stream_events))
    .route("/api/v1/events/ws", get(ws_events))

    // Terminal
    .route("/api/v1/terminal/session/:session_id", get(ws_terminal_session))
    .route("/api/v1/terminal/sessions", get(list_terminal_sessions).post(create_terminal_session))

    // RLM & Data Fabric (routes.rs)
    .merge(routes::create_routes())

    // Voice Service
    .merge(create_voice_routes())

    // WebVM Bridge
    .merge(create_webvm_routes())

    // A2R Operator
    .merge(create_operator_routes())
    // A2R Agent System Rails endpoints
    .merge(create_rails_routes())

    // Middleware
    .layer(metrics_layer)
    .layer(rate_limit_layer)
    .layer(Compress::new(CompressLevel::default()))
    .route_layer(middleware::from_fn_with_state(..., policy_middleware))
    .with_state(shared_state);
```

---

## Configuration

### Service Configuration

**File:** `.a2r/services.json`

```json
{
  "version": "2026-02-06-enterprise-v2",
  "hosts": {
    "internal": "127.0.0.1",
    "public": "0.0.0.0"
  },
  "ports": {
    "gateway": 8013,
    "api": 3000,
    "registry": 8080,
    "kernel": 3004,
    "memory": 3200,
    "policy": 3003,
    "voice": 8001,
    "webvm": 8002,
    "operator": 3010,
    "executor": 3510
  },
  "services": [ /* ... */ ],
  "startup_order": [
    "policy", "memory", "registry", "kernel",
    "api", "voice", "webvm", "operator", "gateway", "shell-electron"
  ]
}
```

### Environment Variables

**Required for API:**
```bash
# Service URLs (auto-populated from services.json)
A2R_KERNEL_URL=http://127.0.0.1:3004
A2R_REGISTRY_URL=http://127.0.0.1:8080
A2R_MEMORY_URL=http://127.0.0.1:3200
A2R_POLICY_URL=http://127.0.0.1:3003
A2R_VOICE_URL=http://127.0.0.1:8001
A2R_WEBVM_URL=http://127.0.0.1:8002
A2R_OPERATOR_URL=http://127.0.0.1:3010
A2R_RAILS_URL=http://127.0.0.1:3011
A2R_EXECUTOR_URL=http://127.0.0.1:3510

# API Configuration
HOST=127.0.0.1
PORT=3000
RUST_LOG=info

# Policy
A2RCHITECH_API_IDENTITY=api-service
A2RCHITECH_API_TENANT=default
A2RCHITECH_API_POLICY_ENFORCE=true
```

---

## Development

### Starting Services

**All Services:**
```bash
# Using a2r CLI
a2r start

# Or manually in order
cargo run --manifest-path 2-governance/policy/Cargo.toml &
cargo run --manifest-path 4-services/memory/Cargo.toml &
cargo run --manifest-path 4-services/registry/registry-server/Cargo.toml &
cargo run --manifest-path 4-services/orchestration/kernel-service/Cargo.toml &
cargo run --manifest-path 6-apps/api/Cargo.toml &
python3 -m uvicorn main:app --app-dir 4-services/ai/voice-service/api --host 127.0.0.1 --port 8001 &
cargo run --manifest-path 3-adapters/bridges/a2r-webvm/Cargo.toml &
python3 4-services/gateway/src/main.py &
```

**Health Checks:**
```bash
# Gateway
curl http://localhost:8013/health

# API through Gateway
curl http://localhost:8013/api/health

# Voice Service
curl http://localhost:8013/api/v1/voice/health

# WebVM Bridge
curl http://localhost:8013/api/v1/webvm/health

# Direct service health
curl http://localhost:3000/health  # API
curl http://localhost:8001/health  # Voice
curl http://localhost:8002/health  # WebVM
curl http://localhost:3010/health  # Operator
```

### Testing Voice Service

```bash
# List voices
curl http://localhost:8013/api/v1/voice/voices

# Generate TTS
curl -X POST http://localhost:8013/api/v1/voice/tts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, this is a test",
    "voice": "default",
    "format": "wav",
    "use_paralinguistic": true
  }'
```

### Testing WebVM

```bash
# Create session
curl -X POST http://localhost:8013/api/v1/webvm/sessions \
  -H "Content-Type: application/json" \
  -d '{"disk_image": "alpine"}'

# List sessions
curl http://localhost:8013/api/v1/webvm/sessions

# Send input
curl -X POST http://localhost:8013/api/v1/webvm/sessions/{session_id} \
  -H "Content-Type: application/json" \
  -d '{"input": "ls -la"}'

# Stop session
curl -X DELETE http://localhost:8013/api/v1/webvm/sessions/{session_id}
```

### Testing A2R Operator

```bash
# Health check
curl http://localhost:8013/api/v1/operator/health

# Browser health
curl http://localhost:8013/api/v1/operator/browser/health

# Search (free, replaces paid APIs)
curl -X POST http://localhost:8013/api/v1/operator/browser/search \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum computing"}'

# Retrieve URL (free, replaces Firecrawl)
curl -X POST http://localhost:8013/api/v1/operator/browser/retrieve \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# Create browser task
curl -X POST http://localhost:8013/api/v1/operator/browser/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Search for AI news",
    "url": "https://duckduckgo.com",
    "mode": "browser-use"
  }'

# Vision propose (desktop automation)
curl -X POST http://localhost:8013/api/v1/operator/vision/propose \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "desktop-session",
    "task": "Click the Calculator icon",
    "screenshot": "base64encoded...",
    "viewport": {"w": 1920, "h": 1080}
  }'

# Parallel execution
curl -X POST http://localhost:8013/api/v1/operator/parallel/runs \
  -H "Authorization: Bearer a2r-operator-key" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "run-123",
    "goal": "Implement navbar",
    "variants": [
      {"variantId": "v1", "model": "claude-3.5-sonnet", "agentType": "code"},
      {"variantId": "v2", "model": "gpt-4o", "agentType": "code"}
    ]
  }'
```

### Testing A2R Agent System Rails

```bash
# Health check
curl http://localhost:8013/api/v1/rails/health

# Initialize workspace
curl -X POST http://localhost:8013/api/v1/init

# Create a plan
curl -X POST http://localhost:8013/api/v1/plan \
  -H "Content-Type: application/json" \
  -d '{"text": "Implement user authentication system"}'

# Refine a plan
curl -X POST http://localhost:8013/api/v1/plan/refine \
  -H "Content-Type: application/json" \
  -d '{
    "dag_id": "dag-xxx",
    "delta": "Add OAuth2 support",
    "reason": "Product requirement"
  }'

# Show DAG
curl http://localhost:8013/api/v1/plan/dag-xxx

# Render DAG as markdown
curl "http://localhost:8013/api/v1/dags/dag-xxx/render?format=md"

# List ready WIHs
curl -X POST http://localhost:8013/api/v1/wihs \
  -H "Content-Type: application/json" \
  -d '{"ready_only": true}'

# Pick up work
curl -X POST http://localhost:8013/api/v1/wihs/pickup \
  -H "Content-Type: application/json" \
  -d '{
    "dag_id": "dag-xxx",
    "node_id": "node-123",
    "agent_id": "agent-001",
    "role": "implementer",
    "fresh": true
  }'

# Get WIH context
curl http://localhost:8013/api/v1/wihs/wih-xxx/context

# Sign open WIH
curl -X POST http://localhost:8013/api/v1/wihs/wih-xxx/sign \
  -H "Content-Type: application/json" \
  -d '{"signature": "agent-001-signature"}'

# Close WIH
curl -X POST http://localhost:8013/api/v1/wihs/wih-xxx/close \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "evidence": ["commit-abc123"]
  }'

# Request lease
curl -X POST http://localhost:8013/api/v1/leases \
  -H "Content-Type: application/json" \
  -d '{
    "wih_id": "wih-xxx",
    "agent_id": "agent-001",
    "paths": ["src/auth.rs"],
    "ttl_seconds": 3600
  }'

# Release lease
curl -X DELETE http://localhost:8013/api/v1/leases/lease-xxx

# Query ledger
curl -X POST http://localhost:8013/api/v1/ledger/tail \
  -H "Content-Type: application/json" \
  -d '{"count": 20}'

# Trace ledger
curl -X POST http://localhost:8013/api/v1/ledger/trace \
  -H "Content-Type: application/json" \
  -d '{"dag_id": "dag-xxx"}'

# Rebuild index
curl -X POST http://localhost:8013/api/v1/index/rebuild

# Gate check
curl -X POST http://localhost:8013/api/v1/gate/check \
  -H "Content-Type: application/json" \
  -d '{
    "wih_id": "wih-xxx",
    "tool": "file_write",
    "paths": ["src/main.rs"]
  }'

# Get gate rules
curl http://localhost:8013/api/v1/gate/rules

# Verify gate
curl "http://localhost:8013/api/v1/gate/verify?json=true"

# Record decision
curl -X POST http://localhost:8013/api/v1/gate/decision \
  -H "Content-Type: application/json" \
  -d '{
    "note": "Approved mutation",
    "reason": "Product requirement",
    "links": ["ticket-123"]
  }'

# Create mail thread
curl -X POST http://localhost:8013/api/v1/mail/threads \
  -H "Content-Type: application/json" \
  -d '{"topic": "Auth implementation discussion"}'

# Send mail
curl -X POST http://localhost:8013/api/v1/mail/send \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-xxx",
    "body_ref": "message-body-ref",
    "attachments": []
  }'

# List inbox
curl "http://localhost:8013/api/v1/mail/inbox?limit=10"

# Archive to vault
curl -X POST http://localhost:8013/api/v1/vault/archive \
  -H "Content-Type: application/json" \
  -d '{"wih_id": "wih-xxx"}'

# Vault status
curl http://localhost:8013/api/v1/vault/status
```

---

## Service Registry Summary

| Service | Port | Path | Language | Purpose |
|---------|------|------|----------|---------|
| **Substrate** | - | `0-substrate/` | Rust, TS | Foundational infrastructure & shared primitives |
| **Policy** | 3003 | `2-governance/policy/` | Rust | Authorization & policy |
| **Memory** | 3200 | `4-services/memory/` | Rust | State & context |
| **Registry** | 8080 | `4-services/registry/registry-server/` | Rust | Agent/skill definitions |
| **Kernel** | 3004 | `4-services/orchestration/kernel-service/` | Rust | Tool execution (internal) |
| **API** | 3000 | `6-apps/api/` | Rust | Business logic |
| **Voice** | 8001 | `4-services/ai/voice-service/` | Python | TTS & voice cloning |
| **WebVM** | 8002 | `3-adapters/bridges/a2r-webvm/` | Rust | Browser-based VMs |
| **Operator** | 3010 | `4-services/a2r-operator/` | Python | Browser, Desktop, Parallel automation |
| **Rails** | 3011 | `a2r-agent-system-rails/` | Rust | Agent task planning & work execution |
| **Gateway** | 8013 | `4-services/gateway/` | Python | Public entry point |
| **Shell** | - | `6-apps/shell-electron/` | JS/TS | Desktop UI |
| **Executor** | 3510 | `1-kernel/compute/executor/` | Rust | On-demand compute |

---

## Appendix: Task Executor Details

The **Task Executor** (`1-kernel/compute/executor/`) is a specialized service for distributed compute:

**Key Characteristics:**
- **Port:** 3510
- **Invocation:** HTTP POST `/execute` (on-demand)
- **Purpose:** Execute functions/tools when agents call them
- **Not a persistent service** in the traditional sense - spawned on-demand

**Execution Flow:**
1. Agent requests tool execution via Kernel
2. Kernel calls API
3. API calls Task Executor
4. Task Executor:
   - Checks permissions (Policy Engine)
   - Executes tool (Apps Registry)
   - Logs action (Audit Logger)
   - Returns result + UI Card

**Integration Points:**
- Policy Engine (permission checks)
- Apps Registry (tool execution)
- Audit Logger (execution logging)
- UI Card Renderer (result visualization)

---

*Document generated: 2026-02-06*  
*Maintainers: A2rchitect Platform Team*
