# Allternit Agent System Audit & Modular Packaging Proposal

**Date:** March 7, 2026  
**Scope:** Agent System Rails + Agent Runner (DAK)  
**Goal:** Package as modular product within platform

---

## Executive Summary

The Allternit agent system consists of two complementary components:

1. **Agent Rails** (`infrastructure/allternit-agent-system-rails/`) - The **control plane** providing deterministic enforcement, ledger truth, gates, leases, and receipts
2. **Agent Runner (DAK)** (`domains/kernel/agent-systems/allternit-dak-runner/`) - The **execution plane** providing orchestration, worker management, Ralph loop, and context compilation

**Current State:** Tightly coupled within monorepo, accessed via internal APIs  
**Recommended Packaging:** **Hybrid CLI + MCP Server** with optional sidecar deployment

---

## Part 1: Codebase Audit

### 1.1 Agent Rails Architecture

**Location:** `infrastructure/allternit-agent-system-rails/` + `5-agents/` specs

#### Core Responsibilities
```
┌─────────────────────────────────────────────────────────────┐
│                    AGENT RAILS (Control Plane)              │
├─────────────────────────────────────────────────────────────┤
│  • Ledger Truth (append-only state + provenance)            │
│  • Leases (write authority / concurrency control)           │
│  • Gates (policy + invariants + acceptance checks)          │
│  • Receipts/Vault (immutable evidence store)                │
│  • Idempotent Pipelines (replay-safe transitions)           │
│  • Mail (bounded coordination channel)                      │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Ledger** | `.allternit/ledger/events/` | Append-only event sourcing |
| **Leases** | `.allternit/leases/leases.db` | Concurrency control (SQLite) |
| **Gates** | `domains/governance/policy/` | Policy enforcement engine |
| **Receipts** | `.allternit/receipts/` | Immutable evidence blobs |
| **Vault** | `.allternit/vault/` | Archive + compaction |
| **Mail** | `.allternit/mail/threads/` | Bounded message channels |
| **Context Packs** | `.allternit/work/dags/` | WIH-scoped context compilation |

#### Event Taxonomy (Rails-owned)
```typescript
// Prompt Provenance
- PromptCreated
- PromptDeltaAppended
- PromptLinkedToWork
- AgentDecisionRecorded

// DAG Planning
- DagCreated
- DagNodeCreated/Updated/StatusChanged
- DagEdgeAdded (blocked_by)
- DagRelationAdded (related_to)

// WIH Lifecycle
- WIHCreated/PickedUp/OpenSigned/Heartbeat
- WIHCloseRequested/ClosedSigned/Archived

// Runs & Receipts
- RunStarted
- ReceiptWritten
- RunEnded

// Leases
- LeaseRequested/Granted/Denied
- LeaseRenewed/Released

// Gates
- GateCheckPassed/Failed
- GateCommit/Fail
```

#### CLI Surface (Existing)
```bash
# Planning
allternit plan new "<text>" [--project <id>]
allternit plan refine <dag_id> --delta "<text>"
allternit plan show <dag_id>

# Work Items
allternit wih list --ready [--dag <dag_id>]
allternit wih pickup <node_id> --dag <dag_id> --agent <agent_id>
allternit wih sign-open <wih_id>
allternit wih close <wih_id> --status DONE|FAILED

# Leases
allternit lease request <wih_id> --paths "<glob>"
allternit lease release <lease_id>

# Gates
allternit gate status
allternit gate check <wih|run>
allternit gate rules
allternit gate verify

