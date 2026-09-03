'use client';

import { useEffect, useMemo, useState } from 'react';
import { createFabricSessionClient } from '@/lib/dispatch/fabric-session-client';
import type { RuntimeViewModel } from './useRuntimes';

export interface FabricPendingCounts {
  permissions: number;
  questions: number;
  loading: boolean;
}

export function useFabricPendingCounts(
  runtimes: RuntimeViewModel[],
  getToken: () => Promise<string | null>
): FabricPendingCounts {
  const [counts, setCounts] = useState<{ permissions: number; questions: number }>({ permissions: 0, questions: 0 });
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
        setCounts({ permissions: 0, questions: 0 });
        setLoading(false);
        return;
      }
      setLoading(true);
      const results = await Promise.all(
        clients.map(async ({ client }) => {
          try {
            const [permissions, questions] = await Promise.all([
              client.listPendingPermissions(),
              client.listPendingQuestions(),
            ]);
            return { permissions: permissions.length, questions: questions.length };
          } catch {
            return { permissions: 0, questions: 0 };
          }
        })
      );
      if (cancelled) return;
      setCounts(
        results.reduce(
          (acc, curr) => ({ permissions: acc.permissions + curr.permissions, questions: acc.questions + curr.questions }),
          { permissions: 0, questions: 0 }
        )
      );
      setLoading(false);
    }
    void fetchCounts();
    const interval = setInterval(fetchCounts, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [clients]);

  return { ...counts, loading };
}
