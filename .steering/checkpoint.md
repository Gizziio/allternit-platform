# Steering checkpoint — session/adocs2-0913 (gap work)

## Goal
Owner directive: merge #463 [done, 550cccd9, attestation 3a3673021], then
implement ALL documented gaps (1 mint principals, 2 bot linkage, 3 delegation
chains, 4 IntentEnvelope + cowork_executions replacement, 5 UI control
surface), update docs, one PR stopped before merge.

## Just did
- Gaps 1–4 backend: V162 roles / V163 agents.principal_id / V164 intents+
  chains+depth (renumbered after main took V159–V161). seed_default_principals
  at boot; provision-token endpoint; agent create mints principal in-tx
  (token once); validate_delegation_chain (cycle/depth, workspace depth);
  IntentEnvelope + idempotent submit_intent + POST/GET intents; run-agent/
  team-execute route through intents (cowork_executions dead end removed);
  approvals inbox endpoint. New A_DELEGATION_CYCLE/A_DELEGATION_DEPTH_EXCEEDED.
- Gap 5 UI: FabricTransportView + lib client + /fabric-transport route;
  ViewRegistry on main already expected the named export — provided it.
  tsc clean on touched files (pre-existing unrelated errors elsewhere).
- Docs updated to completion (scorecard, matrix, bot/Al/Gizzi/schema/state
  docs, changelog); no stale open-gap lists except re-scoped ones.
- Live evidence: boot-seeded Al/Gizzi; agent→principal+token; intent idempotent
  replay (same run_id); cyclic chain 409; Gizzi token claimed chain-carrying
  job; auto-approve reason surfaced. 18/18 tests, build clean, clippy clean.

## Next
- Commit, push, open PR, stop before merge. No attestation.

## Open questions
- Auto-decisions write no binding row (synthetic grant); the WHY is in the
  ledger event + API response, and the view shows decided_by for row-backed
  decisions. Documented as intentional minimal scope.
