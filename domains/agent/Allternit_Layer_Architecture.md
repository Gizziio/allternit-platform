# Allternit 5-Layer Architecture Mapping

> This document maps the Allternit 5-layer living workspace architecture to the existing codebase infrastructure.

## Architecture Principle

**Kernel/Governance (Rust)** ←→ **Markdown Distillation** ←→ **Agent Runtime**

The kernel enforces deterministically. The markdown files are a **human-readable, agent-consumable distillation** of kernel state. Agents are rehydrated from these files at every context boundary.

---

## Layer Mapping

### Layer 1: Cognitive Persistence
**Purpose:** Working memory, task graph, session continuity

| Component | Location | Kernel Integration |
|-----------|----------|-------------------|
| BRAIN.md | `.allternit/brain/BRAIN.md` | Mirrors `.allternit/state/taskgraph.json` |
| MEMORY.md | `.allternit/memory/MEMORY.md` | Index of daily memory files |
| memory/*.md | `.allternit/memory/YYYY-MM-DD.md` | Session logs synced to HistoryLedger |
| active-tasks.md | `.allternit/memory/active-tasks.md` | Mirrors task queue from Rails |
| lessons.md | `.allternit/memory/lessons.md` | Curated learnings from HistoryLedger |
| self-review.md | `.allternit/memory/self-review.md` | Agent introspection logs |
| checkpoints/ | `.allternit/state/checkpoints.jsonl` | Checkpoint system for crash recovery |

**Sync Direction:**
- Kernel → MD: Task state changes, receipt emissions, session events
- MD → Kernel: Agent decisions logged as receipts

---

### Layer 2: Identity Stabilization  
**Purpose:** Agent self-concept, voice, user preferences

| Component | Location | Kernel Integration |
|-----------|----------|-------------------|
| IDENTITY.md | `.allternit/identity/IDENTITY.md` | Mirrors agent registration in GovernanceEngine |
| SOUL.md | `.allternit/identity/SOUL.md` | Agent behavior guidelines (distilled from SOT.md) |
| USER.md | `.allternit/identity/USER.md` | User preferences from session context |
| VOICE.md | `.allternit/identity/VOICE.md` | Voice config from role envelopes |
| POLICY.md | `5-agents/POLICY.md` | Dynamic policy overrides (runtime adjustable) |
| POLICY.md (local) | `.allternit/identity/POLICY.md` | Workspace-specific policy overrides |

**Sync Direction:**
- Kernel → MD: Role assignments, policy changes, user pref updates
- MD → Kernel: POLICY.md changes trigger PolicyEngine updates

---

### Layer 3: Governance & Decision
**Purpose:** Constitution, procedures, tool policies, execution rules

| Component | Location | Kernel Integration |
|-----------|----------|-------------------|
| AGENTS.md | `5-agents/AGENTS.md` | **Supreme law** - DAK Runner constitution |
| SYSTEM_LAW.md | `0-substrate/SYSTEM_LAW.md` | Tier 0 law (loaded into ContextPack) |
| SOT.md | `0-substrate/SOT.md` | System operating thesis |
| ARCHITECTURE.md | `ARCHITECTURE.md` | System architecture |
| PLAYBOOK.md | `.allternit/governance/PLAYBOOK.md` | Procedures distilled from cookbooks/ |
| TOOLS.md | `.allternit/governance/TOOLS.md` | Tool registry subset (allowed tools) |
| HEARTBEAT.md | `.allternit/governance/HEARTBEAT.md` | Periodic task config |
| SYSTEM.md | `.allternit/governance/SYSTEM.md` | Environment constraints |
| CHANNELS.md | `.allternit/governance/CHANNELS.md` | MCP/external channel config |
| spec/contracts/ | `5-agents/spec/contracts/` | Contract files from ContextPack |
| spec/deltas/ | `5-agents/spec/deltas/` | Delta files from ContextPack |
| cookbooks/ | `5-agents/cookbooks/` | Deterministic procedures |

**Sync Direction:**
- Kernel → MD: AGENTS.md is locked, PLAYBOOK.md syncs from cookbooks, tool registry updates
- MD → Agent: Agent reads these to understand constraints

---

### Layer 4: Modular Skills
**Purpose:** Reusable capabilities, skill contracts

| Component | Location | Kernel Integration |
|-----------|----------|-------------------|
| skills/ | `.allternit/skills/` | Mirrors `allternit_openclaw_host::skills::SkillRegistry` |
| SKILL.md | `.allternit/skills/{name}/SKILL.md` | Human-readable skill procedure |
| contract.json | `.allternit/skills/{name}/contract.json` | Machine-readable skill contract |
| skills.index.json | `.allternit/contracts/skills.index.json` | Registry index |

**Sync Direction:**
- Kernel → MD: Skill registry exports to skills.index.json
- Agent → Kernel: Skill invocation routed through ToolRegistry

---

### Layer 5: Business Topology
**Purpose:** Multi-tenancy, client management, projects

| Component | Location | Kernel Integration |
|-----------|----------|-------------------|
| CLIENTS.md | `.allternit/business/CLIENTS.md` | Mirrors tenant registry |
| business/crm/ | `.allternit/business/crm/` | Client contact info |
| business/projects/ | `.allternit/business/projects/` | Project-specific workspaces |
| business/content/ | `.allternit/business/content/` | Content templates |
| packs/ | `5-agents/packs/` | Prompt packs (business layer assets) |

**Sync Direction:**
- Kernel → MD: Tenant/project updates
- Agent uses: Client context for multi-tenant responses

---

## Runtime Integration (Allternit Engine)

The CLI `allternit_engine/` serves as the **Agent Workspace Runtime**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Allternit Engine (CLI)                         │
├─────────────────────────────────────────────────────────────┤
│  Boot Sequence (21-phase)                                   │
│  ├── Load AGENTS.md (constitution)                         │
│  ├── Load IDENTITY.md, SOUL.md (identity)                  │
│  ├── Load USER.md, POLICY.md (preferences)                 │
│  ├── Load memory/ (cognitive state)                        │
│  ├── Index skills/ (capabilities)                          │
│  └── Build Context Pack                                    │
├─────────────────────────────────────────────────────────────┤
│  Policy Engine                                              │
│  ├── Enforces AGENTS.md constitution                       │
│  ├── Applies POLICY.md overrides                           │
│  └── Gates tool calls (PreToolUse)                         │
├─────────────────────────────────────────────────────────────┤
│  Checkpoint System                                          │
│  ├── Saves agent state every N minutes                     │
│  ├── Crash recovery from checkpoints                       │
│  └── Session continuity across compactions                 │
├─────────────────────────────────────────────────────────────┤
│  Kernel Sync                                                │
│  ├── Emits receipts to Rails ledger                        │
│  ├── Queries Rails for task state                          │
│  └── Syncs markdown with kernel state                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Deterministic Rehydration

At every context boundary, the agent is rehydrated from:

1. **AGENTS.md hash** → Verifies constitution hasn't changed
2. **Context Pack** → WIH scope, allowed tools, contracts
3. **BRAIN.md** → Current task graph state
4. **MEMORY.md** → Recent decisions, open questions, blockers
5. **POLICY.md** → Runtime policy overrides

This ensures **deterministic behavior** - given the same inputs, the agent produces the same outputs.

---

## File Locations Summary

### Global (5-agents/)
- `AGENTS.md` - Supreme law (locked)
- `POLICY.md` - Base policy
- `spec/` - Specifications and contracts
- `packs/` - Prompt packs
- `roles/` - Role envelopes
- `cookbooks/` - Deterministic procedures

### Per-Workspace (.allternit/)
- `manifest.json` - Workspace metadata
- `brain/BRAIN.md` - Task graph human view
- `memory/` - Session logs and lessons
- `identity/` - IDENTITY.md, SOUL.md, USER.md, VOICE.md
- `governance/` - PLAYBOOK.md, TOOLS.md, HEARTBEAT.md, SYSTEM.md, CHANNELS.md
- `skills/` - Skill definitions
- `business/` - Client/project topology
- `contracts/` - Skill and tool indices
- `context/` - Compiled context packs
- `state/` - Machine-readable state (taskgraph.json, checkpoints.jsonl)

---

## Sync Protocol

### Kernel → Markdown (Every Turn)
1. New receipts emitted → Append to memory/YYYY-MM-DD.md
2. Task state changes → Update BRAIN.md
3. Policy changes → Update POLICY.md
4. Skill registry updates → Update skills.index.json

### Markdown → Kernel (On Changes)
1. POLICY.md edited → PolicyEngine.reload()
2. TOOLS.md edited → ToolRegistry.update()
3. New skill created → SkillRegistry.register()

### Agent Rehydration (Context Boundaries)
1. New session → Full boot sequence
2. Post-compaction → Load from checkpoint + recent memory
3. Subagent spawn → Inherit parent context pack

---

*This mapping ensures the Allternit living workspace architecture integrates seamlessly with the existing kernel infrastructure while maintaining the deterministic, markdown-driven agent experience.*
