import { z } from 'zod';
import {
  ActionIntentSchema,
  BrowserEventSchema,
  COMPUTER_USE_PROTOCOL_VERSION,
  ExecutionLeaseSchema,
  ReceiptSchema,
  type ActionIntent,
  type BrowserEvent,
  type ExecutionLease,
  type Receipt,
} from '@allternit/computer-use-protocol';

export const ExtensionActionCommandSchema = z.object({
  surfaceInstanceId: z.string().min(1),
  tabId: z.number().int().nonnegative(),
  lease: ExecutionLeaseSchema,
  action: ActionIntentSchema,
});

export interface ExtensionActionCommand {
  surfaceInstanceId: string;
  tabId: number;
  lease: ExecutionLease;
  action: ActionIntent;
}

export function parseExtensionActionCommand(
  payload: unknown,
  now = Date.now(),
): ExtensionActionCommand {
  const command = ExtensionActionCommandSchema.parse(payload);
  if (command.lease.runId !== command.action.runId) {
    throw new Error('Execution lease run does not match action run');
  }
  if (command.lease.ownerSurfaceInstanceId !== command.surfaceInstanceId) {
    throw new Error('Execution lease is owned by another surface');
  }
  if (Date.parse(command.lease.expiresAt) <= now) {
    throw new Error('Execution lease has expired');
  }
  return command;
}

export function toLegacyBrowserAction(command: ExtensionActionCommand): Record<string, unknown> {
  const { action, tabId } = command;
  const target = action.targetRef
    ? { type: 'selector', value: `[data-allternit-ref="${action.targetRef}"]` }
    : action.targetDescription
      ? { type: 'text', value: action.targetDescription }
      : undefined;

  switch (action.kind) {
    case 'navigate':
      return { type: 'BROWSER.NAV', tabId, params: { url: requireString(action, 'url') } };
    case 'click':
    case 'hover':
    case 'select':
      return {
        type: 'BROWSER.ACT',
        tabId,
        params: { action: action.kind, target, options: action.input },
      };
    case 'type':
      return {
        type: 'BROWSER.ACT',
        tabId,
        params: { action: 'type', target, options: { ...action.input, text: requireString(action, 'text') } },
      };
    case 'press':
      return { type: 'BROWSER.ACT', tabId, params: { action: 'press', options: action.input } };
    case 'scroll':
      return { type: 'BROWSER.ACT', tabId, params: { action: 'scroll', target, options: action.input } };
    case 'wait':
      return {
        type: 'BROWSER.WAIT',
        tabId,
        params: { condition: String(action.input.condition ?? 'load'), timeout: action.input.timeout },
      };
    case 'extract':
      return { type: 'BROWSER.EXTRACT', tabId, params: { query: action.input.query ?? action.input } };
    case 'screenshot':
      return { type: 'BROWSER.SCREENSHOT', tabId, params: action.input };
    default:
      throw new Error(`Extension transport does not yet support action: ${action.kind}`);
  }
}

export interface ExtensionProtocolActionResult {
  events: BrowserEvent[];
  receipt: Receipt;
}

export function toProtocolActionResult(
  command: ExtensionActionCommand,
  executorResult: unknown,
): ExtensionProtocolActionResult {
  const receipt = ReceiptSchema.parse({
    receiptId: crypto.randomUUID(),
    runId: command.action.runId,
    actionId: command.action.actionId,
    outcome: 'committed',
    issuedAt: new Date().toISOString(),
  });
  return {
    receipt,
    events: [
      protocolEvent(command, 1, 'action.state_changed', {
        actionId: command.action.actionId,
        state: 'executing',
      }),
      protocolEvent(command, 2, 'action.state_changed', {
        actionId: command.action.actionId,
        state: 'committed',
        result: executorResult,
      }),
      protocolEvent(command, 3, 'receipt.issued', { receipt }),
    ],
  };
}

export function toProtocolActionFailure(
  command: ExtensionActionCommand,
  error: unknown,
): ExtensionProtocolActionResult {
  const message = error instanceof Error ? error.message : String(error);
  const receipt = ReceiptSchema.parse({
    receiptId: crypto.randomUUID(),
    runId: command.action.runId,
    actionId: command.action.actionId,
    outcome: 'failed',
    issuedAt: new Date().toISOString(),
  });
  return {
    receipt,
    events: [
      protocolEvent(command, 1, 'action.state_changed', {
        actionId: command.action.actionId,
        state: 'failed',
        error: message,
      }),
      protocolEvent(command, 2, 'receipt.issued', { receipt }),
    ],
  };
}

function protocolEvent(
  command: ExtensionActionCommand,
  sequence: number,
  type: BrowserEvent['type'],
  payload: Record<string, unknown>,
): BrowserEvent {
  return BrowserEventSchema.parse({
    schemaVersion: COMPUTER_USE_PROTOCOL_VERSION,
    eventId: crypto.randomUUID(),
    runId: command.action.runId,
    sessionId: command.action.sessionId,
    sequence,
    emittedAt: new Date().toISOString(),
    sourceSurface: 'extension',
    type,
    payload,
  });
}

function requireString(action: ActionIntent, field: string): string {
  const value = action.input[field];
  if (typeof value !== 'string' || !value) throw new Error(`Action ${action.actionId} requires input.${field}`);
  return value;
}
