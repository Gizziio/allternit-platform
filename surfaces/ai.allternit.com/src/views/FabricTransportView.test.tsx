// ============================================================================
// FabricTransportView — Workflows section (cu29): workflow specs, taught
// NetworkTrace, self-check / target verify, verdict + receipt tamper check.
// ============================================================================

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToastProvider } from '@/components/ui/toast-provider';
import { FabricTransportView } from './FabricTransportView';
import {
  listWorkflowSpecs,
  getWorkflowSpecDetail,
  startWorkflowVerify,
  pollVerifyUntilTerminal,
  checkVerifyReceipt,
} from '@/lib/browser-skills-api';

vi.mock('@/lib/platform-auth-client', () => ({
  usePlatformAuth: () => ({ getToken: async () => 'test-token' }),
}));

vi.mock('@/lib/fabric-transport-api', () => ({
  listRuns: vi.fn(async () => []),
  listRunEvents: vi.fn(async () => []),
  listRunJobs: vi.fn(async () => []),
  getJob: vi.fn(async () => null),
  listApprovals: vi.fn(async () => ({ approvals: [] })),
  decideApproval: vi.fn(async () => ({})),
  submitIntent: vi.fn(async () => ({ intent_id: 'i1', run_id: 'r1', created: true })),
  getIntent: vi.fn(async () => null),
  listPrincipals: vi.fn(async () => ({ principals: [] })),
  provisionPrincipalToken: vi.fn(async () => ({ token: 'tok' })),
  listDelegationRules: vi.fn(async () => ({ rules: [] })),
  upsertDelegationRule: vi.fn(async () => ({})),
  deleteDelegationRule: vi.fn(async () => ({})),
  listConnectorSessions: vi.fn(async () => ({ sessions: [] })),
  listRoutines: vi.fn(async () => ({ routines: [] })),
  createRoutine: vi.fn(async () => ({})),
  deleteRoutine: vi.fn(async () => ({})),
  runRoutineNow: vi.fn(async () => ({ fired: 0 })),
  continueRunInCloud: vi.fn(async () => ({ jobs: [] })),
  getCoworkPreferences: vi.fn(async () => ({ trusted_folders: [], cloud_continuation: false })),
  setCloudContinuation: vi.fn(async () => ({ cloud_continuation: false })),
}));

vi.mock('@/lib/browser-skills-api', () => ({
  listWorkflowSpecs: vi.fn(),
  getWorkflowSpecDetail: vi.fn(),
  startWorkflowVerify: vi.fn(),
  pollVerifyUntilTerminal: vi.fn(),
  checkVerifyReceipt: vi.fn(),
}));

const mockListSpecs = vi.mocked(listWorkflowSpecs);
const mockGetDetail = vi.mocked(getWorkflowSpecDetail);
const mockStartVerify = vi.mocked(startWorkflowVerify);
const mockPoll = vi.mocked(pollVerifyUntilTerminal);
const mockCheckReceipt = vi.mocked(checkVerifyReceipt);

const SPEC_SUMMARY = {
  skill_id: 'skill_a',
  source: '/skills/skill_a.json',
  valid: true,
  error: null,
  workflowId: 'wf-a',
  title: 'Checkout flow',
  provider: 'playwright',
  stepCount: 3,
  hasNetworkTrace: true,
  networkTraceEntries: 2,
};

const SPEC_DETAIL = {
  workflowId: 'wf-a',
  title: 'Checkout flow',
  provider: 'playwright',
  inputCount: 0,
  steps: [
    { id: 's1', kind: 'type', target: '#name', reason: 'fill name' },
    { id: 's3', kind: 'click', target: '#submit', reason: 'submit' },
  ],
  stepCount: 2,
  safety: { requiresApprovalFor: [], redactionCount: 0 },
  networkTrace: {
    version: 1,
    entries: [
      {
        method: 'GET',
        host: 'example.test',
        pathTemplate: '/form',
        payloadKeysHash: null,
        verifiable: true,
      },
      {
        method: 'POST',
        host: 'example.test',
        pathTemplate: '/submit',
        payloadKeysHash: null,
        verifiable: true,
      },
    ],
  },
};