# Ledger/Audit
allternit ledger tail [--n 50]
allternit ledger trace --node <node_id>
```

---

### 1.2 Agent Runner (DAK) Architecture

**Location:** `domains/kernel/agent-systems/allternit-dak-runner/`

#### Core Responsibilities
```
┌─────────────────────────────────────────────────────────────┐
│               AGENT RUNNER (Execution Plane)                │
├─────────────────────────────────────────────────────────────┤
│  • Context Pack Compilation (WIH scope, policies)           │
│  • Prompt Pack Injection (agents, roles, packs)             │
│  • Worker Orchestration (spawn builder/validator)           │
│  • Ralph Loop (iterative build→validate cycles)             │
│  • Policy Bundle Management (constraints, allowed tools)    │
│  • Observability (tracing, metrics, logging)                │
└─────────────────────────────────────────────────────────────┘
```

#### Key Components (Source Tree)
```
src/
├── runner/
│   └── agent-runner.ts        # Main orchestration class
├── hooks/
│   ├── runtime.ts             # Hook runtime for tool execution
│   └── dispatcher.ts          # Event dispatching
├── tools/
│   ├── registry.ts            # Tool registration/discovery
│   └── enforce.ts             # Tool enforcement layer
├── policy_engine/
│   └── engine.ts              # Policy evaluation
├── policy/
│   └── bundle-builder.ts      # Policy bundle compilation
├── context/
│   └── builder.ts             # Context pack builder
├── plan/
│   └── manager.ts             # Plan file management
├── workers/
│   └── manager.ts             # Worker lifecycle
├── loop/
│   └── ralph.ts               # Ralph iteration loop
├── adapters/
│   ├── rails_api.ts           # Rails API adapter
│   ├── rails_http.ts          # HTTP client
│   └── rails_unified.ts       # Unified interface
├── observability/
│   └── events.ts              # Logging/tracing
└── types/
    └── index.ts               # Type definitions
```

#### AgentRunner Class API
```typescript
interface AgentRunnerConfig {
  runId: RunId;
  projectPath: string;
  railsCliPath: string;
  outputDir: string;
}

class AgentRunner {
  // Lifecycle
  initialize(): Promise<void>
  discoverWork(): Promise<WorkRequest[]>
  executeWork(request: WorkRequest): Promise<ExecutionResult>
  
  // Role-based execution
  private executeAsOrchestrator(request): Promise<Result>
  private executeAsBuilder(request): Promise<Result>
  private executeAsValidator(request): Promise<Result>
  
  // Components
  private toolRegistry: ToolRegistry
  private policyEngine: PolicyEngine
  private contextPackBuilder: ContextPackBuilder
  private planManager: PlanManager
  private workerManager: WorkerManager
  private railsAdapter: RailsAdapter
  private observability: ObservabilityLogger
  
  // Runtime
  private hookRuntime?: HookRuntime
  private ralphLoop?: RalphLoop
}
```

#### Ralph Loop (Iterative Execution)
```typescript
interface RalphLoopConfig {
  maxFixCycles: number;        // Default: 3
  enableParallelValidation: boolean;
}

// Execution flow
1. Builder worker executes → produces artifacts
2. Validator worker checks → PASS/FAIL
3. If FAIL + cycles remaining → fix cycle
4. If PASS → request WIH close
5. If FAIL (max cycles) → escalate
```

---

### 1.3 Rails ↔ Runner Bridge Contract

**Key Document:** `5-agents/BridgeSpec_AgentRunner_RailsRunner_v2.md`

#### Separation of Concerns
```
┌──────────────────────┬──────────────────────────────────────┐
│      RAILS           │           AGENT RUNNER               │
│   (Control Plane)    │        (Execution Plane)             │
├──────────────────────┼──────────────────────────────────────┤
│ • Produces work      │ • Builds ContextPacks                │
│   requests           │ • Selects prompt packs               │
│ • Enforces leases    │ • Spawns worker agents               │
│ • Stores receipts    │ • Loops (Ralph) until gates pass     │
│ • Maintains ledger   │ • Reports outcomes back              │
│ • Idempotent state   │ • Local state = derived/cache        │
└──────────────────────┴──────────────────────────────────────┘
```

#### Bridge Events (Idempotent)
```typescript
// Rails → Runner
WorkRequestCreated {
  dag_id: string
  node_id: string
  wih_path: string
  role: 'builder'|'validator'|'planner'|'reviewer'|'security'
  execution_mode: 'PLAN_ONLY'|'REQUIRE_APPROVAL'|'ACCEPT_EDITS'|'BYPASS_PERMISSIONS'
  required_gates: string[]
  required_receipts: string[]
}

