# Checkpoint

## Goal
Fix 3 Python-side computer-use bugs (direct-actions execute path, recorder gif_path loss, replay approval event), add tests, live smoke, push PR.

## Just did
- Direct mode: ExecuteBody.task optional + actions list; _execute_direct_path dispatches per-action through adapter/executor, per-action results + screenshot artifact; 422 validation.
- Recorder: load() preserves gif_path; new public feed_gif_frame(); /record append now feeds GIF buffer (HTTP-built recordings produce GIFs).
- Approval gates: router-owned machine-readable approval.required/approval.resolved SSE events with run status for planning + replay paths.
- Fixed pre-existing tests/ module-aliasing (outer vs inner `core` package) with tests/conftest.py pinning inner core; added tests/test_import_hygiene.py guard.
- 123 tests pass; live smoke on :8981: direct execute ran 2/2 actions via browser.cdp (real screenshot), 422s confirmed; server killed, artifacts cleaned.

## Next
- Final full pytest re-run, review diff, commit, push, PR with contract doc.

## Open questions
- TS client expects error as {code,message} object; Python envelope keeps error as string (pre-existing shape) — documented in PR contract.
