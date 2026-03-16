# Agent Workspace Architecture

> **Version:** 1.0.0  
> **Status:** ACTIVE  
> **Scope:** Client-side agent workspace runtime (CLI, Shell UI, and future interfaces)

## Overview

The Agent Workspace is the **client-side runtime** that provides a 5-layer living workspace architecture for AI agents. It is **NOT the kernel** - rather, it is the bridge between users/agents and the kernel's deterministic enforcement systems.

### Key Principle

```
┌─────────────────────────────────────────────────────────────────────┐
│  KERNEL (Rust)           │  MARKDOWN                │  AGENT         │
│  ───────────             │  ────────                │  ─────         │
│  • System Law            │  • AGENTS.md             │  • Reads       │
│  • Governance Engine     │  • IDENTITY.md           │  • Decides     │
│  • Policy Enforcement    │  • POLICY.md             │  • Acts        │
│  • Ledger/Receipts       │  • MEMORY.md             │  • Logs        │
│  • Context Pack Builder  │  • BRAIN.md              │  • Syncs       │
└─────────────────────────────────────────────────────────────────────┘
          ↑                           ↑                         ↑
          │                           │                         │
          └─────────── SYNC ──────────┴──────── REHYDRATE ─────┘
```

**The Kernel enforces.** The Markdown distills. The Agent consumes.

---

## Architecture Layers

### Layer 1: Cognitive Persistence
**Purpose:** Working memory, task graph, session continuity

