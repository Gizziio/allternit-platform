# Attestation — session/pyagents-spec — Python-heavy agents research + spec

**Date:** 2026-09-08
**Session branch:** `session/pyagents-spec` → PR #140, merged as `5260678cb` (merge commit)
**Agent family:** kimi
**Topic:** Research report + engineering spec: reorienting gizzi-code for Python-heavy frontier models (Claude Fable 5/5.1, GPT-6 Astra)

## What was done

Docs-only session. Deliverables live at `spec/python-heavy-agents/`:

- **REPORT.md** — evidence base built from primary sources only:
  - Fable 5/5.1's documented Python proactivity (Willison 2026-06-11; Anthropic code-execution tool doc), always-on thinking API contract, silent Opus 4.8 fallback (RuBench, arXiv:2607.06411 — 5/25 tasks mid-session), 5.1 cache pricing change and permission-hook workarounds in the system card.
  - Astra's documented profile: early stopping, mid-task questions, over-testing, under-delegation, 272K pricing cliff, API monitor task-kills; **no** documented Python-generation bias (flagged as unverified premise).
  - Harness-sensitivity evidence: Endor Labs same-model harness swing (59.8%→72.6% FuncPass), Artificial Analysis index numbers, CodeAct (ICML 2024).
  - Architecture audit of `cmd/gizzi-code`: sandbox stubbed (`src/vendor/anthropic-stubs/sandbox-runtime.ts` → unsandboxed execution), headless gateway permission path undefined, SDK `code_execution` tool insecure (shell interpolation, inline pip, overclaims isolation), no served-model logging.
- **SPEC.md** — phased plan: P0 containment + honesty (restore real sandbox-runtime or delete dead path; harden SDK tool; define headless permission resolution), P1 first-class `python_exec` tool (sandboxed, session venv/uv, receipts, resource limits) + served-model logging + provider param maps, P2 verification oracle + cost guards + four-surface exposure (web/desktop/iOS/gizzi-code per GIZZI.md gate).

## How it works

Two markdown documents; no code changed. `bun test test/session/` unaffected (109 passing baseline preserved — no source touched).

## Verification evidence

- PR #140 merged: https://github.com/Gizziio/allternit-platform/pull/140
- Files confirmed on main: `spec/python-heavy-agents/{REPORT,SPEC}.md` at merge `5260678cb`.
- Merge-conflict incident: `.steering/checkpoint.md` collided with concurrent session `office-ui-polish` (expected per AGENTS.md concurrent-session note); resolved keeping this session's checkpoint; merge retried after push, clean.

## Honest deferrals

- **No implementation** — P0–P2 are specced, not built. P0.1 has a real fork in the road (restore vs delete the sandbox path) that needs an owner decision.
- **Astra Python-bias unverified** — needs first-party eval on our task corpus; spec does not depend on it.
- **Brain-side follow-ups not done here**: `Infra/model-routing.md` A://Fe → Fable 5.1 move; `agent-orchestrator` skill yolo-spawn-table hardening. Both noted in SPEC.md §6.
