-- ── Approval risk policy (A:// §8.14 unification) ────────────────────────────
-- One policy evaluation path: risk rules (same model as the cowork-engine
-- ApprovalGate: first-match on actionType + riskLevel, approve/reject) decide
-- whether a protected action needs an approval at all; cowork_approval_bindings
-- scope the approval when one is required. Workspace-scoped overrides; NULL
-- workspace row = global default (low-risk auto-approve).
CREATE TABLE IF NOT EXISTS cowork_approval_policy (
    workspace       TEXT PRIMARY KEY,
    capability_risk TEXT NOT NULL DEFAULT '{}',
    rules           TEXT NOT NULL DEFAULT '[]',
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
