import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CloudInstancesPanel } from './CloudInstancesPanel';

// Mock platform auth so the panel can fetch without Clerk (SettingsView.test.tsx pattern).
// getToken must be referentially stable across renders: the panel builds its
// fetch helper in a useCallback keyed on it, and the real client memoizes the
// context value (platform-auth-client.tsx).
const { getToken } = vi.hoisted(() => ({ getToken: async () => 'test-token' }));
vi.mock('@/lib/platform-auth-client', () => ({
  usePlatformAuth: () => ({ getToken }),
}));

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CloudInstancesPanel', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/provider-tokens')) {
        return jsonResponse({
          providers: [
            { provider: 'hetzner', configured: true },
            { provider: 'digitalocean', configured: false },
          ],
        });
      }
      if (url.includes('/api/v1/cloud/wizard/deployments')) {
        return jsonResponse([]);
      }
      return jsonResponse({ error: 'not_found' }, 404);
    });
  });

  it('renders saved token status without exposing secrets', async () => {
    render(<CloudInstancesPanel />);
    expect(screen.getByText('Cloud instances')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Token saved')).toBeTruthy());
    expect(screen.getByText('No token saved')).toBeTruthy();
    expect(screen.getByText('No deployments yet.')).toBeTruthy();
  });

  it('opens the wizard at provider select', async () => {
    render(<CloudInstancesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /deploy a new instance/i }));
    expect(screen.getByText('Choose a provider')).toBeTruthy();
    expect(screen.getByText('Other / existing server')).toBeTruthy();
    // Hetzner card surfaces the saved-token badge from GET /provider-tokens.
    await waitFor(() => expect(screen.getAllByText('Token saved').length).toBeGreaterThan(0));
  });

  it('shows SSH fields on the manual path and validates over /providers/ssh/validate', async () => {
    render(<CloudInstancesPanel />);
    fireEvent.click(screen.getByRole('button', { name: /deploy a new instance/i }));
    fireEvent.click(screen.getByText('Other / existing server'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Server access')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: '203.0.113.10' } });
    fireEvent.change(screen.getByLabelText(/Private key/), { target: { value: '-----BEGIN KEY-----' } });

    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/providers/ssh/validate')) {
        return jsonResponse({ provider_id: 'ssh', valid: true, message: 'SSH connection validated successfully' });
      }
      return jsonResponse({}, 404);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Validate' }));
    await waitFor(() => expect(screen.getByText('SSH connection validated successfully')).toBeTruthy());
  });
});
