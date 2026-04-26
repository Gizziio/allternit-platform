# Allternit Enterprise Architecture

## Executive Summary

This document defines the canonical enterprise-grade architecture for Allternit. It addresses the current architectural drift where multiple services have overlapping concerns, and establishes clear boundaries for maintainability, scalability, and security.

**Current Problem**: UI talks directly to Kernel (port 3004), bypassing API (port 3000) and Gateway (port 8013). Services have overlapping routes (both Kernel and API handle workflows, capsules, skills).

**Solution**: Implement a layered architecture with clear separation of concerns.

---

## 1. Enterprise Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   Shell UI   │  │   CLI/TUI    │  │  Mobile App  │  │ External Clients │ │
│  │   (5177)     │  │   (future)   │  │  (future)    │  │   (API Keys)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘ │
└─────────┼─────────────────┼─────────────────┼───────────────────┼───────────┘
          │                 │                 │                   │
          └─────────────────┴─────────────────┴───────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EDGE GATEWAY (Port 8013)                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Responsibilities:                                                     │ │
│  │  • SSL/TLS Termination                                                 │ │
│  │  • Authentication (JWT validation, API Keys)                           │ │
│  │  • Rate Limiting & Throttling                                          │ │
│  │  • Request Routing (path-based to appropriate service)                 │ │
│  │  • CORS & Security Headers                                             │ │
│  │  • Load Balancing (future)                                             │ │
│  │  • Request/Response Logging                                            │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   PUBLIC API         │ │   WEBSOCKET API      │ │   WEBHOOK API        │
│   (Port 3000)        │ │   (Port 3001)        │ │   (Port 3002)        │
├──────────────────────┤ ├──────────────────────┤ ├──────────────────────┤
│ • REST endpoints     │ │ • Real-time events   │ │ • External webhooks  │
│ • Request validation │ │ • Streaming          │ │ • Callbacks          │
│ • Business logic     │ │ • Presence           │ │ • Async notifications│
│ • Orchestration      │ │ • Collaborative edits│ │                      │
└──────────┬───────────┘ └──────────┬───────────┘ └──────────┬───────────┘
           │                        │                        │
           └────────────────────────┴────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      SERVICE MESH / INTERNAL APIs                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  Internal Communication:                                               │ │
│  │  • gRPC for service-to-service                                         │ │
│  │  • mTLS for security                                                   │ │
│  │  • Service discovery via registry                                      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
        ┌───────────────┬─────────────┼─────────────┬───────────────┐
        │               │             │             │               │
        ▼               ▼             ▼             ▼               ▼
