# Steering checkpoint — session/cu9-pycore

## Goal
Push the Allternit computer-use Python core to A grade via 4 stages (sole ownership of `domains/computer-use/**`):
1. Workflow-spec executor (`core/workflow_runner.py`) + `POST /v1/browser-skills/run` in the gateway
2. Canonical persistence: canonical event emission from planning/replay/workflow/direct paths + SQLite run records + recordings index (survive gateway restart)
3. Measured conformance: actually run suites A/D/F against available adapters, write real `pass_rate` into `adapter_grades.json`
4. Monitor hook (`core/monitor.py`) in the planning loop

## Just did
- Stage 1 COMPLETE: `core/workflow_runner.py` (spec/skill-package loading, {{input}} parameterization with approval pause, safety.requiresApprovalFor pauses, executor+plain adapter vocab, workflow.* events), `gateway/browser_skills_router.py` (`POST /v1/browser-skills/run` in shared RunStore, pollable + SSE + approve-compatible, skill_id resolution from ~/.allternit/browser-skills/), wired into `gateway/main.py`, `RunStore.finalize()` persistence seam.
- Tests: `tests/test_workflow_runner.py` 25 passed (incl. HTTP poll/approve pause flow).
- Verification: full suite 167 passed / 21 skipped (baseline 142/21, +25 new). Live smoke on :8983 (killed after): 3-step workflow vs https://example.com via CDP adapter → all 3 steps ok, run pollable at GET /v1/computer-use/runs/{id}; missing-param run → abandoned.
- Bug found en route: FastAPI query param `wait` shadowed by body model field (query never parsed) — fixed with explicit Query override. TestClient needs `with TestClient(...)` so the portal loop survives across requests (background run tasks were cancelled mid-approval otherwise) — pre-existing pattern in test_replay, adopted in new tests.

## Key findings / decisions
- Baseline note: `tests/test_e2e.py` + `tests/test_real_adapters.py` fail COLLECTION on main — they import a nonexistent `sessions` module. Pre-existing breakage, NOT mine to fix (out of surgical scope); baseline measured excluding those two modules.
- Workflow kind → adapter action mapping: executor vocabulary (`navigate`, `left_click`, `type`, `key`, `scroll`, `fill`, `wait`, `extract`, `screenshot`) for executor adapters; plain-adapter map (`goto`, `click`, `type_text`, `press`, ...) for plain adapters. Unmapped kinds pass through unchanged.
- Missing `{{input}}` param → pause with `approval.required` (kind `workflow.input_required`); approve = continue with empty substitution, deny = abandon run. `safety.requiresApprovalFor` kinds also pause pre-execution.
- Run persistence: new `gateway/run_persistence.py` — `runs.sqlite3` (runs table) + recordings index table, honoring `ALLTERNIT_COMPUTER_STATE_DIR`. `RunStore` gets an optional persistence backend; non-terminal runs found at startup load as `interrupted`. New `GET /v1/computer-use/runs` lists memory + history.
- Canonical events: lazy `_emit_canonical()` in `computer_use_router.py` importing `_events` EventLedger from `canonical_router` (already imported by gateway main); no-op fallback so unit tests stay light.
- Conformance: new `conformance/measured.py` — builds a mock browser adapter (new, reusable), CDP adapter if health-check passes, runs suites A/F (+D if display), writes `adapter_grades.json` with real numbers under measured adapter ids (`browser.mock`), unmeasured suites (B/C/E etc.) marked `measured: false`, `grade: null` honestly.

## Next
Stage 2: canonical persistence — `gateway/run_persistence.py` (runs.sqlite3 + recordings index), wire into RunStore, canonical event emission across planning/replay/direct paths, GET /runs list, restart-survival test.

## Open questions
- None blocking. (Skill-store: `skill_id` resolution reads `~/.allternit/browser-skills/<skill_id>.json` if present, else 404 — no canonical skill store exists on the Python side yet.)
