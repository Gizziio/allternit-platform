# Plan — cu27 HAR network traces (H0–H3)

Spec: `Research/specs/har-network-traces.md` (approved in-session).

- H0 — capture: `record_har` on recorder browser context; scrub before storage (reuse/extend `redact_tool_args` policy); scrub failure = recording refused. Raw HAR never stored.
- H1 — teach: distill scrubbed HAR → `NetworkTrace` (ordered {method, host, path template, payload key-set hash}); additive versioned field on `BrowserWorkflowSpec`; extend validation.
- H2 — verify: live HAR during batch/replay; deterministic ordered comparison → `ReplayDeviation` entries + receipts; halt-at-first-failure like a11y; unverifiable marking, never guessed.
- H3 — e2e: one script (record → teach → batch 1 grant → verify network+a11y+receipts) on canned form-fill vs local test site; tests a–d; docs/public/aci/safety.md subsection; release-preflight score.

Hard boundaries: additive only; deterministic verdicts; fail-closed scrub.

## Progress

- [x] Setup: worktree `allternit-cu27`, branch `session/cu27-har-traces` from origin/main (e31bbd00f)
- [ ] Reading substrates
