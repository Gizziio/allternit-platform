# Agent Studio UI → Rails API Mapping Guide

## Overview

The **Allternit Agent System Rails** service IS the Agent Studio backend. It's already built and provides sophisticated agent work management.

**Service:** `allternit-agent-system-rails` (port 3011)  
**Gateway:** `http://localhost:8013/api/v1/rails/*`

---

## Concept Mapping

| UI Concept | Rails Concept | Description |
|------------|---------------|-------------|
| **Agent** | Registry Entry + DAG Template | Agents defined in Registry, instantiated as DAGs |
| **Run** | DAG (Directed Acyclic Graph) | An execution plan with nodes and edges |
| **Task** | WIH (Work In Hand) | Individual unit of work within a DAG |
| **Execution History** | Ledger | Immutable event log of all system activity |
| **Agent Messaging** | Mail | Threaded conversations between agents |
| **Queue** | WIH List (filtered) | WIHs with status filtering |
| **Checkpoint** | Vault Archive | Persisted state of completed work |
| **Resource Lock** | Lease | Exclusive access to files/resources |
| **Policy Check** | Gate | Policy enforcement at work transitions |

---

## API Endpoint Mapping

### Agents

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| List Agents | `GET /api/v1/registry/agents` | Use Registry service |
| Create Agent | `POST /api/v1/registry/agents` | Define in Registry |
| Update Agent | `PUT /api/v1/registry/agents/:id` | Modify definition |
| Delete Agent | `DELETE /api/v1/registry/agents/:id` | Remove definition |

### Runs

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| Start Run | `POST /api/v1/rails/v1/plan` | Creates DAG from prompt |
| List Runs | `POST /api/v1/rails/v1/wihs` | List WIHs, group by dag_id |
| Get Run Details | `GET /api/v1/rails/v1/plan/:dag_id` | Get DAG structure |
| Pause Run | `POST /api/v1/rails/v1/gate/mutate` | Mutate DAG status |
| Cancel Run | `POST /api/v1/rails/v1/wihs/:id/close` | Close all WIHs |
| Render Run | `GET /api/v1/rails/v1/dags/:id/render` | Get visual representation |

### Tasks

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| List Tasks | `POST /api/v1/rails/v1/wihs` | Filter by dag_id |
| Get Task | `GET /api/v1/rails/v1/wihs/:id/context` | Get context pack |
| Start Task | `POST /api/v1/rails/v1/wihs/pickup` | Pick up work |
| Complete Task | `POST /api/v1/rails/v1/wihs/:id/close` | Close with evidence |
| Task Dependencies | `GET /api/v1/rails/v1/plan/:dag_id` | Read DAG edges |

### Checkpoints

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| Create Checkpoint | `POST /api/v1/rails/v1/vault/archive` | Archive WIH state |
| List Checkpoints | `GET /api/v1/rails/v1/vault/status` | List archived jobs |
| Restore Checkpoint | - | Download from vault path |

### Queue

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| View Queue | `POST /api/v1/rails/v1/wihs` | ready_only=true |
| Prioritize | `POST /api/v1/rails/v1/gate/mutate` | Reorder via mutations |

### History

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| View History | `POST /api/v1/rails/v1/ledger/tail` | Recent events |
| Search History | `POST /api/v1/rails/v1/ledger/trace` | Filter by wih/node |
| Run Logs | `POST /api/v1/rails/v1/ledger/trace` | Trace by dag_id |

### Commits (Agent Collaboration)

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| List Commits | `POST /api/v1/rails/v1/ledger/tail` | Filter decision events |
| Review Commit | `POST /api/v1/rails/v1/mail/review` | Request review |
| Approve Commit | `POST /api/v1/rails/v1/mail/decide` | approve=true |
| Reject Commit | `POST /api/v1/rails/v1/mail/decide` | approve=false |

### Messaging

| UI Action | Rails Endpoint | Notes |
|-----------|----------------|-------|
| Create Thread | `POST /api/v1/rails/v1/mail/threads` | Ensure thread exists |
| Send Message | `POST /api/v1/rails/v1/mail/send` | Send to thread |
| View Inbox | `POST /api/v1/rails/v1/mail/inbox` | List messages |
| Acknowledge | `POST /api/v1/rails/v1/mail/ack` | Mark as read |

---

## Key Rails Concepts

### 1. DAG (Directed Acyclic Graph)
- **What:** Execution plan with nodes (tasks) and edges (dependencies)
- **Create:** `POST /v1/plan` with natural language prompt
- **Refine:** `POST /v1/plan/refine` to modify
- **Render:** `GET /v1/dags/:id/render` for visualization

### 2. WIH (Work In Hand)
- **What:** Individual task instance that can be picked up by an agent
- **Lifecycle:** open → signed → closed → archived
- **Pickup:** `POST /v1/wihs/pickup` - agent claims work
- **Close:** `POST /v1/wihs/:id/close` - complete with evidence

### 3. Ledger
- **What:** Immutable append-only log of all system events
- **Query:** `POST /v1/ledger/tail` - recent events
- **Trace:** `POST /v1/ledger/trace` - filtered by entity

### 4. Mail
- **What:** Threaded messaging system for agent coordination
- **Pattern:** ensure thread → send → inbox → ack
- **Review:** request_review → decide (approve/reject)

