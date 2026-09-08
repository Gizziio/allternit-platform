# Steering checkpoint

## Goal
Research report + engineering spec: reorienting gizzi-code for Python-heavy frontier models (GPT-6 Astra, Claude Fable 5.1). Deliverables only (docs/spec), no implementation in this session.

## Just did
- Deep research: model behavior (Fable's documented Python proactivity incl. Willison, RuBench silent Opus fallback, Anthropic code-exec doc; Astra's early-stopping/question-asking profile, 272K pricing cliff, API monitor kills; harness-sensitivity evidence from Endor Labs / Artificial Analysis).
- Architecture audit of cmd/gizzi-code: sandbox is stubbed (`src/vendor/anthropic-stubs/sandbox-runtime.ts` → all bash runs unsandboxed), no python_exec tool, headless gateway permission resolution undefined, SDK code_execution tool insecure (shell interpolation, inline pip, overclaims isolation), no served-model logging.
- Wrote `spec/python-heavy-agents/REPORT.md` + `SPEC.md` on session branch `session/pyagents-spec`.

## Next
- Commit, push, open PR for review. Implementation phases P0–P2 are specced but NOT started.

## Open questions
- P0.1: restore real `@anthropic-ai/sandbox-runtime` dep vs delete the dead sandbox path? (spec prefers restore; un-stubbing may also fix the F-grade computer-use subtree per Products/ComputerUse.md)
- Is Astra actually Python-heavy? No primary source yet — needs first-party eval on our task corpus (spec'd in Risks).
- Brain-side: A://Fe should move Fable 5 → Fable 5.1 (cache read pricing 75% cut) — separate change in Allternit Brain.
