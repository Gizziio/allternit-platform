# Allternit Platform - .allternit Directory Specification

Complete specification for the `.allternit/` workspace directory - files, structure, lifecycle, and boot order.

## Overview

The `.allternit/` directory is the heart of the Allternit (Agent-to-Agent Runtime) platform. It maintains session state, receipts, handoffs, conventions, and evidence across tool invocations.

```
workspace/
├── .allternit/                          # Allternit platform directory
│   ├── README.md                  # Human-readable overview
│   ├── config.json                # Platform configuration
│   ├── 
│   ├── receipts/                  # Append-only activity log
│   │   └── receipt.jsonl          # Tool call receipts
│   ├── state/                     # Current DAG node state
│   │   └── state.json             # Session state snapshot
│   ├── handoff/                   # Handoff pointers
│   │   └── latest.md              # Symlink to current baton
│   ├── compact/                   # Compaction batons
│   │   ├── compact-20260224-001.md
│   │   └── compact-20260224-002.md
│   ├── usage/                     # Usage snapshots
│   │   ├── usage-2026-02-24T10-00-00.json
│   │   └── usage-2026-02-24T11-00-00.json
│   ├── conventions.json           # Project conventions
│   ├── tasks/                     # DAG task definitions
│   │   └── dag.json               # Task graph
│   ├── evidence/                  # Evidence artifacts
│   │   ├── diffs/                 # Diff references
│   │   └── screenshots/           # Visual evidence
│   ├── checkpoints/               # Session checkpoints
│   │   └── checkpoint-001.json
│   └── index/                     # Search indexes
│       └── files.idx
├── src/                           # Source code
└── ...
```

## File Reference

### Core Files (Required)

#### 1. `config.json`
**Purpose**: Platform configuration  
**Created**: On first tool invocation  
**Updated**: Rarely (manual config changes)  
**Format**: JSON

```json
{
  "version": "1.0.0",
  "platform": {
    "name": "allternit-shell",
    "version": "1.2.3"
  },
  "workspace": {
    "root": "/path/to/workspace",
    "created_at": 1704067200000
  },
  "session": {
    "session_id": "sess-uuid",
    "runner": "opencode",
    "started_at": 1704067200000
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
    "ci_gates_enabled": true
  }
}
```

---

#### 2. `receipts/receipt.jsonl`
**Purpose**: Append-only log of all tool activities  
**Created**: On first tool call  
**Updated**: Every tool call (append)  
**Format**: JSON Lines (JSONL)  
**Retention**: Never deleted (audit trail)

```jsonl
{"ts":1704067200000,"run_id":"run-001","dag_node_id":"node-001","tool":"bash","kind":"call","args_redacted":{"command":"npm test"},"result_summary":"Tests passed: 45","status":"ok","duration_ms":2340,"files_touched":[{"path":"test/output.log","action":"created"}],"diff_refs":[],"correlation_id":"corr-abc-123"}
{"ts":1704067205000,"run_id":"run-001","dag_node_id":"node-002","tool":"Write","kind":"call","args_redacted":{"file":"src/index.ts"},"result_summary":"Wrote 45 lines","status":"ok","duration_ms":120,"files_touched":[{"path":"src/index.ts","action":"modified"}],"diff_refs":["src/index.ts:1:45"],"correlation_id":"corr-abc-124"}
```

**Schema**: See `spec/Contracts/Receipt.schema.json`

---

#### 3. `state/state.json`
**Purpose**: Current DAG node state and outputs  
**Created**: On first tool call  
**Updated**: Every state transition  
**Format**: JSON

```json
{
  "dag": {
    "current_node_id": "node-042",
    "root_node_id": "node-001",
    "depth": 42,
    "branch_factor": 1.3
  },
  "outputs": {
    "node-042": {
      "tool": "bash",
      "status": "ok",
      "output_preview": "Build successful...",
      "completed_at": 1704070800000
    }
  },
  "context": {
    "last_files_viewed": ["src/index.ts", "package.json"],
    "last_commands_run": ["npm run build"],
    "active_edits": []
  },
  "updated_at": 1704070800000
}
```

