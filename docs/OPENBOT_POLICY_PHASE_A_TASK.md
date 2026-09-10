# TASK A (backend) — Policy Engine + Audit-Before-Act + Audit API

Read `docs/OPENBOT_POLICY_MAP.md` FIRST — it is the full analysis and binding decisions. This file is the executable scope. Do NOT start Task B (UI). Do NOT do git operations (no commit/push/checkout/merge). Do NOT start dev servers.

## Scope — all in crate `allternit-api` (`cmd/allternit-api`) unless noted

1. **Policy engine extension** (`src/permission_policy.rs`):
   - Extend `PermissionRule` with optional fields: `id: String`, `intent: Option<String>`, `botId: Option<String>`, `sessionId: Option<String>`, `mcpTool: Option<String>` (keep existing `tool` glob, `filePath`, `networkHost`, `action: allow|deny|ask`).
   - Matching: all present fields must match (AND); absent fields = wildcard. Deny rules evaluate before allow rules; `ask` passes through to the existing grant/approval flow unchanged.
   - New module `src/policy_config.rs`: loads the policy document from env `ALLTERNIT_ACI_POLICY_FILE`.
     - Env unset → engine OFF (existing behavior, all current tests must pass untouched).
     - Env set + file missing/empty/malformed (bad JSON, unknown action value, rule without `tool`) → `PolicyLoadError` naming the offending rule id / line reason; the gateway MUST refuse to start with a clear log message (wire the loader into startup in `main.rs` right after the other ACI config init — follow the existing `aci_safety` init idiom; fail startup on `Err`).
     - Valid doc with rules → engine ON; a doc that parses to zero rules denies every action (fail-closed) — document this in the module doc comment.
2. **Policy seats** (both, policy-then-grant order — policy verdict first, existing grant/approval flow second):
   - `src/aci_routes.rs` `aci_run` (`:344-540`): after goal validation, BEFORE `aci_safety::evaluate_request` (`:366`), evaluate the run's descriptor (tool=`aci.run`, intent=goal summary, botId/sessionId from request metadata if present, host from allowedSites/target). On `deny` → write audit row + return the existing refusal-shape response (HTTP 403, JSON `{error, reason, rule_id}` — follow the existing refusal idiom in this file). On `ask`/`allow` → continue existing flow.
   - `src/computer_control.rs` `execute_computer_tool` (`:121-138`): before `enforce_confirmation`/guest dispatch, evaluate the action descriptor (tool name, host, file path, botId if resolvable). Same deny behavior.
3. **Audit-before-act store** (new `src/policy_audit.rs`):
   - Append-only JSONL at `<computer_use_dir>/policy_audit/policy_audit.jsonl` (reuse the dir-resolution idiom from `aci_approvals.rs:41-51`). Row: `{ts, decision: "allowed"|"denied", rule_id, bot_id, session_id, actor, tool, intent, host, path, mcp_tool, run_id?}`.
   - **Ordering guarantee**: the row is written BEFORE dispatch on every path (seats above). A forced-executor-failure must still leave the row. Buffered writes must be flushed/synced before dispatch returns — use append + flush per write (volume is low; correctness over throughput).
4. **Read API**: `GET /api/aci/policy/audit?bot_id=<id>&limit=<n=100>` in `aci_routes.rs` — returns newest-first rows filtered by bot_id when given; register in `aci_router()`. No auth changes (follow existing route conventions).
5. **Tests** (`cargo test -p allternit-api`, colocated `#[cfg(test)]`, use `tower::ServiceExt::oneshot` + `crate::test_helpers::app_state`; mock ACU via `ALLTERNIT_ACU_URL` pointing at a local axum mock — copy the pattern at `aci_routes.rs:1274-1561`):
   - Loader: unset env → off; malformed doc → startup error names the rule; empty valid doc → deny-all.
   - Seat evaluation: deny-before-allow (a matching deny beats a matching allow); field AND-matching (botId mismatch → no match); `ask` falls through to existing grant flow.
   - **Ordering test (the critical one)**: policy allows, executor mock 500s → assert the audit row exists with `decision: "allowed"` (or the refusal row for deny) and the action never executed. Assert row timestamp/sequence precedes the executor call (e.g., record executor-hit flag, assert audit row already on disk when hit).
   - Audit API: rows written appear via GET, bot_id filter works.
   - Existing aci tests must pass unchanged (engine off by default).
6. **Docs**: update `docs/public/aci/safety.md` — policy semantics (three states), ordering guarantee, audit API, env var. Match the existing doc's tone/structure. Voice: plain, direct, no guarantee language.

## Constraints

- Extend `permission_policy.rs`; do NOT create a parallel policy schema or second rule engine. Python ACU untouched.
- Policy is additive: never bypass or weaken `aci_safety`, grants, `enforce_confirmation`, HostPolicy, or the circuit breaker.
- No CEL or expression language. No new crates without strong reason (prefer std + existing deps).
- Match repo idiom: rustfmt-stable style, `tracing` for logs, thiserror for errors, existing response/refusal shapes.
- Allowed commands: `cargo test -p allternit-api`, `cargo build -p allternit-api`, `cargo build --release -p allternit-api` (REQUIRED before finishing — desktop bundles this sidecar; production config must compile).
- When a meaningful milestone completes, update `.steering/checkpoint.md` (Goal / Just did / Next / Open questions). If `.allternit/shared-context.md` exists in the worktree, append a `### openbot-policy-gateway <ISO ts>` milestone note.
- Do NOT commit. Leave all changes uncommitted in the worktree.

## Deliverable sentinel

When finished, write `docs/OPENBOT_POLICY_PHASE_A_NOTES.md` starting with YAML frontmatter:
```yaml
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
test_evidence: [what you ran + results]
release_build: "cargo build --release -p allternit-api" result
```
then prose notes. That file existing = done. If blocked, set status: blocked and explain.
