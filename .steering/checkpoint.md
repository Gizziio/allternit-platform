# Steering Checkpoint — session/3a37a822-p4 (desktop boot time)

## Goal
Owner: "we need to fix all of this" — the ~60s desktop boot. Measured breakdown
from real log timestamps (01:42:21 → API ready 01:43:14):
- gizzi-code: ~2s (fine)
- ACU gateway: 20s DEAD WAIT — python launch.py crashes in 35ms (no uvicorn),
  but the exit handler nulls `this.child` before `waitForHealth` checks
  `child.exitCode`, so the early-exit check never fires and it polls the full
  HEALTH_TIMEOUT_MS. Fix: `childDied` flag set in the exit handler before
  nulling; waitForHealth checks the flag. + test (gives up <2s).
- BackendManager reuse probe: 30s DEAD WAIT — `ensureBackend` probes :8013 for
  an existing API with waitForUrl, which swallows ECONNREFUSED and polls the
  full 30s on every cold boot. Fix: extracted `probeExistingBackend()` with a
  1-shot fast probe; ECONNREFUSED → 'none' immediately; ambiguous errors keep
  the patient probe; healthy-but-no-platform → 'misbehaving' (terminate path
  preserved). + tests (4 cases).
- Clerk 20s wait: INVESTIGATED, DROPPED — it is `recoverAccountEmail()`, fired
  void/parallel only when the paired identity has a synthetic email; not on
  the boot critical path. Left alone (auth behavior, not boot time).

Expected boot after fixes: ~2-5s to API listening (was ~52s).

## Just did
- Fixes + tests written in surfaces/allternit-desktop/src/main/
  (backend-manager.ts/.test.ts new, acu-gateway-manager.ts/.test.ts extended;
  AcuGatewayManager class exported for testability).
- pnpm install running in the fresh p4 worktree (needed before vitest/tsc).

## Next
Typecheck + run the two test files → full desktop vitest suite → release-preflight
26/0 (release-path change, release lock applies) → commit/push/PR/merge →
attestation → rebuild desktop main (asar only, no Rust) → reinstall → measure
real boot time.
