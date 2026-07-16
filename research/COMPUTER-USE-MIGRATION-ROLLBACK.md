# Canonical Computer Use Migration and Rollback

Migration is capability-cell based, not provider-wide.

- `shadow`: read-only canonical/legacy observations are compared; no action is duplicated.
- `dual-route`: a cell may be explicitly selected on either route after measured gates pass.
- `canonical-default`: canonical is default only for the proven OS, mode, action,
  observation, and environment cell. Unknown cells remain unavailable or legacy.
- `retired`: unused legacy code is removed after reference auditing, required
  session/receipt/recording migration, and rollback validation. No elapsed-time
  window is required.

Rollback changes the cell routing table to the previous signed configuration; it
does not rewrite observations, receipts, trajectories, approvals, or evaluation
records. Database migrations must be additive during dual-route operation and
retain backward-readable exports. A rollback is mandatory for invariant failure,
evidence regression, permission-loop regression, unsafe fallback, corrupted
receipts, or daemon health failure.

Compatibility routes with live consumers are supported APIs, not pending
retirement. Reference audits determine whether a legacy implementation can be
deleted; capability-cell routing and immutable records provide rollback without
an artificial time gate.
