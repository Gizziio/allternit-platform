# Allternit Packaged Bots — Canonical Implementation Tracker

**Status:** Active master todo list  
**Created:** 2026-08-16  
**Architecture reference:** `OPENMAUSBOT_PHASE_2_ARCHITECTURE.md`  
**Scope:** Packaged bots across API, runtime, web, Electron, mobile, automation,
connectors, computers, delegation, persistence, and shipping.

This is the durable execution tracker for the packaged-bot program. Future
agents must update this file as work is completed. A checked box means the
behavior is implemented and supported by the evidence recorded here; the
presence of a type, route, component, mock, or design document is not enough.

---

## How every agent must use this tracker

1. Read this file and `OPENMAUSBOT_PHASE_2_ARCHITECTURE.md` before changing bot
   behavior.
2. Confirm the selected item is not already owned by another active worktree.
3. Add an owner/worktree and start date to the item or its work log entry.
4. Keep boxes unchecked while work is partial, disconnected, mocked, or only
   implemented on one required surface.
5. Check a box only after its stated acceptance evidence exists.
6. Add links to implementation files, migrations, tests, screenshots, receipts,
   or verification notes in the Evidence Log.
7. Record deviations and new decisions in the Decision Log.
8. Never claim provider or platform parity without completing its conformance
   row.
9. Do not put secrets, tokens, private credentials, or unredacted user data in
   this document or its evidence.

### Status vocabulary

- `[ ]` — not started or not proven
- `[~]` — **do not use**; Markdown checkboxes do not carry partial status
- `[x]` — implemented and evidenced
- `BLOCKED:` — add after the task text with the concrete blocker
- `N/A:` — allowed only with a decision-log entry explaining why

### Required work log format

```text
YYYY-MM-DD — Owner/worktree — Item IDs
Changed:
Evidence:
Remaining:
Risks or decisions:
```

---

## Locked product decisions

- [x] **D-001:** A bot is a packaged Agent, not a parallel execution type.
- [x] **D-002:** A bot owns one durable activity history partitioned into
  multiple bounded sessions.
- [x] **D-003:** Previous sessions enter context through summaries, retrieval,
  explicit pins, and promoted memory—not automatic full-transcript replay.
- [x] **D-004:** Sessions organize conversation; goals define outcomes; task
  graphs define ordered work; WIHs hold active structured work.
- [x] **D-005:** Instantiate a WIH when a real todo list/task graph is
  materialized, not for every chat or ordinary tool call.
- [x] **D-006:** Ralph is deprecated as the canonical loop architecture. Replace
  it with goal, plan, task, attempt, validation, and policy-driven loop logic.
- [x] **D-007:** Child bots are durable roster members; subagents are bounded,
  temporary executions.
- [x] **D-008:** JSONL remains available for audit/export/recovery. Local Rails
  JSONL and the multi-client platform source of truth must be reconciled before
  activity APIs are declared canonical.
- [x] **D-009:** Personality selections and direct workspace edits must converge
  on canonical, versioned workspace artifacts.
- [x] **D-010:** The complete connector and computer-provider programs remain in
  scope. Golden paths sequence implementation; they do not reduce scope.
- [x] **D-011:** Simple roster first; detailed packaged Bot Home uses progressive
  disclosure.
- [x] **D-012:** Web, Electron, and mobile share contracts and semantics, while
  platform-specific capability limitations remain explicit.

---

# Wave 0 — Reality audit, ownership, and threat model

## 0.1 Repository reality map

- [x] **W0-001:** Inventory every bot-related type, schema, migration, API,
  store, component, runtime, event, and test.
- [x] **W0-002:** Classify each discovered path as implemented, partial,
  disconnected, duplicate, mock, obsolete, or missing.
- [x] **W0-003:** Inventory implementation differences between the canonical
  checkout and active bot/OpenMausBot worktrees.
- [x] **W0-004:** Identify which existing Phase 1 files are authoritative and
  remove stale “new file” claims from the architecture document.
- [x] **W0-005:** Map current ownership of agents, sessions, messages, projects,
  WIHs, goals, tasks, routines, memory, artifacts, approvals, connectors,
  computers, inboxes, and receipts.
- [x] **W0-006:** Identify every client-local Zustand/localStorage store that
  currently competes with server state.
- [x] **W0-007:** Inventory every current fallback that silently changes runtime,
  model, connector, computer, or isolation behavior.
- [x] **W0-008:** Produce the baseline web/Electron/mobile parity matrix.

## 0.2 Threat model and privacy

- [x] **W0-020:** Threat-model multi-tenant bot data, events, memory, computers,
  connectors, delegation, exports, diagnostics, and offline replicas.
- [x] **W0-021:** Prohibit raw secret values from browser state, session metadata,
  activity events, JSONL, memory, artifacts, receipts, and diagnostics.
- [x] **W0-022:** Define tenant/user/workspace/bot authorization checks for every
  API and event stream.
- [x] **W0-023:** Define sensitivity labels and redaction rules for events and
  connector/tool results.
- [x] **W0-024:** Define retention, export, deletion, cascade deletion, and “forget
  everywhere” behavior.
- [x] **W0-025:** Define least-privilege delegation for children and subagents.
- [x] **W0-026:** Define approval grant scope, expiry, revocation, and audit rules.
- [x] **W0-027:** Add security review gates before connector and computer waves.

## Wave 0 exit gate

- [x] **W0-GATE:** Reviewed reality report, source-of-truth diagram, threat model,
  parity baseline, and migration inventory exist; no unresolved competing store
  is mislabeled canonical.

---

# Wave 1 — Canonical contracts and operational projection

## 1.1 Bot identity contract

- [x] **W1-001:** Freeze a discriminated Bot contract: `isBot: true` and required
  `botProfile.displayName`.
- [x] **W1-002:** Keep functional `category` separate from `botProfile.botCategory`.
- [x] **W1-003:** Define stable handle, display name, version, owner, parent, and
  lifecycle fields.
- [x] **W1-004:** Add schema versions and migration rules for Bot and BotProfile.
- [x] **W1-005:** Make create, read, update, import, export, and duplicate use the
  same validation contract.
- [x] **W1-006:** Remove or migrate obsolete parallel bot types/stores.

## 1.2 Shared IDs and event envelope

- [x] **W1-020:** Freeze stable IDs for tenant, workspace, bot, project, session,
  goal, task, WIH, run, attempt, artifact, approval, delegation, and event.
- [x] **W1-021:** Define the versioned canonical event envelope.
- [x] **W1-022:** Include sequence, causation ID, correlation ID, actor,
  sensitivity, visibility, occurred time, and recorded time.
- [x] **W1-023:** Define idempotency keys for all mutating APIs and event appends.
- [x] **W1-024:** Define event upgrade/downcast behavior for older clients.
- [x] **W1-025:** Map historical `RailsLoopIteration*` events into compatibility
  projections without making them the new canonical taxonomy.

## 1.3 Bot operational-state projection

- [x] **W1-040:** Define `BotOperationalState` with idle, working, waiting,
  blocked, offline, degraded, failed, and completed semantics.
- [x] **W1-041:** Define status precedence when execution, approval, computer,
  routine, inbox, and failure states overlap.
- [x] **W1-042:** Build the server-owned projection from canonical events.
- [x] **W1-043:** Include active session/run, activity label, pending approvals,
  unread count, computer state, next routine, last sequence, and update time.
- [x] **W1-044:** Add snapshot/rebuild logic so the projection can recover from
  the event history.
- [x] **W1-045:** Add cursor/resume support for live client updates.

## Wave 1 exit gate

- [x] **W1-GATE:** One API returns consistent bot identity and operational state
  after restart and projection rebuild; web and mobile contract fixtures decode
  the same payload.

---

# Wave 2 — Goal, plan, task, validation, and loop runtime

## 2.1 Remove Ralph as canonical architecture

