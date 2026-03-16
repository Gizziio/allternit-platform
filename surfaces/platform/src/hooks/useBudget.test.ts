import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type RuntimeBudgetStatus,
  useBudget,
} from './useBudget';

function createJsonResponse(data: unknown, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(data),
  } as unknown as Response;
}

describe('useBudget', () => {
  const fetchMock = vi.fn();

  const baseBudget: RuntimeBudgetStatus = {
    credits_remaining: 12,
    credits_consumed_this_hour: 1.5,
    projected_hourly_cost: 6.25,
    status: 'healthy',
    cpu_percent: 42,
    memory_percent: 38,
    network_percent: 12,
    worker_percent: 55,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads the live runtime budget on mount', async () => {
    fetchMock.mockResolvedValue(createJsonResponse(baseBudget));

    const { result } = renderHook(() => useBudget());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/runtime/budget');
    expect(result.current.budget).toEqual(baseBudget);
    expect(result.current.configuredCreditsPerHour).toBe(12);
    expect(result.current.metrics).toHaveLength(4);
    expect(result.current.alerts[0]?.level).toBe('info');
    expect(result.current.statusTone).toBe('success');
  });

  it('posts quota updates and refetches runtime status', async () => {
    fetchMock
      .mockResolvedValueOnce(createJsonResponse(baseBudget))
      .mockResolvedValueOnce(
        createJsonResponse({
          status: 'quota_updated',
          credits_per_hour: 20,
          tenant_id: 'default',
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ...baseBudget,
          credits_remaining: 20,
          projected_hourly_cost: 8,
          cpu_percent: 78,
          status: 'warning',
        }),
      );

    const { result } = renderHook(() => useBudget());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.setQuota(20);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/runtime/budget/quota', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credits_per_hour: 20 }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/runtime/budget');
    expect(result.current.lastQuotaUpdate).toEqual({
      status: 'quota_updated',
      credits_per_hour: 20,
      tenant_id: 'default',
    });
    expect(result.current.configuredCreditsPerHour).toBe(20);
    expect(result.current.statusTone).toBe('warning');
  });

  it('surfaces fetch failures', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: vi.fn(),
    } as unknown as Response);

    const { result } = renderHook(() => useBudget());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.budget).toBeNull();
    expect(result.current.error?.message).toBe('Failed to fetch runtime budget');
  });

  it('rejects invalid quota values before posting', async () => {
    fetchMock.mockResolvedValue(createJsonResponse(baseBudget));

    const { result } = renderHook(() => useBudget());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await expect(result.current.setQuota(Number.NaN)).rejects.toThrow(
      'Quota must be a non-negative number',
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
