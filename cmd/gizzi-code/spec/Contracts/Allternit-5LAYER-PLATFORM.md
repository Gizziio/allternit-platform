# Agent Workspace - 5-Layer Platform Specification

Client-side workspace management using the 5-layer architecture.

> **Architecture**: KERNEL (Authoritative) ←→ MARKDOWN (Distillation) ←→ AGENT WORKSPACE (This Module) ←→ AGENT (LLM)
>
> The kernel maintains authoritative state (Rust, ledger, receipts).
> The agent_workspace maintains a distilled markdown view for rehydration.

## 5-Layer Architecture

```
workspace/
├── .allternit/                                    # Allternit platform directory
│   ├── manifest.json                        # ← replaces config.json
│   │
│   ├── L1-COGNITIVE/                        # Task graph, memory, state
│   │   ├── BRAIN.md                         # Task DAG (human-readable)
│   │   ├── brain/
│   │   │   ├── state.json                   # Machine state (was state/state.json)
│   │   │   ├── taskgraph.json               # Structured task graph
│   │   │   └── batons/                      # Compaction batons
│   │   │       └── compact-YYYYMMDD-NNN.md
│   │   │
│   │   └── memory/                          # Session logs (was receipts/)
│   │       ├── MEMORY.md                    # Human-readable memory index
│   │       ├── memory.jsonl                 # ← was receipts/receipt.jsonl
│   │       ├── handoff.md                   # ← was handoff/latest.md
│   │       ├── checkpoints/                 # Crash recovery
│   │       │   └── checkpoint-NNN.json
│   │       └── usage/                       # Usage snapshots
│   │           └── usage-ISO-TIMESTAMP.json
│   │
│   ├── L2-IDENTITY/                         # Agent identity & conventions
│   │   ├── IDENTITY.md                      # Who am I (this agent)
│   │   ├── SOUL.md                          # Core values, ethics
│   │   ├── USER.md                          # User preferences
│   │   ├── VOICE.md                         # Communication style
│   │   ├── POLICY.md                        # Base policy rules
│   │   └── CONVENTIONS.md                   # ← was conventions.json
│   │
│   ├── L3-GOVERNANCE/                       # Rules & workflows
│   │   ├── PLAYBOOK.md                      # Operating procedures
│   │   ├── TOOLS.md                         # Tool definitions & gating
│   │   ├── HEARTBEAT.md                     # Health & status
│   │   └── AUDIT.md                         # Audit log reference
│   │
│   ├── L4-SKILLS/                           # Skill definitions
│   │   ├── INDEX.md                         # Skill registry index
│   │   └── skills/                          # Individual skill files
│   │       └── example/
│   │           ├── SKILL.md                 # Skill definition
│   │           └── contract.json            # Skill contract
│   │
│   ├── L5-BUSINESS/                         # Client/project topology
│   │   ├── CLIENTS.md                       # Client list
│   │   ├── crm/                             # Client relationships
│   │   ├── projects/                        # Project definitions
│   │   └── content/                         # Generated content
│   │
│   └── state/                               # Cross-layer machine state
│       ├── locks/                           # File locks
│       ├── index/                           # Search indexes
│       └── cache/                           # Temporary cache
│
└── ...
```

## Layer Mappings (Old → New)

| Old Location | New Location | Layer | Purpose |
|-------------|--------------|-------|---------|
| `config.json` | `manifest.json` | Meta | Platform configuration |
| `receipts/receipt.jsonl` | `L1-COGNITIVE/memory/memory.jsonl` | L1 | Activity log |
| `state/state.json` | `L1-COGNITIVE/brain/state.json` | L1 | Machine state |
| `handoff/latest.md` | `L1-COGNITIVE/memory/handoff.md` | L1 | Handoff pointer |
| `compact/compact-*.md` | `L1-COGNITIVE/brain/batons/*.md` | L1 | Compaction batons |
| `tasks/dag.json` | `L1-COGNITIVE/brain/taskgraph.json` | L1 | Task graph |
| `conventions.json` | `L2-IDENTITY/CONVENTIONS.md` | L2 | Project conventions |
| `usage/*.json` | `L1-COGNITIVE/memory/usage/*.json` | L1 | Usage snapshots |
| `evidence/diffs/*` | `L5-BUSINESS/content/evidence/*` | L5 | Evidence artifacts |
| `checkpoints/*.json` | `L1-COGNITIVE/memory/checkpoints/*.json` | L1 | Checkpoints |

