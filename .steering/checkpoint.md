# Checkpoint — cu20-eval-doc

## Goal
Publish measured eval/safety numbers as docs/public/aci/safety.md (packaging Gap 4).

## Just did
- Verified numbers live: test_measured_conformance.py 10/10; test_monitor.py + test_cost_accounting.py 40/40; conformance.measured --network → mock 8/8, hybrid 3/3, playwright 8/8, crawler 5/5, routing 6/6; CDP suite A run directly against headless Chrome on :9222 → 8/8.
- Wrote docs/public/aci/safety.md; linked from index.md. Committed 9ef3893af and pushed.
- Confirmed PR #177 = aci_credentials.rs vault (merged 2026-09-09).
- No llms.txt under docs/public/ — nothing to link there.
- Changelog.md is scoped to tool-contract versions only — deliberately NOT adding an off-format entry.

## Next
- Wait for cargo test -p allternit-api aci_ (build in progress), then finalize PR.

## Open questions
- Pre-existing: guide.md says grant TTL default 300s; aci_approvals.rs says 120s. Doc cites code (120s). Flag in PR, not fixing here.