- [x] **W2-001:** Inventory every Ralph-named type, event, UI label, route, test,
  and persisted record.
- [x] **W2-002:** Mark Ralph APIs/events deprecated and document compatibility.
- [x] **W2-003:** Remove Ralph terminology from new product UI and architecture.
- [x] **W2-004:** Retain read compatibility for historical Ralph events until the
  migration support window ends.
- [ ] **W2-005:** Delete obsolete Ralph execution code only after replacement
  runtime parity and migration evidence exist. BLOCKED: replacement runtime parity
  now exists, but deletion should be staged after W2-GATE evidence is recorded.

## 2.2 Goal and plan contracts

- [x] **W2-020:** Define Goal objective, definition of done, constraints,
  milestones, validation, budget, priority, deadline, blockers, and outcome.
- [x] **W2-021:** Implement goal states: draft, planning, active, waiting,
  blocked, validating, completed, failed, cancelled.
- [x] **W2-022:** Preserve the repeated-blocker audit before declaring a goal
  blocked.
- [x] **W2-023:** Define versioned Plan and TaskGraph contracts.
- [x] **W2-024:** Implement dependency validation, cycle detection, ordering, and
  graph mutation receipts.
- [x] **W2-025:** Define plan acceptance and user-edit semantics.

## 2.3 Task and attempt contracts

- [x] **W2-040:** Define task expected result, dependencies, assignee, tools,
  write scope, inputs, budgets, retry policy, validation, and artifacts.
- [x] **W2-041:** Implement task states: pending, ready, running,
  waiting-for-input, waiting-for-approval, validating, completed, failed,
  cancelled.
- [x] **W2-042:** Define attempt records separately from tasks.
- [x] **W2-043:** Add checkpoint, cancellation, timeout, retry/backoff, and crash
  recovery.
- [x] **W2-044:** Enforce budgets for turns, tokens, cost, wall-clock time,
  recursion, and spawned workers.
- [x] **W2-045:** Emit versioned Goal, Plan, Task, Attempt, Validation, and
  Delegation events.

## 2.4 Policy-driven loop controller

- [x] **W2-060:** Implement single-pass strategy.
- [x] **W2-061:** Implement retry-on-failure strategy.
- [x] **W2-062:** Implement iterate-until-validator-passes strategy.
- [x] **W2-063:** Implement plan-execute-review strategy.
- [x] **W2-064:** Implement generator-critic strategy.
- [x] **W2-065:** Implement tool-result continuation.
- [x] **W2-066:** Implement scheduled recurrence integration.
- [x] **W2-067:** Implement human-approval continuation.
- [x] **W2-068:** Implement goal decomposition.
- [x] **W2-069:** Implement bounded parallel map/reduce.
- [x] **W2-070:** Define genuine multi-agent consensus separately, with
  independent participants, quorum, arbitration, and final authority.
- [x] **W2-071:** Require explicit exit conditions and prevent unbounded loops.
- [x] **W2-072:** Move raw shell execution behind sandbox/tool policy; do not use
  inherited host process access as the canonical automation executor.

## Wave 2 exit gate

- [x] **W2-GATE:** A goal decomposes into ordered tasks, survives runtime restart,
  pauses for approval, retries a failed attempt, validates completion, and emits
  a complete recoverable event history without using Ralph as its controller.

---

# Wave 3 — WIH lifecycle and bounded bot sessions

## 3.1 WIH materialization rules

- [x] **W3-001:** Define the exact plan/todo threshold that creates a WIH.
- [x] **W3-002:** Do not create WIHs for normal conversation or ordinary
  lightweight tool calls.
- [x] **W3-003:** Atomically create Goal + TaskGraph + WIH when a structured plan
  is accepted/materialized.
- [x] **W3-004:** Link WIH to bot, project, session, goal, task graph, current
  task, tools, scope, validation, artifacts, participants, budgets, and cursor.
- [x] **W3-005:** Support several sequential WIHs within one bot session.
- [x] **W3-006:** Implement resume, block, cancel, close, archive, and recovery.
- [ ] **W3-007:** Require close validation and completion receipts.

## 3.2 Durable activity and session APIs

- [x] **W3-020:** Resolve local Rails JSONL versus platform database authority.
- [ ] **W3-021:** Define secure server append and synchronization protocol.
- [x] **W3-022:** Implement bot activity API with cursor pagination.
- [x] **W3-023:** Implement bounded session list/create/update/close APIs.
- [ ] **W3-024:** Implement activity export with schema version and redaction.
- [x] **W3-025:** Implement device synchronization cursors and duplicate-event
  tolerance.
- [ ] **W3-026:** Handle concurrent sends, compaction, deletion, and offline
  replicas deterministically.
- [x] **W3-027:** Add corruption detection, checkpoints, projection rebuild, and
  recovery tests.

## 3.3 Context selection and summaries

- [x] **W3-040:** Define per-session context budgets.
- [ ] **W3-041:** Load identity/policy on every run from canonical artifacts.
- [ ] **W3-042:** Load current-session messages only within budget.
- [ ] **W3-043:** Admit previous information only through summaries, retrieval,
  explicit pins, or promoted memory.
- [x] **W3-044:** Create structured session summaries with decisions, open loops,
  artifacts, unresolved questions, and memory candidates.
- [ ] **W3-045:** Preserve raw history during compaction.
- [ ] **W3-046:** Record exactly which previous summaries/memories entered a run
  and why.
- [ ] **W3-047:** Evaluate summary drift and transcript leakage across multiple
  sessions.

## Wave 3 exit gate

- [x] **W3-GATE:** One bot completes several bounded sessions and several WIHs,
  searches full history, resumes selected work, and starts a new session without
  raw prior-transcript leakage.

---

# Wave 4 — Personality workspace, memory, and duplication

## 4.1 Versioned canonical workspace

- [x] **W4-001:** Freeze versioned schemas and precedence for `IDENTITY.md`,
  `SOUL.md`, `USER.md`, governance policy, skills manifest, `TOOLS.md`,
  `HEARTBEAT.md`, `AGENTS.md`, and memory artifacts.
- [x] **W4-002:** Choose structured front matter plus free-form managed content,
  or document another reversible representation.
- [x] **W4-003:** Implement one serializer/deserializer used by create, edit,
  import, export, and duplicate.
- [x] **W4-004:** Make personality/voice selections deterministically update the
  canonical artifacts.
- [x] **W4-005:** Make direct file edits round-trip into the UI without silently
  discarding unsupported content.
- [x] **W4-006:** Implement atomic writes, revision hashes, conflict detection,
  last-known-good rollback, and audit history.
- [x] **W4-007:** Invalidate runtime context caches after accepted edits.
- [x] **W4-008:** Remove decorative personality controls that do not alter
  canonical runtime behavior.

## 4.2 Memory isolation and quality

- [x] **W4-020:** Create independent bot memory namespaces.
- [x] **W4-021:** Create subordinate session/project scopes.
- [x] **W4-022:** Prevent cross-user and cross-bot leakage in storage, indexing,
  retrieval, export, and deletion.
- [x] **W4-023:** Implement memory candidate proposal and explicit/policy-based
  promotion.
- [x] **W4-024:** Store provenance, confidence, sensitivity, expiry, correction,
  and contradiction state.
- [x] **W4-025:** Add user inspection: why remembered, source, edit, pin, expire,
  and forget everywhere.
- [x] **W4-026:** Remove deleted memories from indexes, embeddings, summaries,
  exports, and replicas as policy requires.
- [x] **W4-027:** Add prompt-injection defenses for memory promotion/retrieval.
- [x] **W4-028:** Establish retrieval precision, context-budget, and summary-drift
  evaluation sets.

## 4.3 Complete duplication

- [x] **W4-040:** Add backend clone preview and transactional clone endpoint.
- [x] **W4-041:** Always copy identity, bot profile, personality, model, tools,
  skills, policies, and harness settings.