## Boot Order (21-Phase)

Based on the Allternit engine boot sequence:

### Phase 1: Foundation (Layers 0-1)
```
01. Create .allternit/ directory structure
02. Write manifest.json (session ID, runner, thresholds)
03. Create L1-COGNITIVE/brain/ + memory/ directories
04. Initialize brain/state.json (empty DAG)
05. Create memory/memory.jsonl (empty receipt log)
06. Write L1-COGNITIVE/BRAIN.md (initial task graph header)
07. Create L1-COGNITIVE/memory/MEMORY.md (memory index)
```

### Phase 2: Identity (Layer 2)
```
08. Create L2-IDENTITY/ directory
09. Write L2-IDENTITY/IDENTITY.md (agent identity)
10. Write L2-IDENTITY/POLICY.md (base policy)
11. Infer/write L2-IDENTITY/CONVENTIONS.md (from project)
12. Write L2-IDENTITY/SOUL.md (core values)
13. Write L2-IDENTITY/USER.md (user preferences)
14. Write L2-IDENTITY/VOICE.md (communication style)
```

### Phase 3: Governance (Layer 3)
```
15. Create L3-GOVERNANCE/ directory
16. Write L3-GOVERNANCE/PLAYBOOK.md (operating procedures)
17. Write L3-GOVERNANCE/TOOLS.md (tool definitions)
18. Write L3-GOVERNANCE/HEARTBEAT.md (initial status)
```

### Phase 4: Skills (Layer 4)
```
19. Create L4-SKILLS/ directory
20. Write L4-SKILLS/INDEX.md (skill registry)
    - Discover available skills from kernel
```

### Phase 5: Business (Layer 5)
```
21. Create L5-BUSINESS/ directory (optional)
    - Only if business context detected
```

### Phase 6: Handoff Discovery
```
22. Check L1-COGNITIVE/memory/handoff.md
23. If exists: validate and offer resume
24. Start runtime (accept tool calls)
```

## File Specifications

### L1-COGNITIVE/BRAIN.md

Task graph in human-readable markdown:

```markdown
# Allternit Brain - Task Graph

**Session:** sess-abc-123  
**Runner:** opencode  
**Updated:** 2026-02-24T10:00:00Z

## Current Focus
- Node: node-042
- Task: Implement handoff emitter

## Task Graph

### Completed
- [x] node-001: Setup project structure
- [x] node-002: Create types

### In Progress
- [~] node-042: Implement handoff emitter
  - Dependencies: node-002
  - Priority: critical
  - Blocking: true

### Pending
- [ ] node-043: Add CI gates
  - Dependencies: node-042
  - Priority: high

## Context Summary
- Files modified: 3
- Commands run: 5
- Last action: WriteFile to handoff-emitter.ts
```

### L1-COGNITIVE/memory/memory.jsonl

Same as old `receipts/receipt.jsonl`:

```jsonl
{"ts":1704067200000,"run_id":"run-001","dag_node_id":"node-001","tool":"bash","kind":"call","args_redacted":{"command":"npm test"},"result_summary":"Tests passed: 45","status":"ok","duration_ms":2340,"files_touched":[{"path":"test/output.log","action":"created"}],"diff_refs":[],"correlation_id":"corr-abc-123"}
```

### L1-COGNITIVE/memory/handoff.md

Handoff pointer:

```markdown
# Allternit Handoff Pointer

**Generated:** 2026-02-24T10:00:00.000Z  
**Session:** sess-abc-123  
**Reason:** threshold

## Current Baton

`L1-COGNITIVE/brain/batons/compact-20260224-001.md`

## Quick Resume

**Objective:** Implement session handoff feature  
**Progress:** 75% (3/4 major tasks complete)  
**Blockers:** None  
**Next Action:** Add CI gates validation

## Context Window
- **Used:** 184,000 tokens (92%)
- **Limit:** 200,000 tokens
- **Status:** 🔴 HANDOFF REQUIRED

## Target Tool
Preferred: `claude_code` (but any compatible runner acceptable)
```

