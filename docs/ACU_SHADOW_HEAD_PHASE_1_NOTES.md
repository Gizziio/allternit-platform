---
status: done
files_changed:
  - domains/computer-use/core/core/element_table.py
  - domains/computer-use/core/core/decision_head.py
  - domains/computer-use/core/core/shadow_eval.py
  - domains/computer-use/core/core/planning_loop.py
  - domains/computer-use/core/pyproject.toml
  - domains/computer-use/core/scripts/shadow_head_eval.py
  - domains/computer-use/core/tests/test_element_table.py
  - domains/computer-use/core/tests/test_decision_head.py
  - domains/computer-use/core/tests/test_shadow_hook.py
  - domains/computer-use/core/tests/test_shadow_eval_smoke.py
  - docs/ACU_SHADOW_HEAD_PHASE_1_NOTES.md
deviations:
  - "Hook placement: the shadow hook sits after the per-step AX skeleton refresh (planning_loop.py, just before the ACT phase), not literally at the decide call at ~line 344. This is still 'after the decide, plan created, before ACT' per the task spec, and it means the element table is built from the freshest observation — the same one the action will act on. Placing it before the AX refresh would force the head to reason about a stale tree."
  - "Model revision pin: DEFAULT_REVISION is None (repo default branch) with an SHADOW_HEAD_REVISION env override, instead of a fabricated commit hash. Pinning a guessed hash is worse than none; record the concrete commit hash here after the first verified download."
  - "Eval harness drives PlanningLoop over synthetic observations (scripted AX inspector + recorded LLM transcript + MockHead), per the MAP's own note that replay_engine re-executes recordings without re-running the decide step. This was the cheapest correct option; a recorded-decision replay mode inside ReplayEngine was the alternative and was rejected as larger scope."
  - "pytest invocation: plain `uv run pytest` fails dependency resolution in this checkout for Python >= 3.15 markers (pre-existing pyobjc pin in the `mobile` extra, unrelated to this diff). Used `uv run --frozen --extra dev` (plus `--with fastapi --with pydantic --with mcp` for the gateway-importing tests)."
  - "tests/test_e2e.py and tests/test_real_adapters.py do not collect in this checkout: both import a top-level `sessions` module that does not exist anywhere under domains/computer-use/ (pre-existing, unrelated to this diff). They were excluded from the full-suite run; everything else collects and passes."
remaining:
  - "Download mlx-lm + weights once (uv pip install 'allternit-computer-use[shadow-head]') and record the verified commit hash into DEFAULT_REVISION in core/decision_head.py."
  - "Run the eval with MlxDirectLogitHead instead of MockHead to get real agreement numbers (the harness accepts any DecisionHead; wire head selection into scripts/shadow_head_eval.py)."
  - "Build labelled traces from shadow.decision events to seed the Tier A classifier (Phase 2 — explicitly out of scope here)."
---

# ACU Shadow Head — Phase 1 Notes

## What was built

**`core/element_table.py`** — atomic indexed table of observed elements, built
from the loop's AX skeleton observation (the `ax_tree.captured` compact-dict
shape, or the `AccessibilityNode` itself). Rows carry index, role, name,
value, the `@eN` ref from the existing refmap when assigned, and a closed
operation set per role (subset of the 11-action whitelist mirrored from
`core/batch_dispatch.py`; Rust `BATCH_ACTION_WHITELIST` stays authoritative).
Pruning to the configurable cap (default 250, per the jev-ultrafast reference
pattern) is documented in the module docstring: interactive → ref'd → named →
role-only, stable depth-first order within tiers. Target options map to
observed row indices only — never selectors, coordinates, or JS.

**`core/decision_head.py`** — head-agnostic `DecisionHead` protocol
(`decide(state_text, questions) -> TypedDecision`: per-option probabilities +
entropy-based confidence, validation of probability sums and confidence
bounds). Two implementations:

- `MlxDirectLogitHead` (Tier B): one prefill of the state with mlx-lm, a
  per-option first-token logit readout at the final prompt position, softmax
  across options, entropy confidence. Operation choice + speculative
  `<operation>_target` choices in one pass. Public ungated Apache-2.0 repo
  (`mlx-community/Qwen3-4B-Instruct-2507-4bit`, Qwen3.5-4B class), lazy
  download, clear actionable error when the optional extra is absent. No
  network calls at inference once weights are cached.
- `MockHead`: deterministic scripted/callback head for tests and offline
  evals — no model download anywhere in the test path.

**`core/planning_loop.py`** — `PlanningLoopConfig.shadow_head_enabled`
(default False), `shadow_head_max_elements`, `shadow_head`. After the AX
refresh, before ACT: build table → ask head → emit `shadow.decision`
(added to `LOOP_EVENTS`) with latency, confidence, element count, and the full
typed decision. `plan` is never mutated; head failures degrade to a warning.
With the flag off the added code is a no-op guard — byte-identical behavior.

**Eval harness** — `core/shadow_eval.py` + `scripts/shadow_head_eval.py`.
The replay engine re-executes recordings without re-running the decide step
(the MAP flags this), so the harness drives `PlanningLoop` over synthetic
task observations instead: the LLM provider replays a recorded transcript
with scripted latency, a scripted `AccessibilityInspector` returns
deterministic AX trees (with fill values appearing after fill steps), and the
head is a scripted `MockHead`. Three tasks × 22 decide steps (search flow,
form fill, settings toggle), with scripted adapter failures so agreement
splits by LLM success/failure. Reports: `evaluation/shadow-eval/shadow-eval-report.{json,md}`.