// Runner → Rails
WorkRequestClaimed {
  run_id: string
  agent_id: string
  claimed_at: string
}

WorkIterationStarted {
  iteration_id: string
  context_pack_id: string
  policy_bundle_id: string
}

ReceiptRecorded {
  receipt_id: string
  kind: 'tool_call'|'validator_report'|'context_pack_seal'|'compaction'
  payload: any
  correlation_id: string
}

WorkIterationCompleted {
  success: boolean
  receipts: string[]
  outcome: 'DONE'|'FAILED'|'ESCALATED'
}

WorkIterationBlocked {
  reason: string
  gate_id: string
  required_action: string
}
```

#### Non-Negotiable Rules
1. **Runner never writes canonical state outside Rails**
2. **All mutations flow through Rails gates**
3. **Leases required for write-like operations**
4. **Receipts submitted for all tool calls**
5. **Events are idempotent (replay-safe)**

---

### 1.4 Existing CLI Infrastructure

#### Rust CLI (`cmd/cli/`)
```rust
// Main entry point
cmd/cli/src/main.rs

// Commands
cmd/cli/src/commands/
├── auth.rs              # Authentication
├── brain_integration.rs # Brain/taskgraph integration
├── cap.rs               # Capability management
├── daemon.rs            # Daemon mode
├── ev.rs                # Event viewing
├── j.rs                 # Job management
├── marketplace.rs       # Plugin marketplace
├── model.rs             # Model selection
├── openclaw_compat.rs   # OpenClaw compatibility
├── repl.rs              # REPL interface
├── rlm.rs               # RLM execution
├── run.rs               # Run commands
├── skills.rs            # Skill management
├── status_health_sessions.rs  # Health checks
├── taskgraph.rs         # Task graph operations
├── tools.rs             # Tool execution
├── tui.rs               # TUI mode
├── voice.rs             # Voice service
└── webvm.rs             # WebVM integration
```

#### TypeScript CLI (`cmd/gizzi-code/`)
```typescript
// Main entry
cmd/gizzi-code/src/cli/main.ts

