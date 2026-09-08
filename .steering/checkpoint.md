# Checkpoint — session/cu5-approvals (DONE, awaiting orchestrator merge)

## Goal
Product-scoped approvals bound to action hashes (TASK cu5-approvals).

## Just did
- Full implementation (see PR #144): aci_approvals.rs (hash-bound single-use expiring grants + receipts), aci_safety.rs confirmation taxonomy + enforce_confirmation, enforcement wired into aci_routes / computer_control / computer_routes / tool_routes, TS docs, docs/public/aci/index.md section.
- Verification: cargo test -p allternit-api --lib aci → 26 passed; computer_control → 7 passed; full suite → 698 passed, 4 pre-existing failures (agent_cloud_routes OS-backed tests, external stale allternitos_control_plane binary rejects --fake-provider; unrelated). sdk/computer-use tsc clean, jest 98/98.
- Committed c750b2c76, pushed session/cu5-approvals, opened PR #144 (NOT merged — orchestrator merges).

## Next
- Orchestrator review/merge. Nothing further from this session unless review feedback arrives.

## Open questions
- Grants are route-scoped by design (documented).
- Pre-existing agent_cloud_routes failures noted in PR body.
