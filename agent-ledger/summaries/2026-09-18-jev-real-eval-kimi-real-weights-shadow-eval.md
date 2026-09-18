# Attestation — session/jev-real-eval (real-weights shadow-head eval)

- **Session:** session/jev-real-eval (orchestrated, executor: kimi K2.8 via subagent)
- **Date:** 2026-09-18
- **Branch:** `session/jev-real-eval` → **PR #575, MERGED** (merge SHA `a35a861eea8e5bf750938a20ea1244a428e8afd5`)
- **Follows:** PR #573 (Phase 1 shadow head) — this lands the deferred real-weights eval from its NOTES
- **Spec:** `Allternit Brain/Research/specs/jev-policy-head.md` — queue `rq-20260918-002` (landed)

## What was done

- `--head {mock,mlx}` selection wired into `scripts/shadow_head_eval.py` (default mock; committed MockHead artifacts byte-identical after all changes).
- Three pre-existing defects root-caused + fixed: closed-set options never listed in state text (logit readout measured the unconditional token prior → constant answers); prompt not answer-aligned (measured a discourse prior → constant "press"/"click"); `timeout_ms=120s` silently killed real-head runs and the disk-backed ACU scratchpad inflated prompts to ~13.7k chars (10–25× slower prefill, eval junk in `~/.allternit/acu/scratchpad`) — `run_task` now isolates `ACU_SCRATCHPAD_DIR` into a temp dir and scales the timeout.
- Real-weights report: `evaluation/shadow-eval/shadow-eval-report-mlx.{json,md}` (3 tasks × 22 steps, `mlx-community/Qwen3-4B-Instruct-2507-4bit` @ `50d4277`).
- Full analysis: `docs/JEV_REAL_EVAL_NOTES.md`.

## Real numbers (the point of this session)

| Metric | MlxDirectLogitHead |
|---|---|
| Agreement rate | 0.227 |
| Agreement given LLM failure | 0.000 |
| Operation agreement | 0.652 — exactly the transcript's click base rate (head answered click on all 66 steps; degenerate) |
| Target agreement | 0.349 (vs ~20–25% chance — real but weak signal) |
| Confidence (agree vs disagree steps) | 0.898 vs 0.721 — separates, but mostly between tasks, not a usable per-step veto |
| Mean head latency | 1704 ms (scripted LLM: 850 ms) |

## Conclusion (drives Phase 2)

Zero-shot Tier B is **not good enough to act on** — no operation signal at all on these tasks (would fail all three flows; fill steps are unskippable). The instrumentation (table → questions → readout → calibration report) is validated end-to-end with real weights. **Tier A (151M classifier trained on labelled traces from this harness) is now the promoted path** over zero-shot Tier B gating, per the spec's layered-tier architecture. Tier C LLM escalation stays authoritative for the foreseeable term.

## Verification

- Targeted tests: 43 passed / 1 skipped (new `test_head_flag_parsing`; weights-dependent test now runs with cached weights).
- MockHead numbers byte-identical pre/post fixes; committed mock artifacts untouched.

## Incidents / notes

- Origin/main advanced mid-session (1e38d9157 harness commit added `scripts/git-discipline-check.sh`); our diff showed it as "deleted" only because the base predates it — no action, merge preserved it.
- `uv sync --extra shadow-head` impossible in this checkout (uv.lock predates the extra; `--frozen` validates extras against the lock) — used the sanctioned fallback `uv pip install -e '.[shadow-head]'` + `uv run --no-sync`. Lockfile regeneration is blocked by the known ≥3.15 pyobjc pin issue; recorded pre-existing.
- Stale synthetic scratchpad entries under `~/.allternit/acu/scratchpad/tasks/` (pre-isolation) left in place, noted in JEV_REAL_EVAL_NOTES.md.

## Deferrals

- Per-question prefill for goal/stuck gates (currently position priors — documented in NOTES).
- Tier A classifier build (next phase; needs trace accumulation policy — shadow runs against live/replay tasks with `shadow_head_enabled=true`).
- Tier C promotion thresholds — blocked on Tier A calibration data.