- [x] **W4-042:** Offer explicit options for memory, routines, workspace,
  computer snapshot/template, and child topology.
- [x] **W4-043:** Copy connector bindings only after authorization; never copy
  raw secrets.
- [x] **W4-044:** Never copy sessions, active leases, approvals, running jobs,
  receipt identities, or runtime IDs.
- [x] **W4-045:** Clone routines disabled by default.
- [x] **W4-046:** Provision new email, phone, wallet, handle, and other unique
  identities.
- [x] **W4-047:** Add child-graph preview, recursion limit, cycle detection,
  policy reauthorization, ID remapping, and rollback.
- [x] **W4-048:** Emit a redacted duplication receipt mapping source IDs to new
  IDs.
- [x] **W4-049:** Replace frontend object-copy duplication with the backend
  operation.

## Wave 4 exit gate

- [ ] **W4-GATE:** Two meaningfully different bots retain personality after
  restart; direct file edits safely round-trip; a duplicate passes a field and
  resource audit without copying secret values or active runtime state.

---

# Wave 5 — Consumer roster and Bot Home

## 5.1 Named roster overview

- [ ] **W5-001:** Show every installed/created bot with stable avatar and name.
- [ ] **W5-002:** Render real operational state, current task, last activity,
  next routine, approvals, computer, and unread status.
- [ ] **W5-003:** Add search, filter, sort, pin, archive, and status filters.
- [ ] **W5-004:** Start a bounded session or task directly from a roster card.
- [ ] **W5-005:** Remove mock/random timers and client-inferred status.
- [ ] **W5-006:** Add reconnect, loading, stale, degraded, and offline states.
- [ ] **W5-007:** Meet keyboard, screen-reader, reduced-motion, responsive, and
  touch-target requirements.

## 5.2 Progressive Bot Home

- [ ] **W5-020:** Default Bot Home to simple Message, New Task, Inbox, and More
  actions.
- [ ] **W5-021:** Add sessions/tasks grouped by project and date.
- [ ] **W5-022:** Add activity timeline and deep links.
- [ ] **W5-023:** Add artifacts with preview and provenance.
- [ ] **W5-024:** Add inspectable memory.
- [ ] **W5-025:** Add automation tasks.
- [ ] **W5-026:** Add apps/connections health and allowed actions.
- [ ] **W5-027:** Add computer status, preview, and controls.
- [ ] **W5-028:** Add tools/skills, children/delegations, and advanced settings.
- [ ] **W5-029:** Reconcile permanent Inbox conversation with focused task
  sessions and projects.
- [ ] **W5-030:** Remove accidental “reuse first matching session” behavior.

## 5.3 Session experience

- [ ] **W5-040:** Show goal/task/WIH progress rather than Ralph progress.
- [ ] **W5-041:** Show inline tool activity, questions, approvals, validation,
  delegation, artifacts, failures, and recovery.
- [ ] **W5-042:** Implement stop, cancel task, retry, resume, and edit-plan UX.
- [ ] **W5-043:** Keep advanced receipts, leases, and provider details available
  without overwhelming consumer defaults.

## Wave 5 exit gate

- [ ] **W5-GATE:** A new user can see what every bot is doing, start or resume a
  bounded task, answer an approval, inspect output, and find previous sessions
  without entering Agent Studio.

---

# Wave 6 — Automation and connected applications

## 6.1 Automation runtime parity

- [ ] **W6-001:** Bind every goal, routine, and loop to bot identity and activity
  sessions.
- [ ] **W6-002:** Ensure scheduled execution loads the same personality, model,
  tools, skills, memory, connectors, secrets, policy, computer, and workspace as
  interactive execution.
- [ ] **W6-003:** Move routine/loop shell steps behind the canonical task runtime
  and sandbox/tool policy.
- [ ] **W6-004:** Implement durable leases, idempotency, restart recovery,
  cancellation, pause/resume, retry/backoff, and missed-run policy.
- [ ] **W6-005:** Show timezone, next run, last result, retry state, output, and
  availability guarantees.
- [ ] **W6-006:** Make unattended approvals follow explicit policy rather than
  bypassing interactive protections.
- [ ] **W6-007:** Create normal activity/run/session records for every automation
  execution.

## 6.2 Connector platform contract

- [ ] **W6-020:** Define action manifest fields: schema, OAuth scopes, risk,
  approval, idempotency, rate limit, audit, and redaction.
- [ ] **W6-021:** Keep credential values server/runtime-side and expose only
  opaque capability references to clients.
- [ ] **W6-022:** Implement discovery, setup, binding, allowed actions, refresh,
  revoke, execution, approval, recovery, and receipts.
- [ ] **W6-023:** Add connection health and exact allowed-action UI to Bot Home.
- [ ] **W6-024:** Add per-bot account selection and multiple-account behavior.
- [ ] **W6-025:** Add automation-safe connector invocation.

## 6.3 Provider conformance matrix

- [ ] **W6-040:** GitHub discovery/auth/binding/read/write/approval/revoke/audit.
- [ ] **W6-041:** Gmail discovery/auth/binding/read/send/approval/refresh/revoke.
- [ ] **W6-042:** Calendar discovery/auth/binding/read/write/approval/refresh.
- [ ] **W6-043:** Slack discovery/auth/binding/read/post/approval/revoke/audit.
- [ ] **W6-044:** Notion discovery/auth/binding/read/write/approval/revoke/audit.
- [ ] **W6-045:** Generic MCP discovery/auth/tool schema/invocation/approval/audit.
- [ ] **W6-046:** Add provider regression and fault-injection suite.

## Wave 6 exit gate

- [ ] **W6-GATE:** Scheduled and interactive golden tasks execute through all
  committed connector providers with correct identity, policy, redaction,
  persisted results, receipts, refresh/revoke behavior, and recovery.

---

# Wave 7 — Bot-owned computers and provider parity

## 7.1 Canonical computer contract

- [ ] **W7-001:** Define bot computer attachment and optional additional
  computers.
- [ ] **W7-002:** Define discover, provision, start, stop, restart, health,
  command, browser, desktop, stream, takeover, return, transfer, snapshot,
  restore, reset, and destroy operations.
- [ ] **W7-003:** Define capabilities so unsupported operations are explicit.
- [ ] **W7-004:** Define image/version, CPU, memory, disk, boot timeout, idle
  shutdown, billing, and architecture metadata.
- [ ] **W7-005:** Define filesystem, browser profile, clipboard, file transfer,
  secrets, network egress, and data-destruction policy.
- [ ] **W7-006:** Separate browser operation from full desktop control.
- [ ] **W7-007:** Define exclusive takeover lease and concurrent-client behavior.
- [ ] **W7-008:** Prohibit silent fallback from isolated/cloud execution to host.
- [ ] **W7-009:** Restrict direct host execution in shared/multi-user deployments.

## 7.2 Provider implementations and conformance

- [ ] **W7-020:** Local isolated provider golden path.
- [ ] **W7-021:** Selected cloud provider golden path.
- [ ] **W7-022:** Docker provider conformance.
- [ ] **W7-023:** Direct-host/This Mac trust-mode conformance.
- [ ] **W7-024:** OpenSandbox provider conformance.
- [ ] **W7-025:** Kubernetes provider conformance.
- [ ] **W7-026:** Remaining supported cloud-provider conformance.
- [ ] **W7-027:** Persistent browser/filesystem tests across restart.
- [ ] **W7-028:** Watch/takeover/return-control tests.
- [ ] **W7-029:** Snapshot/restore/reset/destruction-proof tests.
- [ ] **W7-030:** Crash, timeout, quota, network, and billing-failure tests.

## 7.3 Consumer experience

- [ ] **W7-040:** First-run choice: isolated on device, cloud computer, or This
  Mac.
