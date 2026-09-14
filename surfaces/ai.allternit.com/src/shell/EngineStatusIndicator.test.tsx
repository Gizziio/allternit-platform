import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { EngineStatusPanel, EngineStatusIndicator } from './EngineStatusIndicator';

describe('EngineStatusPanel', () => {
  afterEach(() => {
    delete (window as unknown as { allternit?: unknown }).allternit;
  });

  it('explains it is desktop-only when the engines bridge is missing', () => {
    render(<EngineStatusPanel />);
    expect(screen.getByTestId('engine-status-panel')).toBeTruthy();
    expect(screen.getByText('Local engines')).toBeTruthy();
    expect(screen.getByText(/Allternit Desktop/i)).toBeTruthy();
    expect(screen.queryByText('Running')).toBeNull();
  });

  it('lists named engines with Running/Starting/Stopped, not unlabeled dots', async () => {
    (window as unknown as { allternit: unknown }).allternit = {
      engines: {
        getStatus: async () => ({
          api: { status: 'up', detail: 'listening :18013' },
          gizzi: { status: 'pending', detail: 'starting' },
          fabricWorker: { status: 'down', detail: 'not running' },
          office: { status: 'up', detail: 'ok' },
        }),
        onStatusChange: () => () => {},
      },
    };
    render(<EngineStatusPanel />);
    await waitFor(() => {
      expect(screen.getByText('API')).toBeTruthy();
      expect(screen.getByText('Gizzi')).toBeTruthy();
      expect(screen.getAllByText('Running').length).toBeGreaterThan(0);
      expect(screen.getByText('Starting')).toBeTruthy();
      expect(screen.getByText('Stopped')).toBeTruthy();
      expect(screen.getByText('listening :18013')).toBeTruthy();
    });
  });

  it('does not render a floating chrome chip', () => {
    const { container } = render(<EngineStatusIndicator />);
    expect(container.firstChild).toBeNull();
  });
});