| File | Location | Kernel Mirror | Sync Direction |
|------|----------|---------------|----------------|
| BRAIN.md | `.a2r/brain/BRAIN.md` | `.a2r/state/taskgraph.json` | Kernel → MD |
| MEMORY.md | `.a2r/memory/MEMORY.md` | Index of daily files | Kernel → MD |
| memory/*.md | `.a2r/memory/YYYY-MM-DD.md` | HistoryLedger receipts | Kernel → MD |
| active-tasks.md | `.a2r/memory/active-tasks.md` | Rails task queue | Kernel → MD |
| lessons.md | `.a2r/memory/lessons.md` | Curated from HistoryLedger | Bidirectional |
| self-review.md | `.a2r/memory/self-review.md` | Agent introspection logs | Agent → Kernel |
| checkpoints/ | `.a2r/state/checkpoints.jsonl` | Session state | Kernel → MD |

**Function:**
- Human-readable view of agent's working memory
- Task graph visualization and editing
- Session logs for continuity
- Crash recovery via checkpoints

---

### Layer 2: Identity Stabilization
**Purpose:** Agent self-concept, voice, user preferences

| File | Location | Kernel Mirror | Sync Direction |
|------|----------|---------------|----------------|
| IDENTITY.md | `.a2r/identity/IDENTITY.md` | GovernanceEngine agent registry | Kernel → MD |
| SOUL.md | `.a2r/identity/SOUL.md` | Distilled from SOT.md | Manual edit |
| USER.md | `.a2r/identity/USER.md` | Session context preferences | Bidirectional |
| VOICE.md | `.a2r/identity/VOICE.md` | Role envelopes | Kernel → MD |
| POLICY.md | `.a2r/identity/POLICY.md` | PolicyEngine overrides | Bidirectional |

**Function:**
- Who the agent is (name, nature, vibe)
- How the agent should behave (soul)
- User preferences (communication style, technical depth)
- Runtime policy adjustments (without restart)

**Key Feature:** POLICY.md changes take effect immediately via the Policy Engine.

---

### Layer 3: Governance & Decision
**Purpose:** Constitution, procedures, tool policies, execution rules

| File | Location | Source | Notes |
|------|----------|--------|-------|
| AGENTS.md | `5-agents/AGENTS.md` | Supreme Law | **LOCKED** - References SYSTEM_LAW.md |
| SYSTEM_LAW.md | `0-substrate/SYSTEM_LAW.md` | Tier 0 Law | Loaded into ContextPack |
| SOT.md | `0-substrate/SOT.md` | System Thesis | Loaded into ContextPack |
| ARCHITECTURE.md | `ARCHITECTURE.md` | System Design | Loaded into ContextPack |
| PLAYBOOK.md | `.a2r/governance/PLAYBOOK.md` | cookbooks/ | Procedures distilled from cookbooks |
| TOOLS.md | `.a2r/governance/TOOLS.md` | ToolRegistry | Allowed tools for this workspace |
| HEARTBEAT.md | `.a2r/governance/HEARTBEAT.md` | User config | Periodic task configuration |
| SYSTEM.md | `.a2r/governance/SYSTEM.md` | Environment | System constraints |
| CHANNELS.md | `.a2r/governance/CHANNELS.md` | User config | MCP/external channel config |
| spec/contracts/ | `5-agents/spec/contracts/` | ContextPack | Contract files |
| spec/deltas/ | `5-agents/spec/deltas/` | ContextPack | Delta files |

**Function:**
- AGENTS.md is the **supreme law** - all agents must read this first
- Playbooks provide deterministic procedures for common scenarios
- Tools.md shows what tools are available in this workspace
- System.md defines environment constraints

---

### Layer 4: Modular Skills
**Purpose:** Reusable capabilities, skill contracts

| File | Location | Kernel Mirror | Sync Direction |
|------|----------|---------------|----------------|
| skills/ | `.a2r/skills/` | `a2r_openclaw_host::skills::SkillRegistry` | Kernel → MD |
| SKILL.md | `.a2r/skills/{name}/SKILL.md` | Human-readable procedure | Manual edit |
| contract.json | `.a2r/skills/{name}/contract.json` | Machine-readable contract | Manual edit |
| skills.index.json | `.a2r/contracts/skills.index.json` | Registry index | Kernel → MD |

**Function:**
- Reusable capability packages
- Each skill has a procedure (SKILL.md) + contract (contract.json)
- Skills are indexed and routed by the Skills Registry
- Integration with OpenClaw skill bridge

---

### Layer 5: Business Topology
**Purpose:** Multi-tenancy, client management, projects

| File | Location | Kernel Mirror | Sync Direction |
|------|----------|---------------|----------------|
| CLIENTS.md | `.a2r/business/CLIENTS.md` | Tenant registry | Kernel → MD |
| business/crm/ | `.a2r/business/crm/` | Contact management | Bidirectional |
| business/projects/ | `.a2r/business/projects/` | Project workspaces | Bidirectional |
| business/content/ | `.a2r/business/content/` | Content templates | Bidirectional |
| packs/ | `5-agents/packs/` | Prompt packs | Manual edit |

**Function:**
- Multi-tenant client management
- Project-specific workspaces
- Content templates for business use cases

---

## Client-Side Runtime (Agent Workspace)

The Agent Workspace is implemented in:
- **CLI:** `7-apps/cli/src/agent_workspace/`
- **Shell UI:** Uses the same system via API calls (future: shared crate)

### Components

```
agent_workspace/
├── mod.rs                    # Module exports
├── boot_sequence.rs          # 21-phase deterministic initialization
├── policy_engine.rs          # AGENTS.md + POLICY.md enforcement
├── context_pack.rs           # 5-layer aggregation for LLM
├── skills_registry.rs        # Skill discovery and routing
├── checkpoint.rs             # Crash recovery and session continuity
└── workspace_compiler.rs     # Markdown → structured data
```

### Boot Sequence (21 Phases)

```
Phase 1: System Initialization
├── Step 1: Lock acquisition
├── Step 2: Load manifest
└── Step 3: Crash recovery

Phase 2: Identity & Governance
├── Step 4: Load IDENTITY.md
├── Step 5: Load AGENTS.md (constitution)
├── Step 6: Load SOUL.md
└── Step 7: Load USER.md

Phase 3: Environment & Tools
├── Step 8: Load TOOLS.md
├── Step 9: Load SYSTEM.md
├── Step 10: Load CHANNELS.md
└── Step 11: Load POLICY.md

Phase 4: Memory Hydration
├── Step 12: Load MEMORY.md
├── Step 13: Load daily logs
├── Step 14: Load active tasks
├── Step 15: Load lessons
└── Step 16: Load self-reviews

Phase 5: Capabilities
├── Step 17: Index skills
├── Step 18: Load tool registry
└── Step 19: Load provider configs

Phase 6: Context Build
├── Step 20: Build context pack
└── Step 21: Resume work
```

---

## Deterministic Rehydration

At every context boundary, the agent is rehydrated:

### Context Boundaries
1. **New session** → Full boot sequence
2. **Post-compaction** → Load checkpoint + recent memory
3. **Subagent spawn** → Inherit parent context pack
4. **Tool call boundary** → Policy check + receipt logging
5. **Crash recovery** → Restore from checkpoint

### Rehydration Data
```rust
struct RehydrationContext {
    agents_md_hash: String,      // Verify constitution unchanged
    context_pack: ContextPack,   // WIH scope, allowed tools
    brain: TaskGraph,            // Current task state
    memory: WorkingMemory,       // Recent decisions, open questions
    policy: PolicySet,           // Runtime overrides
}
```

---

## Sync Protocol

### Kernel → Markdown (Every Turn)

```rust
// 1. Receipts emitted
kernel.emit_receipt(tool_call) {
    // Append to memory/YYYY-MM-DD.md
    memory_file.log(tool_call);
}

// 2. Task state changes
kernel.update_task(task_id, status) {
    // Update BRAIN.md
    brain_file.sync(taskgraph);
}

// 3. Policy changes
kernel.policy_engine.update(policy) {
    // Update POLICY.md if workspace-specific
    policy_file.sync(policy);
}

// 4. Skill registry updates
kernel.skills.register(skill) {
    // Update skills.index.json
    index_file.sync(registry);
}
```

### Markdown → Kernel (On Changes)

```rust
// 1. POLICY.md edited
fs.watch("POLICY.md", |event| {
    if event.is_write() {
        policy_engine.reload();
    }
});

// 2. New skill created
fs.watch("skills/", |event| {
    if event.is_create() {
        skill_registry.index();
    }
});

// 3. AGENTS.md edited (rare)
// Requires kernel restart - this is supreme law
```

### Agent → Kernel (Via Tool Calls)

```rust
// Agent reads AGENTS.md
let constitution = workspace.agents_md();

// Agent decides action
let decision = agent.decide(constitution, context);

// Agent acts via kernel
tool_call = kernel.tools.execute(decision) {
    // PreToolUse gate check
    policy_engine.check(tool_call)?;
    
    // Execute
    result = tool.execute();
    
    // Emit receipt
    ledger.emit(tool_call_receipt);
    
    // Sync to markdown
    memory_file.log(tool_call_receipt);
}
```

---

## File Locations

### Global (5-agents/)
```
5-agents/
├── AGENTS.md                    # Supreme law (LOCKED)
├── POLICY.md                    # Base policy
├── A2R_Layer_Architecture.md    # This document
├── templates/
│   └── a2r_workspace/           # Workspace templates
│       ├── layer1_cognitive/    # BRAIN.md, MEMORY.md, memory/
│       ├── layer2_identity/     # IDENTITY.md, SOUL.md, USER.md, etc.
│       ├── layer3_governance/   # PLAYBOOK.md, TOOLS.md
│       ├── layer4_skills/       # SKILL.md template, contract.json
│       └── layer5_business/     # CLIENTS.md
├── spec/
│   ├── contracts/               # Contract files
│   └── deltas/                  # Delta files
├── packs/                       # Prompt packs
├── roles/                       # Role envelopes
└── cookbooks/                   # Deterministic procedures
```

### Per-Workspace (.a2r/)
```
.a2r/
├── manifest.json                # Workspace metadata
├── brain/
│   └── BRAIN.md                 # Task graph human view
├── memory/
│   ├── YYYY-MM-DD.md           # Daily session logs
│   ├── active-tasks.md         # Current task queue
│   ├── lessons.md              # Curated learnings
│   └── self-review.md          # Introspection logs
├── identity/
│   ├── IDENTITY.md             # Agent identity
│   ├── SOUL.md                 # Agent behavior
│   ├── USER.md                 # User preferences
│   ├── VOICE.md                # Voice config
│   └── POLICY.md               # Runtime overrides
├── governance/
│   ├── PLAYBOOK.md             # Procedures
│   ├── TOOLS.md                # Tool configuration
│   ├── HEARTBEAT.md            # Periodic tasks
│   ├── SYSTEM.md               # Environment constraints
│   └── CHANNELS.md             # MCP/external channels
├── skills/
│   ├── _template/              # Skill template
│   └── {skill_name}/           # Individual skills
│       ├── SKILL.md
│       └── contract.json
├── business/
│   ├── CLIENTS.md              # Client registry
│   ├── crm/                    # Contact info
│   ├── projects/               # Project workspaces
│   └── content/                # Content templates
├── contracts/
│   ├── skills.index.json       # Skill registry index
│   └── tools.registry.json     # Tool registry
├── context/
│   └── pack.current.json       # Compiled context pack
└── state/
    ├── taskgraph.json          # Machine task graph
    ├── checkpoints.jsonl       # Session checkpoints
    └── locks/                  # Workspace locks
```

---

## Integration: CLI vs Shell UI

### CLI (`7-apps/cli/`)
```rust
// Direct integration
mod agent_workspace;
use agent_workspace::{BootSequence, PolicyEngine, ContextPackBuilder};

// Agent creation wizard
fn create_agent_a2r() {
    // Copy templates from 5-agents/templates/a2r_workspace/
    // Initialize .a2r/ structure
    // Run boot sequence
}
```

### Shell UI (`6-ui/shell-ui/`)
```typescript
// API-based integration
interface AgentWorkspaceAPI {
    // Boot sequence
    boot(workspaceId: string): Promise<BootContext>;
    
    // Policy engine
    checkToolCall(tool: string, context: ActionContext): Promise<PolicyResult>;
    
    // Context pack
    buildContextPack(workspaceId: string): Promise<ContextPack>;
    
    // Skills
    listSkills(workspaceId: string): Promise<Skill[]>;
    executeSkill(skillId: string, inputs: any): Promise<SkillResult>;
    
    // Sync
    syncWithKernel(workspaceId: string): Promise<SyncResult>;
}

// Shell UI uses the same .a2r/ workspace
// But accesses it via the CLI/kernel API
```

### Shared Principles
Both CLI and Shell UI:
1. Use the same 5-layer workspace structure (`.a2r/`)
2. Read the same markdown files (AGENTS.md, etc.)
3. Sync with the same kernel infrastructure
4. Follow the same boot sequence
5. Enforce the same policies

---

## Deterministic Harness

The combination of Kernel + Markdown + Agent Workspace creates a **deterministic harness**:

### Properties
1. **Reproducibility:** Given same inputs, agent produces same outputs
2. **Auditability:** All decisions logged in receipts + markdown
3. **Continuity:** Crash recovery from checkpoints + memory
4. **Governance:** Kernel enforces, agent follows
5. **Transparency:** Markdown files are human-readable

### Example Flow
```
User Request
    ↓
[Kernel] Create WIH + Lease
    ↓
[Agent Workspace] Boot sequence loads 5 layers
    ↓
[Agent] Reads AGENTS.md (constitution)
    ↓
[Agent] Decides action based on BRAIN.md (task state)
    ↓
[Policy Engine] Checks against POLICY.md
    ↓
[Kernel] Executes tool call (with PreToolUse gate)
    ↓
[Kernel] Emits receipt to Ledger
    ↓
[Agent Workspace] Syncs receipt to memory/YYYY-MM-DD.md
    ↓
[Agent] Continues or completes task
    ↓
[Agent Workspace] Creates checkpoint
    ↓
[Kernel] WIH completion → Ledger
```

---

## Future Evolution

### Phase 1: CLI (Current)
- Full agent workspace implementation in CLI
- Direct file system access to .a2r/
- Local policy enforcement

### Phase 2: Shell UI Integration
- Shell UI accesses workspace via API
- Same .a2r/ structure
- Visual editing of markdown files

### Phase 3: Shared Runtime
- Extract agent_workspace to shared crate
- Both CLI and Shell UI use same runtime
- WebAssembly for browser compatibility

### Phase 4: Multi-Agent Workspaces
- Multiple agents share workspace
- Conflict resolution via kernel
- Collaborative BRAIN.md updates

---

## Summary

The Agent Workspace is the **client-side runtime** that:
1. Provides a 5-layer living workspace for agents
2. Syncs bidirectionally with the kernel
3. Distills kernel state into human-readable markdown
4. Enforces policies at the client level
5. Enables deterministic agent behavior

**It is NOT the kernel.** It is the bridge between agents and the kernel's deterministic enforcement.

---

**END OF DOCUMENT**
