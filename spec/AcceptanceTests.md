# /spec/AcceptanceTests.md — Executable Truth (v0)

Generated: 2026-01-27

These acceptance tests are platform-level gates. Every major change must reference one or more test IDs.

## AT-BOOT — Deterministic boot

- **AT-BOOT-0001**: Kernel refuses to start if `/SOT.md` missing.
- **AT-BOOT-0002**: Kernel refuses to start if `CODEBASE.md` missing.
- **AT-BOOT-0003**: Kernel refuses to start if `/spec/Contracts/WIH.schema.json` missing.
- **AT-BOOT-0004**: Kernel prints the loaded boot manifest (hashes of law files) into `/.a2r/boot/boot_manifest.json`.
- **AT-BOOT-0005**: Kernel refuses to start if `/spec/AcceptanceTests.md` missing.
- **AT-BOOT-0006**: Kernel refuses to start if `/spec/Contracts/Graph.schema.json` missing.
- **AT-BOOT-0007**: Kernel refuses to start if `/.a2r/graphs/` or `/.a2r/wih/` missing.
- **AT-BOOT-0008**: Kernel refuses to start if `/spec/Contracts/ToolRegistry.schema.json` missing.
- **AT-BOOT-0009**: Runtime/CI fails if `spec/1_contracts/` is referenced as canonical input.
- **AT-BOOT-0010**: CODEBASE generator output must match `CODEBASE.md`.
- **AT-BOOT-0011**: Kernel refuses to start if `/agent/POLICY.md` missing.
- **AT-BOOT-0012**: Instances must validate against their canonical JSON Schemas (graphs/WIH/tool registry).
- **AT-BOOT-0013**: WIH must include a valid Beads envelope (via schema composition).
- **AT-BOOT-0014**: Boot manifest validates against `/spec/Contracts/BootManifest.schema.json`.
- **AT-BOOT-0015**: Boot manifest path is consistent between kernel writer and validator.
- **AT-BOOT-0016**: Offline law bootstrap (`scripts/law_setup.sh`) passes.

## AT-WIH — WIH/Beads enforcement

- **AT-WIH-0001**: Task dispatch denied if WIH missing.
- **AT-WIH-0002**: Task dispatch denied if WIH invalid against schema.
- **AT-WIH-0003**: Any tool call denied if task state != RUNNING.

## AT-BEADS — Beads/WIH integrity

- **AT-BEADS-0001**: All WIH/Beads files validate against `/spec/Contracts/WIH.schema.json`.
- **AT-BEADS-0002**: Every graph node has a corresponding WIH/Beads file.
- **AT-BEADS-0003**: WIH/Beads declares non-empty tool allowlist and write_scope.
- **AT-BEADS-0004**: WIH/Beads tool allowlist entries exist in tool registry.

## AT-LAW — Canonical law enforcement

- **AT-LAW-0004**: `spec/Contracts/` is canonical; `spec/1_contracts/` is non-authoritative for runtime/CI.
- **AT-LAW-0005**: Gateway registry must not contain hardcoded ports to prevent port sprawl.

## AT-TASK — DAG + resume

- **AT-TASK-0001**: `blockedBy` prevents scheduling until dependency receipts exist.
- **AT-TASK-0002**: `/install <graph_id>` creates `/.a2r/run_state/<run_id>.json` with correct initial statuses.
- **AT-TASK-0003**: `/resume <run_id>` produces deterministic next-node selection given identical receipts/state.
- **AT-TASK-0004**: Node cannot be `SUCCEEDED` without a node receipt under `/.a2r/receipts/<run_id>/`.
- **AT-TASK-0005**: Beads blocked_by mismatch with graph/WIH hard-fails.

## AT-PROC — Subprocess workers

- **AT-PROC-0001**: Worker registry is required and validates against `/spec/Contracts/WorkerRegistry.schema.json`.
- **AT-PROC-0002**: Subprocess execution denied when worker_id is not allowlisted.
- **AT-PROC-0003**: Allowlisted worker execution emits a subprocess receipt under `/.a2r/receipts/<run_id>/`.
- **AT-PROC-0004**: Subprocess receipts include worker_id, argv, cwd, env_allowlist, exit_code, stdout/stderr hashes, and previews.

