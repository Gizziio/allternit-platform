# Vendor Compatibility Matrix

Status legend:
- **Supported**: A2R provides equivalent semantics + CLI
- **Partial**: core semantics exist but CLI or extra ops are missing
- **Not supported**: explicitly out of scope for v1

## Beads (bd) command families

Supported / Partial:
- create/update/show/list: **Partial** → `a2r plan new/refine/show`, `a2r wih list`
- dep/blocked/ready/graph: **Partial** → DAG edges + cycle detection + `wih list --ready`
- gate: **Partial** → `a2r gate status/check/rules/verify` (no waiter management)
- history/audit: **Partial** → `a2r ledger trace`
- close/reopen: **Partial** → `a2r wih close` (no reopen)

Not supported (v1):
- daemon/daemons, sync/federation, gitlab/jira/linear, worktree, admin/compact/repair,
  labels/comments/kv, templates/formulas, mol/epic/swarm/merge-slot, import/export, hooks.

## MCP Agent Mail CLI

Supported / Partial:
- thread/message/review semantics: **Supported** → `a2r mail ensure/send/request-review/decide`
- inbox status/search: **Not supported** (no server/FTS mail store)

Not supported (v1):
- serve-http/serve-stdio, guard, file_reservations, archive/restore, share/encrypt,
  products/docs/doctor tooling, project discovery utilities.

## Notes
- A2R reuses vendor **semantics**, not their runtime.
- Any unsupported surface can be added later as an A2R-native module.
