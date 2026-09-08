# Checkpoint — session/cu2-replay

## Goal
Make deterministic replay real in domains/computer-use.

## Just did
- Implemented ReplayEngine + disk load + router rewiring + 22 passing tests (see prior checkpoint).
- LIVE SMOKE TEST PASSED on :8977 (uvicorn gateway, 5 adapters registered):
  1. /record start → append 3 frames → stop → GET /recordings listed completed recording from disk (recorder popped).
  2. /replay wait=true thr=0.05: step 1 executed OK via adapter layer, deviation 0.463 > 0.05 → PAUSED → approval timed out (120s) → abandoned. Deviation pause proven live.
  3. /replay wait=true thr=0.99: completed, steps 1-3 all ok.
  4. /replay thr=0.05 async: paused at awaiting_approval → POST /runs/{id}/approve approve → resumed → completed.
- Server killed, smoke recordings + /tmp scratch deleted.

## Next
- Commit, push session/cu2-replay, open PR (do NOT merge).

## Open questions
- None
