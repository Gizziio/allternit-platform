/**
 * Swarm Dashboard Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwarmDashboard } from './SwarmDashboard';

// Mock fetch with URL matching
const mockFetch = vi.fn((url: string) => {
  if (url.includes('/circuit-breakers')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  }
  if (url.includes('/quarantine')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
  }
  if (url.includes('/messages/stats')) {
    return Promise.resolve({ 
      ok: true, 
      json: () => Promise.resolve({
        messages_sent: 0,
        messages_received: 0,
        messages_failed: 0,
        avg_latency_ms: 0,
        active_streams: 0,
      })
    });
  }
  return Promise.resolve({ ok: false, status: 404 });
});
global.fetch = mockFetch;

const mockCircuitBreakers = [
  {
    agent_id: 'agent_1',
    state: 'closed' as const,
    failure_count: 0,
    success_count: 10,
    last_failure_at: null,
    last_state_change: new Date().toISOString(),
  },
  {
    agent_id: 'agent_2',
    state: 'open' as const,
    failure_count: 5,
    success_count: 0,
    last_failure_at: new Date().toISOString(),
    last_state_change: new Date().toISOString(),
  },
];

const mockQuarantined = [
  {
    agent_id: 'agent_3',
    quarantined_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    reason: 'Circuit breaker opened',
    remaining_minutes: 60,
  },
];

const mockMessageStats = {
  messages_sent: 1000,
  messages_received: 950,
  messages_failed: 50,
  avg_latency_ms: 45.5,
  active_streams: 5,
};

describe('SwarmDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementation
    mockFetch.mockReset();
  });

  it('renders loading state initially', async () => {
    mockFetch.mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<SwarmDashboard />);
    
    // Wait for the loading state to be rendered
    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveClass('animate-spin');
    });
  });

  it('renders error state on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it('renders dashboard with data', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCircuitBreakers) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockQuarantined) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // Circuit breakers count
      expect(screen.getByText('1')).toBeInTheDocument(); // Quarantined count
      expect(screen.getByText('1,000')).toBeInTheDocument(); // Messages sent
    });
  });

  it('displays circuit breaker states correctly', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCircuitBreakers) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Closed')).toBeInTheDocument();
      expect(screen.getByText('Open')).toBeInTheDocument();
    });
  });

  it('calls reset circuit breaker on button click', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers/') && url.includes('/reset')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCircuitBreakers) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    // Wait for the dashboard to load and circuit breakers to appear
    await waitFor(() => {
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
    });

    // Wait for circuit breakers to be rendered (agent_2 has state 'open')
    await waitFor(() => {
      expect(screen.getByText('agent_2')).toBeInTheDocument();
    });

    // Find and click the enabled reset button (agent_2 has state 'open', so its button is enabled)
    // agent_1 has state 'closed' so its reset button is disabled
    const resetButtons = screen.getAllByRole('button', { name: /reset/i });
    expect(resetButtons.length).toBeGreaterThan(0);
    // Click the second reset button (for agent_2 which is 'open')
    fireEvent.click(resetButtons[1]);

    // Verify the fetch was called with the reset endpoint
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/circuit-breakers/agent_'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('refreshes data on refresh button click', async () => {
    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCircuitBreakers) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(6); // Initial 3 + refresh 3
    });
  });

  it('displays empty state when no circuit breakers', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/no circuit breakers active/i)).toBeInTheDocument();
    });
  });

  it('displays empty state when no quarantined agents', async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCircuitBreakers) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    // Wait for the dashboard to load
    await waitFor(() => {
      expect(screen.getByText('Swarm Dashboard')).toBeInTheDocument();
    });

    // Click on the Quarantine tab using userEvent
    const quarantineTab = screen.getByRole('tab', { name: /quarantine/i });
    await userEvent.click(quarantineTab);

    // Wait for tab content to switch and empty state to appear
    await waitFor(() => {
      expect(screen.getByText('No agents in quarantine')).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('shows message statistics correctly', async () => {
    mockFetch.mockImplementation((url: string) => {
      console.log('Fetch called with:', url);
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      console.log('Unmatched URL:', url);
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    await waitFor(() => {
      expect(screen.getByText('1,000')).toBeInTheDocument(); // Sent
      expect(screen.getByText(/950 received/)).toBeInTheDocument(); // Received
      expect(screen.getByText(/50 failed/)).toBeInTheDocument(); // Failed
      expect(screen.getByText('45.50ms')).toBeInTheDocument(); // Latency
    });
  });

  it('auto-refreshes every 30 seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/circuit-breakers')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/quarantine')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/messages/stats')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockMessageStats) });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });

    render(<SwarmDashboard />);

    // Wait for initial data fetch (3 calls: circuit-breakers, quarantine, messages/stats)
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    // Fast-forward 30 seconds to trigger the interval
    vi.advanceTimersByTime(30000);
    
    // Wait for the next fetch cycle to complete
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(6);
    }, { timeout: 3000 });

    vi.useRealTimers();
  }, 10000);
});
