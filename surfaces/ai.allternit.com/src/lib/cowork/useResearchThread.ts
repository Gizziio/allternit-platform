'use client';

import { useState, useCallback, useRef } from 'react';
import { isBetaApiEnabled } from '@/lib/env';
import { cloudApiFetch } from '@/lib/cloud-api';

// When the beta control-plane flag is on, /api/v1/beta/research is served by
// the cloud-api control plane (Clerk auth → user's data-plane node → relay),
// reached with the Clerk session bearer via cloudApiFetch. When off, the
// callers below never fire: every entry point fails closed on the flag first.
const BETA_RESEARCH_DISABLED_MESSAGE =
  'Deep research is disabled in this deployment (the beta research API is not enabled).';

interface ResearchMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ResearchTask {
  id: string;
  query: string;
  status: string;
  synthesis?: string | null;
  sources?: unknown;
  created_at: string;
  updated_at: string;
}

export interface ResearchThreadState {
  threadId: string | null;
  messages: ResearchMessage[];
  isStreaming: boolean;
  streamBuffer: string;
  error: string | null;
  isHealthy: boolean | null;
}

const API_BASE = '/api/v1/beta/research';
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 120_000;

/**
 * Fetch a beta research path. Flag on → cloud-api control plane with the
 * Clerk bearer; flag off → relative path (callers never reach this when off —
 * every entry point is guarded by isBetaApiEnabled).
 */
async function researchFetch(path: string, init?: RequestInit): Promise<Response> {
  if (isBetaApiEnabled()) {
    return cloudApiFetch(path, init);
  }
  return fetch(path, init);
}

export function useResearchThread() {
  const [state, setState] = useState<ResearchThreadState>({
    threadId: null,
    messages: [],
    isStreaming: false,
    streamBuffer: '',
    error: null,
    isHealthy: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const checkHealth = useCallback(async () => {
    if (!isBetaApiEnabled()) {
      // Never probe /api/v1/beta/research when disabled; the panel renders
      // its offline state (disabled input + "Offline" badge) off isHealthy.
      setState((s) => ({ ...s, isHealthy: false }));
      return;
    }
    try {
      const res = await researchFetch(`${API_BASE}?limit=1`);
      setState((s) => ({ ...s, isHealthy: res.ok }));
    } catch {
      setState((s) => ({ ...s, isHealthy: false }));
    }
  }, []);

  const pollTask = useCallback(async (taskId: string, startedAt: number) => {
    try {
      const res = await researchFetch(`${API_BASE}/${taskId}`);
      if (!res.ok) throw new Error(`Task poll failed (${res.status})`);
      const data = (await res.json()) as { task?: ResearchTask };
      const task = data.task;

      if (!task) throw new Error('Task response missing task');

      if (task.status === 'completed' || task.status === 'failed') {
        setState((s) => ({
          ...s,
          isStreaming: false,
          streamBuffer: '',
          messages: [
            ...s.messages,
            {
              role: 'assistant',
              content:
                task.status === 'completed'
                  ? task.synthesis || `Research complete for: ${task.query}`
                  : `Research task failed for: ${task.query}`,
            },
          ],
        }));
        clearPoll();
        return;
      }

      setState((s) => ({
        ...s,
        streamBuffer: `Research status: ${task.status}…`,
      }));

      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        setState((s) => ({
          ...s,
          isStreaming: false,
          streamBuffer: '',
          messages: [
            ...s.messages,
            { role: 'assistant', content: `Research task timed out: ${task.query}` },
          ],
        }));
        clearPoll();
        return;
      }

      pollTimerRef.current = window.setTimeout(() => pollTask(taskId, startedAt), POLL_INTERVAL_MS);
    } catch (err) {
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamBuffer: '',
        error: err instanceof Error ? err.message : String(err),
      }));
      clearPoll();
    }
  }, [clearPoll]);

  const query = useCallback(async (message: string) => {
    if (state.isStreaming) return;

    if (!isBetaApiEnabled()) {
      // Fail closed with a deliberate message instead of POSTing to
      // /api/v1/beta/research — when the flag is off, nothing serves it here.
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamBuffer: '',
        error: BETA_RESEARCH_DISABLED_MESSAGE,
      }));
      return;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    clearPoll();
    setState((s) => ({
      ...s,
      isStreaming: true,
      error: null,
      streamBuffer: 'Creating research task…',
      messages: [...s.messages, { role: 'user', content: message }],
    }));

    try {
      const res = await researchFetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: message, mode: 'ultrabrowse' }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(data.message ?? `Research create error (${res.status})`);
      }

      const data = (await res.json()) as { task?: ResearchTask };
      const task = data.task;
      if (!task?.id) throw new Error('Research task response missing id');

      setState((s) => ({ ...s, threadId: task.id }));
      void pollTask(task.id, Date.now());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((s) => ({
        ...s,
        isStreaming: false,
        streamBuffer: '',
        error: err instanceof Error ? err.message : String(err),
      }));
      clearPoll();
    }
  }, [state.isStreaming, clearPoll, pollTask]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    clearPoll();
    setState({ threadId: null, messages: [], isStreaming: false, streamBuffer: '', error: null, isHealthy: null });
  }, [clearPoll]);

  return { ...state, query, reset, checkHealth };
}
