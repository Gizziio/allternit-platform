# Attestation — session/adispatch-0912 (phase 3, final) — A:// approval timeout, event idempotency, unified risk-policy path

**Date:** 2026-09-12 (late evening)
**Agent:** kimi (subagent of the ao orchestrator)
**PR:** #436 — merged as `f265a85d4ae95b86d43016942ab1bfd28b5624c2` (merge commit)
**Session:** closed after this attestation (worktree + branch removed)

## What was built

Phase 3 of the A:// fabric-transport slice, clearing the four deferrals from
#429. All fabric-transport naming; built on merged main (`0281ba515`).

### (a) Approval timeout / auto-deny — migration V156

`cowork_approval_bindings.expires_at` (server clock; request TTL selectable,
default 300s). Sweeper (run.rs) and boot downtime pass (main.rs) both run
`sqlite_store::expire_approvals`: stale pending requests become `expired` with
executor-attributed `approval.expired` events. `decide` after expiry →
`A_APPROVAL_INVALID`; `check` on expired → `A_APPROVAL_REQUIRED`. Recovery
policy (documented in the contract): **re-request**, deny-by-default — a late
grant can never authorize execution already told to re-request.

### (b) Client-supplied event_id idempotency — migration V157

`cowork_run_events.client_event_id` (unique per run). `POST /runs/:id/events`
accepts `event_id`; `insert_event_idempotent` returns the canonical existing
event (`duplicated: true`) on retry instead of double-writing.

### (c) Single approval policy path — migration V158

`allternit-cowork-runtime/src/risk_policy.rs` implements the cowork-engine
`ApprovalGate` rule model in Rust (first-match actionType+riskLevel, low-risk
auto-approve default) + canonical risk table for the §8.6 vocabulary.
`cowork_approval_policy` holds workspace overrides. Risk rules decide WHETHER
a protected action needs an approval; bindings scope it when required.
Auto-decisions are ledgered via the request path (`approval.granted`/`denied`,
`decided_by: risk-rule (...)`); `check_approval` is read-only so polling cannot
flood the ledger. The TS `ApprovalGate` is untouched — UI-side pending manager,
not an execution gate.

### (d) Contract doc

§5 idempotency note, §8.14 timeout/policy notes, Appendix A Approval row, §16
scorecard (Approval = conformant), changelog fourth update.

## Verification evidence

- `cargo test -p allternit-cowork-runtime` — 15/15 green, including
  `test_approval_expiry_and_late_grant_rejected`,
  `test_event_post_idempotency`, `test_risk_policy_single_evaluation_path`.
- `cargo build -p allternit-api` — 0 errors; clippy clean on touched files.
- Fresh-DB migrations V156–V158 verified.
- Live: 2s-TTL approval expired by the sweeper with attributed event; late
  grant → HTTP 409 A_APPROVAL_INVALID. Event POST retry with the same
  `event_id` → `duplicated: true` + canonical id (2 rows for 3 deliveries).

## Desktop rebuild (ritual step 8)

Clean worktree at merge commit `0281ba515`: preflight 35/0; DMG
`Allternit-Desktop-1.1.1-local-arm64.dmg` built (attempt 1 failed only on the
artifact-name env; attempt 2 with `ALLTERNIT_BUILD_SUFFIX=-local` succeeded,
unsigned per local-build rules). Bundle verified to contain the
`/fabric/transport/*` routes. Staged in `allternit-desktop-preview` next to the
previous b2186 DMG (old kept — preview worktree is machine-owned).

## Honest deferrals

- TS `ApprovalGate` pending-set not yet physically merged with the binding
  table (rule model shared; merge is UI work).
- Cowork UI does not yet surface auto-decision reasons (ledger has them).
- System-generated fabric-transport events are single-writer by construction;
  client-key idempotency covers the external event API.
