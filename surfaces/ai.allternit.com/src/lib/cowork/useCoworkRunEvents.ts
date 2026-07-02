'use client';

import { useState, useEffect } from 'react';

export interface CoworkRunEvent {
  event_type: string;
  payload: Record<string, unknown>;
}

export function useCoworkRunEvents(runId: string | null) {
  const [events, setEvents] = useState<CoworkRunEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) {
      setEvents([]);
      setConnected(false);
      setError(null);
      return;
    }

    setEvents([]);
    setError(null);
    const es = new EventSource(`/api/v1/runs/${runId}/events/stream`);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as CoworkRunEvent;
        setEvents((prev) => [...prev, data]);
      } catch (err) {
        setError(String(err));
      }
    };
    es.onerror = () => {
      setConnected(false);
      setError('Event stream error');
    };

    return () => es.close();
  }, [runId]);

  return { events, connected, error };
}
