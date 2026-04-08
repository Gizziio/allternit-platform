"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  MeasurementEntry,
  TenantQuota,
  UsageSummary,
} from '@/types/runtime';

export type { TenantQuota, UsageSummary, MeasurementEntry as Measurement };

export interface RuntimeBudgetStatus {
  credits_remaining: number;
  credits_consumed_this_hour: number;
  projected_hourly_cost: number;
  status: string;
  cpu_percent: number;
  memory_percent: number;
  network_percent: number;
  worker_percent: number;
}

export interface RuntimeBudgetQuotaUpdate {
  status: string;
  credits_per_hour: number;
  tenant_id: string;
}

export interface RuntimeBudgetMetric {
  key: 'cpu' | 'memory' | 'network' | 'workers';
  label: string;
  percent: number;
  tone: 'healthy' | 'warning' | 'critical';
  detail: string;
}

export interface RuntimeBudgetAlert {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
}

interface UseBudgetReturn {
  budget: RuntimeBudgetStatus | null;
  metrics: RuntimeBudgetMetric[];
  alerts: RuntimeBudgetAlert[];
  configuredCreditsPerHour: number;
  maxPressurePercent: number;
  statusTone: 'success' | 'warning' | 'failed';
  lastUpdatedAt: string | null;
  lastQuotaUpdate: RuntimeBudgetQuotaUpdate | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setQuota: (creditsPerHour: number) => Promise<RuntimeBudgetQuotaUpdate>;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, value));
}

function formatPercent(value: number): string {
  return `${clampPercent(value).toFixed(1)}% utilized`;
}

function getMetricTone(percent: number): RuntimeBudgetMetric['tone'] {
  if (percent >= 90) {
    return 'critical';
  }

  if (percent >= 75) {
    return 'warning';
  }

  return 'healthy';
}

function getStatusTone(
  status: string,
  maxPressurePercent: number,
): UseBudgetReturn['statusTone'] {
  if (status === 'exhausted' || maxPressurePercent >= 100) {
    return 'failed';
  }

  if (status === 'warning' || maxPressurePercent >= 75) {
    return 'warning';
  }

  return 'success';
}

function buildMetrics(budget: RuntimeBudgetStatus | null): RuntimeBudgetMetric[] {
  if (!budget) {
    return [];
  }

  return [
    {
      key: 'cpu',
      label: 'CPU',
      percent: clampPercent(budget.cpu_percent),
      tone: getMetricTone(budget.cpu_percent),
      detail: formatPercent(budget.cpu_percent),
    },
    {
      key: 'memory',
      label: 'Memory',
      percent: clampPercent(budget.memory_percent),
      tone: getMetricTone(budget.memory_percent),
      detail: formatPercent(budget.memory_percent),
    },
    {
      key: 'network',
      label: 'Network',
      percent: clampPercent(budget.network_percent),
      tone: getMetricTone(budget.network_percent),
      detail: formatPercent(budget.network_percent),
    },
    {
      key: 'workers',
      label: 'Workers',
      percent: clampPercent(budget.worker_percent),
      tone: getMetricTone(budget.worker_percent),
      detail: formatPercent(budget.worker_percent),
    },
  ];
}

function buildAlerts(
  budget: RuntimeBudgetStatus | null,
  configuredCreditsPerHour: number,
  maxPressurePercent: number,
): RuntimeBudgetAlert[] {
  if (!budget) {
    return [];
  }

  const alerts: RuntimeBudgetAlert[] = [];

  if (budget.status === 'exhausted' || maxPressurePercent >= 100) {
    alerts.push({
      level: 'critical',
      title: 'Runtime budget exhausted',
      message:
        'The runtime has crossed its enforced pressure ceiling. Reduce load or raise the hourly quota before launching more work.',
    });
  } else if (budget.status === 'warning' || maxPressurePercent >= 75) {
    alerts.push({
      level: 'warning',
      title: 'Runtime pressure climbing',
      message:
        'One or more resource channels are above the warning band. Watch this view before dispatching heavier workloads.',
    });
  }

  if (
    configuredCreditsPerHour > 0 &&
    budget.projected_hourly_cost > configuredCreditsPerHour
  ) {
    alerts.push({
      level: 'warning',
      title: 'Projected burn exceeds quota',
      message:
        'Projected hourly cost is above the configured credits-per-hour limit reported by the runtime settings.',
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: 'info',
      title: 'Runtime budget healthy',
      message:
        'The shared default runtime tenant is operating inside its current budget envelope.',
    });
  }

  return alerts;
}

export function useBudget(): UseBudgetReturn {
  const [budget, setBudget] = useState<RuntimeBudgetStatus | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [lastQuotaUpdate, setLastQuotaUpdate] = useState<RuntimeBudgetQuotaUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBudget = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/runtime/budget');

      if (!res.ok) {
        throw new Error('Failed to fetch runtime budget');
      }

      const data = (await res.json()) as RuntimeBudgetStatus;
      setBudget(data);
      setLastUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBudget();
  }, [fetchBudget]);

  const metrics = useMemo(() => buildMetrics(budget), [budget]);

  const maxPressurePercent = useMemo(() => {
    if (!budget) {
      return 0;
    }

    return Math.max(
      clampPercent(budget.cpu_percent),
      clampPercent(budget.memory_percent),
      clampPercent(budget.network_percent),
      clampPercent(budget.worker_percent),
    );
  }, [budget]);

  const configuredCreditsPerHour = budget?.credits_remaining ?? 0;
  const statusTone = useMemo(
    () => getStatusTone(budget?.status ?? 'healthy', maxPressurePercent),
    [budget?.status, maxPressurePercent],
  );

  const alerts = useMemo(() => {
    return buildAlerts(budget, configuredCreditsPerHour, maxPressurePercent);
  }, [budget, configuredCreditsPerHour, maxPressurePercent]);

  const setQuota = useCallback(
    async (creditsPerHour: number): Promise<RuntimeBudgetQuotaUpdate> => {
      if (!Number.isFinite(creditsPerHour) || creditsPerHour < 0) {
        throw new Error('Quota must be a non-negative number');
      }

      setIsSaving(true);
      setError(null);

      try {
        const res = await fetch('/api/v1/runtime/budget/quota', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credits_per_hour: creditsPerHour }),
        });

        if (!res.ok) {
          throw new Error('Failed to update runtime budget quota');
        }

        const result = (await res.json()) as RuntimeBudgetQuotaUpdate;
        setLastQuotaUpdate(result);
        await fetchBudget();
        return result;
      } catch (err) {
        const nextError =
          err instanceof Error ? err : new Error('Unknown quota update error');
        setError(nextError);
        throw nextError;
      } finally {
        setIsSaving(false);
      }
    },
    [fetchBudget],
  );

  return {
    budget,
    metrics,
    alerts,
    configuredCreditsPerHour,
    maxPressurePercent,
    statusTone,
    lastUpdatedAt,
    lastQuotaUpdate,
    isLoading,
    isSaving,
    error,
    refetch: fetchBudget,
    setQuota,
  };
}
