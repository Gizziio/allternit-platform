# Agent Studio - Reality Check: What's Actually Built

## The Truth

You already have an **Agent Studio backend**. It's called **Allternit Agent System Rails**.

## What Actually Exists

### 1. Allternit Agent System Rails (`allternit-agent-system-rails/`)
**Port:** 3011
**Status:** ✅ **FULLY BUILT**

This IS the agent management system. It has:

```
POST /v1/plan              - Create execution plans (DAGs)
POST /v1/plan/refine       - Refine plans
GET  /v1/plan/:dag_id      - Get DAG details
GET  /v1/dags/:dag_id/render - Render DAG

POST /v1/wihs              - List work items (WIHs)
POST /v1/wihs/pickup       - Pick up work
GET  /v1/wihs/:id/context  - Get work context
POST /v1/wihs/:id/sign     - Sign work
POST /v1/wihs/:id/close    - Complete work

POST /v1/leases            - Request resource leases
DELETE /v1/leases/:id      - Release leases

POST /v1/ledger/tail       - Query execution history
POST /v1/ledger/trace      - Trace events

POST /v1/mail/threads      - Create conversation threads
POST /v1/mail/send         - Send messages
POST /v1/mail/inbox        - Check inbox
POST /v1/mail/review       - Request reviews
POST /v1/mail/decide       - Approve/reject

GET  /v1/gate/status       - Check policy gate
POST /v1/gate/check        - Validate actions
POST /v1/gate/decision     - Record decisions

POST /v1/vault/archive     - Archive work
POST /v1/init              - Initialize workspace
```

**Features:**
- ✅ Task planning (DAG creation)
- ✅ Work tracking (WIHs)
- ✅ Resource leases
- ✅ Event ledger
- ✅ MCP Agent Mail (messaging)
- ✅ Policy gates
- ✅ Vault archiving
- ✅ Multi-agent coordination

### 2. Kernel Service (`services/orchestration/kernel-service/`)
**Port:** 3004
**Status:** ✅ **FULLY BUILT** (3937 lines!)

Has:
```
GET  /v1/brain/profiles        - List brain profiles
POST /v1/brain/profiles        - Register brain
POST /v1/brain/route           - Route to brain
GET  /v1/brain/runtimes        - List runtimes
POST /v1/sessions              - Create sessions
GET  /v1/sessions/:id/events   - Stream events
POST /v1/sessions/:id/input    - Send input
POST /v1/intent/dispatch       - Dispatch intents
POST /v1/actions/execute       - Execute actions
GET  /v1/capsules              - List capsules
POST /v1/taskgraph/install     - Install task graphs
POST /v1/taskgraph/resume      - Resume tasks
POST /v1/governance/evaluate   - Policy evaluation
POST /v1/governance/receipts   - Submit receipts
```

### 3. Memory Service (`services/memory/`)
**Port:** 3200
**Status:** ⚠️ **STUB** (230 lines)

Needs work to be fully functional.

### 4. Registry Service (`services/registry/registry-server/`)
**Port:** 8080
**Status:** ✅ **BUILT**

Stores agent, skill, and tool definitions.

### 5. API Service (`6-apps/api/`)
**Port:** 3000
**Status:** ✅ **BUILT**

Aggregates all services and provides unified API.

### 6. Gateway (`services/gateway/`)
**Port:** 8013
**Status:** ✅ **BUILT**

Public entry point. Routes:
```
/api/v1/rails/* → Rails service
/api/v1/voice/* → Voice service
/api/v1/browser/* → Operator
/api/v1/operator/* → Operator
/api/v1/webvm/* → WebVM
```

## What I Built vs What Exists

### What I Built (Wrong Approach)
- ❌ New `agent-service` - **REDUNDANT**
- ❌ New database schema - **DUPLICATES Rails ledger**
- ❌ New endpoints - **ALREADY IN Rails**

### What Actually Powers Agent Studio
- ✅ **Rails** - Work planning, DAGs, WIHs
- ✅ **Kernel** - Brain sessions, execution
- ✅ **Registry** - Agent definitions
- ✅ **API** - Unified interface
- ✅ **Gateway** - Public access

## What Needs to Happen

### Option 1: Use Existing Rails Service (Recommended)

The UI should call Rails endpoints directly:

```typescript
// Instead of my made-up endpoints:
POST /api/v1/agents              ❌
GET  /api/v1/agents/:id/runs     ❌

// Use ACTUAL Rails endpoints:
POST /api/v1/plan                ✅ Creates execution plan
GET  /api/v1/wihs                ✅ Lists work items  
POST /v1/wihs/pickup             ✅ Picks up work
POST /v1/ledger/tail             ✅ Gets execution history
```

