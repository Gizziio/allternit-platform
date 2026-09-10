---
status: done
files_changed:
  - cmd/allternit-api/src/permission_policy.rs
  - cmd/allternit-api/src/policy_config.rs
  - cmd/allternit-api/src/policy_audit.rs
  - cmd/allternit-api/src/aci_routes.rs
  - cmd/allternit-api/src/computer_control.rs
  - cmd/allternit-api/src/main.rs
  - cmd/allternit-api/src/lib.rs
  - docs/public/aci/safety.md
  - .steering/checkpoint.md
  - .allternit/shared-context.md
deviations:
  - "Rule precedence pinned as deny > ask > allow > implicit deny (spec orders deny-before-allow and says ask passes through; where ask and allow both match, ask wins so the action keeps its grant-flow scrutiny)."
  - "PermissionRule.id is Option<String> rather than a bare String so legacy config-file policies (which have no ids) keep deserializing unchanged."
  - "ask verdicts write no policy_audit row: they fall through to the existing grant/approval flow, which already persists redemption receipts before execution. Rows are written only for allow and deny decisions."
  - "Seat B (execute_computer_tool) evaluates with bot_id unset: the bot id is not resolvable until after the ownership/sandbox DB reads, which sit behind the policy gate by design. A botId-scoped rule therefore does not match at this seat (present-field vs missing-descriptor = no match, fail-closed)."
  - "aci_run mints its run_id before the policy gate so audit rows can carry it; the uuid mint has no side effects and the response contract is unchanged."
remaining:
  - "Task B (bot-mode governance UI) — explicitly out of scope."
  - "4 agent_cloud_routes real-control-plane tests fail on this machine (spawn an external allternitos_control_plane binary); pre-existing on clean main, documented in agent-ledger/summaries/2026-09-10-1705-botmode-api-0910-*.md, unrelated to this diff."
  - "No git operations performed per task; changes are uncommitted in the worktree for the orchestrator to PR/merge and attest."
test_evidence:
  - "cargo test -p allternit-api --lib policy → 51 passed, 0 failed (loader states, deny-beats-allow, AND field matching, ask fall-through, zero-rule deny-all, seat denies, audit API filter/limit, ordering test)"
  - "Ordering test: policy allows; mock ACU 500s; the mock handler asserts the allowed audit row is already on disk at hit time (flag) and the row is re-asserted after the failure; denied run never reaches the executor and its refusal row precedes the (absent) dispatch"
  - "cargo test -p allternit-api (full) → 855 passed, 4 failed; all 4 are the pre-existing agent_cloud_routes real-control-plane env failures above"
  - "Existing aci tests (aci_safety, aci_approvals, aci_credentials, credential e2e, approval http) pass unchanged with the engine off"
release_build: "cargo build --release -p allternit-api → Finished release profile, exit 0 (only pre-existing warnings)"
---

# Phase A notes — OpenBot Policy Gateway (backend)

## What was built

A declarative, fail-closed policy layer on the Rust gateway (`allternit-api`),
extending the existing rule engine in `permission_policy.rs` — no parallel
schema, no second engine, Python ACU untouched.

**Rule engine** (`permission_policy.rs`): `PermissionRule` gained optional
`id`, `intent`, `botId`, `sessionId`, `mcpTool` fields (camelCase serde with
snake_case aliases). New `evaluate_policy` evaluates a `PolicyRequest`
descriptor with AND semantics (every present rule field must match; absent
fields are wildcards; a present field never matches a missing descriptor
value). Precedence: deny (anywhere in the document) > ask > allow > implicit
deny, so a document with zero rules denies every action. The legacy
first-match `evaluate` used by config-file policies is untouched — all
pre-existing tests pass unchanged.

**Loader** (`policy_config.rs`): `ALLTERNIT_ACI_POLICY_FILE` naming a JSON
`{"rules": [...]}` document. Unset → engine off (legacy behavior). Set +
missing/empty/malformed (bad JSON, unknown action, rule without `tool`) →
`PolicyLoadError` naming the offending rule id (or `(index N)` when the rule
has no id); `main.rs` refuses to start with a clear log message. Valid →
installed into a gateway-wide static; `evaluate_descriptor` returns `None`
when the engine is off so seats are literally the old code path.

**Audit store** (`policy_audit.rs`): append-only JSONL at
`<computer_use_dir>/policy_audit/policy_audit.jsonl` (same dir idiom as
`aci_approvals::computer_use_dir`). One row per allow/deny decision
(`{ts, decision, rule_id, bot_id, session_id, actor, tool, intent, host,
path, mcp_tool, run_id}`, absent fields omitted). Each write is append +
flush + sync_all before the seat proceeds. If the write fails, the seat
returns 500 and the action never dispatches — an action that cannot be
audited does not run.

**Seats** (policy verdict first, existing safety machinery second):
- `aci_run` (`aci_routes.rs`): immediately after goal validation, before
  `aci_safety::evaluate_request` and grant redemption. Descriptor: tool
  `aci.run`, intent = goal (200 chars), host = first `allowedSites` entry.
  Deny → audit row + HTTP 403 `{error: "policy_denied", reason, rule_id}`.
- `execute_computer_tool` (`computer_control.rs`): before
  `enforce_confirmation` and any guest dispatch. Descriptor: canonical tool
  name (`computer.shell`, `computer.file_read`, …) and file path where one
  applies. Same deny behavior.

`ask` verdicts change nothing at either seat — they continue into the
existing grant/approval flow, which was already receipt-before-execution.

**Read API**: `GET /api/aci/policy/audit?bot_id=<id>&limit=<n>` (default 100,
cap 1000), newest-first, bot-filtered, registered in `aci_router()`.

## Verification

- 51 policy tests pass, including the forced-executor-failure ordering test:
  policy allows, the mock ACU 500s, and the mock asserts — from inside the
  executor call — that the `allowed` row is already durable on disk.
- Full `cargo test -p allternit-api`: 855 pass; the only 4 failures are
  `agent_cloud_routes` real-control-plane tests that spawn an external
  `allternitos_control_plane` binary and fail identically on clean main
  (documented by session botmode-api-0910, unrelated).
- `cargo build --release -p allternit-api` green (the desktop bundles this
  sidecar; production config compiles).

## Notes for Task B

- Verdict chips can poll `GET /api/aci/policy/audit?bot_id=` (~3s) as the map
  prescribes; rows carry `bot_id`, `tool`, `decision`, `rule_id`, `ts`,
  `run_id` — enough to join against run events for a session view.
- `bot_id` is currently only populated on rows when the seat knows it; the
  `aci_run` seat does not take a bot id today (the request body has no bot
  metadata). If Task B needs per-bot run rows, add optional `botId` to
  `AciRunBody` and thread it into the seat descriptor — the rule engine
  already supports it.
