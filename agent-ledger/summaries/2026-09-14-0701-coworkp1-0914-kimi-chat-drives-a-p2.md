# Attestation — session/coworkp1-0914: Consumer-packaged Cowork Phase 2 "Chat drives A://"

- **Date:** 2026-09-14
- **Agent:** kimi (Kimi Code CLI), session `coworkp1-0914`
- **PR:** #508 — merged to main `a29d7c743f3328ccfd575f896813ebd4fd970f02` (owner-authorized)

## What was done

Cowork chat no longer relays directly to a model — every request becomes a
canonical intent → orchestrator delegation → leased worker run:

- **2.1** `POST /cowork/al/chat/stream` (SSE) sharing `prepare_delegation`
  with `/cowork/al/chat`; frames delegation → run_state → approval/
  approval_decision → result → finish; SPA routes chat through it behind
  `NEXT_PUBLIC_ALLTERNIT_COWORK_CHAT_VIA_AL` (legacy `/api/agent-chat` stays
  default; parity checklist in PR #508).
- **2.2** agentic job kind in the gizzi worker — bounded model-agent loop via
  the EXISTING model router (operator key; no new LLM path), fs_read/fs_write/
  bash tools, per-step checkpointing, step/token budgets. 7 bun tests.
- **2.3** trusted_folders confinement in worker file tools (default-deny,
  realpath/symlink-safe); desktop passes grants from /cowork-preferences.
- **2.4** approval cards (ApprovalToastHost) → existing fabric approvals
  endpoints; decided-by recorded server-side.

## Verification

- 43/43 runtime tests; build + clippy clean; gizzi/SPA/desktop typechecks
  clean; preflight 36/0.
- **Live demo** (`tmp/p2-evidence/`): chat → delegation frame → worker claim →
  **kill mid-run** (`leased`) → sweeper requeue (`queued`, retry 1) →
  recovery at lease_generation 2 → completed → artifact only inside the
  granted folder (0 outside). Model endpoint scripted mock; everything else
  real (canonical store, claim/lease/sweeper, checkpoints, SSE).

## Incidents / notes

- First demo attempt killed the worker AFTER completion (instant mock) —
  rerun with a 3 s model delay made the mid-run kill real.
- Rebuild policy: desktop bundle rebuilt after P2 (see ledger entry for the
  rebuild result) and will be rebuilt again after the final phase.

## Deferrals

- Parity items before flipping the flag (15-min ceiling, providerRouting
  pass-through, multi-turn richness) — listed in PR #508.