---

#### 4. `handoff/latest.md`
**Purpose**: Pointer to current handoff baton  
**Created**: On first compaction/handoff  
**Updated**: Every handoff  
**Format**: Markdown

```markdown
# Allternit Handoff Pointer

Generated: 2026-02-24T10:00:00.000Z

## Current Baton

.allternit/compact/compact-20260224-001.md

## Metadata

- workspace: /home/user/project
- handoff_count: 5
- last_compact_reason: threshold
```

---

### Generated Files

#### 5. `compact/compact-*.md`
**Purpose**: Compaction batons with full context  
**Created**: On compaction (manual, threshold, or error)  
**Updated**: Never (immutable)  
**Format**: Markdown  
**Naming**: `compact-{YYYYMMDD}-{NNN}.md`

Contains 13 sections:
1. Objective
2. Current Plan
3. Work Completed
4. Files Changed
5. Commands Executed
6. Errors / Blockers
7. Decisions Made
8. Open TODOs
9. DAG Tasks
10. Next Actions
11. Allternit Conventions
12. Evidence Pointers
13. Limits Snapshot

---

#### 6. `usage/usage-*.json`
**Purpose**: Usage snapshots for tracking  
**Created**: Periodically or on significant events  
**Updated**: Never (immutable)  
**Format**: JSON  
**Naming**: `usage-{ISO-TIMESTAMP}.json`

```json
{
  "timestamp": 1704070800000,
  "session_id": "sess-abc-123",
  "usage": {
    "tokens": { "input": 15000, "output": 5000, "total": 20000 },
    "context_ratio": 0.75,
    "quota_ratio": 0.50,
    "cost": { "total": 0.05, "currency": "USD" }
  },
  "model": "claude-sonnet-4-20250514",
  "trigger": "threshold_check"
}
```

---

### Optional Files

#### 7. `conventions.json`
**Purpose**: Project conventions and standards  
**Created**: Manually or inferred  
**Updated**: Manually  
**Format**: JSON

```json
{
  "file_naming": {
    "pattern": "kebab-case",
    "examples": ["my-util.ts", "auth-service.ts"]
  },
  "code_style": {
    "formatter": "prettier",
    "linter": "eslint",
    "rules_url": "./eslint.config.js"
  },
  "directory_structure": {
    "root_dirs": ["src", "test", "docs"],
    "patterns": ["src/**/*.ts", "test/**/*.test.ts"]
  },
  "testing": {
    "framework": "vitest",
    "pattern": "**/*.test.ts",
    "coverage_threshold": 80
  },
  "git_workflow": {
    "branching_strategy": "git-flow",
    "commit_convention": "conventional-commits",
    "pr_template": ".github/pull_request_template.md"
  },
  "architecture": {
    "pattern": "layered",
    "patterns_used": ["Repository", "Service", "Factory"],
    "forbidden_patterns": ["God objects", "Global mutable state"]
  },
  "review_checklist": [
    "Tests pass locally",
    "Documentation updated",
    "No console.log statements",
    "Breaking changes documented"
  ]
}
```

---

#### 8. `tasks/dag.json`
**Purpose**: DAG task definitions and graph  
**Created**: When tasks are defined  
**Updated**: On task status changes  
**Format**: JSON

```json
{
  "version": "1.0.0",
  "tasks": [
    {
      "id": "setup",
      "name": "Project Setup",
      "description": "Initialize project structure",
      "status": "completed",
      "dependencies": [],
      "priority": "high",
      "blocking": false,
      "estimated_tokens": 5000,
      "actual_tokens": 4500,
      "assigned_to": "opencode"
    },
    {
      "id": "implement",
      "name": "Core Implementation",
      "description": "Build core features",
      "status": "in_progress",
      "dependencies": ["setup"],
      "priority": "critical",
      "blocking": true,
      "estimated_tokens": 15000,
      "actual_tokens": 8000,
      "assigned_to": "opencode"
    }
  ],
  "edges": [
    { "from": "setup", "to": "implement" }
  ],
  "critical_path": ["setup", "implement"]
}
```