## AT-EXEC — Execution Runtime

- **AT-EXEC-0001**: Unified runner requires valid run_id, task_id, and wih_id.
- **AT-EXEC-0002**: Execution emits execution receipt under `/.a2r/receipts/<run_id>/`.
- **AT-EXEC-0003**: Execution respects write_scope constraints.
- **AT-EXEC-0004**: Execution honors memory promotion gates.

## AT-IO — Output law and write scopes

- **AT-IO-0001**: Any write outside `/.a2r/` is denied.
- **AT-IO-0002**: Any write outside WIH declared globs is denied.
- **AT-IO-0003**: Writes to `/.a2r/wih/**`, `/.a2r/graphs/**`, `/.a2r/spec/**`, or `/.a2r/receipts/<other_run>/**` are denied.

## AT-TOOLS — Tool registry + safety

- **AT-TOOLS-0001**: Tool must exist in tool registry to be callable.
- **AT-TOOLS-0002**: Tool call denied if tool safety level exceeds WIH allowance.
- **AT-TOOLS-0003**: PreToolUse hook runs before every tool call and can deny.
- **AT-TOOLS-0004**: Tool registry file validates against `/spec/Contracts/ToolRegistry.schema.json`.
- **AT-TOOLS-0005**: WIH tool allowlist entries must exist in tool registry (validation gate).

## AT-RECEIPT — Receipts as proofs

- **AT-RECEIPT-0001**: Every tool call writes a receipt under `/.a2r/receipts/<run_id>/`.
- **AT-RECEIPT-0002**: Receipts validate against `/spec/Contracts/Receipt.schema.json`.

## AT-SEC — Security gates

- **AT-SEC-0001**: Kernel auth bypass list for core endpoints is forbidden.
- **AT-SEC-0002**: Python exec surface is disabled or gated behind ToolRegistry + WIH + approval.

## AT-MEM — Layered memory + promotion

- **AT-MEM-0001**: Memory access requires WIH-declared pack/layer.
- **AT-MEM-0002**: Session writes cannot mutate law memory.
- **AT-MEM-0003**: Proposals written to `/.a2r/proposals/` only.
- **AT-MEM-0004**: Deterministic auto-approve promotion requires rules + checks; promotion creates diff + receipt.
- **AT-MEM-0005**: Memory candidate must be validated against schema before approval.
- **AT-MEM-0006**: Memory promotion receipts must be emitted for all promotions.
- **AT-MEM-0007**: Memory rollback functionality must be available for promoted candidates.
- **AT-MEM-0008**: Memory retention policies must be enforced per layer.

## AT-NET — Gateway law

- **AT-NET-0001**: UI/CLI only talks to Gateway endpoint.
- **AT-NET-0002**: Internal services are not externally reachable.
- **AT-NET-0003**: Service addressing is name-based; ports are centralized in generated config.
- **AT-NET-0004**: Single ingress endpoint enforced; port sprawl is forbidden.
- **AT-NET-0101**: Gateway registry is required and validates against `/spec/Contracts/GatewayRegistry.schema.json`.
- **AT-NET-0102**: Gateway registry must define exactly one external ingress.
- **AT-NET-0103**: Gateway routes must reference registered services.
- **AT-GW-0001**: Registry runtime load gate.
- **AT-GW-0002**: Reject direct internal routing.
- **AT-GW-0003**: Routing receipt emitted.

## AT-CLI — CLI Module Runtime

- **AT-CLI-0001**: CLI modules must be registered in cli/cli_registry.json.
- **AT-CLI-0002**: CLI execution requires valid worker_id from worker registry.
- **AT-CLI-0003**: CLI execution emits CLIRunReceipt under `/.a2r/receipts/<run_id>/`.
- **AT-CLI-0004**: CLI modules must respect fs_policy and write_scope constraints.

## AT-CAP — Capsules / MCP Apps

