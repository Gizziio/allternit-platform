'use client';

import { useEffect, useMemo, useState } from 'react';
import { createFabricSessionClient } from '@/lib/dispatch/fabric-session-client';
import type { RuntimeViewModel } from './useRuntimes';

export interface FabricRuntimePendingCounts {
  permissions: number;
  questions: number;
}

export interface FabricPendingCounts {
  permissions: number;
  questions: number;
  loading: boolean;
  byRuntime: Record<string, FabricRuntimePendingCounts>;
}

export function useFabricPendingCounts(
  runtimes: RuntimeViewModel[],
  getToken: () => Promise<string | null>
): FabricPendingCounts {
  const [counts, setCounts] = useState<{
    permissions: number;
    questions: number;
    byRuntime: Record<string, FabricRuntimePendingCounts>;
  }>({ permissions: 0, questions: 0, byRuntime: {} });
  const [loading, setLoading] = useState(true);

  const clients = useMemo(
    () =>
      runtimes
        .filter((rt) => rt.status === 'online' || rt.status === 'busy')
        .map((rt) => ({ runtimeId: rt.id, client: createFabricSessionClient({ runtimeId: rt.id, getToken }) })),
    [runtimes, getToken]
  );

  useEffect(() => {
    let cancelled = false;
    async function fetchCounts() {
      if (clients.length === 0) {
        setCounts({ permissions: 0, questions: 0, byRuntime: {} });
        setLoading(false);
        return;
      }
      setLoading(true);
      const results = await Promise.all(
        clients.map(async ({ runtimeId, client }) => {
          try {
            const [permissions, questions] = await Promise.all([
              client.listPendingPermissions(),
              client.listPendingQuestions(),
            ]);
            return { runtimeId, permissions: permissions.length, questions: questions.length };
          } catch {
            return { runtimeId, permissions: 0, questions: 0 };
          }
        })
      );
      if (cancelled) return;
      const byRuntime: Record<string, FabricRuntimePendingCounts> = {};
      let permissions = 0;
      let questions = 0;
      for (const row of results) {
        byRuntime[row.runtimeId] = { permissions: row.permissions, questions: row.questions };
        permissions += row.permissions;
        questions += row.questions;
      }
      setCounts({ permissions, questions, byRuntime });
      setLoading(false);
    }
    void fetchCounts();
    const onFocus = () => {
      if (document.visibilityState === 'visible') void fetchCounts();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [clients]);

  return { ...counts, loading };
}