### L2-IDENTITY/CONVENTIONS.md

Project conventions (converted from JSON):

```markdown
# Allternit Project Conventions

## File Naming
- **Pattern:** kebab-case
- **Examples:** `my-file.ts`, `auth-service.ts`

## Code Style
- **Formatter:** prettier
- **Linter:** eslint
- **Rules:** ./eslint.config.js

## Testing
- **Framework:** vitest
- **Pattern:** `**/*.test.ts`
- **Coverage:** 80% minimum

## Git Workflow
- **Strategy:** git-flow
- **Commits:** conventional-commits

## Architecture
- **Pattern:** layered
- **Patterns Used:** Repository, Service, Factory
- **Forbidden:** God objects, Global mutable state

## Review Checklist
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Breaking changes documented
```

### manifest.json

Replaces `config.json`:

```json
{
  "allternit_version": "2.0.0",
  "manifest_version": "1.0.0",
  
  "workspace": {
    "root": "/path/to/workspace",
    "created_at": 1704067200000,
    "name": "my-project"
  },
  
  "session": {
    "session_id": "sess-uuid",
    "runner": "opencode",
    "started_at": 1704067200000,
    "parent_session": null
  },
  
  "layers": {
    "l1_cognitive": { "enabled": true, "path": "L1-COGNITIVE/" },
    "l2_identity": { "enabled": true, "path": "L2-IDENTITY/" },
    "l3_governance": { "enabled": true, "path": "L3-GOVERNANCE/" },
    "l4_skills": { "enabled": true, "path": "L4-SKILLS/" },
    "l5_business": { "enabled": false, "path": "L5-BUSINESS/" }
  },
  
  "thresholds": {
    "warn_context_ratio": 0.70,
    "compact_context_ratio": 0.85,
    "handoff_context_ratio": 0.92,
    "max_context_tokens": 200000
  },
  
  "features": {
    "guard_enabled": true,
    "telemetry_enabled": true,
    "auto_compact": true,
    "ci_gates_enabled": true,
    "checkpoint_interval_ms": 300000
  }
}
```

## Compaction/Handoff Flow (5-Layer)

```
Trigger: Threshold reached (92% context)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 1. EXTRACT CONTEXT                                  │
│    - Read L1-COGNITIVE/brain/state.json             │
│    - Read L1-COGNITIVE/memory/memory.jsonl          │
│    - Read L2-IDENTITY/CONVENTIONS.md                │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 2. BUILD BATON                                      │
│    - Generate 13 sections                           │
│    - Include L1 task graph summary                  │
│    - Include L2 conventions                         │
│    - Include L4 skill context                       │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 3. RUN CI GATES                                     │
│    - Evidence: Check files in L5-BUSINESS/          │
│    - No-Lazy: Validate action quality               │
│    - Resume: Check fits context                     │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 4. WRITE BATON                                      │
│    - Write: L1-COGNITIVE/brain/batons/*.md          │
│    - Update: L1-COGNITIVE/memory/handoff.md         │
│    - Sync: L1-COGNITIVE/BRAIN.md                    │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 5. NOTIFICATION                                     │
│    - Write L3-GOVERNANCE/HEARTBEAT.md               │
│    - Exit or notify user                            │
└─────────────────────────────────────────────────────┘
```

## Resume Flow (5-Layer)

```
New Agent Starts
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ 1. BOOT (Phases 1-6)                                │
│    - Create directory structure                     │
│    - Check L1-COGNITIVE/memory/handoff.md           │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 2. DISCOVER HANDOFF                                 │
│    - Read handoff.md pointer                        │
│    - Verify baton exists                            │
│    - Check workspace match                          │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 3. VALIDATE BATON                                   │
│    - Run Resume gate                                │
│    - Verify L2-IDENTITY compatible                  │
│    - Check L4-SKILLS available                      │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 4. REHYDRATE                                        │
│    - Load BRAIN.md task graph                       │
│    - Load CONVENTIONS.md standards                  │
│    - Read last memory.jsonl entries                 │
│    - Present baton to user                          │
└──────────┬──────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│ 5. CONTINUE SESSION                                 │
│    - Update IDENTITY.md (new agent)                 │
│    - Resume from last task                          │
│    - Start appending to memory.jsonl                │
└─────────────────────────────────────────────────────┘
```

## Integration with Kernel

The 5-layer structure syncs with the kernel infrastructure:

| Kernel Component | Allternit Location | Sync Direction |
|------------------|--------------|----------------|
| `HistoryLedger` | `L1-COGNITIVE/memory/memory.jsonl` | Bidirectional |
| `SkillRegistry` | `L4-SKILLS/` | Kernel → Allternit |
| `ContextPack` | `L1-COGNITIVE/brain/batons/*.md` | Allternit → Kernel |
| `PolicyEngine` | `L2-IDENTITY/POLICY.md` + `L3-GOVERNANCE/` | Bidirectional |
| `TaskGraph` | `L1-COGNITIVE/brain/taskgraph.json` | Bidirectional |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `Allternit_ENABLED` | Enable Allternit platform | `true` |
| `Allternit_DIR` | Custom .allternit location | `.allternit` |
| `Allternit_LAYERS` | Enabled layers (comma list) | `L1,L2,L3,L4` |
| `Allternit_THRESH_WARN` | Warn threshold | `0.70` |
| `Allternit_THRESH_COMPACT` | Compact threshold | `0.85` |
| `Allternit_THRESH_HANDOFF` | Handoff threshold | `0.92` |

## Migration from Old Structure

```bash
# One-time migration script
#!/bin/bash

# Old → New mappings
mkdir -p L1-COGNITIVE/brain/batons
mkdir -p L1-COGNITIVE/memory/checkpoints
mkdir -p L1-COGNITIVE/memory/usage
mkdir -p L2-IDENTITY
mkdir -p L3-GOVERNANCE
mkdir -p L4-SKILLS/skills
mkdir -p L5-BUSINESS/crm L5-BUSINESS/projects L5-BUSINESS/content

# Move files
mv config.json manifest.json
mv receipts/receipt.jsonl L1-COGNITIVE/memory/memory.jsonl
mv state/state.json L1-COGNITIVE/brain/state.json
mv handoff/latest.md L1-COGNITIVE/memory/handoff.md
mv compact/*.md L1-COGNITIVE/brain/batons/
mv conventions.json L2-IDENTITY/CONVENTIONS.md  # Convert format
mv tasks/dag.json L1-COGNITIVE/brain/taskgraph.json
mv usage/*.json L1-COGNITIVE/memory/usage/
mv evidence/* L5-BUSINESS/content/evidence/
mv checkpoints/*.json L1-COGNITIVE/memory/checkpoints/

# Create new layer files
touch L1-COGNITIVE/BRAIN.md
touch L1-COGNITIVE/memory/MEMORY.md
touch L2-IDENTITY/IDENTITY.md
touch L2-IDENTITY/POLICY.md
touch L2-IDENTITY/SOUL.md
touch L2-IDENTITY/USER.md
touch L2-IDENTITY/VOICE.md
touch L3-GOVERNANCE/PLAYBOOK.md
touch L3-GOVERNANCE/TOOLS.md
touch L3-GOVERNANCE/HEARTBEAT.md
touch L4-SKILLS/INDEX.md

# Cleanup old dirs
rmdir receipts state handoff compact tasks usage evidence checkpoints index 2>/dev/null
```

## Summary

The 5-layer architecture consolidates files into a logical hierarchy:

- **L1-COGNITIVE**: Brain (task graph) + Memory (logs, handoffs)
- **L2-IDENTITY**: Who the agent is, conventions, values
- **L3-GOVERNANCE**: Rules, playbooks, tools
- **L4-SKILLS**: Available capabilities
- **L5-BUSINESS**: Client/project context

This structure mirrors the kernel architecture and enables deterministic rehydration at context boundaries.
