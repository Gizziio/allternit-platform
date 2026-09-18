# Attestation — ao/jev-policy-head (shadow-mode local policy head, Phase 1)

- **Session:** ao/jev-policy-head (orchestrated, executor: kimi K2.8 via agent-orchestrator)
- **Date:** 2026-09-18
- **Branch:** `ao/jev-policy-head` → **PR #573, MERGED** (merge SHA `20d8e4f6665b991a185ba81d6cf42d8ca90fdfd7`, merge commit, not squash)
- **Spec:** `Allternit Brain/Research/specs/jev-policy-head.md` — queue `rq-20260918-002` (approved by Eoj 2026-09-17), decision `reverse_engineer` (TypeSafe Jev SaaS vetoed), layered-tier architecture (Tier B 4B head now / Tier A 151M classifier Phase 2+ / Tier C LLM escalation always)
- **Scope docs:** `docs/ACU_SHADOW_HEAD_MAP.md`, `docs/ACU_SHADOW_HEAD_PHASE_1_TASK.md`, `docs/ACU_SHADOW_HEAD_PHASE_1_NOTES.md` (all in-repo)

## What was done

Phase 1 of the Jev-pattern port, all shadow/propose-only:

- `domains/computer-use/core/core/element_table.py` — indexed element table over the AX skeleton observation (observed elements only; closed op set per element mirrored from `batch_dispatch.WHITELIST_METHODS`, Rust `BATCH_ACTION_WHITELIST` authoritative; 250-cap pruning; `coverage_gaps` exact-match input-under-reporting check added per reviewer addendum — the jev-browser DOM-vs-a11y tension).
- `domains/computer-use/core/core/decision_head.py` — head-agnostic `DecisionHead` protocol (one pass: operation Choice + speculative target Choices + goal_satisfied/stuck gates; per-option probabilities + entropy confidence); `MlxDirectLogitHead` (mlx-lm, `mlx-community/Qwen3-4B-Instruct-2507-4bit`, Apache-2.0 ungated, local inference only, lazy import behind `shadow-head` extra gated arm64+Darwin); `MockHead` for tests.
- `domains/computer-use/core/core/planning_loop.py` — `shadow_head_enabled` config (default False; off = byte-identical), `shadow.decision` loop event, propose-only (plan never mutated; head failure → warning).
- `core/shadow_eval.py` + `scripts/shadow_head_eval.py` — deterministic offline eval harness (scripted AX inspector + recorded LLM transcript + MockHead); report: agreement, agreement conditioned on LLM success/failure, latency, gate calibration aggregates. 3 tasks × 22 steps.
- Tests: `test_element_table.py`, `test_decision_head.py`, `test_shadow_hook.py`, `test_shadow_eval_smoke.py`.

## Verification evidence

- Targeted tests: 42 passed / 1 skipped, offline, no weights.
- Full suite with env deps supplied: all non-passes (8) reproduce identically at pristine base `d0f739ff9` or are environmental (missing httpx/pyautogui/display) — pre-existing, untouched by this diff. Verified by an independent review pass (separate subagent, claim-by-claim, including a detached base-worktree reproduction of the failures).
- Committed eval artifacts reproduced byte-for-byte by re-running the harness.
- Veto scan: zero TypeSafe/OpenRouter references in code; no gated models; inference makes zero network calls (one-time anonymous HF download only).
- Review verdict: ACCEPT (9/9 claims verified).

## Incidents

- Disk ENOSPC mid-execution (98% full) — freed ~30 GB (uv cache 11.9 GB force-cleaned; 187 ao logs >14d pruned). Executor self-recovered.
- **Worktree deletion incident:** `allternit-ao-jev-policy-head` and several sibling worktrees were deleted externally while the executor had everything uncommitted — all code work was lost (branch ref pointed at base). Recovered by recreating the worktree, regenerating scope docs, respawning the executor. Defense going forward: commit early on session branches (worktrees are reaped by the machine's disk-hygiene regime / janitor). Open question to Eoj about what ran the deletion.

## Honest deferrals

- **Real-weights eval not run in-session** (per task constraints, no downloads): `uv pip install 'allternit-computer-use[shadow-head]'`, then run `scripts/shadow_head_eval.py` with `MlxDirectLogitHead` wired in to get real agreement/calibration numbers. Mock numbers in NOTES are plumbing checks only.
- `DEFAULT_REVISION` is None (repo default branch) with `SHADOW_HEAD_REVISION` env override; record the concrete commit hash after first verified download.
- **Shared checkout NOT synced** (lifecycle step 6 deferred): the shared `allternit` checkout is in detached HEAD at `d0f739ff9` with another session's dirty `pnpm-lock.yaml` — switching branches would risk clobbering in-flight work, so it was left untouched per worktree-ownership rules. Next session touching the shared checkout should `git checkout main && git pull --ff-only`.
- **Desktop rebuild (step 8) skipped:** the change is a default-off, shadow-only Python backend feature; no desktop-bundled surface behavior changes. Rebuild at the next desktop release cycle.
- Phase 2+ (out of scope): Tier A 151M classifier on labelled traces, confidence-thresholded promotion, risk-taxonomy wiring, phone harness, hybrid DOM+AX table candidate.
