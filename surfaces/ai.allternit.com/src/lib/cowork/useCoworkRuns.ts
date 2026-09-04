'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';

// Cowork runs are served by allternit-cloud-api, not by this static SPA —
// same-origin `/api/v1/*` paths resolve to the Pages host and return SPA HTML
// in production. Route everything through the cloud API base with the Clerk
// session token, mirroring hosted-compute.ts / useRuntimes.ts.
const API_BASE = env(
  'NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL',
  'https://api.allternit.com',
)!.replace(/\/$/, '');

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
  const auth = usePlatformAuth();
  const [runs, setRuns] = useState<CoworkRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True when the cloud API does not serve the cowork runs endpoints at all
  // (404). Callers should hide the feature UI instead of showing errors.
  const [unsupported, setUnsupported] = useState(false);
  // Set when a specific sub-endpoint 404s — recover and handoffs are not
  // implemented in cloud-api; detect once and hide those controls.
  const [recoverUnavailable, setRecoverUnavailable] = useState(false);
  const [handoffsUnavailable, setHandoffsUnavailable] = useState(false);

  const coworkFetch = useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await auth.getToken().catch(() => null);
      const headers = new Headers(init?.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (init?.body) headers.set('Content-Type', 'application/json');
      return fetch(`${API_BASE}${path}`, { ...init, headers });
    },
    [auth],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await coworkFetch('/api/v1/runs');
      if (res.status === 404) {
        setUnsupported(true);
        setRuns([]);
        return;
      }
      if (res.status === 401 || res.status === 403) {
        // Not signed in (or token rejected) — nothing to list.
        setRuns([]);
        return;
      }
      if (!res.ok) throw new Error(`Failed to fetch runs: ${res.status}`);
      const data = (await res.json()) as CoworkRun[];
      setRuns(workspaceId ? data.filter((r) => r.workspace_id === workspaceId) : data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [coworkFetch, workspaceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createRun = useCallback(
    async (req: CreateRunRequest) => {
      const res = await coworkFetch('/api/v1/runs', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`Failed to create run: ${res.status}`);
      const run = (await res.json()) as CoworkRun;
      refresh();
      return run;
    },
    [coworkFetch, refresh],
  );

  const startRun = useCallback(
    async (id: string) => {
      const res = await coworkFetch(`/api/v1/runs/${id}/start`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to start run: ${res.status}`);
      refresh();
    },
    [coworkFetch, refresh],
  );

  const cancelRun = useCallback(
    async (id: string) => {
      const res = await coworkFetch(`/api/v1/runs/${id}/cancel`, { method: 'POST' });
      if (!res.ok) throw new Error(`Failed to cancel run: ${res.status}`);
      refresh();
    },
    [coworkFetch, refresh],
  );

  const recoverRun = useCallback(
    async (id: string) => {
      const res = await coworkFetch(`/api/v1/runs/${id}/recover`, { method: 'POST' });
      if (res.status === 404) {
        setRecoverUnavailable(true);
        return;
      }
      if (!res.ok) throw new Error(`Failed to recover run: ${res.status}`);
      refresh();
    },
    [coworkFetch, refresh],
  );

  const createHandoff = useCallback(
    async (runId: string, req: { to_agent_id: string; task_id?: string; note?: string }) => {
      const res = await coworkFetch(`/api/v1/runs/${runId}/handoffs`, {
        method: 'POST',
        body: JSON.stringify(req),
      });
      if (res.status === 404) {
        setHandoffsUnavailable(true);
        return undefined as unknown as CoworkHandoff;
      }
      if (!res.ok) throw new Error(`Failed to create handoff: ${res.status}`);
      refresh();
      return (await res.json()) as CoworkHandoff;
    },
    [coworkFetch, refresh],
  );

  return {
    runs,
    loading,
    error,
    unsupported,
    recoverUnavailable,
    handoffsUnavailable,
    refresh,
    createRun,
    startRun,
    cancelRun,
    recoverRun,
    createHandoff,
  };
}

export function useCoworkRunJobs(runId: string | null) {
  const auth = usePlatformAuth();
  const [jobs, setJobs] = useState<CoworkJob[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!runId) {
      setJobs([]);
      return;
    }
    setLoading(true);
    try {
      const token = await auth.getToken().catch(() => null);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`${API_BASE}/api/v1/runs/${runId}/jobs`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch jobs: ${res.status}`);
      setJobs((await res.json()) as CoworkJob[]);
    } catch (e) {
      console.error('[useCoworkRunJobs]', e);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [auth, runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { jobs, loading, refresh };
}

export function useCoworkRunHandoffs(runId: string | null) {
  const auth = usePlatformAuth();
  const [handoffs, setHandoffs] = useState<CoworkHandoff[]>([]);

  const refresh = useCallback(async () => {
    if (!runId) {
      setHandoffs([]);
      return;
    }
    try {
      const token = await auth.getToken().catch(() => null);
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const res = await fetch(`${API_BASE}/api/v1/runs/${runId}/handoffs`, { headers });
      if (!res.ok) throw new Error(`Failed to fetch handoffs: ${res.status}`);
      setHandoffs((await res.json()) as CoworkHandoff[]);
    } catch (e) {
      console.error('[useCoworkRunHandoffs]', e);
      setHandoffs([]);
    }
  }, [auth, runId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { handoffs, refresh };
}

export interface CoworkRunEvent {
  event_type: string;
  payload: Record<string, unknown>;
}