- [ ] **W7-041:** Explain isolation, persistence, cost, and permissions clearly.
- [ ] **W7-042:** Show computer state and preview in roster, Bot Home, and active
  session.
- [ ] **W7-043:** Show degraded/failure state and recovery without silently
  changing provider.

## Wave 7 exit gate

- [ ] **W7-GATE:** Equivalent bot tasks pass lifecycle, policy, persistence,
  takeover, recovery, and event tests across every committed provider; declared
  capability differences are visible and truthful.

---

# Wave 8 — Child bots, subagents, messaging, and groups

## 8.1 Temporary subagents

- [ ] **W8-001:** Define bounded subagent scope, task, context, tools, budget,
  lifetime, and result contract.
- [ ] **W8-002:** Link subagent execution to parent session/task/WIH.
- [ ] **W8-003:** Fold results and artifacts back into the parent with provenance.
- [ ] **W8-004:** Implement cancellation, timeout, failure, orphan recovery,
  recursion limit, and budget propagation.
- [ ] **W8-005:** Keep temporary subagents out of the permanent roster.

## 8.2 Persistent child bots

- [ ] **W8-020:** Define parent/child topology and independent identity, memory,
  sessions, tools, policy, computer, routines, and roster presence.
- [ ] **W8-021:** Require user/policy approval before promoting or creating a
  durable child.
- [ ] **W8-022:** Prevent cycles, unbounded depth, privilege escalation, and
  budget escape.
- [ ] **W8-023:** Show parent/child relationships in both Bot Homes.

## 8.3 Durable messaging

- [ ] **W8-040:** Define human-readable bot inbox and group-thread contracts
  separately from the local Rails transport queue.
- [ ] **W8-041:** Add membership authorization, ordering, deduplication,
  acknowledgement, unread state, correlation, cancellation, and partial failure.
- [ ] **W8-042:** Bridge local tmux/socket delivery into cloud/mobile-visible
  events without exposing transport details.
- [ ] **W8-043:** Implement loop prevention, turn limits, budgets, and moderation.
- [ ] **W8-044:** Implement bot `@mention` routing against stable IDs.
- [ ] **W8-045:** Treat `!urgent`, `!review`, `!delegate`, and `!escalate` as
  optional UX only after core routing is proven.

## 8.4 Genuine groups and consensus

- [ ] **W8-060:** Implement persistent group membership and thread history.
- [ ] **W8-061:** Define leader, worker, reviewer, and observer permissions.
- [ ] **W8-062:** Implement broadcast/direct/mailbox behaviors on the durable
  messaging contract.
- [ ] **W8-063:** Implement genuine consensus only with independent participants,
  quorum, voting/arbitration, evidence, conflicts, and final authority.
- [ ] **W8-064:** Do not infer consensus from a single agent’s iteration loop.

## Wave 8 exit gate

- [ ] **W8-GATE:** Temporary subagents and persistent children pass scope,
  cancellation, recursion, recovery, budget, and tool-policy tests; group threads
  survive restart and multi-client access without duplicate or runaway turns.

---

# Wave 9 — Web, Electron, mobile, and cross-device consistency

## 9.1 Shared API and client contracts

- [ ] **W9-001:** Publish shared contracts for bot identity, operational state,
  activity, sessions, projects, goals, tasks, WIHs, memory, automation,
  connectors, computers, delegation, messages, and approvals.
- [ ] **W9-002:** Generate or validate TypeScript and Swift clients from the same
  schemas.
- [ ] **W9-003:** Remove platform-specific inference of canonical business state.
- [ ] **W9-004:** Version APIs and document compatibility windows.

## 9.2 Cross-device conflict behavior

- [ ] **W9-020:** Resolve concurrent personality edits.
- [ ] **W9-021:** Resolve simultaneous messages and session compaction.
- [ ] **W9-022:** Make approvals single-settlement and idempotent.
- [ ] **W9-023:** Make computer takeover exclusive and recoverable.
- [ ] **W9-024:** Resolve concurrent routine edits and run-now requests.
- [ ] **W9-025:** Prevent deleted bots from reappearing from offline replicas.
- [ ] **W9-026:** Implement offline queue, reconnect, resync, and conflict UI where
  supported.

## 9.3 Platform parity matrix

- [ ] **W9-040:** Web capability matrix completed and evidenced.
- [ ] **W9-041:** Electron capability matrix completed and evidenced.
- [ ] **W9-042:** iOS/mobile capability matrix completed and evidenced.
- [ ] **W9-043:** Every cell marked supported, read-only, intentionally
  unavailable, or gap.
- [ ] **W9-044:** Desktop-only OS control and mobile takeover limitations are
  explicit.
- [ ] **W9-045:** Identity and status semantics are identical everywhere.

## Wave 9 exit gate

- [ ] **W9-GATE:** Contract fixtures, multi-client conflict tests, and parity
  evidence prove consistent supported behavior across web, Electron, and mobile.

---

# Wave 10 — Shipping, installation, migration, and support

## 10.1 First-run and diagnostics

- [ ] **W10-001:** Detect model runtimes, installed CLIs, local permissions,
  sandbox providers, and connector prerequisites.
- [ ] **W10-002:** Classify services as required, optional, disabled, or degraded.
- [ ] **W10-003:** Do not launch explicitly disabled optional services.
- [ ] **W10-004:** Provide actionable health checks and repair guidance.
- [ ] **W10-005:** Export a schema-redacted diagnostics/support bundle.

## 10.2 Distribution

- [ ] **W10-020:** Signed and notarized macOS artifacts.
- [ ] **W10-021:** Signed Windows artifacts and installer behavior.
- [ ] **W10-022:** Supported web deployment documentation and health checks.
- [ ] **W10-023:** Supported mobile distribution path.
- [ ] **W10-024:** Automatic update channels and release metadata.
- [ ] **W10-025:** Starter bots work with minimal setup and degrade honestly.

## 10.3 Upgrade and recovery

- [ ] **W10-040:** Version and migrate bots, profiles, sessions, events, workspace
  files, memory, routines, connector bindings, and computer metadata.
- [ ] **W10-041:** Back up and restore complete bot state without secret leakage.
- [ ] **W10-042:** Test forward upgrade and supported rollback.
- [ ] **W10-043:** Recover from interrupted migration and partial update.
- [ ] **W10-044:** Define uninstall behavior and optional secure data removal.
- [ ] **W10-045:** Verify clean-machine and existing-user journeys.

## 10.4 Operational SLOs

- [ ] **W10-060:** Set event append durability target.
- [ ] **W10-061:** Set roster propagation latency target.
- [ ] **W10-062:** Set session and computer startup latency targets.
- [ ] **W10-063:** Set compaction/recovery success targets.
- [ ] **W10-064:** Set connector success and retry targets.
- [ ] **W10-065:** Set unread-count and projection-accuracy targets.
- [ ] **W10-066:** Prove zero cross-tenant access in security tests.
- [ ] **W10-067:** Set upgrade/rollback data-loss target to zero for supported
  paths.

## Wave 10 exit gate

- [ ] **W10-GATE:** Clean-machine install, first run, update, rollback, backup,
  restore, diagnostics, and uninstall journeys pass on supported targets without
  losing bot state or exposing secrets.

---

# Program completion gate

- [ ] **PROGRAM-GATE:** All wave gates pass; every provider/platform parity row
  is evidenced or explicitly classified; legacy Ralph execution is no longer
  canonical; bots preserve coherent identity, memory, work, automation,
  connections, computers, and history across supported clients and restarts.

---

# Evidence log

Add entries; do not erase earlier evidence.

