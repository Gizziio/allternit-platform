# JEV SemIf lane — measured results (2026-09-19)

Session `semif-eval`, branch `session/semif-eval` (pushed, no PR/merge per
owner directive). Lane: measure **SemIf** — the community open-weights System
One reproduction (`TheoLeeCJ/SemIf`, formerly OpenJev, MIT, 1,816★ at
measurement, last push 2026-09-19) — as a decision head behind our existing
`DecisionHead` protocol, head-to-head against the cloud kimi head on the
SAME 66 held-out decide steps (3 synthetic tasks × 22, canonical state text
with the unconditional `[SINCE LAST STEP]` block, all graft flags off —
identical format to the kimi-deltas comparison run).

## Step 0 — SemIf API reality-check (README vs actual code)

Read the upstream source at commit `ca3ba65f` (cloned to
`~/Desktop/allternit-workspace/semif-upstream`, removed after the session).
Package name is **`semif-phase1`**, not `semif`; installed from git
(`pip install -e '.[test,mlx]'`, not on PyPI). What the README says vs what
the code does:

| README claim | Code reality |
|---|---|
| "Models MiniCPM5-2B and Qwen3.5-4B" | **MLX backend hard-rejects anything but `model_type == "qwen3_5"`** (`mlx_backend.py:64`). MiniCPM5-2B is the browser web-demo (GGUF) ladder only — it cannot run on the mlx backend the README advertises it under. |
| "direct scoring, serial prefix reuse, parallel shared-state decisions" on MLX | All three exist and are real: `mlx_backend.score` (fresh), `SerialPrefixScorer` (prefix cache reuse), `mlx_backend.score_shared` (one state prefill + one batched suffix forward over all rows). |
| Typed option probabilities, no JSON generation | True. Per-option first-token logits at the answer position, softmax across the option letters. Returns `probabilities` + `option_logits` per row. |
| (implied) a confidence readout | **None.** Result carries `"probability_status": "conditional option score; uncalibrated as decision confidence"`. We use our `entropy_confidence` convention (same as `MlxDirectLogitHead`). |
| pip install | Pins are strict: `torch==2.10.0`, `transformers==5.17.0`, mlx-lm **from git** `@a63e24c3` (the upstream Qwen3.5 recurrent-norm fix; PyPI 0.31.3 applies the L2 epsilon wrong). Remote models require a **pinned 40-hex revision**; no default-branch convenience. |
| Generic option sets | Hard cap: **2–16 options** (letters A–P, `core.LETTERS`). `validate_row` rejects anything else. Our mlx head truncates target menus at 64 — SemIf truncates at 16. Never hit in this eval (synthetic tables are small), but a real-page caveat. |

The strict pins have one real consequence for us: in the shared venv the
`[semif]` install moves mlx-lm to SemIf's git pin (0.32.0), superseding the
`[shadow-head]` extra's `>=0.24.0` floor. Both heads still pass their live
tests on that pin; noted here so nobody is surprised by the resolution.

