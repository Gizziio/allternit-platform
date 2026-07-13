import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PromotionDashboardView } from './PromotionDashboardView';

const mockProposals = [
  {
    id: 'prop-1',
    title: 'Add auth middleware',
    description: 'Wire JWT validation into API routes',
    author: 'alice',
    timestamp: '2026-07-10',
    status: 'pending',
    riskLevel: 'Medium',
    affectedFiles: [{ path: 'src/auth.ts', additions: 40, deletions: 5 }],
    ciChecks: 'passing',
  },
];

describe('PromotionDashboardView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading then list of proposals', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockProposals),
      } as Response)
    ));

    render(<PromotionDashboardView />);
    expect(screen.getByText('Loading proposals…')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Add auth middleware')).toBeInTheDocument();
    });
  });

  it('calls decision endpoint when applying a proposal', async () => {
    const fetchSpy = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/promotion/proposals') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProposals),
        } as Response);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as Response);
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<PromotionDashboardView />);
    await waitFor(() => screen.getByText('Add auth middleware'));

    fireEvent.click(screen.getByText('Apply Proposal'));
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/promotion/proposals/prop-1/decision',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ decision: 'approved' }),
        })
      );
    });
  });

  it('rolls back on decision failure', async () => {
    const fetchSpy = vi.fn((url: string) => {
      if (url === '/api/v1/promotion/proposals') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockProposals),
        } as Response);
      }
      return Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({ message: 'Server error' }) } as Response);
    });
    vi.stubGlobal('fetch', fetchSpy);

    render(<PromotionDashboardView />);
    await waitFor(() => screen.getByText('Add auth middleware'));

    fireEvent.click(screen.getByText('Apply Proposal'));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
    expect(screen.getByText('PENDING')).toBeInTheDocument();
  });
});