---

#### 9. `evidence/diffs/*.diff`
**Purpose**: Diff references for evidence  
**Created**: On file modifications  
**Updated**: Never (immutable)  
**Format**: Unified diff

---

#### 10. `checkpoints/checkpoint-*.json`
**Purpose**: Session checkpoints for rollback  
**Created**: On explicit checkpoint or auto-checkpoint  
**Updated**: Never (immutable)  
**Format**: JSON  
**Naming**: `checkpoint-{NNN}.json`

```json
{
  "checkpoint_id": "checkpoint-005",
  "created_at": 1704070800000,
  "session_id": "sess-abc-123",
  "receipt_offset": 150,
  "state_hash": "abc123def456",
  "files_snapshot": ["src/index.ts", "package.json"],
  "description": "Before major refactor"
}
```

---

#### 11. `index/files.idx`
**Purpose**: File index for quick search  
**Created**: On first file operation  
**Updated**: Periodically  
**Format**: Binary/Proprietary

---

## Boot Order

When a tool starts in a workspace, the `.allternit/` directory is initialized in this order:

### Phase 1: Directory Structure (Pre-flight)
```
Step 1: Create .allternit/ directory
Step 2: Create subdirectories:
        - receipts/
        - state/
        - handoff/
        - compact/
        - usage/
        - evidence/
        - evidence/diffs/
        - checkpoints/
        - index/
```

### Phase 2: Core Files (Initialization)
```
Step 3: Write config.json
        - Generate session_id
        - Record workspace path
        - Set thresholds from defaults/env
        
Step 4: Write receipts/receipt.jsonl
        - Create empty file
        
Step 5: Write state/state.json
        - Initialize DAG root
        - Set current_node_id
```

### Phase 3: Optional Files (Discovery)
```
Step 6: Check for conventions.json
        - If exists: validate and load
        - If not: infer from project structure
        
Step 7: Check for tasks/dag.json
        - If exists: load task graph
        - If not: create empty task list
        
Step 8: Check for existing handoff
        - Read handoff/latest.md
        - If points to valid baton: offer resume
```

### Phase 4: Runtime (Operational)
```
Step 9: Start receipt appending
Step 10: Update state on transitions
Step 11: Monitor thresholds
Step 12: Trigger compaction when needed
```

## Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BOOT SEQUENCE                             │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  Tool Start  │
    └──────┬───────┘
           │
           ▼
    ┌────────────────────────────────────────────────────┐
    │  Phase 1: Directory Structure                      │
    │  • Create .allternit/ and all subdirectories             │
    └──────┬─────────────────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────────────────┐
    │  Phase 2: Core Files                               │
    │  • config.json (new session ID)                    │
    │  • receipts/receipt.jsonl (empty)                  │
    │  • state/state.json (initial DAG)                  │
    └──────┬─────────────────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────────────────┐
    │  Phase 3: Optional Files                           │
    │  • conventions.json (load or infer)                │
    │  • tasks/dag.json (load or empty)                  │
    │  • handoff/latest.md (check for resume)            │
    └──────┬─────────────────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────────────────┐
    │  Phase 4: Runtime                                  │
    │  • Start accepting tool calls                      │
    │  • Append to receipts                              │
    │  • Update state                                    │
    │  • Monitor thresholds                              │
    └──────┬─────────────────────────────────────────────┘
           │
           ▼
    ┌────────────────────────────────────────────────────┐
    │  Running Session                                   │
    └────────────────────────────────────────────────────┘
