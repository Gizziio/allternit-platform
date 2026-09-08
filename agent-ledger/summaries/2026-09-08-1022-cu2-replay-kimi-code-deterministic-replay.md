# Session cu2-replay — deterministic replay wired (D → working)

- Date: 2026-09-08 (swarm session, orchestrated by Kimi Code goal run)
- Branch: session/cu2-replay → PR #142 → merge b5e91c615

## What was done
Record-and-teach could record (JSONL+GIF) but `ActionRecorder.replay` had zero call sites and `/replay` 404'd after stop (audit grade D).

- New `core/core/replay_engine.py` (`ReplayEngine`): step-by-step re-execution through the adapter layer, after-screenshot deviation check (Pillow mean-abs-diff, threshold default 0.05), pause → approval callback (resume/abandon), cancel support, `replay.*` events.
- `action_recorder.py`: `find_recording_path`/`load_recording`; `ActionRecorder.replay` delegates to ReplayEngine; `list_recordings` served over HTTP.
- Gateway: `GET /recordings`; `/record` gains `append`; `/replay` rewritten to load completed recordings **from disk**, run as replay runs in `RunStore` (pollable + SSE), deviation pause via existing `approval_future` → `POST /runs/{id}/approve` (approve=resume, deny=abandon, 120s timeout=abandon); `wait=true` option.
- `core/tests/test_replay.py` — 22 tests.

## Verification
pytest test_replay.py 22/22; full core/tests 104 passed (failures pre-existing, identical on main). **Live smoke**: record 3 frames → stop → list from disk → replay completed 3/3; strict threshold paused on real 0.463 deviation → approve → resumed → completed; timeout path → abandoned.

## Honest deferrals / incidents
- `/replay` response shape changed (old payload only ever 404'd).
- N deviating steps = N pauses (one approval each) — documented.
- Used pre-existing user venv `~/.venv-acu311`; installed pytest/pytest-asyncio/pyautogui into it.
