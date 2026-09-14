# Attestation — session/cu27-har-traces — HAR network traces (H0–H3)

Agent: Kimi Code (cu27). Spec: Research/specs/har-network-traces.md (approved in-session).

## What shipped
- H0 capture: ActionRecorder HAR capture, scrub-before-storage (fail-closed survivor check),
  raw HAR never stored; core/network_trace.py.
- H1 teach: distill_har -> versioned NetworkTrace on BrowserWorkflowSpec (TS zod + Python validation).
- H2 verify: deterministic ordered compare; ReplayDeviation kind=network + workflow receipts.
- H3 e2e: scripts/har_chain_e2e.py — record->teach->batch(1 grant)->verify, two runs identical
  verdict + receipt hash da713f6a7dbaad00... (content-derived).
- docs/public/aci/safety.md subsection with measured numbers + caveats.

## Verification
- 37 new tests (canary scrub, teach, all deviation classes, determinism) green.
- Required suites: test_network_trace + batch_dispatch + batch_context + batch_adversarial +
  executor_vocabulary + brain_subprocess + code_mode + code_execution + replay + workflow_runner +
  workflow_batch — see PR #499 comment for the final counts (pre-existing failures unchanged:
  8 failed / 129 passed / 5 errors before; failures are fastapi-missing HTTP fixtures + asyncio
  fixture errors, untouched by this change).
- e2e chain: deterministic=true, canary_absent=true, network pass, a11y diff zero.

## Incidents
- macOS TCC revoked Desktop access for the shell repeatedly during the session; work was landed
  by idempotent retry workers between access windows.
- Bring-up caught two real scrub gaps (request cookie jar, Referer query tokens) — both fixed
  and covered by tests.

## Deferrals
- Merge of the Rust-side batch HAR capture (sidecar context) not attempted — out of scope
  (additive Python-only per spec contract).
