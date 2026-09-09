# cu16-replayui checkpoint — COMPLETE

## Goal
Session replay as product surface in surfaces/ai.allternit.com (SOLE ownership; sdk/computer-use read-only): Recordings view — list, steps, inline GIF, Replay w/ deviation threshold, Run-as-workflow w/ compile-first hint, run polling, approval banner.

## Just did
- Implemented: src/remote-control/api/recordings.ts (+15 tests), src/remote-control/recordings/RecordingsPanel.tsx, DashboardPage wiring.
- Verified: typecheck PASS (0 errors); new tests 15/15; full suite 1424 passed + 1 pre-existing failure (fabric-session-kind, fails on untouched main); remote-control vite build clean (artifact removed).
- Committed c257bce46, pushed session/cu16, opened PR #173. Not merging (orchestrator merges).

## Next
- Orchestrator merge + ledger attestation per repo AGENTS.md (steps 6-8) after merge.

## Open questions
- Gateway recordings detail/file/gif routes don't exist on main; UI degrades gracefully. If the gateway-owning sprint session adds them under different paths, the client paths in recordings.ts are the single place to adjust.
