# DAK Runner - Deterministic Agent Kernel

**Version:** 1.0.0  
**Status:** Production Ready  
**License:** MIT

The Deterministic Agent Kernel (DAK) Runner is an execution runtime for A2R (Agent-to-Agent Runtime) that ensures reproducible, auditable, and policy-compliant agent workflows.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Integration with Agents](#integration-with-agents)
- [API Overview](#api-overview)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Overview

DAK Runner sits in the **execution plane** of the A2R architecture. It:

- Executes DAG (Directed Acyclic Graph) workflows
- Enforces Work Item Header (WIH) constraints
- Injects policy bundles for compliance
- Records tool snapshots for deterministic replay
- Proxies all state changes through Rails gates

**Key Principle:** DAK Runner is execution-only. All ledger truth lives in Rails.

```
┌─────────────────────────────────────────────────────────────┐
│                        A2R SYSTEM                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────┐  │
│  │   Agents     │      │  DAK Runner  │      │  Rails   │  │
│  │  (Templates, │◄────►│  (Execution) │◄────►│(Control) │  │
│  │   Roles)     │      │              │      │          │  │
│  └──────────────┘      └──────────────┘      └──────────┘  │
│         │                     │                   │        │
│         └─────────────────────┴───────────────────┘        │
│                    AGENTS/ FOLDER                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Features

### Core Execution

- **DAG Parser & Executor** - YAML-defined workflows with topological ordering
- **WIH Parser** - Work Item Headers for scoped, constrained execution
- **Topological Sort** - Kahn's algorithm with cycle detection
- **Gate Evaluation** - Policy gates at node boundaries

### Policy & Compliance

- **Policy Injection** - Signed markers at 4 injection points
- **Bundle Management** - Policy bundle loading and validation
- **Marker Verification** - Cryptographic proof of policy application

### Determinism

- **Tool Snapshots** - Content-addressed storage (SHA-256)
- **Replay Engine** - Exact/fuzzy/similarity matching strategies
- **Request Normalization** - Consistent hashing for cache hits

### Production Hardening

- **Circuit Breaker** - Prevent cascading failures
- **Retry Logic** - Exponential backoff with jitter
- **Metrics Collection** - Prometheus-compatible export

### Prompt Pack Support

- **PFS v1 Templates** - 13 standardized prompt packs
- **Jinja2 Rendering** - Variable substitution
- **Schema Validation** - Strict 8-section structure

---

## Quick Start

### Installation

```bash
npm install @a2r/dak-runner
```

### Basic Usage

```typescript
import { 
  DagParser, 
  DagExecutor,
  PolicyInjector,
  SnapshotStore 
} from '@a2r/dak-runner';

// Initialize
const parser = new DagParser();
const executor = new DagExecutor();

// Parse a DAG
const dag = await parser.parse(`
dag_version: v1
dag_id: dag_example_001
nodes:
  - id: build
    action: npm.build
    depends_on: []
  - id: test
    action: npm.test
    depends_on: [build]
`);

// Execute
const result = await executor.execute(dag, {
  sessionId: 'sess_001',
  agentId: 'agent_001',
  executeNode: async (node) => {
    console.log(`Executing: ${node.id}`);
    return { status: 'success', outputs: {} };
  }
});

console.log('Status:', result.status);
```

---

## Architecture

### System Context

```
                    User Request
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│                  A2R Platform UI                        │
│           (Intent Capture, Canvas, Shell)               │
└────────────────────────────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│                  Intent Graph Kernel                    │
│         (Graph Construction, Plan Generation)           │
└────────────────────────────────────────────────────────┘
                         │
                         ▼ DAG + WIH
┌────────────────────────────────────────────────────────┐
│  ┌─────────────┐    DAK RUNNER    ┌─────────────┐     │
│  │ DAG Parser  │◄────────────────►│ DAG Executor│     │
│  └─────────────┘                  └─────────────┘     │
│         │                               │              │
│         ▼                               ▼              │
│  ┌─────────────┐    ┌──────────┐    ┌──────────┐     │
│  │WIH Parser   │    │  Policy  │    │Snapshots │     │
│  └─────────────┘    │ Injection│    └──────────┘     │
│                     └──────────┘                       │
└────────────────────────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Agents/     │ │   Rails/     │ │  Prompt Pack │
│  Roles/      │ │   Gates/     │ │  Service     │
│  Templates   │ │   Leases     │ │  (Port 3005) │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Data Flow

1. **Plan Phase** - Intent Graph → DAG + WIH
2. **Context Phase** - Load policy bundles, inject markers
3. **Execution Phase** - Topological node execution
4. **Validation Phase** - Gate checks, receipt emission
5. **Completion Phase** - Validator approval, cleanup

### Authority Separation

| Plane | Responsibility | Authority |
|-------|---------------|-----------|
| **Rails** | Ledger, gates, leases, receipts | Canonical state |
| **DAK Runner** | Execution, hooks, snapshots | Execution-only |
| **Agents** | Prompts, roles, cookbooks | Advisory |

---

## Project Structure

```
1-kernel/dak-runner/
├── README.md                 # This file
├── ARCHITECTURE.md           # Detailed architecture
├── package.json              # Dependencies
├── tsconfig.json             # TypeScript config
│
├── src/                      # Source code
│   ├── index.ts              # Public API exports
│   │
│   ├── dag/                  # DAG execution engine
│   │   ├── parser.ts         # YAML parsing
│   │   ├── executor.ts       # Topological execution
│   │   └── types.ts          # Type definitions
│   │
│   ├── wih/                  # Work Item Header parser
│   │   ├── parser.ts         # Front matter extraction
│   │   └── types.ts          # WIH type definitions
│   │
│   ├── policy/               # Policy injection system
│   │   ├── injection.ts      # Marker generation
│   │   ├── types.ts          # Policy types
│   │   └── index.ts          # Module exports
│   │
│   ├── snapshots/            # Tool replay system
│   │   ├── store.ts          # Content-addressed storage
│   │   ├── replay.ts         # Replay engine
│   │   ├── types.ts          # Snapshot types
│   │   └── index.ts          # Module exports
│   │
│   ├── monitoring/           # Production hardening
│   │   ├── circuit-breaker.ts
│   │   ├── retry.ts
│   │   ├── metrics.ts
│   │   └── index.ts
│   │
│   ├── reports/              # Report validators
│   │   └── schemas.ts
│   │
│   ├── adapters/             # External adapters
│   ├── context/              # Context pack builder
│   ├── hooks/                # Hook runtime
│   ├── loop/                 # Ralph loop
│   ├── observability/        # Events & replay
│   ├── plan/                 # Plan manager
│   ├── policy_engine/        # Policy evaluation
│   ├── runner/               # Agent runner
│   ├── tools/                # Tool registry
│   ├── types/                # Shared types
│   └── workers/              # Worker manager
│
├── __tests__/                # Integration tests
│   ├── dag-executor.test.ts
│   ├── policy-injection.test.ts
│   └── tool-snapshots.test.ts
│
└── docs/                     # Documentation
    ├── API-REFERENCE.md      # Complete API docs
    └── INTEGRATION-GUIDE.md  # Integration patterns
```

---

## Integration with Agents

The DAK Runner integrates with the `agents/` folder structure:

```
agents/
├── AGENTS.md                 # Agent law & invariants
├── spec/                     # Technical specifications
│   ├── BRIDGE_RAILS_RUNNER.md
│   ├── DAG_SCHEMA.md
│   └── WIH_SCHEMA.md
├── roles/                    # Role definitions
│   ├── orchestrator.md
│   ├── builder.md
│   ├── validator.md
│   └── reviewer.md
├── packs/                    # Prompt packs
│   ├── dak-core-v1.yaml
│   ├── dak-tools-v1.yaml
│   ├── dak-orch-v1.yaml
│   └── templates/            # PFS v1 templates
│       ├── core/
│       │   └── context_prime.j2
│       ├── roles/
│       │   ├── builder.j2
│       │   ├── validator.j2
│       │   ├── reviewer.j2
│       │   └── security.j2
│       ├── orch/
│       │   └── orchestrator_loop.j2
│       ├── plan/
│       │   └── plan_with_files.j2
│       ├── cleanup/
│       │   └── cleanup_and_seal.j2
│       ├── control_flow/
│       │   ├── escalation.j2
│       │   └── delegation_spawn.j2
│       └── evidence/
│           ├── receipt_emit.j2
│           └── trace_summarize.j2
├── cookbooks/                # Deterministic procedures
│   ├── policy-injection.md
│   └── ralph-loop.md
└── primitives/               # Kernel primitives
```

### How They Connect

1. **Templates** (`agents/packs/templates/`) → Loaded by DAK Runner for prompt rendering
2. **Roles** (`agents/roles/`) → Enforced by DAK Runner during execution
3. **Spec** (`agents/spec/`) → Implemented by DAK Runner parsers
4. **Cookbooks** (`agents/cookbooks/`) → Executed as DAG nodes

### Role Enforcement

```typescript
// DAK Runner loads role constraints from agents/roles/
const wih = parseWIH(workItemHeader);

// Enforces scope from WIH
const scope = wih.scope;
// - allowed_paths: ["src/"]
// - allowed_tools: ["fs.read", "fs.write"]
// - execution_permission: { mode: "write_leased" }

// Validates against role definition
if (role === 'builder') {
  // Builder can write under lease
  // Builder cannot self-approve
}
```

---

## API Overview

### DAG Execution

```typescript
import { DagParser, DagExecutor } from '@a2r/dak-runner';

const dag = await new DagParser().parse(yamlString);
const result = await new DagExecutor().execute(dag, context);
```

### Policy Injection

```typescript
import { PolicyInjector } from '@a2r/dak-runner';

const injector = new PolicyInjector(config);
await injector.loadBundle(policyBundle);
const marker = await injector.injectForDAG(dagId, sessionId, agentId);
```

### Tool Snapshots

```typescript
import { SnapshotStore, ReplayEngine, withSnapshots } from '@a2r/dak-runner';

const store = new SnapshotStore(config);
const engine = new ReplayEngine(store, replayConfig);

// Or use wrapper
const wrappedTool = withSnapshots('tool_name', liveFunction, store);
```

### Monitoring

```typescript
import { CircuitBreaker, withRetry, MetricsCollector } from '@a2r/dak-runner';

const breaker = new CircuitBreaker('api', config);
const result = await withRetry(() => fetchData(), retryConfig);
metrics.histogram('duration', Date.now() - start);
```

See [API-REFERENCE.md](./docs/API-REFERENCE.md) for complete documentation.

---

## Configuration

### Environment Variables

```bash
# DAK Runner
DAK_LOG_LEVEL=info
DAK_MARKER_DIR=.a2r/markers
DAK_SNAPSHOT_DIR=.a2r/snapshots
DAK_MAX_SNAPSHOTS=10000
DAK_SNAPSHOT_TTL=604800

# Policy
DAK_POLICY_BUNDLE_PATH=agents/packs/
DAK_REQUIRED_MARKERS=session_start,dag_load,node_entry

# Circuit Breaker
DAK_CB_FAILURE_THRESHOLD=5
DAK_CB_RESET_TIMEOUT=30000

# Retry
DAK_RETRY_MAX_ATTEMPTS=5
DAK_RETRY_BACKOFF=exponential
```

### Programmatic Configuration

```typescript
import { DagExecutor } from '@a2r/dak-runner';

const executor = new DagExecutor({
  maxNodes: 100,
  maxDepth: 10,
  timeoutMs: 30 * 60 * 1000,
  onNodeStart: (node) => console.log(`Starting: ${node.id}`),
  onNodeComplete: (node, result) => console.log(`Completed: ${node.id}`),
  onNodeError: (node, error) => console.error(`Failed: ${node.id}`, error)
});
```

---

## Development

### Setup

```bash
cd 1-kernel/dak-runner
npm install
npm run build
```

### Build

```bash
npm run build        # Compile TypeScript
npm run clean        # Clean build artifacts
```

### Lint

```bash
npm run lint         # Run ESLint
```

---

## Testing

### Run Tests

```bash
npm test             # Run all tests
npm test -- --watch # Watch mode
```

### Test Coverage

| Module | Coverage |
|--------|----------|
| DAG Executor | Topological sort, cycle detection, gates, retry |
| Policy Injection | Marker generation, validation, bundle verification |
| Tool Snapshots | Storage, replay, matching strategies |

---

## Documentation

| Document | Description |
|----------|-------------|
| [API-REFERENCE.md](./docs/API-REFERENCE.md) | Complete API documentation |
| [INTEGRATION-GUIDE.md](./docs/INTEGRATION-GUIDE.md) | Integration patterns and examples |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture and data flow |
| [agents/AGENTS.md](../agents/AGENTS.md) | Agent law and invariants |

---

## Related Projects

| Component | Path | Description |
|-----------|------|-------------|
| Rails API | `3-adapters/rails/` | Control plane (gates, leases, receipts) |
| Prompt Pack Service | `4-services/prompt-pack-service/` | Template rendering service |
| Intent Graph Kernel | `1-kernel/intent-graph-kernel/` | Graph construction and planning |
| A2R Platform | `5-ui/a2r-platform/` | User interface |

---

## License

MIT License - See LICENSE file for details.

---

## Contributing

1. Follow the Agent Law in `agents/AGENTS.md`
2. Ensure all tool calls go through Rails gates
3. Add tests for new features
4. Update documentation

---

**Built with ❤️ by the A2R Team**
