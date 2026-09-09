-- Phase 4: distinguish golden-holder VMs (template build artifacts) from user
-- computers. Golden holders are excluded from default GET /api/v1/computers
-- listings unless ?include_roles=1 is passed.

ALTER TABLE computers ADD COLUMN role TEXT NOT NULL DEFAULT 'user';

CREATE INDEX IF NOT EXISTS idx_computers_role ON computers(role);
