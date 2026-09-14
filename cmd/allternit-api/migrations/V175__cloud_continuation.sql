-- Cloud continuation (Cowork E6): workspace preference + per-routine
-- continuation policy. Jobs that opt in require compute.cloud and are
-- claimable only by the always-on gizzi-cloud principal.
ALTER TABLE user_cowork_preferences ADD COLUMN cloud_continuation INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cowork_routines ADD COLUMN continuation TEXT NOT NULL DEFAULT 'local';
