import { useCallback, useEffect, useState } from 'react';
import { api } from '@/integration/api-client';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('useInferenceRouterCliStatus');

export interface InferenceRouterProvider {
  id: string;
  name: string;
  installed: boolean;
  available: boolean;
  reason?: string;
  models?: Array<{ id: string; name: string; default?: boolean }>;
}

export interface UseInferenceRouterCliStatusReturn {
  providers: InferenceRouterProvider[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useInferenceRouterCliStatus(): UseInferenceRouterCliStatusReturn {
  const [providers, setProviders] = useState<InferenceRouterProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const signal = AbortSignal.timeout(5000);
      const response = await api.getInferenceRouterCliStatus({ signal });
      setProviders(response.providers ?? []);
    } catch (err) {
      const wrapped = err instanceof Error ? err : new Error(String(err));
      logger.warn({ err: wrapped }, 'Failed to load inference-router CLI status');
      setError(wrapped);
      // Leave stale provider list in place so the picker does not flicker to
      // empty on transient network errors.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { providers, isLoading, error, refetch };
}