┌──────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
│   KERNEL     │ │  REGISTRY  │ │  MEMORY  │ │  POLICY  │ │   RUNTIME    │
│  (Port 3004) │ │ (Port 8080)│ │(Port 3200│ │(Port 3003│ │(Port 3006)   │
├──────────────┤ ├────────────┤ ├──────────┤ ├──────────┤ ├──────────────┤
│ • Tool Exec  │ │ • Agents   │ │ • State  │ │ • AuthZ  │ │ • Capsules   │
│ • Sandboxes  │ │ • Skills   │ │ • Context│ │ • Policy │ │ • Sandboxes  │
│ • Processes  │ │ • Tools    │ │ • History│ │ • Audit  │ │ • Embodiment │
│ • Brain sess │ │ • Workflows│ │ • Cache  │ │ • Compliance│ │ • Execution  │
│ • No HTTP    │ │ • Tenants  │ │          │ │          │ │              │
│   directly!  │ │            │ │          │ │          │ │              │
└──────────────┘ └────────────┘ └──────────┘ └──────────┘ └──────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      EVENT BUS / MESSAGE QUEUE                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │  • Async communication                                                 │ │
│  │  • Event sourcing for audit trail                                      │ │
│  │  • Saga pattern for distributed transactions                           │ │
│  │  • Pub/sub for real-time updates                                       │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Service Responsibilities (Single Responsibility Principle)

### 2.1 Edge Gateway (Port 8013)
**Canonical Path**: `services/gateway/gateway-service/`

**Responsibilities**:
- ONLY entry point for external traffic
- Authentication (verify JWT, API keys)
- Rate limiting per tenant/user
- Route requests to appropriate backend service
- SSL termination
- Request/response logging for audit
- CORS handling

**Routes**:
```
/api/*         → Public API (3000)
/ws/*          → WebSocket API (3001)
/webhook/*     → Webhook API (3002)
/health        → Gateway health check
```

**What it does NOT do**:
- Business logic
- Database queries
- Tool execution
- Session management

---

### 2.2 Public API (Port 3000)
**Canonical Path**: `6-apps/api/`

**Responsibilities**:
- Business logic orchestration
- Request validation (schemas)
- Response formatting
- Multi-service coordination
- Client-facing contracts
- API versioning (`/api/v1/`, `/api/v2/`)

**Routes**:
```
GET    /api/v1/sessions          # List sessions
POST   /api/v1/sessions          # Create session
GET    /api/v1/sessions/:id      # Get session
POST   /api/v1/sessions/:id/chat # Send message

GET    /api/v1/agents            # List agents
POST   /api/v1/agents            # Create agent
GET    /api/v1/agents/:id        # Get agent

GET    /api/v1/skills            # List skills
POST   /api/v1/skills            # Register skill
POST   /api/v1/skills/:id/exec   # Execute skill

GET    /api/v1/workflows         # List workflows
POST   /api/v1/workflows         # Create workflow
POST   /api/v1/workflows/:id/run # Run workflow

GET    /api/v1/capsules          # List capsules
POST   /api/v1/capsules          # Create capsule
POST   /api/v1/capsules/:id/run  # Run capsule

GET    /api/v1/terminal/sessions # List terminal sessions
POST   /api/v1/terminal/sessions # Create terminal session
```

**How it works**:
1. Receives request from Gateway
2. Validates authentication (via Gateway headers)
3. Validates request schema
4. Calls appropriate internal services (gRPC)
5. Aggregates responses
6. Returns formatted response

---

### 2.3 Kernel (Port 3004)
**Canonical Path**: `domains/kernel/allternit-engine/` or `services/orchestration/kernel-service/`

**Responsibilities**:
- **PURE EXECUTION ONLY**
- Tool execution (filesystem, shell, etc.)
- Brain session management (Claude, Codex, etc.)
- Sandbox/container management
- Process spawning and monitoring
- No business logic!

**Routes** (internal only - not exposed through Gateway):
```
# Brain Sessions (for API to call)
POST   /internal/v1/sessions          # Create brain session
GET    /internal/v1/sessions/:id      # Get session
POST   /internal/v1/sessions/:id/input # Send input
GET    /internal/v1/sessions/:id/events # SSE events

# Tool Execution (for API to call)
POST   /internal/v1/tools/:id/exec    # Execute tool
GET    /internal/v1/tools/:id/status  # Tool status

# Sandbox Management
POST   /internal/v1/sandboxes        # Create sandbox
DELETE /internal/v1/sandboxes/:id    # Destroy sandbox
```

**What it does NOT do**:
- User authentication
- Permission checks (relies on Policy service)
- Workflow orchestration
- Agent lifecycle management
- HTTP exposure to external clients

---

### 2.4 Registry Service (Port 8080)
**Canonical Path**: `services/registry/registry-server/`

**Responsibilities**:
- Agent definitions and metadata
- Skill registry and versioning
- Tool definitions and schemas
- Workflow definitions
- Tenant management
- Read-heavy, cached

**Key Point**: Registry stores DEFINITIONS, not runtime state.

---

### 2.5 Memory Service (Port 3200)
**Canonical Path**: `services/memory/`

**Responsibilities**:
- Context/state management
- Session history
- Working memory (short-term)
- Long-term memory/persistence
- Vector embeddings (future)

---

### 2.6 Policy/Governance Service (Port 3003)
**Canonical Path**: `domains/governance/allternit-governor/`

**Responsibilities**:
- Authorization decisions (AuthZ)
- Policy evaluation
- Compliance checking
- Audit logging coordination
- Safety tier enforcement

---

### 2.7 Runtime Service (Port 3006)
**Canonical Path**: `services/runtime/capsule-runtime/`

**Responsibilities**:
- Capsule execution environment
- WASM runtime
- Container management
- Resource isolation

---

## 3. Data Flow Examples

### 3.1 User Sends Chat Message

```
┌──────────┐    ┌──────────────┐    ┌───────────────┐    ┌──────────┐
│  Shell   │───▶│   Gateway    │───▶│    Public     │───▶│  Kernel  │
│   UI     │    │   (8013)     │    │    API        │    │ (3004)   │
└──────────┘    └──────────────┘    └───────────────┘    └──────────┘
     │                │                    │                  │
     │ POST           │ POST               │ gRPC             │
     │ /api/v1/       │ /api/v1/           │ CreateSession    │ Spawn
     │ sessions/123/  │ sessions/123/      │                  │ Claude
     │ chat           │ chat               │                  │
     │                │                    │                  │
     │                │ 1. Auth check      │ 2. Validate      │ 3. Exec
     │                │ (JWT valid?)       │ (Rate limit?)    │
     │                │                    │ 4. Call Kernel   │
     │                │                    │ 5. Stream events │
     │                │                    │    via SSE       │
     │                │                    │                  │
     │◀───────────────│◀───────────────────│◀─────────────────│
     │   SSE Events   │   SSE Events       │   Tool calls     │   Output
```

### 3.2 User Executes Skill

```
1. UI: POST https://gateway:8013/api/v1/skills/skill-123/exec
2. Gateway: Validate JWT, add headers
3. Gateway: Forward to API:3000
4. API: Validate request schema
5. API: Get skill definition from Registry (8080)
6. API: Check permissions with Policy (3003)
7. API: Load context from Memory (3200)
8. API: Call Kernel (3004) to execute
9. API: Stream results back through Gateway to UI
10. API: Log audit trail to Audit service
```

---

## 4. Current Issues & Migration Plan

### Issue 1: UI Directly Calls Kernel
**Current**: `6-apps/shell-ui/src/shims/runtime.ts` has:
```typescript
const DEFAULT_KERNEL_URL = "http://127.0.0.1:3004";
```

**Fix**:
```typescript
const DEFAULT_API_URL = "http://127.0.0.1:3000";  // Or through gateway:8013
```

### Issue 2: Kernel Has Business Logic Routes
**Current**: Kernel has routes for skills, workflows, capsules

**Fix**: Move to API service:
- `GET /api/v1/skills` → API
- `POST /api/v1/workflows` → API
- Kernel only exposes `/internal/v1/*`

### Issue 3: Duplicate Services
**Current**: Multiple registry services, multiple gateways

**Fix**: Consolidate:
- Merge `registry-functions`, `registry-apps`, `registry-server` → single Registry
- Merge `gateway-browser`, `gateway-stdio`, `gateway-service`, `a2a-gateway`, `agui-gateway` → single Gateway with protocol adapters

### Issue 4: Missing Service Mesh
**Current**: Services call each other via HTTP

**Fix**: Implement gRPC for internal communication

---

## 5. File Structure (Canonical)

```
/Users/macbook/Desktop/allternit-workspace/allternit/
│
├── infrastructure/              # Shared libraries, types, contracts
│   └── rust/
│       ├── allternit-substrate/    # Core types and traits
│       └── capsule_spec/     # Capsule specification
│
├── domains/kernel/                 # EXECUTION ONLY
│   └── allternit-engine/
│       ├── src/
│       │   ├── main.rs       # Axum server - INTERNAL ONLY
│       │   ├── brain/        # Brain session management
│       │   ├── tools/        # Tool execution
│       │   └── sandbox/      # Sandbox management
│       └── Cargo.toml
│
├── domains/governance/             # POLICY & COMPLIANCE
│   └── rust/
│       └── allternit-governor/     # Authorization & policy
│
├── services/               # BRIDGES & RUNTIMES
│   ├── allternit-runtime/          # Runtime boundary
│   └── bridges/
│       └── allternit-webvm/        # WebVM bridge
│
├── services/               # DOMAIN SERVICES
│   ├── gateway/              # SINGLE Gateway service
│   │   └── src/
│   │       └── main.py       # FastAPI - Edge proxy
│   │
│   ├── api/                  # PUBLIC API
│   │   └── src/
│   │       └── main.rs       # Axum - Business logic
│   │
│   ├── registry/             # SINGLE Registry service
│   │   └── src/
│   │       └── main.rs       # Definitions & metadata
│   │
│   ├── memory/               # Memory & state
│   │   └── src/
│   │       └── main.rs
│   │
│   └── orchestration/
│       └── platform-orchestration-service/  # Service launcher
│
├── 5-ui/                     # UI COMPONENTS
│   └── allternit-platform/         # Shared UI components
│       └── src/
│           └── integration/
│               └── api.ts    # HTTP client to API:3000
│
├── 6-apps/                   # APPLICATIONS
│   ├── shell-ui/             # Web UI (Vite/React)
│   │   └── src/
│   │       └── main.tsx
│   │
│   └── shell-electron/       # Desktop shell
│       └── main/
│           └── index.cjs
│
└── .allternit/
    └── services.json         # Service definitions for orchestrator
```

---

## 6. Configuration Changes

### services.json (Canonical)

```json
{
  "version": "2026-02-06",
  "hosts": {
    "internal": "127.0.0.1",
    "public": "0.0.0.0"
  },
  "ports": {
    "gateway": 8013,
    "api": 3000,
    "websocket": 3001,
    "registry": 8080,
    "kernel": 3004,
    "memory": 3200,
    "policy": 3003,
    "runtime": 3006,
    "shell_ui": 5177
  },
  "services": [
    {
      "id": "policy",
      "order": 10,
      "command": "cargo",
      "args": ["run", "--manifest-path", "domains/governance/rust/allternit-governor/Cargo.toml"],
      "env": { "PORT": "${ports.policy}" }
    },
    {
      "id": "memory",
      "order": 20,
      "command": "cargo",
      "args": ["run", "--manifest-path", "services/memory/Cargo.toml"],
      "env": { "PORT": "${ports.memory}" }
    },
    {
      "id": "registry",
      "order": 30,
      "command": "cargo",
      "args": ["run", "--manifest-path", "services/registry/Cargo.toml"],
      "env": { "PORT": "${ports.registry}" }
    },
    {
      "id": "kernel",
      "order": 40,
      "command": "cargo",
      "args": ["run", "--manifest-path", "domains/kernel/allternit-engine/Cargo.toml"],
      "env": { "PORT": "${ports.kernel}" }
    },
    {
      "id": "api",
      "order": 50,
      "command": "cargo",
      "args": ["run", "--manifest-path", "6-apps/api/Cargo.toml"],
      "env": { 
        "PORT": "${ports.api}",
        "KERNEL_URL": "http://${hosts.internal}:${ports.kernel}",
        "REGISTRY_URL": "http://${hosts.internal}:${ports.registry}",
        "MEMORY_URL": "http://${hosts.internal}:${ports.memory}",
        "POLICY_URL": "http://${hosts.internal}:${ports.policy}"
      }
    },
    {
      "id": "gateway",
      "order": 60,
      "command": "python3",
      "args": ["services/gateway/src/main.py"],
      "env": { 
        "PORT": "${ports.gateway}",
        "API_URL": "http://${hosts.internal}:${ports.api}",
        "WEBSOCKET_URL": "http://${hosts.internal}:${ports.websocket}"
      }
    },
    {
      "id": "shell-ui",
      "order": 70,
      "command": "pnpm",
      "args": ["-C", "6-apps/shell-ui", "dev"],
      "env": { 
        "VITE_ALLTERNIT_GATEWAY_URL": "http://${hosts.internal}:${ports.gateway}"
      }
    }
  ]
}
```

---

## 7. UI Integration Code (Canonical)

### api-client.ts (New File)

```typescript
// 5-ui/allternit-platform/src/integration/api-client.ts

const GATEWAY_URL = (window as any).__ALLTERNIT_GATEWAY_URL__ || 'http://127.0.0.1:8013';

export class AllternitApiClient {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    this.baseUrl = GATEWAY_URL;
    this.token = localStorage.getItem('allternit_token');
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': this.token ? `Bearer ${this.token}` : '',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Sessions
  async createSession(profileId: string) {
    return this.request<{ id: string }>('POST', '/api/v1/sessions', { profile_id: profileId });
  }

  async sendMessage(sessionId: string, message: string) {
    return this.request<{ message_id: string }>('POST', `/api/v1/sessions/${sessionId}/chat`, { message });
  }

  // Skills
  async listSkills() {
    return this.request<{ skills: any[] }>('GET', '/api/v1/skills');
  }

  async executeSkill(skillId: string, input: unknown) {
    return this.request<{ result: unknown }>('POST', `/api/v1/skills/${skillId}/exec`, { input });
  }

  // Workflows
  async listWorkflows() {
    return this.request<{ workflows: any[] }>('GET', '/api/v1/workflows');
  }

  async runWorkflow(workflowId: string, input: unknown) {
    return this.request<{ run_id: string }>('POST', `/api/v1/workflows/${workflowId}/run`, { input });
  }

  // Event streaming
  connectEventStream(sessionId: string): EventSource {
    return new EventSource(`${this.baseUrl}/api/v1/sessions/${sessionId}/events`);
  }
}

export const apiClient = new AllternitApiClient();
```

---

## 8. Implementation Checklist

### Phase 1: API Service Cleanup
- [ ] Remove overlapping routes from Kernel (keep only `/internal/*`)
- [ ] Consolidate all business logic routes in API service
- [ ] Implement gRPC clients in API for Kernel, Registry, Memory, Policy
- [ ] Add request validation middleware
- [ ] Add rate limiting middleware

### Phase 2: Gateway Cleanup
- [ ] Remove business logic from Gateway
- [ ] Implement pure proxy/routing logic
- [ ] Add JWT validation
- [ ] Add request logging

### Phase 3: Kernel Decoupling
- [ ] Change Kernel routes to `/internal/*`
- [ ] Remove HTTP exposure (internal gRPC only)
- [ ] Ensure Kernel only executes, no orchestration

### Phase 4: UI Update
- [ ] Replace all `fetch('http://127.0.0.1:3004/...')` with API client
- [ ] Update `VITE_ALLTERNIT_KERNEL_URL` → `VITE_ALLTERNIT_GATEWAY_URL`
- [ ] Remove direct kernel dependencies

### Phase 5: Service Consolidation
- [ ] Merge registry services
- [ ] Merge gateway services
- [ ] Update `.allternit/services.json`

### Phase 6: Documentation
- [ ] Update API documentation (OpenAPI)
- [ ] Update architecture diagrams
- [ ] Update developer onboarding

---

## 9. Security Considerations

1. **Zero Trust**: Services authenticate each other via mTLS
2. **Defense in Depth**: Auth at Gateway AND Policy service
3. **Least Privilege**: Kernel cannot be accessed directly from external
4. **Audit Trail**: All requests logged through Policy service
5. **Network Segmentation**: Internal services on separate network (future: k8s)

---

## 10. Summary

The canonical enterprise architecture has:

1. **One Gateway** (8013) - Edge security and routing
2. **One Public API** (3000) - Business logic and orchestration
3. **One Kernel** (3004) - Pure execution, internal only
4. **Clear separation** - Each service has ONE responsibility
5. **UI talks to Gateway only** - Never directly to Kernel

This enables:
- Independent scaling of components
- Clear security boundaries
- Easier testing and maintenance
- Enterprise compliance (audit trails, auth)
- Future cloud deployment (k8s-ready)
