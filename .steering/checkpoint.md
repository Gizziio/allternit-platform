# Session checkpoint — cu14-demo-cost

## Goal
TASK cu14-demo-cost — domains/computer-use SOLE ownership. Two features:
- A: one-command Docker-free demo (gateway on free port, mock vision, self-contained demo UI, README + docs/public/aci/index.md)
- B: per-run token/cost accounting persisted to runs.sqlite3 + GET endpoint per-run cost + aggregate summary; wired through planning/replay/workflow/direct paths; honest zero when unavailable.

## Just did
- Feature B implemented + verified: core/cost_accounting.py (new), vision_providers input/output split, planning_loop aggregation, run_persistence columns+migration+cost_summary, router RunState.cost + 4-path wiring + GET /runs/{id}/cost + GET /cost/summary.
- Feature A implemented + verified: demo.py launcher, gateway/demo_ui.py (self-contained page), main.py env-gated mount; README + docs/public/aci/index.md sections written.
- 22 new tests pass; targeted regression run 135 passed.
- Full suite: 232 passed / 21 skipped / 23 failed — 22 failures pre-existing (conformance/integration httpx-connect), +1 flaky desktop-mouse integration tests (nondeterministic pass/fail on identical code, confirmed by re-running).
- Live smoke on port 8991: /demo HTML, /demo/status (vision mock), health, canned run completed 2/2 (real navigate to example.com via playwright), SSE events streamed, per-run cost honest zero, aggregate summary correct, planning run with mock → honest zero. Server + headless Chrome killed, /tmp artifacts removed.

## Next
- Commit, push session/cu14, open PR with evidence. Do NOT merge (orchestrator).

## Open questions
- None.
