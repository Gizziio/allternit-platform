'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  detectRuntimeUnavailable,
  markRuntimeAvailable,
  markRuntimeUnavailable,
} from './useRuntimeAvailable';

export interface CoworkSessionRecord {
  id: string;
  userId: string;
  projectId: string | null;
  title: string | null;
  status: string;
  mode: string;
  checkpoint: string | null;
  metadata: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useCoworkSessionList() {
  const [sessions, setSessions] = useState<CoworkSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/v1/cowork/sessions?limit=30')
      .then(async (r) => {
        if (!r.ok) {
          const runtime = await detectRuntimeUnavailable(r);
          if (runtime.unavailable) {
            // No paired runtime — surface it in the shared store instead of
            // silently rendering an empty "recent sessions" list.
            markRuntimeUnavailable(runtime.reason);
            return { sessions: [] } as { sessions?: CoworkSessionRecord[] };
          }
          throw new Error(`Failed to load sessions (HTTP ${r.status})`);
        }
        markRuntimeAvailable();
        return r.json() as Promise<{ sessions?: CoworkSessionRecord[] }>;
      })
      .then((data: { sessions?: CoworkSessionRecord[] }) => {
        setSessions(data.sessions ?? []);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const deleteSession = useCallback(async (id: string) => {
    await fetch(`/api/v1/cowork/sessions/${id}`, { method: 'DELETE' });
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const saveCheckpoint = useCallback(async (id: string, checkpoint: unknown) => {
    await fetch(`/api/v1/cowork/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkpoint, status: 'paused' }),
    });
    refresh();
  }, [refresh]);

  return { sessions, loading, error, refresh, deleteSession, saveCheckpoint };
}

/** Parse a checkpoint string back into a usable context block. */
export function extractCheckpointContext(checkpointJson: string | null): string {
  if (!checkpointJson) return '';
  try {
    const cp = JSON.parse(checkpointJson) as { summary?: string; lastMessage?: string; taskTitles?: string[] };
    const parts: string[] = [];
    if (cp.summary) parts.push(`Previous session summary: ${cp.summary}`);
    if (cp.lastMessage) parts.push(`Last message: ${cp.lastMessage}`);
    if (cp.taskTitles?.length) parts.push(`Tasks in progress: ${cp.taskTitles.join(', ')}`);
    return parts.join('\n');
  } catch {
    return checkpointJson;
  }
}
