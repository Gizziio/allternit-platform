import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BudgetDashboardView,
} from './BudgetDashboardView';
import { useBudget } from '@/hooks/useBudget';

vi.mock('@/hooks/useBudget', () => ({
  useBudget: vi.fn(),
}));

vi.mock('@/design/GlassSurface', () => ({
  GlassSurface: ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <div data-testid="glass-surface" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('../components/StatCard', () => ({
  StatCard: ({ label, value, unit }: { label: string; value: string | number; unit?: string }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
      {unit ? <span>{unit}</span> : null}
    </div>
  ),
}));

vi.mock('../components/ProgressBar', () => ({
  ProgressBar: ({
    label,
    value,
    used,
    limit,
  }: {
    label?: string;
    value: number;
    used?: string;
    limit?: string;
  }) => (
    <div data-testid="progress-bar">
      <span>{label}</span>
      <span>{value}</span>
      <span>{used}</span>
      <span>{limit}</span>
    </div>
  ),
}));

vi.mock('../components/StatusBadge', () => ({
  StatusBadge: ({ text }: { text?: string }) => <div data-testid="status-badge">{text}</div>,
}));

describe('BudgetDashboardView', () => {
  const mockRefetch = vi.fn();
  const mockSetQuota = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      budget: {
        credits_remaining: 12,
        credits_consumed_this_hour: 2,
        projected_hourly_cost: 5,
        status: 'healthy',
        cpu_percent: 40,
        memory_percent: 35,
        network_percent: 20,
        worker_percent: 55,
      },
      metrics: [
        { key: 'cpu', label: 'CPU', percent: 40, tone: 'healthy', detail: '40.0% utilized' },
        { key: 'memory', label: 'Memory', percent: 35, tone: 'healthy', detail: '35.0% utilized' },
      ],
      alerts: [
        {
          level: 'info',
          title: 'Runtime budget healthy',
          message: 'The shared default runtime tenant is operating inside its current budget envelope.',
        },
      ],
      configuredCreditsPerHour: 12,
      maxPressurePercent: 55,
      statusTone: 'success',
      lastUpdatedAt: '2026-02-27T16:22:00.000Z',
      lastQuotaUpdate: null,
      isLoading: false,
      isSaving: false,
      error: null,
      refetch: mockRefetch,
      setQuota: mockSetQuota,
    });
  });

  it('renders the live runtime budget surface', async () => {
    render(<BudgetDashboardView />);

    expect(screen.getByText('Runtime Budget')).toBeInTheDocument();
    expect(screen.getByText('Shared runtime quota')).toBeInTheDocument();
    expect(screen.getByText('Resource pressure')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12')).toBeInTheDocument();
    expect(screen.getByTestId('status-badge')).toHaveTextContent('healthy');
  });

  it('applies a quota update from the control surface', async () => {
    mockSetQuota.mockResolvedValue({
      status: 'quota_updated',
      credits_per_hour: 20,
      tenant_id: 'default',
    });

    render(<BudgetDashboardView />);

    const input = screen.getByLabelText('Credits per hour');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply quota' }));

    await waitFor(() => {
      expect(mockSetQuota).toHaveBeenCalledWith(20);
    });
  });

  it('shows the full-screen error state when no budget is available', () => {
    (useBudget as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      budget: null,
      metrics: [],
      alerts: [],
      configuredCreditsPerHour: 0,
      maxPressurePercent: 0,
      statusTone: 'failed',
      lastUpdatedAt: null,
      lastQuotaUpdate: null,
      isLoading: false,
      isSaving: false,
      error: new Error('boom'),
      refetch: mockRefetch,
      setQuota: mockSetQuota,
    });

    render(<BudgetDashboardView />);

    expect(screen.getByText('Failed to load runtime budget')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
