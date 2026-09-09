# Session cu18 — Gateway recordings detail/file/GIF routes

- **Date:** 2026-09-09
- **Agent:** kimi-code (orchestrated swarm task A)
- **PR:** #186 → merge 5948fbcff
- **Branch:** session/cu18-recordings

## What was done

Added the three GET routes the remote-control surface's typed client (`surfaces/ai.allternit.com/src/remote-control/api/recordings.ts`) was written against but which did not exist on the gateway (flagged as packaging-sprint follow-up from PR #173):

- `GET /v1/computer-use/recordings/{id}` → `{manifest, steps, gif_url}` mapped exactly to the TS `RecordingManifest`/`RecordedStep` contract, parsed from the on-disk JSONL via `ActionRecorder.load` (screenshot b64 stripped).
- `GET /v1/computer-use/recordings/{id}/file` → verbatim JSONL as `application/x-ndjson`.
- `GET /v1/computer-use/recordings/{id}/gif` → `image/gif` (candidates: manifest `gif_path`, `<id>.gif`, `session-<run_id>.gif`) or clean 404.
- Unknown id → 404 `{"detail": ...}` on all three; malformed JSONL → 400.

## Security

Recording ids are filesystem lookups. Two layers in `_resolve_recording_path`: regex allowlist `^[A-Za-z0-9._-]+$` AND resolved-path containment (`Path.resolve()` + `is_relative_to`) against the recordings root. GIF candidates get the same containment check. Traversal ids (`..`, `..%2F..%2Fetc%2Fpasswd`, `a/b`, `/etc/passwd`) verified rejected without touching a decoy outside the root.

## Verification

- `tests/test_recordings_routes.py` (new, 15 tests): 15 passed via FastAPI TestClient.
- Full gateway folder: 22 pre-existing failures (live-server tests needing a gateway on :8080, httpx.ConnectError), byte-identical on unmodified main. No regressions.
- Post-merge on main: 30/30 (with cu19's suite) green.

## Incidents / deferrals

- Under pytest the outer `domains/computer-use/core/__init__.py` binds as `core`, breaking the router's inner-`core` imports; fixed for the gateway tests with `tests/conftest.py` pinning the inner package (same pattern `core/tests/conftest.py` documents). Repo-wide fix deferred, out of scope.
- `~/.venv-acu311` has a stale editable install pointing at deleted worktree `allternit-session-desktop-cloud-mvp` — harmless, noted for cleanup.
- No live uvicorn smoke: TestClient covers routing/headers/error shapes end-to-end.
