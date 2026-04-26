# Agent Studio - Service Mapping

## Overview

This document maps the Agent Studio UI features to the **actual existing services** in the codebase.

## Real Services Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Allternit Platform UI                          │
│                   (5-ui/allternit-platform)                        │
│                     Agent Studio                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway                               │
│              (services/gateway/gateway-service)            │
│                     Port: 8013                               │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│Kernel Service│ │Registry  │ │  Memory     │
│  (Port 3004) │ │ Service  │ │  Service    │
└──────────────┘ └──────────┘ └─────────────┘
```

## Service Locations

### 1. Kernel Service (Primary Backend)
**Location:** `services/orchestration/kernel-service/`
**Port:** 3004
**Purpose:** Core agent orchestration, brain management, sessions

**Existing Endpoints:**
- `GET  /v1/brain/profiles` - List brain profiles
- `POST /v1/brain/profiles` - Register brain profile
- `POST /v1/brain/route` - Route to brain
- `GET  /v1/brain/integration/events` - Stream events
- `GET  /v1/brain/runtimes` - List runtimes
- `POST /v1/brain/runtimes/install` - Install runtime
- `POST /v1/sessions` - Create session
- `GET  /v1/sessions/:id/events` - Stream session events
- `POST /v1/sessions/:id/input` - Send input
- `POST /v1/intent/dispatch` - Dispatch intent
- `POST /v1/actions/execute` - Execute action
- `POST /v1/actions/dispatch` - Dispatch action
- `GET  /v1/capsules` - List capsules
- `GET  /v1/capsules/:id` - Get capsule
- `POST /v1/taskgraph/install` - Install task graph
- `POST /v1/taskgraph/resume` - Resume task graph
- `POST /v1/governance/evaluate` - Evaluate policy
- `POST /v1/governance/receipts` - Submit receipt
- `GET  /v1/journal` - Get journal
- `GET  /v1/artifacts/:id` - Get artifact

### 2. Registry Services
**Location:** `services/registry/`

**Services:**
- `registry-apps/` - Application registry
- `registry-functions/` - Function registry
- `registry-server/` - Registry server
- `framework-registry-service/` - Framework registry

### 3. Memory Services
**Location:** `services/memory/`

**Services:**
- `state/memory/` - Memory state management
- `state/history/` - History/ledger
- `observation/` - Observation storage

### 4. AI Services
**Location:** `services/ai/`

**Services:**
- `voice-service/` - Voice processing
- `pattern-service/` - Pattern recognition

### 5. Gateway Services
**Location:** `services/gateway/`

**Services:**
- `gateway-service/` - Main API gateway (port 8013)
- `a2a-gateway/` - Agent-to-agent gateway
- `agui-gateway/` - Agent UI gateway
- `gateway-browser/` - Browser gateway
- `gateway-stdio/` - Stdio gateway

### 6. Allternit Orchestrator
**Location:** `domains/kernel/allternit-orchestrator/`
**Type:** TypeScript/Node.js
**Purpose:** Turn-based agent orchestration

### 7. Allternit Agent System Rails
**Location:** `allternit-agent-system-rails/`
**Purpose:** Unified work execution under policy gates

## UI Feature → Service Mapping

### Agent Configuration
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Create Agent | kernel-service | `POST /v1/brain/profiles` | ✅ Exists |
| List Agents | kernel-service | `GET /v1/brain/profiles` | ✅ Exists |
| Update Agent | kernel-service | (Need to add) | 🔄 Needed |
| Delete Agent | kernel-service | (Need to add) | 🔄 Needed |
| Agent Templates | kernel-service | (Need to add) | 🔄 Needed |

### Agent Execution
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Start Run | kernel-service | `POST /v1/sessions` | ✅ Exists |
| Cancel Run | kernel-service | (Need to add) | 🔄 Needed |
| Pause Run | kernel-service | (Need to add) | 🔄 Needed |
| Resume Run | kernel-service | `POST /v1/taskgraph/resume` | ✅ Exists |
| Stream Events | kernel-service | `GET /v1/sessions/:id/events` | ✅ Exists |
| Send Input | kernel-service | `POST /v1/sessions/:id/input` | ✅ Exists |

### Task Management
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| List Tasks | taskgraph | Via taskgraph service | ✅ Exists |
| Task Status | kernel-service | Via events | ✅ Exists |
| Update Task | kernel-service | (Need to add) | 🔄 Needed |

### Checkpoints
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Create Checkpoint | memory-service | Via memory store | 🔄 Needed |
| List Checkpoints | memory-service | Via memory store | 🔄 Needed |
| Restore Checkpoint | kernel-service | Via session restore | 🔄 Needed |

### Commits/Versioning
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Create Commit | history-service | Via history ledger | 🔄 Needed |
| List Commits | history-service | Via history ledger | 🔄 Needed |

### Queue
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Enqueue | kernel-service | Via intent dispatch | ✅ Exists |
| Dequeue | kernel-service | Via action dispatch | ✅ Exists |
| List Queue | kernel-service | (Need to add) | 🔄 Needed |

### Subagents
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Spawn Subagent | allternit-orchestrator | Via orchestrator | ✅ Exists |
| Subagent Config | kernel-service | (Need to add) | 🔄 Needed |

### Swarms
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Create Swarm | (New Service) | (Need to build) | 🔄 Needed |
| Swarm Run | (New Service) | (Need to build) | 🔄 Needed |

### Workflows
| UI Feature | Real Service | Endpoint | Status |
|------------|--------------|----------|--------|
| Create Workflow | workflows | Via workflow engine | ✅ Exists |
| Execute Workflow | kernel-service | `POST /v1/taskgraph/install` | ✅ Exists |
| Pause Workflow | kernel-service | `POST /v1/taskgraph/resume` | ✅ Exists |

## What Needs to Be Built

### 1. Agent Management API (Extend kernel-service)
The kernel-service has `/v1/brain/profiles` but needs CRUD operations:

```rust
// Add to kernel-service/src/main.rs

