-- Cowork approval decisions: record the outcome of POST /cowork/approvals on
-- the row so decided approvals keep an audit trail instead of vanishing.
-- Refinery applies each migration once (tracked in _refinery_schema_history),
-- so plain ALTERs are safe; decided rows are also marked dismissed=1.

ALTER TABLE cowork_approvals ADD COLUMN decision TEXT;
ALTER TABLE cowork_approvals ADD COLUMN decided_at DATETIME;
