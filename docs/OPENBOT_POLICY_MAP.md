# OpenBot Policy Gateway — Implementation Map (orchestrator analysis, 2026-09-10)

Feature: fail-closed declarative policy layer + audit-before-act ordering + bot-mode governance UI.
Source spec: Allternit Brain `Research/specs/openbot-policy-gateway.md` (reverse_engineer of CopilotKit OpenBot, MIT — design only).
**Extend what exists. Do not invent parallel machinery.**

## 1. Key discovery — a rule engine already exists

`cmd/allternit-api/src/permission_policy.rs` already has:
- `PermissionRule { tool (glob), filePath, networkHost, action: allow|deny|ask }` (`:24-52`), glob matching (`matches_pattern`), in-memory `ApprovalStore` (`:143-190`).

**Decision: the new policy document extends this engine.** Add fields `intent`, `botId`, `sessionId`, `mcpTool` to the rule shape, add a file loader with fail-closed semantics, evaluate deny→allow→ask order, wire it into the ACI paths. Do NOT create a new policy schema or second engine.

Python side also has `domains/computer-use/core/policy/rules.py` (`load_custom_rules`, `PolicyRule`) — Phase 1 does NOT touch Python policy; the gateway is the enforcement point.

## 2. Execution path & policy seat (Rust gateway, crate `allternit-api`)

- Router: `cmd/allternit-api/src/aci_routes.rs:29-40`, mounted at `/api` (`main.rs:795`).
- `aci_run` (`aci_routes.rs:344-540`): goal validation → `aci_safety::evaluate_request` (`:366`) → grant redemption (`:371-440`) → credential resolution → ACU dispatch (`:511-527`) → `buffer_create` + event drain (`:529-530`).
- Per-action shared path: `execute_computer_tool` (`cmd/allternit-api/src/computer_control.rs:121-138`) already runs `enforce_confirmation` BEFORE guest dispatch — the model for audit-before-act.
- **Policy seat A**: `aci_run`, immediately after goal validation, BEFORE `evaluate_request` (policy-then-grant, one linear gate).
- **Policy seat B**: `execute_computer_tool`, before `enforce_confirmation`/dispatch (per-action).

## 3. Existing safety/policy machinery to keep (do not weaken)

- `aci_safety.rs`: goal-text `SensitiveActionType` (`:49-95`), `ConfirmationClass` + action classifiers (`:438-555`), `HostPolicy` env lists (`:107-198`), `CircuitBreaker` (`:244-346`), `SafetyMode` (`:22-46`).
- Grant flow: action-hash-bound single-use expiring grants; receipts written at redemption, BEFORE execution (`aci_approvals.rs:370-421`, `persist_receipt :295-316`). Grant TTL 120s.
- **Ordering finding**: Rust receipts already precede dispatch on the grant path — good. The gap is per-action policy decisions and a queryable audit trail; Python run records finalize post-hoc (out of scope for the ordering guarantee).

## 4. Audit stores (three — do not conflate)

- Rust receipts JSONL: `aci_approvals.rs:231-434`, `<computer_use_dir>/receipts/receipts.jsonl`, row `RedemptionReceipt {receipt_id, grant_id, user_id, action_hash, outcome, reason, redeemed_at}`. **No bot id / session / host / path / MCP fields today. No HTTP read API.**
- Python EventLedger `canonical_events.py:17-103` (events.sqlite3, payload JSON; read: `list_session`).
- Python RunPersistence `run_persistence.py:44-150` (runs.sqlite3; HTTP `GET /runs*` on ACU).

**Decision**: new gateway-side store `policy_audit.jsonl` in the same computer-use dir, one row per policy decision:
`{ts, decision: allowed|denied, rule_id, bot_id, session_id, actor, tool, intent, host, path, mcp_tool, run_id?}`.
Denied rows MUST be written before the action dispatches (audit-before-act). New HTTP read API on the Rust gateway: `GET /api/aci/policy/audit?bot_id=<id>&limit=<n>` — bot-scoped, newest first.

## 5. Policy document & fail-closed semantics

