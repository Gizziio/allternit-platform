-- Review administration: emergency kill switches.
--
-- A kill switch either targets the whole marketplace (scope = 'marketplace')
-- or a single miniapp (scope = miniapp id). While enabled, the public listing
-- hides affected entries and the release endpoint refuses to serve install
-- descriptors, so already-distributed clients stop installing/updating them.

CREATE TABLE kill_switches (
    scope TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    reason TEXT,
    actor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only audit trail for every kill-switch transition.
CREATE TABLE kill_switch_events (
    id BIGSERIAL PRIMARY KEY,
    scope TEXT NOT NULL,
    enabled BOOLEAN NOT NULL,
    reason TEXT,
    actor TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX kill_switch_events_scope_idx ON kill_switch_events (scope, created_at DESC);