// Commands
cmd/gizzi-code/src/cli/commands/
├── run.ts               # Run workflows
├── plugin.ts            # Plugin management
├── mcp.ts               # MCP server
├── serve.ts             # Start server
├── session.ts           # Session management
├── skills.ts            # Skills registry
├── models.ts            # Model management
├── generate.ts          # Code generation
├── export.ts            # Export data
├── import.ts            # Import data
└── github.ts            # GitHub integration
```

---

## Part 2: Packaging Architecture Analysis

### 2.1 Requirements

#### Functional Requirements
1. **Modularity** - Can be installed/used independently
2. **Interoperability** - Works with existing platform
3. **Extensibility** - Easy to add new tools/gates/workers
4. **Observability** - Full tracing and debugging
5. **Portability** - Runs locally, in cloud, or as sidecar

#### Non-Functional Requirements
1. **Performance** - Low latency for tool execution
2. **Reliability** - Crash recovery, checkpointing
3. **Security** - Policy enforcement, sandboxing
4. **Scalability** - Multi-agent, parallel execution
5. **Developer Experience** - Easy to debug, extend, test

---

### 2.2 Packaging Options Comparison

| Option | Pros | Cons | Best For |
|--------|------|------|----------|
| **Standalone CLI** | Simple, familiar, portable | Limited real-time interaction | Batch processing, CI/CD |
| **MCP Server** | Standard protocol, IDE integration | Requires MCP client | IDE/tool integration |
| **Sidecar Process** | Tight integration, shared state | Deployment complexity | Platform integration |
| **Hybrid (CLI+MCP)** | Best of both worlds | More complex | **Recommended** |
| **Microservice** | Scalable, isolated | Network overhead | Cloud deployment |

---

### 2.3 Recommended Architecture: Hybrid CLI + MCP Server

```
┌─────────────────────────────────────────────────────────────────┐
│                    Allternit AGENT SYSTEM PACKAGE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐     ┌─────────────────────────────┐   │
│  │   CLI (Binary)      │     │   MCP Server                │   │
│  │   @allternit/agent-cli    │     │   @allternit/agent-mcp            │   │
│  │                     │     │                             │   │
│  │  Commands:          │     │  Tools:                     │   │
│  │  • allternit run          │     │  • allternit_create_work          │   │
│  │  • allternit rails        │     │  • allternit_claim_work           │   │
│  │  • allternit rails status │     │  • allternit_execute_tool         │   │
│  │  • allternit gate check   │     │  • allternit_read_ledger          │   │
│  │  • allternit ledger tail  │     │  • allternit_write_receipt        │   │
│  │  • allternit wih *        │     │  • allternit_request_lease        │   │
│  │  • allternit lease *      │     │                             │   │
│  │                     │     │  Resources:                 │   │
│  │  Modes:             │     │  • allternit://dags/{id}          │   │
│  │  • Interactive REPL │     │  • allternit://wih/{id}           │   │
│  │  • Batch execution  │     │  • allternit://receipts/{id}      │   │
│  │  • Daemon mode      │     │  • allternit://ledger/events      │   │
│  └─────────────────────┘     └─────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Core Library (@allternit/agent-core)             │   │
│  │                                                         │   │
│  │  • AgentRunner (DAK)                                    │   │
│  │  • RailsAdapter                                         │   │
│  │  • PolicyEngine                                         │   │
│  │  • ToolRegistry                                         │   │
│  │  • ContextPackBuilder                                   │   │
│  │  • RalphLoop                                            │   │
│  │  • Observability                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Sidecar Deployment (Optional)              │   │
│  │                                                         │   │
│  │  • Docker container with CLI + MCP                      │   │
│  │  • Shared volume for .allternit/ directory                    │   │
│  │  • Network bridge for platform integration              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Implementation Plan

### 3.1 Package Structure

```
@allternit/agent-system/
├── packages/
│   ├── agent-core/           # Shared library
│   │   ├── src/
│   │   │   ├── runner/       # AgentRunner
│   │   │   ├── rails/        # Rails adapter
│   │   │   ├── policy/       # Policy engine
│   │   │   ├── tools/        # Tool registry
│   │   │   ├── context/      # Context packs
│   │   │   ├── loop/         # Ralph loop
│   │   │   ├── observability/# Logging/tracing
│   │   │   └── types/        # Shared types
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agent-cli/            # CLI binary
│   │   ├── src/
│   │   │   ├── commands/
│   │   │   │   ├── run.ts
│   │   │   │   ├── rails.ts
│   │   │   │   ├── gate.ts
│   │   │   │   ├── ledger.ts
│   │   │   │   ├── wih.ts
│   │   │   │   ├── lease.ts
│   │   │   │   └── receipt.ts
│   │   │   ├── ui/           # TUI components
│   │   │   └── main.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── agent-mcp/            # MCP server
│   │   ├── src/
│   │   │   ├── server.ts
│   │   │   ├── tools/
│   │   │   │   ├── createWork.ts
│   │   │   │   ├── claimWork.ts
│   │   │   │   ├── executeTool.ts
│   │   │   │   ├── readLedger.ts
│   │   │   │   ├── writeReceipt.ts
│   │   │   │   └── requestLease.ts
│   │   │   └── resources/
│   │   │       ├── dags.ts
│   │   │       ├── wih.ts
│   │   │       ├── receipts.ts
│   │   │       └── ledger.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── agent-sidecar/        # Docker deployment
│       ├── Dockerfile
│       ├── docker-compose.yml
│       └── config/
│           └── agent-config.yaml
│
├── package.json              # Workspace root
├── pnpm-workspace.yaml
└── README.md
```

