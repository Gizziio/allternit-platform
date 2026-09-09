# Checkpoint — cu20-eval-doc (COMPLETE, awaiting orchestrator merge)

## Goal
Publish measured eval/safety numbers as docs/public/aci/safety.md (packaging Gap 4). DONE.

## Just did
- PR #185 opened: https://github.com/Gizziio/allternit-platform/pull/185 (branch session/cu20-eval-doc, 3 commits).
- Verification: pytest measured-conformance 10/10; monitor+cost 40/40; live measurement mock 8/8, playwright 8/8, crawler 5/5, hybrid 3/3, routing 6/6; CDP suite 8/8 vs headless Chrome :9222; cargo test -p allternit-api aci_ 40/40.
- Stopped before merge per task instructions — orchestrator merges PRs.

## Next
- Orchestrator: merge PR #185, then ledger attestation + worktree cleanup per repo AGENTS.md steps 6-8.

## Open questions
- None. Deferrals documented in PR body: no llms.txt exists; changelog is contract-scoped (no entry); guide.md TTL 300 vs code 120 (pre-existing, doc cites 120).
