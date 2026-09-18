# ACU Shadow Head — Phase 1 Task

Read `docs/ACU_SHADOW_HEAD_MAP.md` first — it is the full analysis. This file is your executable scope.

## Scope (exactly this, nothing more)

1. `core/element_table.py` (new): build an indexed element table from the loop's AX skeleton observation (`AccessibilityInspector.snapshot(...)` output / `ax_tree.captured` shape in planning_loop.py) — observed elements only, each row: index, role, name, ref/identifier compatible with existing element_refs refmap, supported operations (closed subset of the 11-action whitelist per role). Prune to a configurable cap (default 250, matching the reference pattern); document pruning order.
2. `core/decision_head.py` (new): head-agnostic typed-decision interface (`DecisionHead` protocol: `decide(state_text, questions) -> TypedDecision` with per-option probabilities + confidence) + a local direct-logit implementation using mlx-lm with an open Apache-2.0 ungated 4B-class model (Qwen3.5-4B class). One prefill of state; per-option logit readout; softmax; entropy-based confidence. Operation choice + speculative target choices in one pass. Model choice must be a public ungated HF repo; pin revision; lazy download with clear error if absent. Include a `MockHead` for tests (deterministic) so unit tests need no model download.
3. Shadow hook in `core/planning_loop.py`: after the decide at ~line 344 (plan created, before ACT phase), if `PlanningLoopConfig.shadow_head_enabled` (new flag, default False): build element table + ask the head; attach the head's answer to the loop log as a `shadow.*` event (match existing event vocabulary ~lines 177-195); record head latency + confidence. NEVER mutate `plan`. When the flag is off, behavior must be byte-identical to today.
4. Shadow eval harness `tests/` + script: drive PlanningLoop (or the extracted decide function) over >=3 recorded/synthetic task observations with the LLM provider mocked (recorded LLM answers) so the eval is deterministic and offline; produce the eval report JSON + markdown: head vs LLM latency, agreement rate, agreement conditioned on LLM success/failure, >=20 decide steps per task.
5. Tests: unit tests for element_table (indexing, pruning, closed op set), decision_head (MockHead + interface; skip real-model test if weights absent — mark it), shadow-hook off-means-identical test, eval harness smoke test.
6. Add `mlx-lm` (and any mlx extras) as an OPTIONAL dependency extra (e.g. `[project.optional-dependencies] shadow-head`) — core package must import and all existing tests must pass WITHOUT it.

## Constraints

- NO builds/typechecks/dev servers needed; run ONLY `pytest domains/computer-use/core/tests/` (and your new tests) via uv. Do not run the full repo build.
- NO git operations (no commit, no push, no branch switches). Work in the current checkout.
- Do NOT modify TypeScript/browser-runtime code, Rust code, or any file outside `domains/computer-use/core/` and the two docs/.
- No new network services; no new HTTP endpoints. Inference makes zero network calls once weights are cached.
- Do not download model weights yourself in this session — code must handle absence gracefully; the eval harness must run fully on MockHead.
- Match repo idiom: 4-space, double quotes, docstring-first module headers, typed gradually, ruff/black defaults.
- Do NOT start Phase 2 (no Tier A classifier, no risk-taxonomy wiring, no acting on head decisions).

## Deliverable sentinel

When finished, write `docs/ACU_SHADOW_HEAD_PHASE_1_NOTES.md` starting with YAML frontmatter:

```
status: done|blocked
files_changed: [paths]
deviations: [what + why]
remaining: [items]
```

Then prose notes: how to run the eval, the agreement numbers you got on mocked data, and anything the reviewer must know. That file existing = done.
