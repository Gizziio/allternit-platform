# A2R Code Mode — Vision

Generated: 2026-02-26
Status: DRAFT v1.0

---

## What Code Mode Is

A2R Code Mode is a **controlled agent runtime wrapped in a review-driven UI with strict execution boundaries**.

It is NOT "chat that edits files."
It is NOT an IDE.
It is NOT VS Code inline suggestions.

It is a **supervised, deterministic, multi-session execution environment** where agents propose changes, humans approve them, and every action is receipted into Rails.

---

## Strategic Position

| System | Architecture Class |
|---|---|
| Claude Code Desktop | Single-agent controlled code harness |
| OpenAI Codex App | Multi-agent orchestrated control surface |
| **A2R Code Mode** | **Deterministic multi-agent execution kernel + visual swarm control plane** |

A2R is a superset. It does not choose between single-agent and multi-agent. It unifies both under WIH enforcement, DAG scheduling, and Rails receipting.

---

## Core Principle

**LLM → Patch Generator → Diff Viewer → Approval Gate → Atomic Apply → Receipt**

No file is written without:
1. A proposed ChangeSet
2. Policy evaluation
3. User or auto-approval (per mode)
4. An immutable receipt in Rails

---

## Architecture Primitives

### 1. Workspace
A directory (repo) the user selects. Context is scoped per session, not global.

### 2. Session
An isolated unit of agentic work. Each session gets its own worktree or sandbox, its own branch, its own policy profile.

### 3. ChangeSet
A proposed patch bundle. Structured diffs with file hashes, hunks, and verification steps. Never applied without approval.

### 4. Action
A tool invocation requiring permission gating: read, write, shell, install, network, git, destructive.

### 5. Mode
Execution stance controlling permission defaults:
- **SAFE** — read-only
- **DEFAULT** — ask on write/exec
- **AUTO** — allow common actions within bounds
- **PLAN** — think first, propose strategy, execute after approval

### 6. Receipt
Immutable proof of every action. Stored in Rails. References approval tokens, file hashes, stdout/stderr, duration.

---

## What Already Exists in A2R

| Capability | Status |
|---|---|
| WIH / Beads enforcement | Built |
| DAG scheduling | Built |
| Rails vs Runner separation | Designed |
| Policy engine (law layer) | Designed |
| Evidence / receipt logging | Built |
| Swarm scheduling | Designed |
| Tool contract layer | Built |
| ShellUI layout | Partially built (needs stabilization) |
| Patch / diff flow | Not built |
| Session isolation | Not built |
| Permission gating (visual) | Not built |
| Plan → Execute pipeline | Not wired |

---

## Build Order

1. Stabilize ShellUI layout (left rail, tabs, chat input)
2. Implement session isolation with worktrees
3. Implement ChangeSet contract + diff renderer + apply gating
4. Implement policy gating (allow/ask/deny) non-bypassable
5. Wire PLAN → EXECUTE state machine
6. Add editor bridging + comment-on-diff loop

---

## Non-Goals (v1)

- Building a full IDE editor inside A2R (use editor bridge)
- Remote dev environments / multi-machine sync
- Background tasks without UI open
- Replacing existing CI/CD systems