---

### 3.2 CLI Commands Specification

```bash
# Run agent execution
allternit run [options] <dag_id> <node_id>
  --role <builder|validator|orchestrator>
  --mode <PLAN_ONLY|REQUIRE_APPROVAL|ACCEPT_EDITS>
  --agent <agent_id>
  --output <dir>

# Rails operations
allternit rails status
allternit rails health
allternit rails config

# Gate operations
allternit gate check <wih_id|run_id>
allternit gate rules
allternit gate verify [--dag <dag_id>]
allternit gate decision "<note>" --link <event_id>...

# Ledger operations
allternit ledger tail [--n 50]
allternit ledger trace --node <node_id> --wih <wih_id>
allternit ledger export --dag <dag_id> --format json|md

# WIH operations
allternit wih list [--dag <dag_id>] [--status ready|active|closed]
allternit wih pickup <node_id> --agent <agent_id> [--role <role>]
allternit wih close <wih_id> --status DONE|FAILED --evidence <ref...>
allternit wih show <wih_id>

# Lease operations
allternit lease request <wih_id> --paths "<glob>" [--ttl <sec>]
allternit lease release <lease_id>
allternit lease list [--active]

# Receipt operations
allternit receipt show <receipt_id>
allternit receipt list --wih <wih_id>
allternit receipt export <receipt_id> --output <file>

# Context operations
allternit context pack <wih_id> --output <file>
allternit context rebuild --dag <dag_id>

# Daemon mode
allternit daemon start [--port 8080]
allternit daemon status
allternit daemon stop

# REPL mode
allternit repl
```

---

### 3.3 MCP Server Specification

#### MCP Tools
```typescript
// Tool: Create Work
{
  name: "allternit_create_work",
  description: "Create a new work item (DAG node + WIH)",
  inputSchema: {
    type: "object",
    properties: {
      dag_id: { type: "string" },
      node_title: { type: "string" },
      role: { type: "string", enum: ["builder", "validator", "orchestrator"] },
      execution_mode: { type: "string" },
      prompt: { type: "string" }
    },
    required: ["dag_id", "node_title", "role"]
  }
}

// Tool: Claim Work
{
  name: "allternit_claim_work",
  description: "Claim a work item for execution",
  inputSchema: {
    type: "object",
    properties: {
      dag_id: { type: "string" },
      node_id: { type: "string" },
      agent_id: { type: "string" },
      run_id: { type: "string" }
    },
    required: ["dag_id", "node_id", "agent_id"]
  }
}

// Tool: Execute Tool
{
  name: "allternit_execute_tool",
  description: "Execute a tool call with gate enforcement",
  inputSchema: {
    type: "object",
    properties: {
      tool: { type: "string" },
      args: { type: "object" },
      wih_id: { type: "string" },
      lease_id: { type: "string" }
    },
    required: ["tool", "args", "wih_id"]
  }
}

// Tool: Read Ledger
{
  name: "allternit_read_ledger",
  description: "Query ledger events",
  inputSchema: {
    type: "object",
    properties: {
      dag_id: { type: "string" },
      node_id: { type: "string" },
      wih_id: { type: "string" },
      event_type: { type: "string" },
      limit: { type: "number" }
    }
  }
}

// Tool: Write Receipt
{
  name: "allternit_write_receipt",
  description: "Write a receipt to the vault",
  inputSchema: {
    type: "object",
    properties: {
      kind: { type: "string" },
      payload: { type: "object" },
      wih_id: { type: "string" },
      correlation_id: { type: "string" }
    },
    required: ["kind", "payload", "wih_id"]
  }
}

// Tool: Request Lease
{
  name: "allternit_request_lease",
  description: "Request a write lease for paths",
  inputSchema: {
    type: "object",
    properties: {
      wih_id: { type: "string" },
      paths: { type: "array", items: { type: "string" } },
      ttl: { type: "number" }
    },
    required: ["wih_id", "paths"]
  }
}
```

