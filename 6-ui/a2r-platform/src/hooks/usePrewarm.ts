"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PoolStatus,
  PoolActivity,
  PoolStats,
  PoolHealth,
  PoolCreateForm,
  ActivityType,
} from '@/types/runtime';

export type { PoolStatus, PoolActivity, PoolStats, PoolCreateForm };

interface BackendPoolStatus {
  name: string;
  available: number;
  in_use: number;
  pool_size: number;
}

interface BackendPrewarmStatus {
  enabled: boolean;
  pool_size: number;
  available_instances: number;
  in_use_instances: number;
  pools: BackendPoolStatus[];
}

interface UsePrewarmReturn {
  pools: PoolStatus[];
  activities: PoolActivity[];
  stats: PoolStats;
  selectedPool: PoolStatus | undefined;
  runtimeStatus: BackendPrewarmStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setPoolSize: (poolSize: number) => Promise<void>;
  warmupPool: (name?: string) => Promise<void>;
  selectPool: (name: string | undefined) => void;
  getPoolsByHealth: (health: PoolHealth) => PoolStatus[];
  calculateHealth: (pool: PoolStatus) => PoolHealth;
}

const emptyStats: PoolStats = {
  total_pools: 0,
  total_instances: 0,
  total_available: 0,
  total_in_use: 0,
  total_warmups_performed: 0,
  total_reuses: 0,
  avg_warmup_time_ms: 0,
};

function calculateHealth(pool: PoolStatus): PoolHealth {
  if (pool.available_count <= 0) {
    return PoolHealth.Empty;
  }

  if (pool.available_count / Math.max(pool.pool_size, 1) < 0.35) {
    return PoolHealth.Degraded;
  }

  return PoolHealth.Healthy;
}

function mapPool(pool: BackendPoolStatus): PoolStatus {
  const mapped: PoolStatus = {
    name: pool.name,
    image: 'runtime/default',
    pool_size: pool.pool_size,
    available_count: pool.available,
    in_use_count: pool.in_use,
    warming_up_count: 0,
    status: PoolHealth.Empty,
    created_at: '',
    last_activity: '',
  };

  mapped.status = calculateHealth(mapped);
  return mapped;
}

function buildStats(status: BackendPrewarmStatus | null): PoolStats {
  if (!status) {
    return emptyStats;
  }

  return {
    total_pools: status.pools.length,
    total_instances: status.available_instances + status.in_use_instances,
    total_available: status.available_instances,
    total_in_use: status.in_use_instances,
    total_warmups_performed: 0,
    total_reuses: 0,
    avg_warmup_time_ms: 0,
  };
}

export function usePrewarm(): UsePrewarmReturn {
  const [runtimeStatus, setRuntimeStatus] = useState<BackendPrewarmStatus | null>(null);
  const [pools, setPools] = useState<PoolStatus[]>([]);
  const [activities, setActivities] = useState<PoolActivity[]>([]);
  const [selectedPoolName, setSelectedPoolName] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const stats = useMemo(() => buildStats(runtimeStatus), [runtimeStatus]);

  const appendActivity = useCallback((activity: PoolActivity) => {
    setActivities((current) => [activity, ...current].slice(0, 50));
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/runtime/prewarm/status');
      if (!res.ok) {
        throw new Error('Failed to fetch prewarm status');
      }

      const status = await res.json() as BackendPrewarmStatus;
      setRuntimeStatus(status);
      setPools(status.pools.map(mapPool));

      setSelectedPoolName((current) => {
        if (current && status.pools.some((pool) => pool.name === current)) {
          return current;
        }
        return status.pools[0]?.name;
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const setPoolSize = useCallback(async (poolSize: number) => {
    const res = await fetch('/api/v1/runtime/prewarm/pool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pool_size: poolSize }),
    });

    if (!res.ok) {
      throw new Error('Failed to update pool size');
    }

    appendActivity({
      timestamp: new Date().toISOString(),
      pool_name: selectedPoolName || 'default',
      activity_type: ActivityType.InstanceCreated,
      details: `Set pool size to ${poolSize}`,
    });

    await fetchData();
  }, [appendActivity, fetchData, selectedPoolName]);

  const warmupPool = useCallback(async (name?: string) => {
    const res = await fetch('/api/v1/runtime/prewarm/warmup', {
      method: 'POST',
    });

    if (!res.ok) {
      throw new Error('Failed to trigger warmup');
    }

    appendActivity({
      timestamp: new Date().toISOString(),
      pool_name: name || selectedPoolName || 'default',
      activity_type: ActivityType.WarmupStarted,
      details: 'Warmup triggered from the GUI',
    });

    await fetchData();
  }, [appendActivity, fetchData, selectedPoolName]);

  const selectPool = useCallback((name: string | undefined) => {
    setSelectedPoolName(name);
  }, []);

  const getPoolsByHealth = useCallback((health: PoolHealth): PoolStatus[] => {
    return pools.filter((pool) => calculateHealth(pool) === health);
  }, [pools]);

  const selectedPool = useMemo(() => {
    return pools.find((pool) => pool.name === selectedPoolName);
  }, [pools, selectedPoolName]);

  return {
    pools,
    activities,
    stats,
    selectedPool,
    runtimeStatus,
    isLoading,
    error,
    refetch: fetchData,
    setPoolSize,
    warmupPool,
    selectPool,
    getPoolsByHealth,
    calculateHealth,
  };
}

export { PoolHealth, ActivityType };
