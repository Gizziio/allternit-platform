import { describe, expect, it } from 'vitest';
import {
  parseExtensionActionCommand,
  toLegacyBrowserAction,
  toProtocolActionFailure,
  toProtocolActionResult,
} from './protocol-transport';

const issuedAt = '2026-07-11T04:00:00.000Z';
const expiresAt = '2026-07-11T04:05:00.000Z';

function commandPayload(overrides: Record<string, unknown> = {}) {
  return {
    surfaceInstanceId: 'extension-surface-1',
    tabId: 123,
    lease: {
      leaseId: 'lease-1',
      runId: 'run-1',
      ownerSurfaceInstanceId: 'extension-surface-1',
      issuedAt,
      expiresAt,
      epoch: 1,
      nonce: '0123456789abcdef',
    },
    action: {
      schemaVersion: '1.0',
      actionId: 'action-1',
      runId: 'run-1',
      sessionId: 'session-1',
      kind: 'navigate',
      reason: 'Open the target page.',
      input: { url: 'https://example.com/' },
    },
    ...overrides,
  };
}

describe('extension computer-use protocol transport', () => {
  it('parses shared protocol action commands and maps navigate to the legacy executor', () => {
    const command = parseExtensionActionCommand(commandPayload(), Date.parse(issuedAt));

    expect(toLegacyBrowserAction(command)).toEqual({
      type: 'BROWSER.NAV',
      tabId: 123,
      params: { url: 'https://example.com/' },
    });
  });

  it('rejects commands when the execution lease is owned by another surface', () => {
    expect(() =>
      parseExtensionActionCommand(
        commandPayload({
          lease: {
            leaseId: 'lease-1',
            runId: 'run-1',
            ownerSurfaceInstanceId: 'other-surface',
            issuedAt,
            expiresAt,
            epoch: 1,
            nonce: '0123456789abcdef',
          },
        }),
        Date.parse(issuedAt),
      ),
    ).toThrow('Execution lease is owned by another surface');
  });

  it('emits committed protocol events and a receipt for successful actions', () => {
    const command = parseExtensionActionCommand(commandPayload(), Date.parse(issuedAt));
    const result = toProtocolActionResult(command, { ok: true });

    expect(result.receipt).toMatchObject({
      runId: 'run-1',
      actionId: 'action-1',
      outcome: 'committed',
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'action.state_changed',
      'action.state_changed',
      'receipt.issued',
    ]);
    expect(result.events.map((event) => event.sourceSurface)).toEqual([
      'extension',
      'extension',
      'extension',
    ]);
  });

  it('emits failed protocol events and a receipt for failed actions', () => {
    const command = parseExtensionActionCommand(commandPayload(), Date.parse(issuedAt));
    const result = toProtocolActionFailure(command, new Error('boom'));

    expect(result.receipt).toMatchObject({
      runId: 'run-1',
      actionId: 'action-1',
      outcome: 'failed',
    });
    expect(result.events.map((event) => event.type)).toEqual([
      'action.state_changed',
      'receipt.issued',
    ]);
    expect(result.events[0]?.payload).toMatchObject({
      actionId: 'action-1',
      state: 'failed',
      error: 'boom',
    });
  });
});