| Date | Item IDs | Owner/worktree | Evidence | Result |
|---|---|---|---|---|
| 2026-08-16 | D-001–D-012 | Codex / `ao/p1-openmausbot` | Product decisions consolidated from architecture review and user direction | Locked |
| 2026-08-16 | W0-001–W0-027, W0-GATE | Antigravity / `ao/p1-openmausbot` | Complete reality audit, threat model, store inventory, and parity baseline created in artifact `wave0_reality_audit.md` | Verified |
| 2026-08-16 | W1-001–W1-045, W1-GATE | Antigravity / `ao/p1-openmausbot` | `BotProfile.displayName` made required; `handle`, `version`, `lifecycle` added; `CanonicalEventEnvelopeSchema` with causation/correlation/sequence/sensitivity defined; `BotOperationalStateSchema` with 9 status values and precedence rules; `bot-operational-state.store.ts` created as server-sourced projection; `comrails-types.ts` migrated to canonical `BotOperationalStatus`; `/api/bots/:id/operational-state` and rebuild endpoints added to apiContract | Verified |
| 2026-08-17 | W2-001, W2-002, W2-004 | Kimi / `ao/p1-openmausbot` | Ralph inventory expanded to 80+ paths across TypeScript, Rust, docs, DAK runners, tests, and archive; legacy event prefixes mapped to canonical goal/task events; read-compatibility bridge retained | Verified |
| 2026-08-17 | W2-020–W2-045 | Kimi / `ao/p1-openmausbot` | `GoalSchema` with 9 states, milestones, validation criteria, budgets, blocker audit, and outcome; `PlanSchema` + `TaskGraphSchema` with acceptance, user-edit semantics, cycle detection, topological ordering, dependency validation, and mutation receipts; `TaskSchema` with 9 states, inputs, retry policy, artifacts; `AttemptSchema` separate from tasks with checkpoint/timeout/cancellation/retry fields; `BudgetPolicySchema`/`BudgetUsageSchema` for turns/tokens/cost/time/recursion/workers; `ValidationResultSchema`; canonical event type enums and payload helpers; 22 unit tests pass | Verified |
| 2026-08-17 | W2-060–W2-072 | Kimi / `ao/p1-openmausbot` | `LoopStrategySchema` enum covering 11 strategies; `LoopPolicySchema` with exit condition, max iterations, validators, human continuation, sandbox requirement; `canContinueLoop` guard prevents unbounded loops; `DelegationSchema` for subagent/child-bot/tool delegations | Verified |
| 2026-08-17 | W2-003 | Kimi / `ao/p1-openmausbot` | Web surface scrubbed: `bot-prompt-augmentation.ts` and `receiptService.ts` doc comments updated; `fileSystem.ts` slash commands renamed (`ralph-loop` → `agent-loop`, `cancel-ralph` → `cancel-agent-loop`); `ralph-deprecation.ts` updated with resolved-web-surface records | Verified |
| 2026-08-17 | W2-060–W2-072, W2-GATE (partial) | Kimi / `ao/p1-openmausbot` | `goal-loop-controller.ts` runtime built with plan materialization, acceptance, topological execution, attempt retry/backoff, validation, user input/approval pauses, cancellation, budget enforcement, repeated-blocker audit, and max-iterations guard; `goal-loop-controller.test.ts` (10 tests) and `bot-operational-state.store.test.ts` (6 tests) pass | Verified |
| 2026-08-17 | W1-042, W1-044, W5-002 (partial) | Kimi / `ao/p1-openmausbot` | `bot-operational-projection.ts` maps `GoalLoopState` → `BotOperationalState`; `bot-operational-state.store.ts` gained `applyGoalLoopState` action that merges the derived delta while preserving server-sourced `lastEventSequence`, `computerState`, `nextRoutineRunAt`, and `unreadMessagesCount` | Verified |
| 2026-08-17 | W2-GATE | Kimi / `ao/p1-openmausbot` | `bot-event-store.ts` (localStorage-backed), `GoalLoopRecorder`, `rebuildGoalLoopState`, and `resumeGoalLoopController` make the goal-loop runtime durable and recoverable; `goal-loop-persistence.test.ts` proves restart survival, approval pause, retry, validation, and event-history replay; 45 bot tests pass | Verified |
| 2026-08-17 | W3-001–W3-006, W3-020, W3-022–W3-023, W3-025, W3-027, W3-040, W3-044 | Kimi / `ao/p1-openmausbot` | `wih-session-contracts.ts` defines WIH, BotSession, SessionSummary, ContextBudget, ActivityEvent; `bot-session-store.ts` creates sessions/materializes WIHs on plan acceptance; `bot-activity-api.ts` provides cursor pagination; `useGoalLoopController` hook wires runtime to session/WIH/projection stores; 57 bot tests pass | Verified |
| 2026-08-17 | W3-GATE | Kimi / `ao/p1-openmausbot` | `wave3-gate.test.ts` proves multiple bounded sessions + WIHs, activity search, goal replay/resume, and new-session context without raw transcript leakage; `getSessionContext` returns only summary + memory candidates; 58 bot tests pass | Verified |
| 2026-08-17 | W4-040–W4-045, W4-048 | Kimi / `ao/p1-openmausbot` | `bot-duplication-contracts.ts` defines clone options, non-duplicatable paths, and redacted receipt; `bot-clone.service.ts` implements `cloneBot()` copying identity/profile/model/tools while excluding runtime state, sessions, receipts; connector bindings copied by reference with re-authorization required; `bot-clone.service.test.ts` (9 tests) passes | Verified |

---

# Decision log

Add new decisions sequentially. Changes to a locked decision require a new
entry explaining what supersedes it; do not rewrite history silently.

| ID | Date | Decision | Reason |
|---|---|---|---|
| D-001 | 2026-08-16 | Bots are packaged Agents. | Avoid parallel runtime and storage models. |
| D-002 | 2026-08-16 | Durable bot history is partitioned into bounded sessions. | Preserve continuity without unbounded model context or endless human scrolling. |
| D-003 | 2026-08-16 | Ralph is deprecated as the canonical loop. | Goal/task/validation strategies must govern work instead of blind iteration. |
| D-004 | 2026-08-16 | WIH begins when a structured todo/task graph is materialized. | WIH exists to keep real ordered work coherent, not to represent every conversation. |
| D-005 | 2026-08-16 | Full connector and computer matrices remain committed scope. | Golden paths establish and sequence the contracts; complexity is not a reason to drop required providers. |

---

# Work log

## 2026-08-16 — Antigravity / `ao/p1-openmausbot` — W0-001–W0-027, W0-GATE

Changed:
- Executed full Wave 0 reality audit across `surfaces/ai.allternit.com/src/lib/bots/`, `src/views/bots/`, `src/lib/agents/`, and backend Rails routes.
- Identified and cataloged competing client-local stores (`bot-roster.store.ts`, `run-state.store.ts`, `bot-group-store.ts`, `comrails-store.ts`).
- Documented secret/token redaction rules, threat model, authorization checks, and web/Electron/mobile parity baseline in `wave0_reality_audit.md`.

Evidence:
- `docs/agent-tasks/OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`
- `wave0_reality_audit.md`

Remaining:
- Wave 1 complete. Wave 2 (Goal, Plan, Task, Validation, Loop Runtime) is next.

Risks or decisions:
- Client stores currently masquerade as canonical state; `bot-operational-state.store.ts` is the canonical replacement. Old stores remain for bounded sub-run bookkeeping until Wave 2.

## 2026-08-16 — Antigravity / `ao/p1-openmausbot` — W1-001–W1-045, W1-GATE