- Env `ALLTERNIT_ACI_POLICY_FILE` → path to a JSON policy doc (same operational shape as OpenBot's `AGENT_COMPUTER_POLICY`). No CEL — declarative JSON rules.
- States: **unset** → engine off, legacy behavior unchanged (keeps existing suites green; this is the Phase 1 default). **set + missing/empty/malformed** → gateway REFUSES STARTUP naming the broken rule (fail-closed; OpenBot parity). **set + valid** → evaluate every action: deny rules before allow; doc with zero matching allow for an action and any rules present → deny (a present-but-empty rule list denies everything).
- Rule shape (extends `PermissionRule`): `{ id, tool (glob), intent?, botId?, sessionId?, mcpTool?, networkHost?, filePath?, action: allow|deny|ask }`. `ask` = pass through to the existing grant/approval flow (additive — do not remove it).

## 6. Bot-mode UI (React + TS, Tailwind, phosphor-icons, `cn()` from `@/lib/utils`)

- Bot session view: `surfaces/ai.allternit.com/src/views/bots/BotChatSessionView.tsx` (536 lines). **This is where ALL new UI lives. No new ViewRegistry/nav entries.**
- Bot mode = `session.metadata.sessionMode === "agent"` (+ `metadata.isBot`, `botCanonicalFor`) — see `BotHubSessionsTab.tsx:80-84`, `bot-canonical-chat.service.ts:104-115`.
- Watch/takeover precedent: `BotComputerViewport.tsx` (`observeBotDesktop`/`takeOverBotDesktop`/`handBackBotDesktop`, control states `human_observing/human_controls/bot_controls`, VNC WS).
- Reusable pieces: `src/components/ui/badge.tsx`, `Pill.tsx`, `AgentPill.tsx`; status-dot pattern `BotHubCard.tsx:131-135` using `--status-*` CSS vars. **No ActivityFeed exists** — build on Badge/Pill.
- SSE plumbing: `src/lib/sse/global-sse-manager.ts` (ref-counted EventSource multicast). Rust has NO approval SSE (poll-based `GET /api/aci/approvals/:id`); Rust run stream is `/api/aci/stream/:id` (in-process buffer).
  **Decision**: verdict chips poll `GET /api/aci/policy/audit?bot_id=` every ~3s while the session is open and merge with any run events already consumed by the session view. Do NOT build a new SSE transport in Phase 1.

## 7. Test conventions

- Rust: `cargo test -p allternit-api`; HTTP tests use `tower::ServiceExt::oneshot` + `crate::test_helpers::app_state`; mock ACU by pointing `ALLTERNIT_ACU_URL` at a local axum mock (pattern at `aci_routes.rs:1274-1561`).
- Frontend: vitest, colocated `*.test.ts(x)`.
- The forced-executor-failure ordering test: configure policy to allow, point dispatch at a mock that 500s, assert the `policy_audit.jsonl` row exists BEFORE/with the failed call (assert row present after failure, action never executed).

## 8. Repo ritual (AGENTS.md)

Worktree on branch `ao/openbot-policy-gateway`. Executor: NO git operations, no commits, no dev servers. Orchestrator opens the PR + writes the ledger summary. Ledger format: `agent-ledger/summaries/YYYY-MM-DD-HHMM-<session>-<agent>-<topic>.md` + one-line entry in `agent-ledger/LEDGER.md`.

## 9. Explicit deviations from the source spec (orchestrator decisions, recorded)

1. **"Missing policy permits nothing"** is implemented as fail-closed *when policy is configured* (`ALLTERNIT_ACI_POLICY_FILE` set): missing/empty/malformed doc → startup refusal. When the env var is unset the engine is off so existing behavior and suites are untouched (spec requires policy be additive, not a bypass).
2. **Ordering guarantee scope** = gateway-side paths (`aci_run`, `execute_computer_tool`, computer tool routes) write audit rows before dispatch. Python-side post-hoc run persistence is unchanged (Phase 2 concern).
3. Policy **extends `permission_policy.rs`** instead of a new schema (exploration finding; spec said "extend existing over new").
