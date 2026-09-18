# ACU Shadow Policy Head — MAP

## Goal (paste verbatim)

"Implement a shadow-mode local policy head for the Allternit browser runtime, porting the Jev/jev-ultrafast decision pattern (MIT) without any TypeSafe or hosted-API dependency. Given the existing accessibility observation and the current goal, a fully-local non-generative decision head proposes the next browser action as a typed closed-set choice over observed elements only (operation choice plus speculative per-operation target choices in one pass, returning per-option probabilities and confidence). Model output must never become selectors, coordinates, or JS — targets map only to observed element indices. The head runs in SHADOW mode beside the existing LLM decide step during replayed eval tasks: it proposes but never affects executed action sequences."

## Architecture decisions (locked, do not relitigate)

- Layered tiers behind ONE head-agnostic typed-decision interface (operation Choice + speculative per-operation target Choices in one pass; per-option probabilities + confidence):
  - Tier B (this phase): 4B-class direct-logit head. Implement the direct-logit scoring pattern ourselves (one prefill of state, branch KV/read per option, softmax, entropy confidence) using mlx-lm with an open ungated Apache-2.0 model (Qwen3.5-4B class). Do NOT depend on daseinlabs/open-jev or gated HF weights (Gemma 3 weights are login-gated = signup veto); those repos are design references only. The interface must allow swapping heads (Qwen variant, trained classifier, even Jev later) without consumer changes.
  - Tier A (later phase): 151M trained/calibrated classifier (rlcd-modernbert-151m pattern) for high-volume judgments; needs labelled traces this phase collects.
  - Tier C (always): existing LLM decide step catches low-confidence/judgment calls; only generative path (typing text values).
- Zero-shot heads are measurably over-confident on judgment calls — confidence thresholds come from OUR eval data, not vendor numbers.
- Jev/TypeSafe is vetoed (waitlisted paid SaaS, no self-host/open weights). No network calls at inference. cua runtime not adopted (own Incus/Tart microVMs locked).

## Current codebase map (verified paths)

- Python ACU loop package: `domains/computer-use/core/` (uv, requires-python >=3.9, pytest asyncio_mode=auto, ruff/black/mypy dev deps, no lint config = defaults).
- Decide step: `domains/computer-use/core/core/planning_loop.py` — `PlanningLoop.run` PLAN phase at line ~344 calls `self.vision_provider.ground_and_reason(screenshot_b64=..., task=..., history=...)` returning an `ActionPlan` (reasoning, immediate_action, optional batch); screenshot-primary observation (`_capture_screenshot` ~line 779), AX skeleton secondary via `AccessibilityInspector.snapshot(skeleton=True)` (~lines 430-444, emits `ax_tree.captured`). Loop events vocabulary ~lines 177-195 (`plan.created` etc.). Config dataclass `PlanningLoopConfig` ~line 108 (has `batch_enabled`, `code_mode_enabled` — shadow head flag goes here).
- Batch path: `core/batch_dispatch.py` — `WHITELIST_METHODS` frozenset line ~39 (mirrors Rust `BATCH_ACTION_WHITELIST` in `cmd/allternit-api/src/aci_batch.rs:45`: click, fill, type, press, scrollTo, nextChunk, prevChunk, selectOptionFromDropdown, hover, doubleClick, dragAndDrop). Rust is authoritative.
- Vision providers: `core/vision_providers.py` — `VisionProviderFactory` ~line 1428, gateway path `AllternitGatewayProvider.ground_and_reason` ~line 1226 (posts screenshot + JSON-schema structured output to local brain at gizzi_runtime_base(), default http://127.0.0.1:4096).
- Naming precedent: `core/shadow_comparison.py` (`compare_observations`, semantic Jaccard over element sets) + `POST /shadow/observe` in `gateway/canonical_router.py:642` — "shadow" already means "run alongside, compare, never act". Reuse that vocabulary.
- Replay/eval: `core/replay_engine.py` `ReplayEngine.replay(recording_path)` ~line 343 re-executes JSONL recordings deterministically (no model calls) through adapters, with screenshot diff deviation detection; recordings at `~/.allternit/recordings/<id>.jsonl` via `core/action_recorder.py` (JSONL manifest+frames, `ActionRecorder.load` ~line 444). NOTE for the executor: replay is action-replay (deterministic), it does NOT re-run the decide step — so the shadow-harness eval must drive `PlanningLoop` over recorded/synthetic observations instead, or add a recorded-decision replay mode; this is an implementation decision to be spelled out in the NOTES (pick the cheapest correct option).
- Browser runtime (TS, for context only — Phase 1 must NOT modify it): `infrastructure/chrome-stream/agent-systems/allternit-browser-runtime/packages/extension/understudy/a11y/snapshot/` — `capture.ts` `captureHybridSnapshot`, `a11yTree.ts` `a11yForFrame`, element lines formatted as `[<encodedId>] <role>: <name>` by `treeFormatUtils.ts` `formatTreeLine`; 11-action whitelist Zod-validated in `packages/extension/inference.ts` and dispatched via `handlers/handlerUtils/actHandlerUtils.ts` `METHOD_HANDLER_MAP`.
- Tests live in `domains/computer-use/core/tests/` (pytest). Eval datasets `evaluation/datasets/`.

## Reference pattern (from jev-ultrafast, MIT — design reference only)

Loop: observation -> atomic indexed element table of OBSERVED elements only -> ONE decision pass asking an operation Choice plus speculative `<operation>_target` Choices (fan-out, consume only the head matching the chosen operation) -> validate (probabilities sum to 1, confidence bounds) -> targets map only to observed element indices. Model output never becomes selectors/coordinates/JS. Small LLM only for text values (out of scope this phase).

## Acceptance criteria (paste verbatim)

- Element table builds from real AX/a11y observations on 3+ recorded tasks, indexes only observed elements, maps each to a closed operation set (the 11-action whitelist subset compatible with that element).
- Decision head runs fully locally (airplane-mode test passes — zero network calls during inference) and answers operation + speculative target questions in one pass with per-option probabilities + confidence.
- Shadow harness runs replayed/planning-loop eval tasks without changing executed action sequences (byte-identical action sequences vs baseline when shadow is off; when shadow is on, actions are still LLM-driven — shadow only logs).
- Eval report: head vs LLM decide-step latency, agreement rate, agreement conditioned on LLM success/failure, over >=20 decide steps per task (>=3 tasks).
- No TYPESAFE_API_KEY, no TypeSafe endpoint, no OpenRouter or any hosted decision API anywhere in the diff. No gated-model downloads.

== End of MAP ==
