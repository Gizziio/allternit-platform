# Attestation — session/subsfab — Subscription Capability Fabric docs package

**Date:** 2026-09-26 ~00:40 CDT
**Agent:** Kimi Code (two sessions: origin session authored the docs; this session landed them)
**PR:** #735 — merged as merge commit `1adda38e3` (merge, not squash)
**Branch:** `session/subsfab`, cut from `origin/main` @ `b1bf20057`

## What was done

Landed the full Subscription Capability Fabric specification package at `docs/specs/subscription-fabric/`:

- `SPEC.md` — original architecture lock (Eoj's origin doc)
- `HARDENING.md` — binding amendments, supersedes SPEC on conflict (D1–D15, A1–A10, S1–S7, X1–X7, MVP cuts, D11–D12 progress/push, surface matrix)
- `IMPLEMENTATION_PLAN.md` — stack/placement, file layout, phases P0–P7 with per-phase verify gates, testing strategy, risk register
- `REVIEW_CLAUDE.md` — Claude architecture review, accepted in full; §S1–S7/A1–A2 are the normative TS schemas for P0
- `DESKTOP_BRIDGE_RESEARCH.md` — CDP-first desktop-automation research (Windows guest, fallback ladder)
- `REVIEW_TASK_CLAUDE.md` / `REVIEW_TASK_CHATGPT.md` — review briefs (ChatGPT second opinion deferred; codex/agy quota-exhausted, per Eoj 2026-09-26 the ao-spawn rerun is dropped in favor of kimi agents on glm/deepseek)
- `HANDOFF.md` — reading order, locked decisions, repo grounding, next steps, gotchas

## How it was verified

Docs-only PR — no code, no build impact, no release-path files touched. Eoj reviewed and explicitly approved the docs on 2026-09-26 (this session confirmed before merging, per the handoff's unmerged-state warning). Merge verified: `origin/main` at `1adda38e3`, shared checkout fast-forwarded.

## Incidents / honest deferrals

- **DAG gate skipped with owner's explicit waiver.** `allternit-commrails`/`wih` not on PATH; Eoj ruled the DAG gate unnecessary for this work (2026-09-26).
- **ChatGPT second opinion not run.** Codex/agy quota exhausted 2026-09-25; Eoj directed dropping the ao-spawn rerun. `REVIEW_TASK_CHATGPT.md` remains in the package if it's ever wanted.
- **P0 not started in this attestation's scope.** Contracts package (zod + TS transcription of REVIEW_CLAUDE §S1–S7/A1–A2) begins next in a fresh session worktree per IMPLEMENTATION_PLAN §2, orchestrated via kimi subagents on glm/deepseek models.
- `REVIEW_CLAUDE.sentinel` (0-byte orchestration artifact) intentionally not committed; removed with the worktree.