## How to run

```bash
cd domains/computer-use/core
# unit + smoke tests (offline, no weights):
uv run --frozen --extra dev pytest tests/test_element_table.py tests/test_decision_head.py tests/test_shadow_hook.py tests/test_shadow_eval_smoke.py -q
# full suite (gateway-importing tests need the optional deps):
uv run --frozen --extra dev --with fastapi --with pydantic --with mcp \
  pytest tests/ -q --ignore=tests/test_e2e.py --ignore=tests/test_real_adapters.py
# the eval:
uv run --frozen --extra dev python scripts/shadow_head_eval.py --steps 22
# the real head (one-time download, then airplane-mode safe):
uv pip install 'allternit-computer-use[shadow-head]'
```

## Reviewer addendum (input coverage + goal/stuck gates)

**Input coverage.** `core/element_table.coverage_gaps(table, expected_names)`
reports expected controls with no observed row, using exact normalized
name/value matching (deliberately NOT the substring fallback in
`match_target`, which could fuzzy a gap away). New test fixture reproduces
the reference under-reporting case: a form-heavy page whose AX skeleton omits
the search box that a DOM snapshot sees. `TestInputCoverage` proves (a)
every interactive node AX DOES report is indexed with its closed op set —
no silent drops within the observation — and (b) the missing search box
surfaces as `coverage_gaps(...) == ["Search"]` instead of being silently
absent. **Recorded coverage gap (by design, Phase 1):** the table indexes
AX-observed elements only; AX under-reporting (inputs visible in DOM but not
in the a11y tree) is a real blind spot the table cannot self-heal. Callers
running the head against live pages should log `coverage_gaps` against a
DOM-derived expectation when one is available; a hybrid DOM+AX table is a
Phase 2 candidate, out of scope here.

**Goal/stuck gates.** `_run_shadow_head` now asks two boolean closed-set
questions in the same single pass — `goal_satisfied` and `stuck` — each with
per-option probabilities and confidence like the operation/target choices.
Proposed only: the loop's own done/stall detection stays authoritative. The
eval report carries them per step (`goal_satisfied`, `stuck`,
`*_true_probability`, `*_confidence`) and as aggregates split by LLM
success/failure (`stuck_true_rate_given_llm_success/failure`) — the
calibration view a later tier needs to decide whether the head's stuck
signal separates failure from success.

## Numbers on mocked data (what they mean)

Latest run — 3 tasks / 66 decide steps:

| Metric | Value |
|---|---|
| Agreement rate | 0.7576 |
| Agreement given LLM success | 0.7333 |
| Agreement given LLM failure | 0.8095 |
| Stuck=true given LLM success | 0.0 (scripted: stuck fires exactly on failing steps) |
| Stuck=true given LLM failure | 1.0 |
| Goal-satisfied=true rate | 0.0455 (1/22 — final action step only, as scripted) |
| Mean head latency | 8.0 ms (scripted) |
| Mean LLM latency | 850.0 ms (scripted) |

These are **plumbing numbers, not model quality**. The scripted head mirrors
the scripted LLM transcript and disagrees deterministically every 5th step;
the measured agreement (~76%) is that design plus name-resolution fallbacks.
What the run proves: the loop integration, event vocabulary, table→question
mapping, latency/confidence accounting, success/failure conditioning, and
report generation all work end-to-end, deterministically, offline. Real
agreement numbers require the mlx head weights (not downloaded in-session, per
constraints).

Notable honest observation: agreement is *higher on LLM-failure steps* in the
mock data — a scripted artifact (the disagreement cadence and the failure
targets land on different steps), not a property of any real head. Treat it
as a schema check that the conditioning split works. Same caveat for the
gate columns: the scripted head is told which steps fail, so
stuck=true-given-failure of 1.0 validates the reporting path only — real
gate calibration needs the mlx head on real observations.

## Reviewer must know

- **No TypeSafe, no OpenRouter, no hosted decision API, no gated weights** anywhere in the diff. Inference is fully local; the only network touch is the one-time anonymous HF download of an Apache-2.0 repo.
- The core package imports and the entire test path work **without** the `shadow-head` extra (lazy imports everywhere; `test_decision_head.py` marks the real-weights test skip when weights are absent and tests the actionable-error path when mlx-lm is absent).
- `pyproject.toml` gained the `shadow-head` extra, gated `arm64 + Darwin` (mlx is Apple-silicon only).
- The shadow head is propose-only: there is no code path from `shadow.decision` to executed actions. Tier A (151M classifier) and any acting-on-head-decisions wiring are Phase 2 and deliberately absent.
- Pre-existing breakage in this checkout, untouched and un-caused by this diff (all verified): `uv run` (non-frozen) fails resolution on Python ≥ 3.15 markers (`mobile` extra pyobjc pin); `tests/test_e2e.py` and `tests/test_real_adapters.py` import a `sessions` module that does not exist under `domains/computer-use/`; the stale lock env lacks `httpx`/`aiohttp` so several gateway/desktop tests fail on `ModuleNotFoundError` until supplied via `--with`; `tests/test_cost_accounting.py::TestCostEndpoints::test_run_cost_planning_path_records_tokens` and `test_run_cost_survives_restart` fail identically with the pristine HEAD `planning_loop.py` (they stub the loop out entirely — RunStore persistence issue); `tests/integration/test_full_workflows.py` desktop-workflow tests fail on environment grounds (no real display/automation privileges). Final full-suite result with deps supplied: 394 passed, 30 skipped, and only those 6 pre-existing failures.
