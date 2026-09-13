# Attestation — session/adocs2-0913 (final) — A:// gaps + task DAG A-T1–A-T5

**Date:** 2026-09-13 (evening)
**Agent:** kimi
**PR:** #473 — merged as `4d4da9eb84903ece2a03af85161cb599dbc3dc1f` (merge commit)
**Session:** closed after this attestation (worktree + branch removed)

## Round 1 — the five gaps from the second-pass docs

- **Gap 1 — default principals (V162):** idempotent per-workspace minting of
  `principal/al` (roles orchestrator/user-interface, zero capabilities) and
  `principal/gizzi` (roles worker/code/terminal + canonical capability set) at
  boot; credential-free seeding; `provision-token` returns/rotates the bearer
  token exactly once.
- **Gap 2 — bot linkage (V163):** agent creation mints the fabric principal
  in-transaction, records `agents.principal_id`, returns the token once.
- **Gap 3 — delegation chains (V164):** `causation_chain` on runs/jobs,
  cycle + depth validation (default 4, workspace-reducible),
  `A_DELEGATION_CYCLE` / `A_DELEGATION_DEPTH_EXCEEDED`.
- **Gap 4 — IntentEnvelope (V164):** canonical type, idempotent submission
  (same intent_id → same canonical run), `POST/GET /fabric/transport/intents`;
  `/cowork/run-agent` and `/team-execute` replaced the dead-end
  `cowork_executions` inserts with canonical intents; approvals inbox endpoint.
- **Gap 5 — control surface:** `FabricTransportView` (+ API client, route) —
  intents, canonical runs, approvals inbox with grant/deny and decided_by
  reasons, attributed events, results. Frontend typecheck clean.

## Round 2 — task DAG A-T1–A-T5 (recorded in MASTER_TRACKING.md)

- **A-T1 (V165):** handoff chains validated; `cowork_handoffs.job_id`;
  `POST .../handoffs/:id/ack` completes the linked job — the audit finding
  (handoffs could never complete) is fixed.
- **A-T2 (V165):** per-principal memory grants (owner + grants, default-deny
  cross-principal) on `/cowork/memory`.
- **A-T3 (V166):** deterministic Al orchestration loop (2s tick): delegation
  rules → child intent (chain extended) → monitor → parent-run mirroring;
  attributed delegation.created/rejected/completed/failed. No model involved.
- **A-T4:** Gizzi claim loop in gizzi-code (`fabric-transport/worker.ts`):
  env token, long-poll claim, `Sandbox.wrap` execution, heartbeat,
  checkpoints, typed Result. gizzi-code typecheck clean.
- **A-T5 (V167):** connector broker v0.1 — env-var-referenced secrets (never
  stored/returned), lease+policy validated principal-bound sessions,
  approval-gated protected capabilities, system-side invocation with an
  honest simulated path; reference connector `connector.webhook.send`.

## Verification evidence

- `cargo test -p allternit-cowork-runtime` **22/22** (8 new: principal
  seeding/rotation, chain cycle/depth, intent idempotency, handoff ack,
  memory grants, orchestration loop, broker sessions).
- `cargo build -p allternit-api` 0 errors; clippy clean; gizzi-code and
  frontend typechecks clean; V162–V167 verified on fresh DBs.
- Live: orchestrator delegated an Al-targeted intent to Gizzi and recorded
  `delegation.completed`; the real bun-run TS worker claimed/executed/
  completed a job over the transport; handoff ack completed its linked job
  (cyclic chain → 409); memory grants visible to owner+grantee only; broker
  session invoked a local webhook catcher (HTTP 200, no secret in response).

## Docs

A_PROTOCOL scorecard, contract changelog, conformance matrix (§5b proof
table), AL/GIZZI/BOT/SCHEMA specs — all updated to Implemented; no stale
open-item lists; remaining items explicitly re-scoped as product depth
(installed-daemon packaging, Al persona runtime, rich Cowork rendering,
connector breadth, non-local placement, multi-store consolidation).

## Incidents / honest deferrals

- Migrations renumbered twice as main moved (final: V162–V167).
- Auto-decisions create no binding row (synthetic grant); the WHY is in the
  ledger event and API response. Documented as intentional minimal scope.
