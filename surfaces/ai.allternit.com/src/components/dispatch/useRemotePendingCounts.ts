'use client';

import { useEffect, useMemo, useState } from 'react';
import { createRemoteControlClient } from '@/lib/dispatch/remote-control';
import type { RuntimeViewModel } from './useRuntimes';

export interface RemotePendingCounts {
  permissions: number;
  questions: number;
  loading: boolean;
}

export function useRemotePendingCounts(
  runtimes: RuntimeViewModel[],
  getToken: () => Promise<string | null>
): RemotePendingCounts {
  const [counts, setCounts] = useState<{ permissions: number; questions: number }>({ permissions: 0, questions: 0 });
  const [loading, setLoading] = useState(true);

  const clients = useMemo(
    () =>
      runtimes
        .filter((rt) => rt.status === 'online' || rt.status === 'busy')
        .map((rt) => ({ runtimeId: rt.id, client: createRemoteControlClient({ runtimeId: rt.id, getToken }) })),
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
