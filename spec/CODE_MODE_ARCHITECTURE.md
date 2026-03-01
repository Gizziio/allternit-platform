# A2R Code Mode — Architecture

Generated: 2026-02-26
Status: DRAFT v1.0

---

## Layer Model

```
┌─────────────────────────────────────────────────────┐
│  Layer 6: UI Surfaces (ShellUI)                     │
│  Tabs: Chat | Code | Agents | Terminal | Diff | Mgr │
├─────────────────────────────────────────────────────┤
│  Layer 5: Mode Control                              │
│  SAFE | DEFAULT | AUTO | PLAN                       │
├─────────────────────────────────────────────────────┤
│  Layer 4: Multi-Session Isolation                   │
│  Worktree per session | Sandbox fallback            │
├─────────────────────────────────────────────────────┤
│  Layer 3: Execution Kernel (Runner)                 │
│  Shell | Test | Build | Git | Scoped Permissions    │
├─────────────────────────────────────────────────────┤
│  Layer 2: Patch System                              │
│  ChangeSet | Diff | Dry Run | Approve/Reject/Edit   │
├─────────────────────────────────────────────────────┤
│  Layer 1: Context Engine                            │
│  Context Pack | Repo Summarizer | Retrieval Adapter  │
├─────────────────────────────────────────────────────┤
│  Foundation: Rails (Control Plane)                  │
│  Sessions | Policies | Receipts | ChangeSets | DAG   │
└─────────────────────────────────────────────────────┘
```

---

## Layer 1 — Context Engine

**Purpose**: Build deterministic, scoped context for the model.

Components:
- **Context Pack Builder**: Generates file tree, key file contents, symbol index
- **Repo Summarizer**: Produces CODEBASE.md-style summary on demand
- **Retrieval Adapter**: Pulls relevant code chunks based on task description
- **Scope**: Per-session. Each session has its own context pack

Inputs:
- Workspace root path
- Session task description / user query
- CODEBASE.md as retrieval anchor

Outputs:
- Context pack JSON (file list, contents, metadata)
- Stored at `.a2r/sessions/<session_id>/context_pack.json`

---

## Layer 2 — Patch System

**Purpose**: All edits flow through structured patches. No direct file writes.

### ChangeSet Lifecycle

```
Agent proposes edits
        │
        ▼
  ┌──────────┐
  │ PROPOSED │ ──→ UI renders diff
  └────┬─────┘
       │ User action
       ▼
  ┌──────────┐     ┌──────────┐     ┌──────────────┐
  │ APPROVED │     │ REJECTED │     │ REVISION_REQ │
  └────┬─────┘     └──────────┘     └──────┬───────┘
       │                                    │
       ▼                                    ▼
  ┌──────────┐                     Agent revises →
  │ APPLIED  │                     new ChangeSet
  └────┬─────┘
       │ (if needed)
       ▼
  ┌──────────┐
  │ REVERTED │
  └──────────┘
```

### Determinism Rules
- ChangeSet references specific base commit + file hashes
- Apply rejected if file hashes diverge (stale patch)
- Every apply emits: patch hash, touched files, before/after hashes
- Receipts stored in Rails

### Diff Rendering
- Unified diff format
- Hunk navigation (per-file, per-hunk)
- Inline comments (for revision requests)
- "Open in editor at file:line"

---

## Layer 3 — Execution Kernel (Runner)

**Purpose**: Only component allowed to touch the filesystem and execute commands.

### Runner Capabilities
| Tool | Purpose | Risk Tier |
|---|---|---|
| fs.read | Read file contents | READ |
| fs.list | List directory | READ |
| fs.write | Write file (via approved ChangeSet) | WRITE |
| shell.run | Execute shell command | EXECUTE |
| git.status | Git status/branch/log | READ |
| git.commit | Git commit | WRITE |
| git.push | Git push | NETWORK |
| deps.install | Install dependencies | EXECUTE + NETWORK |
| test.run | Run test suite | EXECUTE |
| build.run | Run build | EXECUTE |
| lint.run | Run linter | EXECUTE |

### Enforcement
- Runner sends proposed action → Rails
- Rails evaluates policy → issues `approval_token` or blocks
- Runner executes only if token present
- Runner writes receipt back to Rails with token reference
- **No backdoor path**: Runner has no way to bypass Rails

### Runner Constraints
- Deterministic where possible (same inputs → same plan hash)
- Policy-gated (no tool call bypass)
- Receipt-emitting (every action logged)
- Scoped to session worktree/sandbox (never touches primary workspace)

---

## Layer 4 — Multi-Session Isolation

**Purpose**: Parallel sessions cannot interfere with each other.

### Strategy A: Git Worktree (Default)

```
repo/                          ← primary workspace (untouched)
  .a2r/
    worktrees/
      sess_001/                ← branch: a2r/sess_001
      sess_002/                ← branch: a2r/sess_002
      sess_003/                ← branch: a2r/sess_003
```

- Shares git object DB (fast, space-efficient)
- Each session = isolated branch + directory
- Natural PR flow for merge-back
- Worktree registry in Rails tracks lifecycle

### Strategy B: Sandbox Copy (Fallback)

```
repo/
  .a2r/
    sandboxes/
      sess_004/                ← full copy of workspace
```