Model: `Qwen/Qwen3.5-4B@851bf6e8…` (SemIf's own `manifests/models.json`
reference pin). Public, **ungated, Apache-2.0**, ~9 GB BF16 download
(vision tensors included in the checkpoint; MLX-LM's text sanitizer drops
them at load). `bits=4/8` would apply in-memory affine quantization instead
— we ran BF16 (SemIf's reference config) and left quantization unmeasured.

## What we adopted

- `core/semif_head.py::SemIfHead` — one `decide()` = ONE SemIf
  `score_shared` pass: all per-step questions (operation + speculative
  `<op>_target` menus + `goal_satisfied`/`stuck` gates) score in a single
  state prefill + one batched suffix forward. This is SemIf's selling point
  (parallel shared-state decisions) and it maps exactly onto our one-pass
  `decide()` contract — the API genuinely supports what the README claims
  here. Per-question `Choice`: `chosen` = argmax of SemIf's per-option
  probabilities (option string as both id and description, so results map
  straight back onto our vocabulary); `confidence` = `entropy_confidence`
  (SemIf returns none).
- State text passed **verbatim** as SemIf's `row["state"]` evidence — the
  canonical `[TASK]`/`[SINCE LAST STEP]`/`[OBSERVED ELEMENTS]`/`[OPTIONS]`
  format is SemIf's "unstructured state"; no format changes on our side.
- `--head semif` in `scripts/shadow_head_eval.py` (report stem `-semif`,
  step budget 15 s — mlx-class; actual mean latency 2.34 s/step, well under).
- `semif` aggregate-note + markdown block in `core/shadow_eval.py`; `[semif]`
  extra in `pyproject.toml` (git install; SemIf is not on PyPI).
- Tests `tests/test_semif_head.py`: mapping layer (pure, always runs) +
  live shared-pass tests, skip-if-missing like the mlx head tests.

## Numbers — one pass, `--head semif --steps 22 --quiet`

Report: `domains/computer-use/core/evaluation/shadow-eval/shadow-eval-report-semif.{json,md}`

| run | agreement | given LLM success | given LLM failure | mean head ms/step |
|---|---|---|---|---|
| kimi zero-shot (pre-deltas) | 0.318 | — | — | — |
| kimi + state deltas (same format) | **0.4848** | 0.356 | 0.762 | 16,196 |
| old mlx zero-shot (**pre-deltas** format) | 0.2273 | — | — | 1,704 |
| **SemIf + state deltas (this run)** | **0.2273** | 0.178 | 0.333 | **2,336** |

Per task: search-flow **0.318** (op 0.64 / target 0.50), form-fill **0.000**
(op 0.05 / target 0.00), settings-toggle **0.364** (op 1.00 / target 0.36).
kimi-deltas per task for contrast: 0.318 / 0.773 / 0.364.

Three honest observations:

1. **The aggregate equals the old mlx number by coincidence, not by
   equivalence.** 0.2273 was also the pre-delta mlx-zero-shot aggregate, but
   the per-task split differs (old mlx: 0.318 / 0.000 / 0.364 — actually
   identical per-task!). Both local zero-shot heads land on the same profile:
   strong operation prior (settings-toggle op agreement 1.00) with target
   selection that doesn't track the recorded policy. SemIf's gains over the
   old mlx head are systems gains (one shared pass, 2.3 s/step at BF16-4B,
   no per-question re-prefill), not agreement gains.
2. **The entire kimi-deltas margin lives in form-fill** (0.773 vs 0.000) —
   the task where the state visibly changes step to step. SemIf's zero-shot
   readout does not exploit the delta block at all; it collapsed to
   near-constant picks there (7 type / 8 fill / 7 click against a fill/fill/
   click transcript, op agreement 1/22). Same lesson as the kimi lane
   confirmed from the other direction: step-conditioned state only helps a
   head that actually reads it.
3. **Entropy confidence separated right from wrong here** (mean 0.712 on
   agreement steps vs 0.510 on disagreement steps) — unlike kimi's
   self-reported confidence (0.92 right / 0.94 wrong). Do not over-read a
   shape measure at n=66, but it's the first calibration-shaped signal the
   shadow program has produced.

## Verdict

SemIf works exactly as documented on the mlx backend (modulo the
MiniCPM5/README overstatement), drops behind our `DecisionHead` protocol in
~90 lines, runs a full step's questions in one 2.3 s pass, and scores
**0.2273 on the same 66 steps where kimi-deltas scores 0.4848**. As a
zero-shot local retrofit it does not close the gap: its agreement profile is
the same policy-prior shape as our old mlx head. Its real contribution to
this program is architectural — a clean, pinned, auditable shared-state
scoring path (one prefill, batched suffixes, per-option distributions) that
is a better substrate for the next lever (trace-conditioned or few-shot
local heads) than the per-question logit head. Recommended: keep the lane
flag-gated, do not promote; if local tier is revisited, revisit with traces,
not with a bigger zero-shot model.

## Incidents / deviations

- None material. mlx-lm moved to SemIf's git pin in the worktree venv
  (documented above). The Qwen3.5-4B `LICENSE` file was not in SemIf's
  downloader's allow-patterns; license confirmed Apache-2.0 via the HF
  model card instead.
- One eval pass only, per lane constraints; mock smoke regression re-run and
  green (0.7576 plumbing, unchanged harness format).