#### MCP Resources
```typescript
// Resource: DAG
{
  uriTemplate: "allternit://dags/{dag_id}",
  name: "DAG",
  description: "Directed Acyclic Graph for work planning",
  mimeType: "application/json"
}

// Resource: WIH
{
  uriTemplate: "allternit://wih/{wih_id}",
  name: "Work Item Handle",
  description: "Work item handle with execution context",
  mimeType: "application/json"
}

// Resource: Receipt
{
  uriTemplate: "allternit://receipts/{receipt_id}",
  name: "Receipt",
  description: "Immutable evidence artifact",
  mimeType: "application/json"
}

// Resource: Ledger Events
{
  uriTemplate: "allternit://ledger/events?dag_id={dag_id}&node_id={node_id}",
  name: "Ledger Events",
  description: "Append-only event log",
  mimeType: "application/jsonl"
}
```

---

### 3.4 Sidecar Deployment

#### Dockerfile
```dockerfile
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache git openssh

# Create app directory
WORKDIR /app

# Copy package files
COPY packages/agent-core/package.json ./packages/agent-core/
COPY packages/agent-cli/package.json ./packages/agent-cli/
COPY packages/agent-mcp/package.json ./packages/agent-mcp/

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/agent-core ./packages/agent-core
COPY packages/agent-cli ./packages/agent-cli
COPY packages/agent-mcp ./packages/agent-mcp

# Build
RUN pnpm build

# Install CLI globally
RUN pnpm install --global ./packages/agent-cli

# Expose MCP port
EXPOSE 8080

# Default command
CMD ["allternit", "daemon", "start", "--mcp"]
```

#### Docker Compose
```yaml
version: '3.8'

services:
  agent-system:
    build:
      context: .
      dockerfile: packages/agent-sidecar/Dockerfile
    ports:
      - "8080:8080"  # MCP server
    volumes:
      - ./workspace:/workspace
      - ~/.allternit:/root/.allternit
      - ssh_socket:/ssh-socket
    environment:
      - ALLTERNIT_PROJECT_PATH=/workspace
      - ALLTERNIT_RAILS_CLI_PATH=/usr/local/bin/allternit-rails
      - ALLTERNIT_OUTPUT_DIR=/workspace/.allternit/output
      - SSH_AUTH_SOCK=/ssh-socket/ssh-agent
    networks:
      - allternit-network

volumes:
  ssh_socket:
networks:
  allternit-network:
    driver: bridge
```

---

### 3.5 Integration Points

#### Platform Integration
```typescript
// Existing platform can import agent-core
import { AgentRunner, RailsAdapter } from '@allternit/agent-core';

// Or use MCP client
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const client = new Client({
  name: 'allternit-platform',
  version: '1.0.0',
});

await client.connect({
  type: 'stdio',
  command: 'allternit',
  args: ['mcp', 'serve'],
});

// Call tools
const result = await client.callTool({
  name: 'allternit_claim_work',
  arguments: {
    dag_id: 'dag_123',
    node_id: 'node_456',
    agent_id: 'agent_789',
  },
});
```

#### IDE Integration (via MCP)
```json
// .vscode/settings.json
{
  "mcp.servers": {
    "allternit-agent-system": {
      "command": "allternit",
      "args": ["mcp", "serve"],
      "env": {
        "ALLTERNIT_PROJECT_PATH": "${workspaceFolder}"
      }
    }
  }
}
```

---

## Part 4: Migration Strategy

### Phase 1: Extract Core Library (Week 1-2)
- [ ] Create `packages/agent-core/` from `domains/kernel/agent-systems/allternit-dak-runner/src/`
- [ ] Refactor to use shared types
- [ ] Add comprehensive test suite
- [ ] Document public API