- **AT-CAP-0001**: MCP apps render in a sandboxed capsule host.
- **AT-CAP-0002**: Capsule→tool calls include WIH identifiers and pass tool registry.
- **AT-CAP-0003**: Capsule sandbox denies filesystem/network beyond WIH scope.
- **AT-CAP-0004**: Browser capsule emits receipts + artifact manifest.
- **AT-CAP-0005**: Capsule actions requiring approvals must be gated by explicit user consent.
- **AT-CAP-0006**: Capsule registry is required and validates against `/spec/Contracts/CapsuleRegistry.schema.json`.
- **AT-CAP-0007**: Capsule permission manifest enforces allowed tools/network/fs.
- **AT-CAP-0008**: Capsule receipt emitted for actions.
- **AT-CAP-0009**: Capsule definition validates against `/spec/Contracts/CapsuleDefinition.schema.json`.
- **AT-CAP-0010**: Capsule runtime enforces execution constraints per WIH.

## AT-UI — UI Runtime Wiring

- **AT-UI-0001**: UI registry is required and validates against `/spec/Contracts/UIRegistry.schema.json`.
- **AT-UI-0002**: UI actions must reference registered gateway routes only.
- **AT-UI-0003**: UI actions emit receipts under `/.a2r/receipts/<run_id>/`.
- **AT-UI-0004**: UI cannot call tools directly, only through gateway.
- **AT-UI-0005**: UI registry validates against `/spec/Contracts/UIAction.schema.json`.
- **AT-UI-0006**: UI navigation structure validates against `/spec/Contracts/UINav.schema.json`.
- **AT-UI-0007**: UI workspace layout validates against `/spec/Contracts/UIWorkspaceLayout.schema.json`.
- **AT-UI-0008**: UI must implement proper authentication flow.
- **AT-UI-0009**: UI must enforce authorization checks per route.
- **AT-UI-0010**: UI must maintain session state securely.

## AT-FOR — Forensics Export Contract

- **AT-FOR-0001**: Run forensics export generates complete artifact set.
- **AT-FOR-0002**: Replay from forensics preserves deterministic execution order.
- **AT-FOR-0003**: Receipt chain integrity maintained during forensics export/replay.
- **AT-FOR-0004**: Provenance timeline accurately reflects execution sequence.

## AT-AGENT — Agent Execution Contract

- **AT-AGENT-0001**: Agent execution requires run_id, task_id, and wih_id.
- **AT-AGENT-0002**: Agent execution emits AgentExecutionReceipt under `/.a2r/receipts/<run_id>/`.
- **AT-AGENT-0003**: Agent profile must exist in agent registry.
- **AT-AGENT-0004**: Agent execution respects memory pack access controls.

## AT-CODE — Code Mode

### AT-CODE-SESS — Session Lifecycle

- **AT-CODE-SESS-0001**: User must select a workspace before creating a Code session.
- **AT-CODE-SESS-0002**: Session creation produces a valid `CodeSession` object per `/spec/Contracts/CodeSession.schema.json`.
- **AT-CODE-SESS-0003**: Session with `isolation: worktree` creates a git worktree at `.a2r/worktrees/<session_id>` on branch `a2r/<session_id>`.
- **AT-CODE-SESS-0004**: Session with `isolation: sandbox` copies workspace to `.a2r/sandboxes/<session_id>`.
- **AT-CODE-SESS-0005**: Session termination cleans up worktree/sandbox directory.
- **AT-CODE-SESS-0006**: Worktree registry in Rails tracks all active sessions.
- **AT-CODE-SESS-0007**: Three or more sessions can run in parallel without file conflicts.
- **AT-CODE-SESS-0008**: Runner cannot edit files outside the session's worktree/sandbox path.

### AT-CODE-CS — ChangeSet (Diff-First Editing)

