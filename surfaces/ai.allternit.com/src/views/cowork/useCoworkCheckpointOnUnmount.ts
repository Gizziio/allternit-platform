'use client';

import { useEffect, useRef } from 'react';
import { useCoworkSessionStore } from './CoworkSessionStore';
import {
  detectRuntimeUnavailable,
  markRuntimeAvailable,
  markRuntimeUnavailable,
} from '@/lib/cowork/useRuntimeAvailable';

/**
 * Save checkpoint to Prisma when the cowork surface unmounts with an active
 * session. Extracted from CoworkRoot so the server-id targeting is testable.
 *
 * cowork_sessions rows are keyed by the server-minted id captured at
 * creation (metadata.coworkServerId). Patching with the local mode-session
 * id permanently 404s, so the PATCH is skipped when the sync never landed.
 */
export function useCoworkCheckpointOnUnmount(coworkSessionId: string | null): void {
  const coworkSessionIdRef = useRef(coworkSessionId);
  coworkSessionIdRef.current = coworkSessionId;

  useEffect(() => {
    return () => {
      const sid = coworkSessionIdRef.current;
      if (!sid) return;
      const session = useCoworkSessionStore.getState().sessions.find((s) => s.id === sid);
      const messages = session?.messages ?? [];
      const lastMsg = messages[messages.length - 1];
      const checkpoint = {
        savedAt: new Date().toISOString(),
        lastMessage: lastMsg ? String(lastMsg.content ?? '').slice(0, 200) : '',
        messageCount: messages.length,
      };
      const serverId =
        session && typeof session.metadata.coworkServerId === 'string'
          ? session.metadata.coworkServerId
          : null;
      if (!serverId) return;
      fetch(`/api/v1/cowork/sessions/${serverId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint, status: 'paused' }),
      })
        .then(async (r) => {
          if (r.ok) {
            markRuntimeAvailable();
            return;
          }
          const runtime = await detectRuntimeUnavailable(r);
          if (runtime.unavailable) markRuntimeUnavailable(runtime.reason);
        })
        .catch(() => {});
    };
  }, []);
}