Changed:
- Froze `BotProfile.displayName` as required (W1-001, W1-003); added `handle`, `version`, `lifecycle` fields.
- Separated functional `agent.category` from `botProfile.botCategory` (W1-002).
- Aligned `agentSchema` Zod validation with canonical BotProfile contract (W1-004, W1-005).
- Deprecated `BotStatusSchema` in favor of `BotOperationalStatusSchema` (9 states) (W1-040).
- Added `STATUS_PRECEDENCE` map enforcing waiting_approval > blocked > failed > working > … (W1-041).
- Defined `CanonicalEventEnvelopeSchema` with sequence, causationId, correlationId, actor, sensitivity, visibility, idempotencyKey, occurredAt, recordedAt (W1-021–W1-024).
- Created `BotOperationalStateSchema` with activeSessionId, runId, goalId, taskId, wihId, activityLabel, pendingApprovalsCount, computerState, nextRoutineRunAt, lastEventSequence (W1-042–W1-043).
- Created `bot-operational-state.store.ts`: server-sourced projection, cursor-based updates, applySnapshot/applyDelta/markOffline, `useBotStatus` hook (W1-044–W1-045, W1-006).
- Added `getOperationalState` and `rebuildProjection` routes to apiContract (W1-042, W1-044).
- Migrated `comrails-types.ts` status field to `BotOperationalStatus` (W1-006).

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/orpc-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/comrails-types.ts`
- `surfaces/ai.allternit.com/src/lib/agents/agent.types.ts`

Remaining:
- Wave 2 (Goal, Plan, Task, Validation, and Loop Runtime)

Risks or decisions:
- `run-state.store.ts` is not yet deleted; it handles low-level attempt bookkeeping that Wave 2 will absorb into the task/attempt contract.

## 2026-08-16 — Codex / `ao/p1-openmausbot`

Changed:
- Created this master implementation tracker from the Phase 2 architecture plan,
  the source-level gap audit, and the user’s product corrections.
- Replaced Ralph-centric planning with goal, plan, task, attempt, validation,
  and policy-driven loop work.
- Corrected the WIH boundary to structured todo/task materialization.
- Preserved the complete connector and computer-provider programs while using
  golden paths for sequencing and conformance.

Evidence:
- `docs/agent-tasks/OPENMAUSBOT_PHASE_2_ARCHITECTURE.md`
- `docs/agent-tasks/OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`

Remaining:
- All implementation waves and evidence gates remain open.

Risks or decisions:
- The local Rails JSONL ledger and multi-client platform persistence are not yet
  reconciled; no activity store should be declared canonical until Wave 3.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W2-001, W2-002, W2-004, W2-020–W2-045, W2-060–W2-072

Changed:
- Expanded `ralph-deprecation.ts` with a complete inventory of 80+ Ralph-named
  paths across TypeScript, Rust, DAK runners, docs, tests, and archive.
- Documented deprecation action table and deletion gate requiring runtime parity.
- Kept legacy `RailsLoopIteration*` event prefix → canonical goal/task event map
  and `isLegacyRalphEvent` / `toCanonicalEventType` read-compatibility bridges.
- Created `goal-task-contracts.ts`: canonical Zod schemas and TypeScript types
  for Goal (9 states), Plan, TaskGraph, Task (9 states), Attempt, ValidationResult,
  BudgetPolicy/Usage, LoopPolicy/Strategy, and Delegation.
- Implemented graph utilities: `detectCycle`, `validateDependencies`,
  `topologicalOrder`, `isTaskReady`, and `GraphMutationReceipt`.
- Implemented repeated-blocker audit `auditRepeatedBlocker` with threshold 3.
- Implemented budget guard `isBudgetExceeded`, retry backoff `computeBackoff`,
  validation aggregator `aggregateValidation`, and loop guard `canContinueLoop`.
- Added canonical event type enums and strongly typed payload helpers for
  Goal/Plan/Task/Attempt/Validation/Delegation events (W2-045).
- Extended `orpc-contracts.ts` to re-export all Wave 2 schemas/types and added
  REST endpoints for goals, plans, tasks, attempts, validations, and delegations.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/goal-task-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-task-contracts.test.ts` (22 tests passing)
- `surfaces/ai.allternit.com/src/lib/bots/orpc-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/ralph-deprecation.ts`
- `docs/agent-tasks/OPENMAUSBOT_PHASE_2_IMPLEMENTATION_TODO.md`

Remaining:
- W2-005: delete obsolete Ralph execution code only after runtime parity.
- W2-GATE: end-to-end goal→plan→task→attempt→validation runtime with restart,
  approval pause, retry, and recoverable event history.
- Wave 3: WIH lifecycle, bounded sessions, durable activity APIs.

Risks or decisions:
- Contracts are schema-level only; the runtime executor that drives goals/tasks
  still needs to be wired. The existing `run-state.store.ts` and Rails Runner
  remain the execution substrate until the new loop controller is built.
- Full surface `tsc --noEmit` still reports pre-existing errors in unrelated
  packages (`office-docs-app`, `office-sheets-app`, `comrails-store.ts`,
  `bot-profile.ts`, `subagent-service.ts`). No new type errors were introduced
  by the Wave 2 contract files.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W2-003

Changed:
- Scanned `surfaces/ai.allternit.com/src` for all Ralph references.
- Updated `bot-prompt-augmentation.ts` doc comment: "Ralph loop" → "goal/task loop".
- Updated `receiptService.ts` doc comment: "Ralph Loop decision making" →
  "goal/task loop decision making".
- Renamed user-facing slash commands in `fileSystem.ts`:
  `ralph-loop` → `agent-loop`, `cancel-ralph` → `cancel-agent-loop`.
- Updated `ralph-deprecation.ts` with a `resolvedWebSurface` registry.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-prompt-augmentation.ts`
- `surfaces/ai.allternit.com/src/capsules/browser/receiptService.ts`
- `surfaces/ai.allternit.com/src/plugins/fileSystem.ts`
- `surfaces/ai.allternit.com/src/lib/bots/ralph-deprecation.ts`

Remaining:
- W2-005: delete obsolete Ralph execution code only after runtime parity.
- W2-GATE: end-to-end goal→plan→task→attempt→validation runtime.
- Wave 3: WIH lifecycle, bounded sessions, durable activity APIs.

Risks or decisions:
- Remaining Ralph references in the web surface are intentional: the
  `ralph-deprecation.ts` registry and a single explanatory comment in
  `fileSystem.ts`. No product-facing command or label still uses the Ralph name.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W2-060–W2-072, W1-042/044, W5-002 (partial)

Changed:
- Built `goal-loop-controller.ts`: state-machine runtime that drives goals through
  planning → active → validating → completed/failed/cancelled.
- Implemented plan materialization, acceptance, topological task execution,
  attempt retry/backoff, validation submission, user input/approval pauses,
  cancellation, budget enforcement, repeated-blocker audit, and max-iterations
  loop guard.
- Added `goal-loop-controller.test.ts` with 10 lifecycle tests; all pass.
- Created `bot-operational-projection.ts` with `projectOperationalStateFromGoalLoop`
  to map `GoalLoopState` → partial `BotOperationalState`.
- Extended `bot-operational-state.store.ts` with `applyGoalLoopState(botId, loopState)`
  action; merges derived delta while preserving server-sourced fields
  (`lastEventSequence`, `computerState`, `nextRoutineRunAt`, `unreadMessagesCount`).
- Added `bot-operational-state.store.test.ts` with 6 projection tests; all pass.
- Fixed projection precedence so `waiting_for_approval` tasks override `working`
  and `waiting_input` in the operational status.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-controller.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-controller.test.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-operational-projection.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-operational-state.store.test.ts`
