-- 016_cowork_handoffs.sql
--
-- Service parity with the allternit-api cowork routes
-- (cmd/allternit-api/src/rails/routes_cowork.rs): the cowork run surface in
-- ai.allternit.com (useCoworkRuns.ts) calls
--   POST /api/v1/runs/:id/recover
--   GET+POST /api/v1/runs/:run_id/handoffs
-- against this control plane, which had neither the handlers nor the table.
--
-- handoffs : a run-to-agent handoff record. Column-for-column the same shape
--            as allternit-api's cowork_handoffs (id, run_id, to_agent_id,
--            task_id, note, status, created_at); status is plain text here
--            ('pending' at creation) since this crate has no handoff state
--            machine.
--
-- eventtype gains 'run_recovered' and 'handoff_created' so the new routes can
-- record what happened on the run's event ledger, matching the event names
-- allternit-api emits for the same operations. The enum values are added in
-- guarded DO blocks (ALTER TYPE ... ADD VALUE has no IF NOT EXISTS) and are
-- never used inside this migration, so the transactional apply is safe.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'eventtype'
          AND e.enumlabel = 'run_recovered'
    ) THEN
        ALTER TYPE public.eventtype ADD VALUE 'run_recovered';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE n.nspname = 'public' AND t.typname = 'eventtype'
          AND e.enumlabel = 'handoff_created'
    ) THEN
        ALTER TYPE public.eventtype ADD VALUE 'handoff_created';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.handoffs (
    id          TEXT PRIMARY KEY,
    run_id      TEXT NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
    to_agent_id TEXT NOT NULL,
    task_id     TEXT,
    note        TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_handoffs_run ON public.handoffs(run_id);
