# UHP / harness — remaining work (rq-20260908-028)

- **Date:** 2026-09-10
- **Agent:** grok
- **Status:** not started — recorded so it does not evaporate after P6b / #291 land
- **Parent:** PR #280 (P6b full-class), PR #281 (docs), PR #291 (install channels)

Nothing in this list is claimed done. Each item is a follow-up, not a silent absorb into an existing SOW.

## Follow-ups

1. **Engine PATH for managed installs.** `ao harness install` puts binaries in `~/.ao/harness/bin`. The long-lived engine daemon's PATH does not include that dir, so `ao serve` / `layout_apply` cannot spawn `pi` (verified: `Unable to spawn pi`). Fix: prepend managed bin on engine spawn and on UHP turn env, then re-run a live pi turn.

2. **OpenCode UHP live turn in an engine pane.** Direct `opencode run` replies `ok`. Through UHP the engine pane returns `Unexpected server error`. Driver argv/parser are ported; this is the pane/env path.

3. **dsh PyPI pin.** Manifest still pins `deepseek-harness-sdk==0.1.2rc1` (and `deepseek-harness-runtime-bin==0.1.2rc1`). That version is not on PyPI; `ao harness install dsh --accept-terms dsh` fails. Bump to a version that exists, or drop the live-gate until it does.

4. **Gate 2 claude / codex live turns.** Unchanged from P6a. claude OAuth expired on this machine; codex usage limit until 2026-09-16. Re-run the P6a Gate 2 harness after re-auth / reset. One-command shape in `docs/AO_UHP_GATEWAY_NOTES.md`.

5. **Conformance CI.** No job boots `ao serve` and runs `uhp-conformance --class full` from `vendor/harnessrouter-ce/protocol/conformance` (not on PyPI; needs the vendor tree so the schema resolves). Binding 3 from the UHP spec.

6. **Artifact download (X-07).** `GET /v1/sessions/{id}/files` returns `{ "files": [] }`. Full-class suite is CONFORMANT WITH SKIPS until a turn actually writes files and download works (`X-Content-Type-Options: nosniff`).

## Out of this list

gemini/cline live gates need the binaries on PATH (install channels now exist; no opt-in to auto-install those two for UHP live gates). Desktop DMG rebuild is unrelated — this work did not touch the desktop bundle.
