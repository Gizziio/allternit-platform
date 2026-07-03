-- Add execution domain to routines and loops.
-- Domain is explicit: 'local' runs inside the desktop/gizzi process,
-- 'cloud' runs in the Allternit Cloud Scheduler. No implicit fallback.

ALTER TABLE routines ADD COLUMN execution_domain TEXT NOT NULL DEFAULT 'local';
ALTER TABLE loops ADD COLUMN execution_domain TEXT NOT NULL DEFAULT 'local';
