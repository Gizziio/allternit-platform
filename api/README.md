# API Servers

All Allternit API surfaces are consolidated here. Each subdirectory is a distinct server — co-located for visibility but independently deployable.

## Structure

```
api/
├── core/               # Primary runtime APIs
├── cloud/              # Cloud orchestration APIs
├── gateway/            # Request routing and protocol gateways
├── kernel/             # Low-level execution and system APIs
└── services/           # Supporting service APIs
```

## Full Surface Map

### core/ — Primary Runtime APIs

| Server | Language | Port | Purpose |
|---|---|---|---|
| `allternit-api` | Rust/Axum | 3000 | Local execution engine — VM (Firecracker/Apple VF), sandbox, visualization, Rails integration |
| `cloud-backend` | TypeScript/WS | 8080 | WebSocket bridge — browser extension ↔ agent session relay |

### cloud/ — Cloud Orchestration APIs

| Server | Language | Port | Purpose |
|---|---|---|---|
| `allternit-cloud-api` | Rust/Axum | 3001 | Cloud run management — jobs, schedules, checkpoints, approvals, cost tracking, VPS |
| `allternit-cloud-wizard` | Rust/Axum | — | Enterprise BYOC deployment wizard — preflight, verification, provisioning |
| `allternit-node` | Rust/Axum | — | VPS edge agent — connects remote nodes to the control plane |

### gateway/ — Protocol Gateways

| Server | Language | Purpose |
|---|---|---|
| `http` | TypeScript/Fastify | Transport-agnostic API gateway with stdio/http/ws modes and UI v0 binding |
| `a2a` | TypeScript/Express | Agent-to-agent discovery and communication gateway |
| `agui` | TypeScript/Express+WS | Agent UI communication over WebSocket |
| `browser` | Rust/Axum | Routes and bridges HTTP requests to browser environments |
| `chat-rooms` | TypeScript/Fastify+WS | Real-time agent-human chat rooms |
| `routing` | Rust/Axum | IO service — the ONLY permitted side-effect path; sandboxed execution + policy enforcement |
| `stdio` | Rust | Stdio protocol gateway |
| `python` | Python/FastAPI | Python-based gateway service |
| `service` | Python | Gateway service (profiles-based) |
| `unified` | TypeScript | Unified gateway surface |

### kernel/ — System APIs

| Server | Language | Purpose |
|---|---|---|
| `rails-api` | Node.js/Express | **Allternit Agent Rails System API** — Agents, Providers, Sessions, WIHs. Awaiting full integration. |
| `rails-service` | Rust/Axum | Agent Rails execution engine (Rust backend) — WIH execution |
| `presentation-kernel` | Rust/Axum | UI rendering and state management server |
| `launcher` | Rust | Single-binary platform launcher with embedded assets and process management |

### services/ — Supporting Service APIs

| Server | Language | Purpose |
|---|---|---|
| `memory` | Rust+TypeScript | Memory service — agent memory management (SQLx + local LLM daemon) |
| `voice` | Rust/Axum | Voice/audio processing API |
| `replies-runtime` | TypeScript/Express | Replies lifecycle — `/v1/replies`, SSE streams, conversation state |
| `browser-runtime` | TypeScript/Express+WS | Playwright-based browser automation for computer-use |

## Not In This Directory

- `surfaces/platform/src/app/api/v1/` — Next.js App Router API routes (~30 handlers). These stay colocated with the platform surface as per Next.js conventions.
