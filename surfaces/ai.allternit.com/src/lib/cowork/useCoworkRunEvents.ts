'use client';

import { useState, useEffect, useRef } from 'react';
import { usePlatformAuth } from '@/lib/platform-auth-client';
import { env } from '@/lib/env';

export interface CoworkRunEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

// Cowork run events are served by allternit-cloud-api. EventSource cannot send
// Authorization headers, so the SSE variant is not usable cross-origin with
// Clerk bearer auth — poll the JSON events endpoint instead (RunsView already
// refreshes runs on a 5s cadence, so a 4s events poll stays in step).
const API_BASE = env(
  'NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL',
  'https://api.allternit.com',
)!.replace(/\/$/, '');

const EVENTS_POLL_MS = 4000;

export function useCoworkRunEvents(runId: string | null) {
  const auth = usePlatformAuth();
  const [events, setEvents] = useState<CoworkRunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!runId) {
      setEvents([]);
      setConnected(false);
      setError(null);
      return;
    }

    setEvents([]);
    setError(null);
    let cancelled = false;

    const poll = async () => {
      try {
        const token = await auth.getToken().catch(() => null);
        const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
        const res = await fetch(`${API_BASE}/api/v1/runs/${runId}/events?limit=200`, { headers });
        if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
        const data = (await res.json()) as Array<{
          event_type: string;
          payload?: Record<string, unknown>;
        }>;
        if (cancelled) return;
        setEvents(
          data.map((ev) => ({ event_type: ev.event_type, payload: ev.payload ?? {} })),
        );
        setConnected(true);
      } catch (e) {
        if (cancelled) return;
        setConnected(false);
        setError(String(e));
      }
    };

    void poll();
    timerRef.current = window.setInterval(() => void poll(), EVENTS_POLL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [auth, runId]);

  return { events, connected, error };
}