### 5. Gate
- **What:** Policy enforcement layer
- **Check:** `POST /v1/gate/check` - validate before action
- **Mutate:** `POST /v1/gate/mutate` - record DAG changes

### 6. Vault
- **What:** Archival system for completed work
- **Archive:** `POST /v1/vault/archive` - persist WIH state
- **Status:** `GET /v1/vault/status` - check archive jobs

### 7. Leases
- **What:** Exclusive resource reservations
- **Request:** `POST /v1/leases` - lock paths
- **Release:** `DELETE /v1/leases/:id` - unlock

---

## Example Workflows

### Start an Agent Run
```typescript
// 1. Create execution plan (DAG)
const { dag_id } = await railsApi.plan.new({
  text: "Analyze codebase and refactor auth module"
});

// 2. List work items (WIHs) in the DAG
const { wihs } = await railsApi.wihs.list({ dag_id });

// 3. Pick up first task
const { wih_id } = await railsApi.wihs.pickup({
  dag_id,
  node_id: wihs[0].node_id,
  agent_id: "agent-001"
});
```

### Track Execution
```typescript
// Get run history from ledger
const events = await railsApi.ledger.trace({ dag_id });

// Get current task status
const { wihs } = await railsApi.wihs.list({ dag_id });
const status = wihs.map(w => ({ 
  task: w.title, 
  status: w.status 
}));
```

### Agent Messaging
```typescript
// Create thread for collaboration
const { thread_id } = await railsApi.mail.ensureThread({
  topic: "code-review-auth-refactor"
});

// Send message
await railsApi.mail.send({
  thread_id,
  body_ref: "Please review the auth changes"
});

// Check inbox
const { messages } = await railsApi.mail.inbox({ thread_id });
```

### Checkpoint Work
```typescript
// Archive current WIH state
const { path } = await railsApi.vault.archive({ wih_id });

// Later: restore from archive (download from path)
```

---

## Integration Points

### Registry + Rails = Complete Agent System

1. **Registry** stores agent definitions (skills, capabilities)
2. **Rails** manages agent execution (plans, work, history)
3. **Kernel** provides runtime (sessions, tools)

### UI Data Flow

```
User Action → UI Store → Rails API → Ledger Event
                              ↓
                        Gate Check
                              ↓
                        WIH/Lease/Mail Update
```

---

## Migration from Mock API

If you've been using mock endpoints, replace:

| Old (Mock) | New (Rails) |
|------------|-------------|
| `POST /api/v1/agents` | `POST /api/v1/registry/agents` |
| `POST /api/v1/agents/:id/runs` | `POST /api/v1/rails/v1/plan` |
| `GET /api/v1/agents/:id/runs` | `POST /api/v1/rails/v1/wihs` |
| `GET /api/v1/runs/:id/tasks` | `POST /api/v1/rails/v1/wihs` (filter) |
| `POST /api/v1/checkpoints` | `POST /api/v1/rails/v1/vault/archive` |
| `GET /api/v1/queue` | `POST /api/v1/rails/v1/wihs` (ready_only) |
| `GET /api/v1/history` | `POST /api/v1/rails/v1/ledger/tail` |
| `POST /api/v1/messages` | `POST /api/v1/rails/v1/mail/send` |

---

## File Locations

| Component | Path |
|-----------|------|
| Rails Service | `allternit/allternit-agent-system-rails/` |
| Rails HTTP API | `allternit-agent-system-rails/src/service.rs` |
| Rails Types | `allternit-agent-system-rails/src/core/types.rs` |
| Rails WIH | `allternit-agent-system-rails/src/wih/` |
| Rails Ledger | `allternit-agent-system-rails/src/ledger/` |
| Rails Mail | `allternit-agent-system-rails/src/mail/` |
| Rails Gate | `allternit-agent-system-rails/src/gate/` |
| Rails Vault | `allternit-agent-system-rails/src/vault/` |
| Rails Work | `allternit-agent-system-rails/src/work/` |
| Rails CLI | `allternit-agent-system-rails/src/cli/` |
| UI Rails Client | `5-ui/allternit-platform/src/lib/agents/rails.service.ts` |
| Service Config | `.allternit/services.json` |

---

## Testing

```bash
# Start Rails service
cargo run --bin allternit-rails-service --manifest-path allternit-agent-system-rails/Cargo.toml

# Or via service config
# Service runs on port 3011

# Test health
curl http://localhost:3011/health

# Initialize
curl -X POST http://localhost:3011/v1/init

# Create plan
curl -X POST http://localhost:3011/v1/plan \
  -H "Content-Type: application/json" \
  -d '{"text":"Create a todo list app"}'
```

---

## Summary

**You don't need to build an agent backend. It already exists.**

The Rails service provides:
- ✅ Task planning (DAGs)
- ✅ Work tracking (WIHs)
- ✅ Event history (Ledger)
- ✅ Agent messaging (Mail)
- ✅ Policy gates
- ✅ Resource leases
- ✅ Archival (Vault)
- ✅ Multi-agent coordination

**Next Steps:**
1. Delete any mock/redundant agent services
2. Import `rails.service.ts` in the UI
3. Map UI features to Rails endpoints using this guide
4. Test against the real Rails API