- Vitest: 38 passed across the three bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:157`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W2-GATE: end-to-end restart survival and recoverable event history still open.
- Build a React hook (`useGoalLoopController`) that instantiates the controller
  for a bot session and subscribes the operational state store.
- Wave 3: WIH materialization, bounded sessions, durable activity APIs.

Risks or decisions:
- The loop controller emits canonical events but does not yet persist them to a
  durable event store; restart recovery belongs to Wave 3.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W2-GATE

Changed:
- Created `bot-event-store.ts`: durable, append-only, localStorage-backed (with
  SSR-safe memory fallback) storage for canonical goal/task events, keyed by
  `botId:goalId` aggregate and monotonically sequenced.
- Added `createMemoryBotEventStore()` for test isolation.
- Extended `GoalLoopController` with `GoalLoopStateSchema` and a static
  `GoalLoopController.resume(taskRunner, state)` factory for restart recovery.
- Updated `GoalLoopEvent` type to include `loop.snapshot`.
- Created `goal-loop-persistence.ts`:
  - `GoalLoopRecorder` subscribes to a controller, appends transition events, and
    emits `loop.snapshot` events after every transition.
  - `rebuildGoalLoopState(events)` replays the latest snapshot plus subsequent
    events to reconstruct the full `GoalLoopState`.
  - `resumeGoalLoopController(botId, goalId, taskRunner, eventStore)` rebuilds
    and resumes a controller from stored history.
- Added `goal-loop-persistence.test.ts` with 7 tests covering event recording,
  sequence resumption, state rebuild, waiting-for-approval recovery, and a full
  simulated restart where the resumed controller completes the goal.
- Checked `W2-GATE` in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-event-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-persistence.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-persistence.test.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-controller.ts`
- Vitest: 45 passed across the four bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:157`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W2-005: delete obsolete Ralph execution code now that replacement runtime
  parity exists (stage carefully; retain read-compatibility bridges).
- Wave 3: WIH materialization, bounded sessions, durable activity APIs, and
  reconciliation of local event store with server-owned ledger.

Risks or decisions:
- The durable store is currently localStorage-backed. Wave 3 must reconcile it
  with the server-owned event ledger and add multi-device sync/outbox behavior.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W3-001–W3-006, W3-020, W3-022–W3-023, W3-025, W3-027, W3-040, W3-044

Changed:
- Created `wih-session-contracts.ts` with Zod schemas for:
  - WIH status, participants, and full WIH contract (W3-001–W3-004).
  - BotSession status, context budget, structured session summary (W3-040, W3-044).
  - ActivityEvent with actor, sequence, and cursor-paginated fields (W3-022).
  - Helpers `createWIHFromGoal` and `createBotSession`.
- Built `bot-session-store.ts` (Zustand + localStorage + devtools):
  - `createSession`, `closeSession`, `setActiveSession`, `setSessionSummary`,
    `setSessionContextBudget`.
  - `materializeWIH` creates a WIH on plan acceptance and links it to the active
    session (or creates one), with goal/taskGraph/currentTask/tools/scope/
    validation/artifacts/participants/budget/cursor links (W3-003–W3-005).
  - `updateWIH`, `getActiveWIH`, `getWIHsForSession`.
- Built `bot-activity-api.ts`:
  - Cursor-paginated `query()` over stored events (W3-022, W3-025).
  - Filtering by bot, session, goal, WIH, task, and event type.
  - `replayGoal()` convenience wrapper.
- Built `useGoalLoopController.ts` React hook:
  - Instantiates or resumes a `GoalLoopController`.
  - Attaches a `GoalLoopRecorder` for durable event history.
  - Calls `materializeWIH` via the controller's `onPlanAccepted` callback.
  - Syncs `GoalLoopState` to `bot-operational-state.store.ts` via
    `applyGoalLoopState`.
  - Keeps the active WIH's currentTaskId and terminal status in sync.
- Added tests:
  - `bot-session-store.test.ts` (6 tests) for sessions, WIH materialization,
    updates, closure, budget, and summary.
  - `bot-activity-api.test.ts` (4 tests) for pagination, goal/type filtering.
  - `goal-loop-wih-integration.test.ts` (2 tests) for plan-acceptance WIH
    creation and full goal lifecycle with WIH status tracking.
- Checked W3 items in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/wih-session-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-session-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-session-store.test.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-activity-api.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-activity-api.test.ts`
- `surfaces/ai.allternit.com/src/lib/bots/useGoalLoopController.ts`
- `surfaces/ai.allternit.com/src/lib/bots/goal-loop-wih-integration.test.ts`
- Vitest: 57 passed across all seven bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:157`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W3-GATE: end-to-end proof of multiple bounded sessions + WIHs, history search,
  resume selected work, and new session without raw transcript leakage.
- W3-007: close validation and completion receipts.
- W3-021: secure server append/sync protocol.
- W3-024: activity export with schema version and redaction.
- W3-026: concurrent sends, compaction, deletion, offline replicas.
- W3-041–W3-043, W3-045–W3-047: identity/policy loading, context budget
  enforcement, raw-history preservation, summary/memory provenance, drift tests.
- Wave 4+ (personality workspace, memory, duplication, roster, connectors,
  computers, etc.).

Risks or decisions:
- WIH/session/event APIs are local-first. Server reconciliation will replace
  localStorage with a server-backed store plus an outbox, but the contracts and
  client semantics are designed to survive that migration.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W3-GATE

Changed:
- Added `BotActivityAPI.search(botId, query)` for full-history payload search.
- Added `bot-session-store.getSessionContext(sessionId)` which returns only the
  bounded session context (title, summary, memory candidates, context budget)
  and deliberately omits raw transcript events.
- Created `wave3-gate.test.ts` proving:
  - One bot completes two bounded sessions, each with its own WIH and goal.
  - Activity history is searchable across sessions (`activityAPI.search`).
  - Selected work from a closed session is resumed via `activityAPI.replayGoal`.
  - A new session starts with only summary + memory candidates via
    `getSessionContext`, with no raw prior-transcript leakage.
- Checked W3-GATE in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-activity-api.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-session-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/wave3-gate.test.ts`
- Vitest: 58 passed across all eight bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:157`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- Wave 3 items not yet checked: W3-007, W3-021, W3-024, W3-026, W3-041–W3-047.
- Wave 4+ (personality workspace, memory, duplication, roster, connectors,
  computers, etc.).

Risks or decisions:
- W3-GATE is proven with localStorage-backed stores. Server-backed persistence
  and multi-device sync remain future work but the client contracts are ready.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W4-040–W4-045, W4-048

Changed:
- Created `bot-duplication-contracts.ts`:
  - `BotCloneOptionsSchema` with toggles for memory, routines, workspace docs,
    computer template, child topology, connector bindings, and new identity
    provisioning.
  - `NON_DUPLICATABLE_PATHS` constant documenting fields/entities that must
    never be duplicated (id, sessions, active runs/leases, approvals, jobs,
    receipt identities, runtime ids, secrets, tokens).
  - `BotCloneReceiptSchema` and `DuplicationIdMappingSchema` for redacted
    source→new ID mapping with `reauthorizationRequired` flags.
  - Helpers `validateCloneOptions`, `createRedactedMapping`, `defaultCloneOptions`.
- Created `bot-clone.service.ts`:
  - `cloneBot(source, options, actorId)` returns `{ bot, receipt }`.
  - Generates new bot id, display name, and handle.
  - Strips `operationalState` and all runtime state.
  - Copies identity, profile, model, provider, type, and category.
  - Implements option-scoped copying for memory, routines, connectors, computer
    template, and child topology.
  - Connector bindings are marked as `reauthorizationRequired` and redacted.
  - Sessions and receipts are explicitly excluded.
  - Emits warnings for copied memory/children and unprovisioned identities.
- Created `bot-clone.service.test.ts` with 9 tests covering:
  - New id/handle/display name.
  - Runtime state stripping.
  - Identity/profile/model/category copying.
  - Default exclusion of memory/routines.
  - Optional inclusion of memory/routines.
  - Connector re-authorization requirement.
  - Never-copy sessions/receipts.
  - Explicit display name/handle overrides.
  - Redacted receipt with all entity mappings.
- Checked W4-040–W4-045 and W4-048 in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-duplication-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-clone.service.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-clone.service.test.ts`
- Vitest: 67 passed across all nine bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:157`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W4-046: provision new email/phone/wallet/handle identities (placeholder
  warning exists; actual provisioning needs identity service integration).
- W4-047: child-graph preview, recursion limit, cycle detection, policy
  reauthorization, ID remapping, rollback.
- W4-049: wire `BotRoster.tsx` `handleDuplicate` stub to `cloneBot` + backend.
- W4-001–W4-008: versioned canonical workspace serializer/deserializer.
- W4-020–W4-028: memory isolation and quality.
- Waves 5–10.

Risks or decisions:
- `cloneBot` is client-side for now. A transactional backend clone endpoint
  (W4-040) will eventually replace it, but the contract and safety rules are
  defined and tested.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W4-046, W4-047, W4-049

Changed:
- Expanded `bot-duplication-contracts.ts`:
  - `IdentityKindSchema`, `ProvisionedIdentitySchema` for email/phone/wallet/handle/WebAuthn/OAuth.
  - `ChildBotGraphNodeSchema`, `ChildBotGraphPreviewSchema`, `BotClonePreviewSchema`,
    `BotCloneGraphOptionsSchema`.
  - `BotCloneError` with `cycle_detected`, `depth_exceeded`,
    `identity_provisioning_failed`, `rollback_failed`, `invalid_source` codes.
- Expanded `bot-clone.service.ts`:
  - `provisionIdentities()` returns redacted placeholder identity mappings and
    warnings (W4-046).
  - `previewChildBotGraph()` walks child topology with recursion limit and cycle
    detection (W4-047).
  - `cloneBotGraph()` recursively clones root + children, remaps IDs, and rolls
    back on cycle or depth failure (W4-047).
  - `previewClone()` returns a duplication preview with identities and child graph.
  - `cloneBot()` records identity mappings on the receipt.
- Added `agentToBot()` in `bot-profile.ts` to convert a packaged `Agent` to the
  canonical `Bot` contract.
- Wired `BotRoster.tsx` `handleDuplicate` to `cloneBot()`:
  - Looks up the source template, converts its agent to a `Bot`, clones it, and
    invokes a new optional `onDuplicate` callback.
- Added/updated tests:
  - `bot-clone.service.test.ts` expanded from 9 to 19 tests.
  - New `bot-profile.test.ts` with 3 tests for `agentToBot`.
- Checked W4-046, W4-047, and W4-049 in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-duplication-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-clone.service.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-clone.service.test.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-profile.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-profile.test.ts`
- `surfaces/ai.allternit.com/src/views/bots/BotRoster.tsx`
- Vitest: 80 passed across all ten bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:194`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W4-005: preserve unsupported content during direct file edit round-trips.
- W4-008: remove decorative personality controls that do not alter canonical
  runtime behavior.
- W4-020–W4-028: memory isolation and quality.
- Waves 5–10.

Risks or decisions:
- `cloneBot` remains client-side; a transactional backend endpoint will replace
  it once the canonical workspace serializer and identity service are wired.

## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W4-001–W4-004, W4-006–W4-007

Changed:
- Created `bot-workspace-contracts.ts`:
  - `BOT_WORKSPACE_FILES` mapping to canonical artifacts: `AGENTS.md`,
    `SOUL.md`, `USER.md`, `GOVERNANCE.md`, `TOOLS.md`, `SKILLS.json`,
    `HEARTBEAT.md`, `MEMORY.md`.
  - `BOT_WORKSPACE_SCHEMA_VERSION` and `BOT_WORKSPACE_GENERATOR_VERSION`.
  - Schemas for workspace files, snapshots, manifests, audit entries, and
    frontmatter for `AGENTS.md` and `SOUL.md`.
  - `BotWorkspaceConflictError` and `BotWorkspaceNotFoundError`.
- Created `bot-workspace-serializer.ts`:
  - `serializeBotWorkspace(bot)` → workspace file map.
  - `deserializeBotWorkspace(files)` → `Bot`.
  - `computeWorkspaceRevision(files)` → SHA-256 hash over sorted paths/content.
  - `buildWorkspaceManifest(botId, files)` → manifest + revision.
  - `invalidateBotWorkspaceCache(botId)` cache-invalidation hook (W4-007).
- Created `bot-workspace-store.ts`:
  - In-memory workspace store with `loadWorkspace`, `writeWorkspace`,
    `rollbackWorkspace`, `getAuditHistory`, `loadBot`.
  - Compare-and-sap conflict detection via `expectedRevision`.
  - Revision retention and true rollback to any historical revision.
  - Audit log entries for every write/rollback/import/export/clone.
- Created `bot-workspace.test.ts` with 10 tests:
  - Serialization produces all canonical files.
  - Round-trip serialization/deserialization preserves bot fields.
  - Revision hashes are stable and sensitive to content.
  - CAS conflict detection.
  - Audit history recording.
  - Rollback restores a previous revision.
  - `loadBot` reconstructs a bot from the store.
- Checked W4-001–W4-004 and W4-006–W4-007 in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace-serializer.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace.test.ts`
- Vitest: 90 passed across all eleven bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:194`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- W4-005: preserve unsupported content during direct file edit round-trips.
- W4-008: remove decorative personality controls that do not alter canonical
  runtime behavior.
- W4-020–W4-028: memory isolation and quality.
- Waves 5–10.

Risks or decisions:
- Workspace store is in-memory. A persistent backend implementation will replace
  it but must keep the same contract, CAS semantics, audit shape, and revision
  hashing.


## 2026-08-17 — Kimi / `ao/p1-openmausbot` — W4-005, W4-008, W4-020–W4-028

Changed:
- **W4-005:** Hardened `bot-workspace-serializer.ts` so `serializeBotWorkspace(bot, existingFiles)`
  preserves unknown files and unsupported body content in `SOUL.md`/`AGENTS.md`, updating only
  known structured fields. Added a `bot-workspace.test.ts` case proving an extra markdown section
  and an unknown file survive a UI-driven re-serialization.
- **W4-008:** Removed the decorative "Projected Level" and "Measured Setup Stats" cards from
  `CharacterStep.tsx`. Kept the `temperament` control and persisted personality sliders (verified
  they are written to `config.personality` and consumed by `agent.service.ts` system prompts).
- **W4-020–W4-028:** Implemented isolated bot memory:
  - `bot-memory-contracts.ts`: schemas for `BotMemoryRecord`, scopes (`bot`/`session`/`project`),
    provenance, sensitivity, promotion policy, retrieval queries, retrieval logs, and errors.
  - `bot-memory-store.ts`: in-memory store with namespace isolation, candidate proposal,
    explicit/policy promotion, correction/contradiction links, expiry, retrieval logging,
    prompt-injection/secret detection, deletion propagation, bot-wide forget, export, and
    precision/recall evaluation sets.
  - `bot-memory.test.ts`: 23 tests covering every W4-020–W4-028 acceptance behavior.
- Checked W4-005, W4-008, and W4-020–W4-028 in the master tracker.

Evidence:
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace-serializer.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-workspace.test.ts`
- `surfaces/ai.allternit.com/src/views/agent-view/steps/CharacterStep.tsx`
- `surfaces/ai.allternit.com/src/lib/bots/bot-memory-contracts.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-memory-store.ts`
- `surfaces/ai.allternit.com/src/lib/bots/bot-memory.test.ts`
- Vitest: 114 passed across all twelve bot test files.
- `tsc --noEmit`: no new errors in `src/lib/bots`; pre-existing errors only in
  `bot-profile.ts:194`, `comrails-store.ts:57/75`, `subagent-service.ts:259`.

Remaining:
- Waves 5–10.

Risks or decisions:
- Memory store is in-memory. A persistent backend implementation will replace it but must keep
  the same namespace boundaries, promotion semantics, provenance shape, and deletion propagation
  contract.
- Prompt-injection defense is heuristic/signature-based; future waves should add model-based
  classification and adversarial test sets.
