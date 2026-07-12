/**
 * React hook for discovering Allternit Design skills with hot-reload semantics.
 *
 * In the browser we cannot watch arbitrary filesystem paths, so we poll and
 * revalidate on window focus. In a future LTS daemon build this can swap to
 * a WebSocket or SSE feed from the local skill registry.
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchSkills, type SkillsQuery } from './skills-api';
import type { SkillRecord } from './skill-registry';

export interface UseSkillsOptions extends SkillsQuery {
  /** Polling interval in milliseconds. Default 5000. */
  refreshInterval?: number;
  /** Revalidate when the window regains focus. Default true. */
  revalidateOnFocus?: boolean;
}

export function useSkills(options: UseSkillsOptions = {}) {
  const { refreshInterval = 5000, revalidateOnFocus = true, ...query } = options;
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchSkills(query);
      setSkills(result);
      setLastRefreshedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [query.mode, query.scenario, query.query]);

  useEffect(() => {
    refresh();
    if (refreshInterval <= 0) return;
    const id = setInterval(refresh, refreshInterval);
    return () => clearInterval(id);
  }, [refresh, refreshInterval]);

  useEffect(() => {
    if (!revalidateOnFocus || typeof window === 'undefined') return;
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [refresh, revalidateOnFocus]);

  return { skills, loading, error, refresh, lastRefreshedAt };
}