- Used for non-git repos, airgap experiments
- Merge-back via ChangeSet patch apply
- Storage heavy; not default

### Session Registry (Rails)
```json
{
  "session_id": "sess_001",
  "workspace_id": "ws_abc",
  "isolation": "worktree",
  "branch": "a2r/sess_001",
  "worktree_path": ".a2r/worktrees/sess_001",
  "mode": "DEFAULT",
  "state": "EXECUTING",
  "policy_profile_id": "pol_default",
  "created_at": "2026-02-26T20:00:00Z",
  "events": ["evt_001", "evt_002"]
}
```

---

## Layer 5 — Mode Control

**Purpose**: Permission defaults per execution stance.

### Mode → Policy Mapping

```
SAFE mode:
  fs.read    → ALLOW
  fs.write   → DENY
  shell.*    → DENY
  git.push   → DENY
  *          → DENY

DEFAULT mode:
  fs.read    → ALLOW
  fs.write   → ASK
  shell.run  → ASK
  git.commit → ASK
  git.push   → ASK
  deps.*     → ASK
  *          → DENY

AUTO mode:
  fs.read           → ALLOW
  fs.write (in ws)   → ALLOW
  shell.run (test)   → ALLOW
  shell.run (lint)   → ALLOW
  git.commit         → ALLOW
  deps.install       → ASK
  git.push           → ASK
  network.*          → ASK
  destructive.*      → DENY

PLAN mode:
  [all actions DENY until plan approved]
  [on approval → transitions to DEFAULT or AUTO]
```

### Mode Transitions
- User can change mode at any time via UI or API
- Mode change logged as event in Rails
- Active permissions recalculated immediately

---

## Layer 6 — UI Surfaces (ShellUI)

### Top Navigation
```
[ Chat ] [ Code ] [ Agents ] [ Terminal ] [ Artifacts ] [ Audit ]
```

### Code Mode Layout
```
┌──────────────┬─────────────────────────────┬──────────────┐
│  LEFT RAIL   │      CENTER PANE            │  RIGHT PANE  │
│              │                             │              │
│ ▸ Workspace  │  Agent message stream       │ Current Plan │
│   picker     │                             │              │
│   repo chip  │  [ChangeSet diff block]     │ Active Rules │
│              │  ┌─────────────────────┐    │              │
│ ▸ Sessions   │  │ src/ui/Shell.tsx    │    │ Files touched│
│   sess_001 ● │  │ +14 / -3 lines     │    │              │
│   sess_002 ○ │  │ [View Diff]        │    │ Pending      │
│   sess_003 ◐ │  │ [Apply] [Reject]   │    │ approvals    │
│              │  └─────────────────────┘    │              │
│ ▸ Views      │                             │ Context pack │
│   Diff Review│  [Action approval block]    │ summary      │
│   File Tree  │  ┌─────────────────────┐    │              │
│   Tests      │  │ ⚡ pnpm test        │    │ Receipt IDs  │
│   PR Monitor │  │ Risk: EXECUTE       │    │              │
│              │  │ [Allow] [Deny]      │    │              │
│              │  └─────────────────────┘    │              │
└──────────────┴─────────────────────────────┴──────────────┘
```

### Session Status Chips
- `●` running
- `○` idle
- `◐` awaiting approval
- `✗` failed
- `✓` done

### Diff Review View
Three layers:
1. **Proposed** — not applied yet (yellow)
2. **Applied** — written to disk (green)
3. **Reverted** — rolled back (red)

Controls:
- File list with changed line counts
- Per-file unified diff viewer
- Apply All / Apply Selected / Reject
- Inline comment → revision request
- "Open in editor at file:line"

---

## Data Flow: End-to-End Plan → Execute

```
User enters Code Mode
        │
        ▼
Select workspace → Create session → Worktree created
        │
        ▼
Set mode (PLAN recommended for first use)
        │
        ▼
Agent builds context pack → Generates Plan artifact
        │
        ▼
UI renders Plan as editable checklist
        │
        ▼
User approves Plan → State: EXECUTING
        │
        ▼
For each step:
  Agent proposes action → Rails evaluates policy
        │
    ┌───┴───┐
    │       │
  ALLOW    ASK → UI shows approval dialog
    │       │
    ▼       ▼ (approved)
  Runner executes → Receipt emitted
        │
        ▼
Agent proposes ChangeSet → UI shows Diff Review
        │
    ┌───┴───┐
    │       │
  Apply   Reject/Revise → comment → new ChangeSet
    │
    ▼
Atomic apply → Verify (tests/lint) → Receipt
        │
        ▼
Session DONE → branch ready for merge
```

---

## Integration Points with Existing A2R

| A2R Component | Code Mode Integration |
|---|---|
| WIH / Beads | Session creates WIH with code-mode-specific tool allowlist and write_scope |
| DAG Scheduler | Multi-step plans become DAG nodes; dependencies = step ordering |
| Tool Registry | Code mode tools registered in `/spec/Contracts/ToolRegistry.schema.json` |
| Receipt System | All actions emit receipts per existing `Receipt.schema.json` |
| Policy Engine | Mode system maps to policy profiles evaluated by existing engine |
| Gateway | UI ↔ Rails ↔ Runner communication via gateway routes |
| Memory System | Context packs interact with memory layers per WIH declaration |
