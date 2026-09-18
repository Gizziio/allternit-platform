# Attestation — session/jev-kimi-head (KimiCliHead cloud-iteration tier)

- **Session:** session/jev-kimi-head (orchestrated, executor: kimi K2.8 subagent)
- **Date:** 2026-09-18
- **Branch:** `session/jev-kimi-head` → **PR #580, MERGED** (merge SHA `4efe70b27d32a3d0ee39ad2c2309dd483b87ff08`)
- **Follows:** PR #573 (Phase 1), #575 (real-weights eval). Applies the KimiCLIHead parallel-session lessons per spec amendment (cloud-iteration tier).
- **Spec:** `Allternit Brain/Research/specs/jev-policy-head.md` — queue `rq-20260918-002` (landed)

## What was done

- `KimiCliHead` in `core/decision_head.py` behind the `DecisionHead` protocol: one `kimi -p` subprocess per decide pass (gizzi kimi-cli provider mechanism — OAuth/token refresh stays inside the CLI, zero credential handling, no new package deps). Strict JSON contract + defensive extraction + one repair retry → recorded miss (never crashes). Canonical 11-op vocabulary with legacy-alias folding + `vocab_misses` metric. Confidence-scalar → chosen-gets-confidence / uniform-remainder probabilities (documented cloud-tier trade-off).
- `--head kimi` + `--questioning {batched,sequential}` in `scripts/shadow_head_eval.py`; per-step wall-clock budgets + progress lines + vocab-miss aggregation in `core/shadow_eval.py`. 15 new tests (subprocess always stubbed). 66 passed / 1 skipped targeted.
- Reports: `evaluation/shadow-eval/shadow-eval-report-kimi{,-sequential}.{json,md}`; analysis `docs/JEV_KIMI_HEAD_NOTES.md`.

## Honest numbers (3 tasks × 22 steps)

| Metric | mlx local | kimi batched | kimi sequential |
|---|---|---|---|
| Agreement | 0.227 | 0.318 | 0.318 (identical decisions) |
| Op agreement | 0.652 (= click base rate) | 0.758 | 0.758 |
| Agree given LLM failure | 0.000 | 0.667 | 0.619 |
| Mean latency/step | 1704 ms | 27.9 s | 58.2 s |
| Confidence agree/disagree | 0.898 / 0.721 | 0.941 / 0.939 (flat) | 0.937 / 0.928 |

## Conclusion

KimiCliHead beats mlx zero-shot on every agreement number at 16× latency — but the failure anatomy is the same disease one level up: mlx collapsed to a global constant "click" prior; kimi collapses to a **per-task constant policy** (22/22 click in search-flow including all 8 fill steps; 21/22 fill in form-fill) — it conditions on task identity, not step state. Confidence is flat (~0.94 whether right or wrong) → unusable as a veto signal; gates degenerate (false/false all 66 steps). Sequential questioning changed nothing (identical decisions, 2.1× latency, late-run degradation to ~102 s/step) — batched is the default. The cloud tier's real value is prompt-iteration speed with no weights download, as designed. **Tier A (small classifier on labelled `shadow.decision` traces) is confirmed as the path; Tier C LLM stays authoritative.**

## Incidents / notes

- Origin/main advanced twice mid-session (other sessions landing); second advance required a merge into the branch before GitHub would merge — `.steering/checkpoint.md` conflict resolved keeping both sessions' append-only blocks.
- The checkpoint from the parallel discipline sweep answers the 2026-09-17 worktree-deletion mystery: an Eoj-directed shared-checkout cleanup session deleted stale branches/discarded the dirty lockfile around that time; the worktree reaping was the same cleanup wave. Defense (commit early on session branches) already adopted.
- `kimi -p` sanity check passed first try — subscription auth works in this environment.

## Deferrals

- Tier A classifier build (next phase; needs trace-accumulation policy — shadow runs with `shadow_head_enabled=true`).
- Per-question prefill for gates (mlx tier; documented).
- Any promotion thresholds — blocked on Tier A calibration.