// Agent/Brain Profile Management
.route("/v1/agents", get(list_agents).post(create_agent))
.route("/v1/agents/:id", get(get_agent).patch(update_agent).delete(delete_agent))

// Agent Runs
.route("/v1/agents/:id/runs", get(list_agent_runs).post(start_agent_run))
.route("/v1/agents/:id/runs/:runId/cancel", post(cancel_run))
.route("/v1/agents/:id/runs/:runId/pause", post(pause_run))
.route("/v1/agents/:id/runs/:runId/resume", post(resume_run))

// Tasks
.route("/v1/agents/:id/tasks", get(list_agent_tasks))
.route("/v1/agents/:id/tasks/:taskId", patch(update_agent_task))

// Checkpoints
.route("/v1/agents/:id/checkpoints", get(list_checkpoints).post(create_checkpoint))
.route("/v1/agents/:id/checkpoints/:cpId/restore", post(restore_checkpoint))

// Commits
.route("/v1/agents/:id/commits", get(list_commits).post(create_commit))

// Queue
.route("/v1/agents/queue", get(list_queue).post(enqueue))
.route("/v1/agents/queue/:id", delete(dequeue))
```

### 2. Use Existing Services

**For Checkpoints/Commits:**
- Use `allternit_history::HistoryLedger` from history service
- Use `allternit_memory` for state storage

**For Tasks:**
- Use existing taskgraph in kernel-service
- Tasks are already tracked in the graph

**For Queue:**
- Use `allternit_messaging::MessagingSystem`
- Already handles message queuing

**For Subagents:**
- Use existing `AgentOrchestrator` in allternit-orchestrator
- Use `TurnManager` for turn-based execution

**For Workflows:**
- Use `allternit_workflows` crate
- Already exists in `domains/kernel/rust/orchestration/workflows`

## Recommended Implementation Strategy

### Option 1: Extend Kernel Service (Recommended)
Add the missing endpoints to the existing kernel-service:

1. **Database Schema**: Add tables for agents, runs, tasks, checkpoints, commits, queue
2. **Handlers**: Implement the CRUD handlers
3. **Integration**: Use existing brain management, session management

### Option 2: Create Agent Management Service
Create a new service that wraps/extends kernel-service:

1. **New Service**: `services/orchestration/agent-management-service/`
2. **Proxy**: Calls kernel-service for brain operations
3. **Own DB**: Stores agent metadata, runs, tasks
4. **Aggregator**: Combines data from multiple services

## Current UI Integration

The UI I built (`AgentView.tsx`) expects these endpoints:

```typescript
// Current API client calls in agent.service.ts:
GET    /api/v1/agents                 -> maps to kernel /v1/brain/profiles
POST   /api/v1/agents                 -> needs implementation
GET    /api/v1/agents/:id             -> needs implementation
PATCH  /api/v1/agents/:id             -> needs implementation
DELETE /api/v1/agents/:id             -> needs implementation
GET    /api/v1/agents/:id/runs        -> needs implementation
POST   /api/v1/agents/:id/runs        -> maps to kernel /v1/sessions
POST   /api/v1/agents/:id/runs/:id/*  -> needs implementation
GET    /api/v1/agents/:id/tasks       -> needs implementation
GET    /api/v1/agents/:id/checkpoints -> needs implementation
POST   /api/v1/agents/:id/checkpoints -> needs implementation
GET    /api/v1/agents/:id/commits     -> needs implementation
POST   /api/v1/agents/:id/commits     -> needs implementation
GET    /api/v1/agents/queue           -> needs implementation
POST   /api/v1/agents/queue           -> needs implementation
```

## Next Steps

1. **Verify UI works with existing endpoints**
   - Map agent CRUD to brain profiles
   - Map runs to sessions
   - Use existing event streaming

2. **Add missing endpoints to kernel-service**
   - Extend the existing kernel-service
   - Add database tables
   - Implement handlers

3. **Update API client**
   - Use correct endpoint URLs
   - Map to existing services

4. **Remove standalone agent-service**
   - The new service I created is redundant
   - Should extend kernel-service instead
