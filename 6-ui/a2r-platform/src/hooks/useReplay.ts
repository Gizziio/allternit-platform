"use client";

import { useState, useEffect, useCallback } from 'react';

export interface ReplayManifest {
  run_id: string;
  capture_level: 'none' | 'minimal' | 'full';
  output_count: number;
  timestamp_count: number;
}

export interface ReplayResult {
  status: string;
  session_id: string;
  can_replay: boolean;
  envelope?: {
    env_spec_hash?: string;
    policy_hash?: string;
    inputs_hash?: string;
  };
}

interface UseReplayReturn {
  manifests: ReplayManifest[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  replayExecution: (run_id: string) => Promise<ReplayResult>;
}

export function useReplay(): UseReplayReturn {
  const [manifests, setManifests] = useState<ReplayManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/runtime/replay/sessions');
      if (!res.ok) throw new Error('Failed to fetch replay sessions');
      const data = await res.json() as ReplayManifest[];
      setManifests(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const replayExecution = useCallback(async (run_id: string): Promise<ReplayResult> => {
    const res = await fetch(`/api/v1/runtime/replay/sessions/${encodeURIComponent(run_id)}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deterministic: true }),
    });

    if (!res.ok) {
      throw new Error('Replay failed');
    }

    return res.json() as Promise<ReplayResult>;
  }, []);

  return {
    manifests,
    isLoading,
    error,
    refetch: fetchData,
    replayExecution,
  };
}
