# Checkpoint — session/cu18-recordings

## Goal
Add three GET routes on /v1/computer-use in domains/computer-use/core/gateway/computer_use_router.py:
- GET /recordings/{recording_id} → {manifest, steps, gif_url}
- GET /recordings/{recording_id}/file → raw JSONL bytes
- GET /recordings/{recording_id}/gif → GIF bytes or 404
Matching the typed client contract in surfaces/ai.allternit.com/src/remote-control/api/recordings.ts.
Plus tests/gateway/tests/test_recordings_routes.py (TestClient), all green.

## Just did
- Implemented the three routes + helpers in computer_use_router.py (region right after
  /recordings endpoint): regex allowlist ^[A-Za-z0-9._-]+$ AND resolved-path containment
  via Path.resolve() + is_relative_to; JSONL parsed with ActionRecorder.load and mapped to
  the TS RecordingManifest/RecordedStep contract; file route returns verbatim bytes as
  application/x-ndjson; gif route serves image/gif or clean 404 {"detail": ...}.
- Wrote tests/test_recordings_routes.py (15 tests, all green) and tests/conftest.py.
- Incidents solved:
  1. Under pytest, the OUTER package (domains/computer-use/core/__init__.py) binds as `core`,
     which silently made the router's `from core.action_recorder import ...` fail
     (_recorder_available=False → routes would 503). Fixed with gateway/tests/conftest.py
     pinning the INNER core package — same documented pattern as core/tests/conftest.py.
  2. find_recording_path raises FileNotFoundError for unknown ids → converted to 404 in
     _resolve_recording_path.
- Full-folder verification: tests/ → 19 passed, 22 failed — identical 22 pre-existing
  live-server failures (httpx.ConnectError, need a running gateway on :8080) as on
  unmodified main. No regressions.

## Next
1. DONE: committed (3f3f32a8a) and pushed session/cu18-recordings.
2. DONE: PR #186 opened — https://github.com/Gizziio/allternit-platform/pull/186
3. STOPPED per instructions — orchestrator merges; worktree + branch left intact
   (resumable state) for merge/attest/cleanup.

## Open questions
- None. GIF candidates: manifest.gif_path, then <id>.gif, then session-<run_id>.gif
  (ActionRecorder convention), all containment-checked inside the recordings root.
