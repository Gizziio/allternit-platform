# /agent/POLICY.md — Allternit Law Policy (v0)

Generated: 2026-01-28

## Scope

This policy is boot-gated and enforced by kernel + CI. It is not advisory.

## Non-Negotiable Invariants

- Tool execution only via ToolRegistry.
- Tool execution requires full envelope: run_id, graph_id, task_id/node_id, wih_id, write_scope.
- All outputs are run-scoped under `/.allternit/` only.
- Forbidden writes: `/.allternit/wih/**`, `/.allternit/graphs/**`, `/.allternit/spec/**`, and other runs' receipts.
- PreToolUse gating is mandatory before any tool execution.
- Receipts are proofs: tool + node receipts required for completion and resume.
- No auth bypass for core endpoints.
- No raw exec paths in python gateway.

## Approvals

- Destructive operations require explicit user approval.
- Approval authority must be recorded in receipts.

## Dev Profiles

Dev/prod profiles may relax performance or observability only. They may not bypass:
- auth
- tool gating
- write_scope
- receipts
- law validation

END.