- **AT-CODE-CS-0001**: Agent file writes produce a ChangeSet, never direct file modifications.
- **AT-CODE-CS-0002**: ChangeSet validates against `/spec/Contracts/ChangeSet.schema.json`.
- **AT-CODE-CS-0003**: ChangeSet references specific base commit + file hashes.
- **AT-CODE-CS-0004**: Apply is rejected if file hashes diverge from base (stale patch).
- **AT-CODE-CS-0005**: Apply requires Rails-issued `approval_token`.
- **AT-CODE-CS-0006**: Apply is atomic: all diffs apply or none do (when `atomic: true`).
- **AT-CODE-CS-0007**: Every apply emits receipt: patch hash, touched files, before/after hashes, command outputs.
- **AT-CODE-CS-0008**: Reverted ChangeSet restores files to pre-apply state.
- **AT-CODE-CS-0009**: Comment-on-diff produces `changeset_revision_N` scoped to comment context.

### AT-CODE-POL — Permission Gating

- **AT-CODE-POL-0001**: Policy profile validates against `/spec/Contracts/PolicyProfile.schema.json`.
- **AT-CODE-POL-0002**: Every tool call is evaluated against policy rules before execution.
- **AT-CODE-POL-0003**: ALLOW rules permit execution without user prompt.
- **AT-CODE-POL-0004**: ASK rules require explicit user approval before execution.
- **AT-CODE-POL-0005**: DENY rules block execution unconditionally.
- **AT-CODE-POL-0006**: Runner cannot execute without Rails-issued approval token (no backdoor path).
- **AT-CODE-POL-0007**: Policy overrides at session level take priority over workspace and global defaults.

### AT-CODE-MODE — Mode System

- **AT-CODE-MODE-0001**: SAFE mode denies all writes, shell, network, and destructive actions.
- **AT-CODE-MODE-0002**: DEFAULT mode allows reads, asks on writes/shell/git.
- **AT-CODE-MODE-0003**: AUTO mode allows writes in workspace and test/lint execution without prompt.
- **AT-CODE-MODE-0004**: PLAN mode denies all actions until plan is approved.
- **AT-CODE-MODE-0005**: Mode change is logged as event in Rails.
- **AT-CODE-MODE-0006**: Active permissions recalculate immediately on mode change.

### AT-CODE-PLAN — Plan → Execute Pipeline

- **AT-CODE-PLAN-0001**: Plan artifact validates against `/spec/Contracts/CodePlan.schema.json`.
- **AT-CODE-PLAN-0002**: Plan is rendered as editable checklist in UI.
- **AT-CODE-PLAN-0003**: Plan approval transitions session state from PLAN_READY to EXECUTING.
- **AT-CODE-PLAN-0004**: Plan rejection keeps session in PLAN_READY; agent can revise.
- **AT-CODE-PLAN-0005**: Each plan step tracks status (pending/running/completed/failed/skipped).
- **AT-CODE-PLAN-0006**: Plan includes rollback strategy.

### AT-CODE-STATE — Session State Machine

- **AT-CODE-STATE-0001**: Session states follow: IDLE → PLANNING → PLAN_READY → EXECUTING → AWAITING_APPROVAL → CHANGESET_READY → APPLYING → VERIFYING → DONE/FAILED/TERMINATED.
- **AT-CODE-STATE-0002**: All state transitions are logged in Rails event log.
- **AT-CODE-STATE-0003**: Invalid state transitions are rejected.
- **AT-CODE-STATE-0004**: Session in FAILED state preserves all receipts and changesets for forensics.

### AT-CODE-ENV — Environment Awareness

- **AT-CODE-ENV-0001**: Runner reports git status (branch, dirty, ahead/behind) for workspace.
- **AT-CODE-ENV-0002**: Runner can invoke and parse test results.
- **AT-CODE-ENV-0003**: Runner can invoke and parse build results.
- **AT-CODE-ENV-0004**: Runner can invoke and parse linter results.

### AT-CODE-MERGE — Merge-Back

- **AT-CODE-MERGE-0001**: Worktree session can merge branch into main via PR flow.
- **AT-CODE-MERGE-0002**: Sandbox session can merge via ChangeSet patch apply through Diff Review.
- **AT-CODE-MERGE-0003**: Merge events are logged in Rails.
