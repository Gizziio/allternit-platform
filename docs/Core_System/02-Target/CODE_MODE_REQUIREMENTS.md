# Allternit Code Mode — Requirements

Generated: 2026-02-26
Status: DRAFT v1.0

---

## REQ-CM — Code Mode Requirements

### REQ-CM-001: Workspace Binding
User must select a workspace (directory/repo) before entering Code Mode.
- Workspace metadata stored: root path, git status, branch, dirty state
- Context pack built on session creation (file tree, key files, symbols)
- Context scoped per session, not global

### REQ-CM-002: Session Creation
Each coding session is an isolated execution environment.
- Session has: session_id, workspace_id, isolation strategy, branch, mode, policy profile
- Multiple sessions can run in parallel on the same workspace
- Sessions cannot interfere with each other's file state

### REQ-CM-003: Session Isolation — Worktree (Default)
- Create branch `allternit/<session_id>` from current HEAD
- Create worktree at `.allternit/worktrees/<session_id>`
- All session edits occur only in worktree directory
- Runner must never edit primary worktree unless explicitly allowed
- Worktree registry maintained in Rails
- Automatic cleanup on session termination

### REQ-CM-004: Session Isolation — Sandbox (Fallback)
- Copy workspace into `.allternit/sandboxes/<session_id>`
- Used for non-git folders, high-risk experiments, or user-requested airgap
- Merge-back via patch apply through Diff Review

### REQ-CM-005: Diff-First Editing
Agent never writes files directly. Agent proposes a ChangeSet.
- ChangeSet contains: structured diffs, file hashes (before/after), hunks, metadata
- ChangeSet references a specific base commit + file hashes
- Apply rejected if file hashes diverge (unless user chooses rebase)
- Three diff states: Proposed, Applied, Reverted

### REQ-CM-006: ChangeSet Approval
- UI shows unified diff with hunk navigation
- User can: Apply All, Apply Selected, Reject, Request Modifications
- "Request Modifications" attaches comment → agent revises → produces changeset_revision_N
- Apply requires explicit approval token from Rails
- Every apply emits receipt: patch hash, touched files, before/after hashes, command outputs

### REQ-CM-007: Permission Gating
Actions evaluated against policy rules: (tool, args, path, command, risk tier).
- Three outcomes: ALLOW (no prompt), ASK (user prompt required), DENY (block)
- Risk tiers: READ, WRITE, EXECUTE, NETWORK, DESTRUCTIVE
- Policy sources: global defaults, per-workspace overrides, per-session overrides
- Runner cannot execute without Rails-issued approval token
- Non-bypassable: Runner has no backdoor path

### REQ-CM-008: Mode System
Four modes controlling permission defaults:

| Mode | Reads | Writes | Shell | Network | Destructive |
|---|---|---|---|---|---|
| SAFE | ALLOW | DENY | DENY | DENY | DENY |
| DEFAULT | ALLOW | ASK | ASK | ASK | DENY |
| AUTO | ALLOW | ALLOW (in workspace) | ALLOW (tests/lint) | ASK | DENY |
| PLAN | ALLOW | DENY until plan approved | DENY until plan approved | DENY | DENY |

### REQ-CM-009: Plan Mode
- Agent produces structured Plan artifact (goal, files, steps, tools, risk, verification, rollback)
- Plan rendered as editable checklist in UI
- User approves/edits plan
- On approval, session transitions to DEFAULT or AUTO for execution
- Plan artifact stored in Rails

### REQ-CM-010: Plan → Execute State Machine
Session states:
1. IDLE → 2. PLANNING → 3. PLAN_READY → 4. EXECUTING → 5. AWAITING_APPROVAL → 6. CHANGESET_READY → 7. APPLYING → 8. VERIFYING → 9. DONE / 10. FAILED / 11. TERMINATED

All transitions explicit and logged.

### REQ-CM-011: Receipt Enforcement
- Every tool call writes a receipt under `/.allternit/receipts/<run_id>/`
- Receipts include: tool_call, stdout, stderr, duration, file hashes, approval token reference
- Receipts validate against `/spec/Contracts/Receipt.schema.json`
- Runner cannot write without Rails receipt token (cryptographic/architectural enforcement)

### REQ-CM-012: Environment Awareness
Runner must have adapters for:
- Git status, branch, uncommitted changes
- Test runner (invoke and parse results)
- Build system (invoke and parse results)
- Linter (invoke and parse results)
- Environment fingerprint (node version, rust version, etc.)

### REQ-CM-013: Merge-Back
Two paths from isolated env → main:
- **PR merge** (worktree): session commits → user merges branch → Rails logs merge event
- **Patch apply** (sandbox): Runner generates ChangeSet → user applies via Diff Review → Rails logs apply + verification

### REQ-CM-014: Editor Bridge
- "Open in editor" action for any file at specific line
- Supported: VS Code, JetBrains (via URI scheme)
- Not required to build an editor inside Allternit

### REQ-CM-015: Comment-on-Diff Loop
- User can attach comment to any hunk in a ChangeSet
- Comment becomes constrained model input for patch revision
- Agent produces `changeset_revision_N` scoped to comment context
- Prevents full rewrite churn; keeps edits controlled

---

## Rails API Requirements

### REQ-API-001: Session API
- `POST /sessions` — create (workspace_id, mode, isolation)
- `GET /sessions/:id` — get session state
- `POST /sessions/:id/terminate` — terminate session
- `POST /sessions/:id/mode` — change mode (SAFE/DEFAULT/AUTO/PLAN)

### REQ-API-002: ChangeSet API
- `POST /changesets` — create (session_id, patch_bundle, metadata)
- `POST /changesets/:id/approve` — approve
- `POST /changesets/:id/reject` — reject
- `POST /changesets/:id/apply` — atomic apply
- `POST /changesets/:id/revert` — revert applied changeset

### REQ-API-003: Policy API
- `GET /policies/:profile_id` — get policy rules
- `POST /policies/:profile_id/rules` — add/update rules
- `POST /sessions/:id/policy/override` — session-level override

### REQ-API-004: Receipt API
- `POST /receipts` — emit receipt (tool_call, stdout, stderr, duration, hashes, file list)
- `GET /receipts?session_id=...` — query receipts by session

### REQ-API-005: Plan API
- `POST /plans` — store plan artifact (session_id, plan_object)
- `POST /plans/:id/approve` — approve plan
- `POST /plans/:id/reject` — reject plan
- `GET /plans/:id` — get plan with status
