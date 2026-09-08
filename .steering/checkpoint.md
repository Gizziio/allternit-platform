# Checkpoint — session/cu5-approvals

## Goal
Product-scoped approvals bound to action hashes (TASK cu5-approvals) — Rust gateway + TS SDK + docs only.

## Just did
- Implemented everything:
  - NEW cmd/allternit-api/src/aci_approvals.rs: canonical JSON + SHA-256 action hashing; ActionGrantStore (Pending→Approved/Denied→Consumed, TTL env ALLTERNIT_ACI_GRANT_TTL_SECS default 300s, in-memory receipts capped at 10k); global GRANTS.
  - aci_safety.rs: ConfirmationClass taxonomy (Reversible/Risky/Irreversible) + classifiers for mouse/keyboard/shell/file-write + enforce_confirmation[_with_mode] (mode-injectable core for hermetic tests).
  - aci_routes.rs: AciRunBody.approvalId; handoff 202 includes action_hash; retry redeems grant (hash mismatch/other → 403 approval_denied); handoff approve/deny mirror into GRANTS; tests extended.
  - computer_control.rs: execute_computer_tool now takes approval_id and enforces taxonomy before touching the guest; error payload (StatusCode, Value) so approval_id surfaces; control_action_descriptor + classify_control_action helpers; 4 tests updated to mint grants, 3 new tests (deny-without-grant, hash mismatch, reversible no-grant).
  - computer_routes.rs: /api/v1/computers/:id/{mouse,keyboard,shell,files/upload} enforce before delegating to bot_desktop_input; ?approval_id / ?approvalId accepted.
  - tool_routes.rs: computer_* tools pass approval_id from args; error mapping updated.
  - bot_desktop_input.rs: derive(Clone) on input structs (needed for pre-delegation checks).
  - sdk/computer-use: server-side-enforcement doc comments in approvals.ts + canonical.ts ComputerApprovalGrant.
  - docs/public/aci/index.md: new "Server-side approvals" section (taxonomy, hash-bound/single-use/expiring/receipted, flows, UX pre-filter note).
- cargo check -p allternit-api: clean. cargo test --lib aci*: 26 passed. computer_control: 7 passed.

## Next
- Full cargo test -p allternit-api (running in background) — must be green.
- pnpm install for sdk/computer-use subtree (background) → jest conformance tests + tsc typecheck.
- Review diff for scope, commit, push -u origin session/cu5-approvals, gh pr create (no merge).

## Open questions
- Grants are route-scoped by design (route string in descriptor hash) — documented in docs.
- computer_control deny tests assume Enforce mode (default; env ALLTERNIT_ACI_SAFETY_MODE unset in CI).
