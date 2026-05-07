'use client';

import { useState, useCallback } from 'react';

export interface TeamAgentResult {
  personaId: string;
  personaName: string;
  output: string;
  status: 'completed' | 'error';
  error?: string;
  durationMs: number;
}

export interface TeamSessionState {
  task: string;
  results: TeamAgentResult[];
  summary: { total: number; completed: number; errors: number } | null;
  isRunning: boolean;
  error: string | null;
}

export function useTeamSession() {
  const [state, setState] = useState<TeamSessionState>({
    task: '',
    results: [],
    summary: null,
    isRunning: false,
    error: null,
  });

  const execute = useCallback(async (task: string, personaIds?: string[]) => {
    setState((s) => ({ ...s, task, isRunning: true, error: null, results: [], summary: null }));
    try {
      const res = await fetch('/api/v1/cowork/team-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task, personaIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Team execute failed');
      setState((s) => ({
        ...s,
        results: data.results ?? [],
        summary: data.summary ?? null,
        isRunning: false,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        isRunning: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setState({ task: '', results: [], summary: null, isRunning: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