const PASS_RESULT = {
  verify_id: 'verify-abc',
  status: 'completed',
  mode: 'canned',
  network: { status: 'pass', deviations: [] },
  a11y: { status: 'unverifiable' },
  receipt_id: 'rcpt-abc',
  receipt_hash: 'deadbeefcafe',
};

function renderView() {
  return render(
    <ToastProvider>
      <FabricTransportView />
    </ToastProvider>,
  );
}

describe('FabricTransportView — Workflows section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListSpecs.mockResolvedValue([SPEC_SUMMARY]);
    mockGetDetail.mockResolvedValue(SPEC_DETAIL);
  });

  it('lists workflow specs from the gateway and shows the taught NetworkTrace on select', async () => {
    renderView();
    expect(await screen.findByText('Checkout flow')).toBeTruthy();
    fireEvent.click(screen.getByText('Checkout flow'));
    expect(await screen.findByText('Taught NetworkTrace')).toBeTruthy();
    expect(screen.getByText(/example\.test\/form/)).toBeTruthy();
    expect(screen.getByText(/example\.test\/submit/)).toBeTruthy();
    expect(mockGetDetail).toHaveBeenCalledWith('skill_a');
  });

  it('runs the canned self-check and renders verdict + receipt tamper check', async () => {
    mockStartVerify.mockResolvedValue({ verify_id: 'verify-abc', status: 'running', mode: 'canned' });
    mockPoll.mockResolvedValue(PASS_RESULT);
    mockCheckReceipt.mockResolvedValue({
      verify_id: 'verify-abc',
      receipt_id: 'rcpt-abc',
      valid: true,
      stored_hash: 'deadbeefcafe',
      recomputed_hash: 'deadbeefcafe',
      tampered: false,
    });

    renderView();
    fireEvent.click(await screen.findByText('Run deterministic self-check'));
    expect(mockStartVerify).toHaveBeenCalledWith({});
    expect(await screen.findByText('completed')).toBeTruthy();
    expect(screen.getByText('exact ordered match against the recorded trace')).toBeTruthy();
    expect(screen.getByText('rcpt-abc')).toBeTruthy();

    fireEvent.click(screen.getByText('Verify hash'));
    await waitFor(() => expect(screen.getByText('hash verified')).toBeTruthy());
  });

  it('renders deterministic network deviations on a deviated verdict', async () => {
    mockStartVerify.mockResolvedValue({ verify_id: 'verify-abc', status: 'running', mode: 'canned' });
    mockPoll.mockResolvedValue({
      ...PASS_RESULT,
      network: {
        status: 'deviated',
        deviations: [
          {
            kind: 'unexpected_call',
            index: 1,
            live_index: 2,
            expected: { method: 'POST', pathTemplate: '/submit' },
            actual: { method: 'POST', pathTemplate: '/track' },
          },
        ],
      },
    });

    renderView();
    fireEvent.click(await screen.findByText('Run deterministic self-check'));
    expect(await screen.findByText('deviated')).toBeTruthy();
    expect(screen.getByText('1 deterministic deviation(s)')).toBeTruthy();
    expect(screen.getByText('Unexpected Call')).toBeTruthy();
    expect(screen.getByText(/expected POST \/submit → actual POST \/track/)).toBeTruthy();
  });

  it('refuses a non-absolute target URL without calling the gateway', async () => {
    renderView();
    fireEvent.click(await screen.findByText('Checkout flow'));
    expect(await screen.findByText('Taught NetworkTrace')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('http://127.0.0.1:8080/form'), {
      target: { value: 'localhost:8080/form' },
    });
    fireEvent.click(screen.getByText('Verify against target'));
    expect(mockStartVerify).not.toHaveBeenCalled();
  });
});
