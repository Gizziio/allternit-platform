import { useMemo, useRef, useEffect } from 'react';
import { useBrain, type BrainEvent } from '../../runtime/BrainContext';

export type { BrainEvent };

export interface UseBrainEventCursorResult {
  sessionId: string | null;
  newEvents: BrainEvent[];
  reset: () => void;
}

export function useBrainEventCursor(consumerId: string): UseBrainEventCursorResult {
  const { sessions, activeSessionId } = useBrain();
  const sessionId = activeSessionId;
  const lastIndexRef = useRef<Record<string, number>>({});

  const activeSession = useMemo(
    () => sessions.find(s => s.session.id === sessionId),
    [sessions, sessionId]
  );
  const events = activeSession?.events ?? [];

  const key = `${consumerId}:${sessionId ?? 'none'}`;
  const last = lastIndexRef.current[key] ?? 0;
  const newEvents = events.slice(last);

  useEffect(() => {
    lastIndexRef.current[key] = events.length;
  }, [key, events.length]);

  const reset = () => {
    lastIndexRef.current[key] = 0;
  };

  return { sessionId, newEvents, reset };
}
