# Steering checkpoint

## session/adispatch-0912 — phase 3: deferrals cleared (third PR, NOT merged)

### Goal
Owner directive: merge #429 [DONE, 0281ba515] + ritual [attestation 3fa88fb35];
desktop rebuild retry from clean state [DONE — DMG built + verified]; then clear
the four documented deferrals in a third PR (do NOT merge).

### Just did
- Merged #429 (conflict: checkpoint only, resolved; 15/15 tests green pre-merge).
- Attestation: agent-ledger/summaries/2026-09-12-1930-*.md + LEDGER, main dc..3fa88fb35.
- Desktop rebuild from clean merge-commit worktree: preflight 35/0; attempt 1
  built the .app + sidecar but DMG naming failed (ALLTERNIT_BUILD_SUFFIX unset);
  attempt 2 with suffix=-local produced
  Allternit-Desktop-1.1.1-local-arm64.dmg (unsigned per ritual). Bundle
  verified: sidecar contains all /fabric/transport/* route strings. New DMG
  staged in the machine-owned desktop-preview worktree next to the previous
  b2186 DMG (old left in place — preview worktree is not session-owned).
- (a) V156 approval expires_at + sweeper/boot approval.expired + late-grant
  rejection + re-request recovery policy. (b) V157 event client_event_id
  idempotency (POST /runs/:id/events, duplicated:true canonical return).
  (c) V158 cowork_approval_policy + risk_policy.rs mirroring the TS
  ApprovalGate rule model — single execution-gating path; TS gate untouched
  (UI-side pending manager). (d) contract doc updated (§5/§8.14 notes,
  Appendix A, scorecard, changelog).
- 15/15 tests green (new: approval expiry, event idempotency, risk policy).
  Live spot-checks: 2s-TTL approval expired by sweeper, late grant 409;
  event retry deduped (2 rows, canonical id returned).

### Next
- Push + open PR #3 (do NOT merge). Owner reviews.

### Open questions
- Unifying the TS ApprovalGate pending-set with the binding table (single
  table) left for a later slice; Cowork surfacing of auto-deny reasons open.
