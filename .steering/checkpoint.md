# Steering checkpoint — session/cu12-conf

## Goal
Finish honest remaining items in domains/computer-use (sole ownership).

## Just did
- CDP adapter: added `goto` (alias of navigate), `eval`, `observe` actions + screenshot Artifact population in envelope.
- suites.py: added Suite B (browser-adaptive-v1, 3 tests: envelope/clean-failure/goal-forwarding); Suite C = retrieval-v1 (was R, 5 tests, build_suite_r kept as alias); Suite E = hybrid-v1 (was H, 3 tests, build_suite_h alias); gateway/main.py imports still valid.
- measured.py: discovers hybrid.orchestrator always (offline, browser.mock sub-adapter, note says so); retrieval crawler + browser-use discovery; per-adapter suite routing; honest unmeasured fallbacks.
- core/monitor.py: VLMMonitor behind Monitor protocol — env config ACU_MONITOR_VLM_PROVIDER/MODEL/ENDPOINT, stdlib urllib client, injectable client for tests, heuristic pre-filter, errors→continue; docstring documents swap-in.
- tests: 11 new VLMMonitor tests (fake provider), updated measured-conformance tests for new B/C/E reality.
- pytest (venv-acu311, excl. pre-existing collection-error modules): 207 passed / 21 skipped / 0 failed. 3 transient desktop-mouse flakes on first run, green on rerun; pass in isolation.

## Done — PR opened, awaiting orchestrator merge

- PR #168: https://github.com/Gizziio/allternit-platform/pull/168 (branch session/cu12-conf, 3 commits pushed). Per task contract, NOT merged — orchestrator merges.

## Open questions
- None.
