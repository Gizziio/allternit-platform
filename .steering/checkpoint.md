# Checkpoint — ao/openbot-policy-gateway (Task B: bot-mode governance UI)

## Goal
Finish docs/OPENBOT_POLICY_PHASE_B_TASK.md: verdict chips, audit list, policy
editor, bot-session gating, colocated vitest. No git operations, no dev
servers, no Phase 2 UX (avatars / @mentions / group chat).

## Just did
- Kept kimi's partial Task B files (policy-audit.ts, PolicyVerdictChips,
  PolicyAuditList) and finished the rest after the kimi 5-hour quota, Claude
  logout, and Codex usage limit blocked the executor pane.
- PolicyEditor.tsx: structured rule fields, presets, advanced JSON, copy
  fallback to ALLTERNIT_ACI_POLICY_FILE (no write API in Task A).
- PolicyGovernance.tsx: renders nothing unless sessionMode=agent or isBot.
  Wired into BotChatSessionView under the header.
- Vitest: 11 passed (gating, chips, editor validation, presets, document
  builder).

## Next
- Orchestrator: PR from ao/openbot-policy-gateway (Task A + Task B).
- Out of scope: Phase 2 UX cluster in the spec.

## Just did
- permission_policy.rs: PermissionRule extended (id, intent, botId, sessionId,
  mcpTool — all optional, camelCase serde). New PolicyRequest descriptor,
  rule_matches (AND semantics, absent = wildcard), evaluate_policy
  (fail-closed, precedence deny > ask > allow > implicit deny; zero-rule doc
  denies everything). Legacy evaluate() untouched — existing tests unchanged.
- New policy_config.rs: loader for ALLTERNIT_ACI_POLICY_FILE (unset → off;
  missing/empty/malformed → PolicyLoadError naming the rule id; startup
  refuses on Err, wired in main.rs after init_app_config). Global policy
  state + evaluate_descriptor + record_decision + refusal_json.
- New policy_audit.rs: append-only JSONL at
  <computer_use_dir>/policy_audit/policy_audit.jsonl, write+flush+fsync per
  row; read_rows(bot_id, limit) newest-first.
- Seat A (aci_run): policy gate after goal validation, before
  aci_safety::evaluate_request; deny → 403 {error: policy_denied, reason,
  rule_id}; run_id minted early so rows carry it. Seat B
  (execute_computer_tool): gate before enforce_confirmation/guest dispatch.
  Audit write failure → 500, action never dispatches.
- GET /api/aci/policy/audit?bot_id=&limit= registered in aci_router.
- Tests: 51 policy tests incl. the critical ordering test (policy allows,
  mock ACU 500s, allowed row asserted durable inside the executor handler +
  after). Shared POLICY_TEST_LOCK serializes tests that mutate global
  policy / computer-use-dir env across aci_routes, computer_control,
  policy_audit, policy_config modules.
- docs/public/aci/safety.md: new "Declarative policy layer" section.

## Next
- DONE: full `cargo test -p allternit-api` → 855 pass / 4 fail, all 4 the
  pre-existing agent_cloud_routes real-control-plane env failures (fail
  identically on clean main; documented in the 2026-09-10 botmode-api-0910
  ledger summary). `cargo build --release -p allternit-api` green.
- Sentinel docs/OPENBOT_POLICY_PHASE_A_NOTES.md written (status: done).
- Orchestrator: PR + merge + ledger attestation; changes left uncommitted
  per task.

## Open questions
- None.