### Phase 2: Build CLI (Week 3-4)
- [ ] Create `packages/agent-cli/`
- [ ] Implement core commands (run, rails, gate, ledger)
- [ ] Add TUI components for interactive mode
- [ ] Add daemon mode support

### Phase 3: Build MCP Server (Week 5-6)
- [ ] Create `packages/agent-mcp/`
- [ ] Implement MCP tools
- [ ] Implement MCP resources
- [ ] Add authentication/authorization

### Phase 4: Sidecar Deployment (Week 7)
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Test with platform integration
- [ ] Document deployment

### Phase 5: Platform Integration (Week 8)
- [ ] Update platform to use agent-core
- [ ] Migrate existing runner usage
- [ ] Add MCP client to platform
- [ ] Test end-to-end

---

## Part 5: Benefits

### Modularity
- ✅ Independent installation (`npm install -g @allternit/agent-cli`)
- ✅ Version independently from platform
- ✅ Can be used in CI/CD pipelines
- ✅ Works standalone or integrated

### Developer Experience
- ✅ Familiar CLI interface
- ✅ IDE integration via MCP
- ✅ Interactive REPL for debugging
- ✅ Comprehensive observability

### Production Ready
- ✅ Daemon mode for long-running processes
- ✅ Sidecar deployment for isolation
- ✅ Policy enforcement at boundaries
- ✅ Full audit trail via Rails

### Extensibility
- ✅ Plugin architecture for custom tools
- ✅ Custom gates and policies
- ✅ Worker extensions
- ✅ Custom context pack builders

---

## Part 6: Next Steps

1. **Review and approve architecture** - Confirm hybrid CLI+MCP approach
2. **Create package structure** - Initialize workspace with core/cli/mcp
3. **Extract core library** - Refactor DAK runner into agent-core
4. **Build MVP CLI** - Implement essential commands
5. **Test with existing platform** - Ensure backward compatibility
6. **Iterate and expand** - Add MCP, sidecar, advanced features

---

## Appendix A: File Inventory

### Rails-Related Files
```
infrastructure/allternit-agent-system-rails/
domains/kernel/agent-systems/allternit-dak-runner/
5-agents/ALLTERNIT_Rails_Ownership_Map_v1.md
5-agents/BridgeSpec_AgentRunner_RailsRunner_v2.md
5-agents/Runner_Rails_Event_Contract_REC_v1.md
surfaces/allternit-platform/src/views/RailsView.tsx
surfaces/allternit-platform/src/lib/agents/rails.service.ts
```

### Runner-Related Files
```
domains/kernel/agent-systems/allternit-dak-runner/src/runner/agent-runner.ts
domains/kernel/agent-systems/allternit-dak-runner/src/hooks/runtime.ts
domains/kernel/agent-systems/allternit-dak-runner/src/loop/ralph.ts
domains/kernel/agent-systems/allternit-dak-runner/src/workers/manager.ts
domains/kernel/agent-systems/allternit-dak-runner/src/adapters/rails_*.ts
surfaces/allternit-platform/src/runner/AgentRunner.tsx
surfaces/allternit-platform/src/runner/runner.store.ts
```

### CLI-Related Files
```
cmd/cli/src/main.rs
cmd/cli/src/commands/*.rs
cmd/gizzi-code/src/cli/main.ts
cmd/gizzi-code/src/cli/commands/*.ts
```

---

## Appendix B: Key Dependencies

### Core Library
```json
{
  "dependencies": {
    "axios": "^1.13.5",
    "crypto": "^1.0.1",
    "events": "^3.3.0",
    "js-yaml": "^4.1.0",
    "uuid": "^9.0.0",
    "zod": "^3.22.0"
  }
}
```

### CLI
```json
{
  "dependencies": {
    "commander": "^11.0.0",
    "ink": "^4.0.0",
    "react": "^18.0.0",
    "@allternit/agent-core": "workspace:*"
  }
}
```

### MCP Server
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.0",
    "@allternit/agent-core": "workspace:*"
  }
}
```

---

**END OF AUDIT DOCUMENT**
