'use client';

import { useState, useCallback, useEffect } from 'react';

export interface CoworkRun {
  id: string;
  tenant_id: string;
  workspace_id: string;
  initiator: string;
  mode: string;
  state: string;
  entrypoint: string;
  dag_id: string;
  current_job_id: string | null;
  current_checkpoint_id: string | null;
  policy_profile: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CoworkJob {
  id: string;
  run_id: string;
  dag_node_id: string;
  job_type: string;
  priority: number;
  state: string;
  payload: unknown;
  created_at: string;
  updated_at: string;
}

export interface CoworkHandoff {
  id: string;
  run_id: string;
  to_agent_id: string;
  task_id?: string;
  note?: string;
  status: string;
  created_at: string;
}

export interface CreateRunRequest {
  tenant_id: string;
  workspace_id: string;
  initiator: string;
  mode: 'interactive' | 'cowork' | 'scheduled';
  entrypoint: string;
  policy_profile?: string;
}

export function useCoworkRuns(workspaceId?: string) {
  const [runs, setRuns] = useState<CoworkRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/runs');
      if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
      const data = (await res.json()) as CoworkRun[];
      setRuns(workspaceId ? data.filter((r) => r.workspace_id === workspaceId) : data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRun = useCallback(
    async (req: CreateRunRequest) => {
      const res = await fetch('/api/v1/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`Failed to create run: ${res.status}`);
      const run = (await res.json()) as CoworkRun;
      refresh();
      return run;
    },
    [refresh],
  );

  const startRun = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/runs/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to start run: ${res.status}`);
      refresh();
    },
    [refresh],
  );

  const cancelRun = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/runs/${id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to cancel run: ${res.status}`);
      refresh();
    },
    [refresh],
  );

  const recoverRun = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/v1/runs/${id}/recover`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to recover run: ${res.status}`);
      refresh();
    },
    [refresh],
  );

  const createHandoff = useCallback(
    async (runId: string, req: { to_agent_id: string; task_id?: string; note?: string }) => {
      const res = await fetch(`/api/v1/runs/${runId}/handoffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`Failed to create handoff: ${res.status}`);
      refresh();
      return (await res.json()) as CoworkHandoff;
    },
    [refresh],
  );

  return {
    runs,
    loading,
    error,
    refresh,
    createRun,
    startRun,
    cancelRun,
    recoverRun,
    createHandoff,
  };
}

export function useCoworkRunJobs(runId: string | null) {
  const [jobs, setJobs] = useState<CoworkJob[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!runId) {
      setJobs([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/runs/${runId}/jobs`);
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
      setJobs((await res.json()) as CoworkJob[]);
    } catch (e) {
      console.error('[useCoworkRunJobs]', e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { jobs, loading, refresh };
}

export function useCoworkRunHandoffs(runId: string | null) {
  const [handoffs, setHandoffs] = useState<CoworkHandoff[]>([]);

  const refresh = useCallback(async () => {
    if (!runId) {
      setHandoffs([]);
      return;
    }
    try {
      const res = await fetch(`/api/v1/runs/${runId}/handoffs`);
      if (!res.ok) throw new Error(`Failed to fetch handoffs: ${res.status}`);
      setHandoffs((await res.json()) as CoworkHandoff[]);
    } catch (e) {
      console.error('[useCoworkRunHandoffs]', e);
      setHandoffs([]);
    }
  }, [runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { handoffs, refresh };
}