```

## Handoff/Resume Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      HANDOFF SEQUENCE                            │
└─────────────────────────────────────────────────────────────────┘

Session A (Source Tool)
    │
    │  1. Threshold reached
    ▼
    ┌─────────────────────────┐
    │ Extract Context         │
    │ - Objective             │
    │ - Decisions             │
    │ - Files Changed         │
    │ - DAG Tasks             │
    │ - Conventions           │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Emit Baton              │
    │ - compact-*.md          │
    │ - JSON for machines     │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Run CI Gates            │
    │ - Evidence Gate         │
    │ - No-Lazy Gate          │
    │ - Resume Gate           │
    └──────────┬──────────────┘
               │
               │  2. Update handoff/latest.md
               ▼
    ┌─────────────────────────┐
    │ Update Handoff Pointer  │
    │ Point to new baton      │
    └──────────┬──────────────┘
               │
               │  3. Exit / Notify
               ▼
Session B (Target Tool)
    │
    │  4. Start in workspace
    ▼
    ┌─────────────────────────┐
    │ Check handoff/latest.md │
    │ - Read baton pointer    │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Validate Baton          │
    │ - Check existence       │
    │ - Verify workspace      │
    │ - Check actionable      │
    └──────────┬──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │ Resume Session          │
    │ - Load context          │
    │ - Present baton         │
    │ - Continue work         │
    └─────────────────────────┘
```

## File Permissions

| File/Directory | Permissions | Owner | Notes |
|----------------|-------------|-------|-------|
| `.allternit/` | 755 | User | Group readable |
| `config.json` | 644 | User | Contains session secrets |
| `receipts/` | 755 | User | Append-only semantics |
| `receipt.jsonl` | 644 | User | Never modify, only append |
| `state/` | 755 | User | |
| `state.json` | 644 | User | Frequent updates |
| `compact/` | 755 | User | Immutable files |
| `handoff/` | 755 | User | |
| `latest.md` | 644 | User | Updated on handoff |

## Cleanup Policy

| Location | Retention | Cleanup Trigger |
|----------|-----------|-----------------|
| `receipts/receipt.jsonl` | Forever | Never |
| `compact/*.md` | 90 days | Daily cron / manual |
| `usage/*.json` | 30 days | Daily cron / manual |
| `checkpoints/*.json` | 10 most recent | On new checkpoint |
| `evidence/diffs/*.diff` | With baton | With baton cleanup |
| `index/*.idx` | Rebuildable | As needed |

## Migration

When upgrading Allternit platform versions:

1. **Backup** existing `.allternit/` directory
2. **Read** existing `config.json` version
3. **Migrate** schema if needed:
   - Update config.json format
   - Migrate state.json if DAG format changed
   - Rebuild indexes if index format changed
4. **Write** new `config.json` with updated version
5. **Resume** normal operation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `Allternit_ENABLED` | Enable Allternit platform | `true` |
| `Allternit_DIR` | Custom .allternit location | `.allternit` |
| `Allternit_THRESH_WARN` | Warn threshold | `0.70` |
| `Allternit_THRESH_COMPACT` | Compact threshold | `0.85` |
| `Allternit_THRESH_HANDOFF` | Handoff threshold | `0.92` |
| `Allternit_GATES_STRICT` | Strict CI gates | `false` |
| `Allternit_TELEMETRY` | Enable telemetry | `true` |
| `Allternit_RETENTION_DAYS` | File retention | `90` |

## Schema Versions

| Component | Current Version | Schema File |
|-----------|-----------------|-------------|
| config.json | 1.0.0 | `spec/Schemas/Config.schema.json` |
| receipt.jsonl | 1.0.0 | `spec/Schemas/Receipt.schema.json` |
| state.json | 1.0.0 | `spec/Schemas/State.schema.json` |
| baton.md | 1.0.0 | `spec/Schemas/Baton.schema.json` |
| conventions.json | 1.0.0 | `spec/Schemas/Conventions.schema.json` |
| dag.json | 1.0.0 | `spec/Schemas/DAG.schema.json` |