**Agent = Brain Profile + DAG + WIHs**

### Option 2: Build Missing Pieces

Real gaps in current system:

1. **Memory Service** - Currently a stub, needs full implementation
2. **Checkpoint/Restore** - Not explicitly in Rails (could use vault/archive)
3. **Queue Management** - Could use Rails mail system
4. **UI-Friendly Wrappers** - Rails API is low-level

## Honest Assessment

### What's Ready NOW
1. ✅ **Rails Service** - Complete agent work management
2. ✅ **Kernel Service** - Complete brain/session management
3. ✅ **Registry** - Agent/skill storage
4. ✅ **API/Gateway** - Access layer

### What's Missing
1. ⚠️ **Memory Service** - Needs full implementation
2. ⚠️ **UI Integration** - Need to connect UI to real endpoints
3. ⚠️ **Documentation** - Rails is powerful but complex

### What I Should Have Done
Instead of building `agent-service`, I should have:

1. **Documented Rails API** for the UI
2. **Mapped UI features** to Rails concepts:
   - "Create Agent" → `POST /v1/plan` + register in Registry
   - "Start Run" → `POST /v1/wihs/pickup`
   - "Task List" → `POST /v1/wihs`
   - "Execution History" → `POST /v1/ledger/tail`
3. **Built UI** that uses real Rails endpoints
4. **Extended** existing services if gaps found

## Corrected Architecture

```
┌────────────────────────────────────────────┐
│         Agent Studio UI                    │
│         (5-ui/allternit-platform)                │
│                                            │
│  - Calls Rails API for work/plans          │
│  - Calls Kernel API for sessions           │
│  - Calls Registry for agents               │
└────────────────────┬───────────────────────┘
                     │
                     ▼ Gateway (8013)
┌────────────────────────────────────────────┐
│  ┌──────────────┐  ┌──────────────┐       │
│  │Rails Service │  │Kernel Service│       │
│  │  (Port 3011) │  │  (Port 3004) │       │
│  │              │  │              │       │
│  │ - DAG/WIH    │  │ - Sessions   │       │
│  │ - Planning   │  │ - Execution  │       │
│  │ - Ledger     │  │ - Intents    │       │
│  │ - Mail       │  │ - Actions    │       │
│  └──────────────┘  └──────────────┘       │
│                                            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │   Registry   │  │   Memory     │       │
│  │  (Port 8080) │  │  (Port 3200) │       │
│  │              │  │  (needs work)│       │
│  │ - Agents     │  │              │       │
│  │ - Skills     │  │ - State      │       │
│  │ - Tools      │  │ - Context    │       │
│  └──────────────┘  └──────────────┘       │
└────────────────────────────────────────────┘
```

## What to Do Now

### Immediate Actions

1. **Delete** the `agent-service` I created (redundant)
2. **Update UI** to use Rails endpoints:
   ```typescript
   // agent.service.ts should call:
   const api = {
     // Agents → Registry + Rails
     listAgents: () => fetch('/api/v1/registry/agents'),
     createAgent: (agent) => fetch('/api/v1/registry/agents', {method: 'POST'}),
     
     // Runs → WIHs in Rails
     startRun: (input) => fetch('/api/v1/plan', {method: 'POST', body: input}),
     listRuns: () => fetch('/api/v1/wihs', {method: 'POST'}),
     
     // Tasks → WIHs
     listTasks: () => fetch('/api/v1/wihs', {method: 'POST'}),
     
     // History → Ledger
     getHistory: () => fetch('/api/v1/ledger/tail', {method: 'POST'}),
     
     // Messaging → Mail
     sendMessage: (msg) => fetch('/api/v1/mail/send', {method: 'POST'}),
   }
   ```

3. **Document Rails concepts** for UI developers:
   - DAG = Execution Plan
   - WIH = Work Item/Run
   - Ledger = Execution History
   - Mail = Agent Messaging
   - Gate = Policy Check
   - Vault = Archive/Checkpoint

4. **Fix Memory Service** if checkpoints needed

## Conclusion

**The backend EXISTS. I was solving a solved problem.**

The real work is:
1. Understanding the Rails API (it's complex)
2. Mapping UI concepts to Rails concepts
3. Building UI that uses the real API
4. Documenting how it all fits together

My standalone `agent-service` is unnecessary and should be removed.
