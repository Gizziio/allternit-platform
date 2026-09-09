# Checkpoint — cu20-eval-doc

## Goal
Publish measured eval/safety numbers as docs/public/aci/safety.md (packaging Gap 4). Every number traceable to repo files; nothing invented.

## Just did
- Mined all sources: adapter_grades.json (6 graded entries + 2 honest unmeasured), suites.py (A/B/C/D/DX/E/F/V/PL), aci_safety.rs (taxonomy, masking, circuit breaker, host policy), aci_approvals.rs (SHA-256 hash-bound single-use 120s-TTL grants), aci_credentials.rs (AES-256-GCM vault, sandbox_env-only, TOTP), monitor.py (heuristic + VLM), test_cost_accounting.py.
- Confirmed: no llms.txt exists under docs/public/ — will note that.

## Next
- Verify numbers by running pytest suites + conformance.measured --network + cargo test aci_.
- Write docs/public/aci/safety.md, link from index.md, add changelog entry.

## Open questions
- Whether live-network suite runs (playwright/cdp/crawler) pass in this env right now; will only cite what passes.
