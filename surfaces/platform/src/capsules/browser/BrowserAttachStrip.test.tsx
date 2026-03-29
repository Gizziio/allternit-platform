import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __setPlatformComputerUseClientFactory,
  type PlatformComputerUseClient,
} from '@/integration/computer-use-engine';
import { BrowserAttachStrip } from './BrowserAttachStrip';
import { useBrowserAgentStore } from './browserAgent.store';

vi.mock('./observabilityService', () => ({
  getObservabilityService: () => ({
    log: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('./environmentService', () => ({
  getEnvironmentManager: () => ({
    getCurrentEnvironment: vi.fn().mockResolvedValue('local'),
  }),
}));

function createClientMock(): PlatformComputerUseClient {
  return {
    health: vi.fn().mockResolvedValue({ status: 'ok' }),
    execute: vi.fn().mockResolvedValue({ run_id: 'run-1' }),
    getRun: vi.fn().mockResolvedValue({ run_id: 'run-1', status: 'running', receipts: [] }),
    getEvents: vi.fn().mockResolvedValue({ run_id: 'run-1', events: [], completed: false, status: 'running' }),
    getReceipts: vi.fn().mockResolvedValue({ run_id: 'run-1', receipts: [] }),
    approveRun: vi.fn().mockResolvedValue({ ok: true }),
    denyRun: vi.fn().mockResolvedValue({ ok: true }),
    cancelRun: vi.fn().mockResolvedValue({ ok: true }),
    pauseRun: vi.fn().mockResolvedValue({ ok: true }),
    resumeRun: vi.fn().mockResolvedValue({ ok: true }),
    takeoverRun: vi.fn().mockResolvedValue({ ok: true }),
    watchRun: vi.fn(async function* () {}),
  };
}

describe('BrowserAttachStrip', () => {
  beforeEach(() => {
    __setPlatformComputerUseClientFactory(() => createClientMock());
    useBrowserAgentStore.setState({
      status: 'Running',
      mode: 'Agent',
      endpoint: {
        type: 'extension',
        endpointId: 'ext-42',
        tabId: 42,
      },
      connectedEndpoints: [
        {
          type: 'extension',
          endpointId: 'ext-42',
          tabId: 42,
        },
      ],
      currentRunId: 'run-attach-42',
      currentLayer: 'semantic',
      currentAdapterId: 'browser.extension',
      fallbackCount: 2,
      lastEventMessage: 'completed goto',
      engineBaseUrl: 'http://127.0.0.1:3010',
      engineHealthy: true,
      engineStatusMessage: 'Engine reachable',
      runSummary: 'Logged into the attached tab',
      requiresApproval: false,
    });
  });

  afterEach(() => {
    __setPlatformComputerUseClientFactory(null);
  });

  it('renders endpoint attach state and engine port details', async () => {
    render(<BrowserAttachStrip />);

    expect(await screen.findByTestId('browser-attach-strip')).toBeInTheDocument();
    expect(screen.getByText('Attached to tab 42')).toBeInTheDocument();
    expect(screen.getByText(/Agent · semantic/i)).toBeInTheDocument();
    expect(screen.getByText(/2 fallbacks/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh engine status/i })).toBeInTheDocument();
    expect(screen.getByText(/Engine 3010/i)).toBeInTheDocument();
  });
});
