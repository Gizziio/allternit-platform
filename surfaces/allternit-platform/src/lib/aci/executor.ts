/**
 * ACI Executor
 *
 * Forwards normalized AciActions to the ACU gateway (port 8760) via the
 * unified ComputerUseExecutor waterfall:
 *   browser.extension → browser.cdp → browser.playwright → desktop.*
 *
 * Endpoint contract (ACU gateway):
 *   POST /v1/computer   ComputerToolRequest → ResultEnvelope
 */

import type { AciAction } from './types';
import { getPlatformComputerUseBaseUrl } from '../../integration/computer-use-engine';

function acuBaseUrl(): string {
  return getPlatformComputerUseBaseUrl();
}

function generateRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cu-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  return `cu-${Math.random().toString(36).slice(2, 14)}`;
}

export interface ExecuteResult {
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
  screenshotB64?: string;
}

/**
 * Execute a single ACI action through the ACU gateway waterfall.
 */
export async function executeAction(
  action: AciAction,
  sessionId: string = '',
  signal?: AbortSignal,
): Promise<ExecuteResult> {
  const base = acuBaseUrl();
  const body = buildComputerRequest(action, sessionId, generateRunId());

  try {
    const res = await fetch(`${base}/v1/computer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { status: 'failed', error: `ACU gateway error ${res.status}: ${text}` };
    }

    const data = await res.json() as {
      status?: string;
      extracted_content?: Record<string, unknown> | null;
      error?: { code?: string; message?: string } | null;
    };

    const ec = data.extracted_content ?? {};
    const dataUrl = (ec as Record<string, unknown>).data_url as string | undefined;

    return {
      status: data.status === 'completed' ? 'completed' : 'failed',
      result: ec,
      error: data.error?.message,
      screenshotB64: dataUrl?.startsWith('data:') ? dataUrl.split(',', 2)[1] : undefined,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return {
      status: 'failed',
      error: `Failed to reach ACU gateway at ${base}: ${(err as Error).message}`,
    };
  }
}

/**
 * Fetch a screenshot via the ACU gateway.
 * Returns base64 PNG string (no data: prefix).
 */
export async function fetchScreenshot(
  sessionId: string = '',
  signal?: AbortSignal,
): Promise<string | null> {
  const base = acuBaseUrl();
  try {
    const res = await fetch(`${base}/v1/computer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'screenshot',
        session_id: sessionId || undefined,
        run_id: generateRunId(),
        parameters: {},
      }),
      signal,
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      status?: string;
      extracted_content?: { data_url?: string } | null;
    };
    const dataUrl = data.extracted_content?.data_url ?? '';
    if (dataUrl.startsWith('data:')) {
      return dataUrl.split(',', 2)[1] ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Action → ComputerToolRequest mapping
// Maps ACI action types to Claude-native ACU action types.
// ─────────────────────────────────────────────────────────────

interface ComputerToolRequest {
  action: string;
  session_id?: string;
  run_id: string;
  coordinate?: [number, number];
  text?: string;
  key?: string;
  delta?: [number, number];
  url?: string;
  selector?: string;
  parameters: Record<string, unknown>;
}

function buildComputerRequest(
  action: AciAction,
  sessionId: string,
  runId: string,
): ComputerToolRequest {
  const base: ComputerToolRequest = {
    run_id: runId,
    ...(sessionId ? { session_id: sessionId } : {}),
    parameters: {},
    action: 'screenshot', // overwritten below
  };

  switch (action.type) {
    case 'click':
      return {
        ...base,
        action: 'left_click',
        ...(action.x !== undefined ? { coordinate: [action.x, action.y!] } : {}),
        ...(action.selector ? { selector: action.selector } : {}),
      };

    case 'double_click':
      return {
        ...base,
        action: 'double_click',
        ...(action.x !== undefined ? { coordinate: [action.x, action.y!] } : {}),
        ...(action.selector ? { selector: action.selector } : {}),
      };

    case 'right_click':
      return {
        ...base,
        action: 'right_click',
        ...(action.x !== undefined ? { coordinate: [action.x, action.y!] } : {}),
        ...(action.selector ? { selector: action.selector } : {}),
      };

    case 'hover':
      // No hover in ACU — use left_click as best effort
      return {
        ...base,
        action: 'left_click',
        ...(action.x !== undefined ? { coordinate: [action.x, action.y!] } : {}),
      };

    case 'type':
      return {
        ...base,
        action: action.selector ? 'fill' : 'type',
        text: action.text ?? '',
        ...(action.selector ? { selector: action.selector } : {}),
      };

    case 'key':
      return { ...base, action: 'key', key: action.text ?? action.keys?.[0] ?? '' };

    case 'hotkey':
      return { ...base, action: 'key', key: (action.keys ?? []).join('+') };

    case 'navigate':
      return { ...base, action: 'navigate', url: action.url ?? '' };

    case 'scroll': {
      const dir = action.scrollDirection ?? 'down';
      const amt = (action.scrollAmount ?? 3) * 100;
      const dy = dir === 'down' ? amt : dir === 'up' ? -amt : 0;
      const dx = dir === 'right' ? amt : dir === 'left' ? -amt : 0;
      return {
        ...base,
        action: 'scroll',
        delta: [dx, dy],
        ...(action.x !== undefined ? { coordinate: [action.x, action.y!] } : {}),
      };
    }

    case 'drag':
      return {
        ...base,
        action: 'left_click_drag',
        coordinate: [action.x ?? 0, action.y ?? 0],
        parameters: { endX: action.endX ?? 0, endY: action.endY ?? 0 },
      };

    case 'screenshot':
    case 'observe':
      return { ...base, action: 'screenshot' };

    case 'extract':
      return { ...base, action: 'extract' };

    case 'tab_list':
      return { ...base, action: 'tabs' };

    case 'tab_create':
      return { ...base, action: 'navigate', url: action.url ?? 'about:blank' };

    case 'tab_close':
    case 'tab_switch':
      // No direct equivalent — take a screenshot so the run loop can observe state
      return { ...base, action: 'screenshot' };

    default:
      return { ...base, action: 'screenshot' };
  }
}
