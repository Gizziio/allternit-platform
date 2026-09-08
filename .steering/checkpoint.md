# Checkpoint (final — handed to orchestrator for merge)

## Goal
Fix 3 Python-side computer-use bugs, test, smoke, PR. DONE — PR #152, branch session/cu6-pyfix @ 20d980f31.

## Just did
- All 3 fixes + tests + conftest aliasing fix; 123 passed/21 skipped.
- Live smoke on :8981 verified direct mode (2/2 actions via browser.cdp, real screenshot) + 422s.
- Committed (fix(computer-use): …), pushed, PR #152 created with full JSON contract at top.

## Next (orchestrator)
- Review/merge PR #152 (merge commit, not squash). After merge: ledger attestation + worktree/branch cleanup per AGENTS.md steps 6-8.

## Open questions
- TS side must adapt: response `error` is a plain string|null, not {code,message} EngineError (pre-existing envelope; documented in PR).
