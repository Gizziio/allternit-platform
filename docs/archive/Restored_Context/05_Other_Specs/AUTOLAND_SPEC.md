# Specification: Allternit Autoland Protocol

**Version:** 1.1.0  
**Status:** Implemented & Production Ready  
**Scope:** Autonomous Implementation Runs & Safe Landing  

---

## 1. Overview

**Allternit Autoland** is a high-integrity protocol for landing code changes from isolated agent workspaces into the project root. It transforms the agent's role from a "line-by-line coder" to an "orchestrator of implementation runs." 

It provides:
1.  **Strict Isolation**: Changes are built and tested in a sandbox (`.allternit/runner/{wih_id}`).
2.  **Proof of Work**: Every action is recorded in a persistent, auditable log.
3.  **Deterministic Validation**: Landing is blocked unless a "Validator" agent issues a `PASS` status.
4.  **Autonomous Loop**: Optional "self-landing" capability when validation succeeds (files only).
5.  **Optional Git Integration**: User-controlled atomic commits with full audit trails.

---

## 2. Key Components

| Component | Location | Responsibility |
| :--- | :--- | :--- |
| **Autoland Gate** | `infrastructure/allternit-agent-system-rails/src/gate/gate.rs` | Atomic migration of files; optional git commit; status verification. |
| **Proof of Work Store** | `services/allternit-operator/src/main.py` | Persisting run events to `.allternit/autoland/{run_id}.jsonl`. |
| **Rollback System** | `infrastructure/allternit-agent-system-rails/src/gate/gate.rs` | Automatic backups in `.allternit/backups/` before any mutation. |
| **Autoland CLI** | `cmd/cli/src/commands/autoland.rs` | Landing, Rollback, and PoW inspection via `a2 autoland`. |

---

## 3. The Autoland Lifecycle

### Phase 1: Planning (The WIH)
A **WIH (Work Identity Handle)** is created with an optional `LoopPolicy`.
- **Policy Flag**: `autoland_on_pass: true` enables the autonomous loop.
- **Workspace**: A dedicated directory is allocated: `.allternit/runner/{wih_id}/`.

### Phase 2: Execution & Recording
The agent performs work exclusively within its workspace.
- **Recording**: The **Allternit Operator** captures all `stdout`, `stderr`, and tool results.
- **Persistence**: Events are appended to `.allternit/autoland/{run_id}.jsonl`. This is the **Proof of Work (PoW)**.

### Phase 3: Validation (The Ralph Loop)
The "Builder" agent hands off to a "Validator" agent.
- **Test Execution**: Tests are run within the workspace.
- **Closing**: The WIH is closed with a status (`PASS` or `FAIL`).

### Phase 4: The Landing Gate
Landing is the process of moving changes from the sandbox to the root.
- **Manual Landing**: Triggered via CLI: `a2 autoland land <wih_id>`.
- **Autonomous Landing**: Triggered automatically by the Gate service if `autoland_on_pass` is `true`. **Note**: This only moves files; it does not commit.
- **Atomic Mutation**: The Gate creates a backup in `.allternit/backups/` and then recursively copies files from the sandbox to the project root.
- **Git Commit (Optional)**: If the `--commit` flag is provided, the Gate performs a `git commit` with an automated audit message.

### Phase 5: Rollback (Safety Net)
If a landing introduces regressions, it can be reverted:
- **Command**: `a2 autoland rollback <wih_id>`.
- **Logic**: The Gate restores the project state using the latest backup for that WIH.

---

## 4. Usage Reference

### CLI Commands
```bash
# Land a completed implementation (files only)
a2 autoland land <wih_id>

# Land and commit to Git in one step
a2 autoland land <wih_id> --commit

# Shadow Land (Dry Run): See what would change without applying
a2 autoland land <wih_id> --dry-run

# Rollback a landing
a2 autoland rollback <wih_id>

# Inspect the "Proof of Work" recording for a run
a2 autoland pow <run_id>
```

---

**Maintainers:** allternit Platform Team  
**Last Updated:** March 8, 2026
