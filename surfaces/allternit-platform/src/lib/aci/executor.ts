/**
 * ACI Executor
 *
 * Forwards normalized AciActions to the Python CDP service (port 3010).
 * The Python service handles the actual Chrome DevTools Protocol commands.
 *
 * Endpoint contract (Python operator service):
 *   POST /v1/execute   { action_type, parameters } → { status, result, error? }
 *   GET  /v1/vision/screenshot                     → { screenshot: "<base64>" }
 */

import type { AciAction } from './types';
import { getPlatformComputerUseBaseUrl } from '../../integration/computer-use-engine';

function cdpBaseUrl(): string {
  return getPlatformComputerUseBaseUrl() ?? 'http://127.0.0.1:3010';
}

export interface ExecuteResult {
  status: 'completed' | 'failed';
  result?: unknown;
  error?: string;
  screenshotB64?: string; // some actions return a screenshot inline
}

/**
 * Execute a single ACI action against the running CDP/Python service.
 */
export async function executeAction(
  action: AciAction,
  signal?: AbortSignal,
): Promise<ExecuteResult> {
  const base = cdpBaseUrl();

  // Build the Python-compatible payload
  const body = buildPayload(action);

  try {
    const res = await fetch(`${base}/v1/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      return { status: 'failed', error: `CDP service error ${res.status}: ${text}` };
    }

    const data = await res.json() as { status?: string; result?: unknown; error?: string };

    return {
      status: data.status === 'completed' ? 'completed' : 'failed',
      result: data.result,
      error: data.error,
      screenshotB64: (data.result as Record<string, unknown>)?.screenshot_b64 as string | undefined,
    };
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return {
      status: 'failed',
      error: `Failed to reach CDP service at ${base}: ${(err as Error).message}`,
    };
  }
}

/**
 * Fetch a screenshot from the CDP service.
 * Returns base64 PNG string (no data: prefix).
 */
export async function fetchScreenshot(signal?: AbortSignal): Promise<string | null> {
  const base = cdpBaseUrl();
  try {
    const res = await fetch(`${base}/v1/vision/screenshot`, { signal });
    if (!res.ok) return null;
    const data = await res.json() as { screenshot?: string };
    return data.screenshot ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Action → Python payload mapping
// ─────────────────────────────────────────────────────────────

function buildPayload(action: AciAction): { action_type: string; parameters: Record<string, unknown> } {
  const params: Record<string, unknown> = {};

  switch (action.type) {
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'hover':
      if (action.x !== undefined) params.coordinate = [action.x, action.y];
      if (action.selector) params.selector = action.selector;
      break;

    case 'type':
      params.text = action.text ?? '';
      if (action.selector) params.selector = action.selector;
      break;

    case 'key':
      params.key = action.text ?? action.keys?.[0] ?? '';
      break;

    case 'hotkey':
      params.keys = action.keys ?? [];
      break;

    case 'navigate':
      params.url = action.url ?? '';
      break;

    case 'scroll':
      params.scroll_direction = action.scrollDirection ?? 'down';
      params.scroll_amount = action.scrollAmount ?? 3;
      if (action.x !== undefined) params.coordinate = [action.x, action.y];
      break;

    case 'drag':
      params.start_coordinate = [action.x ?? 0, action.y ?? 0];
      params.coordinate = [action.endX ?? 0, action.endY ?? 0];
      break;

    case 'tab_create':
      params.url = action.url ?? 'about:blank';
      break;

    case 'tab_close':
    case 'tab_switch':
      params.tab_id = action.tabId;
      break;

    case 'screenshot':
    case 'observe':
    case 'extract':
    case 'tab_list':
      // No extra parameters
      break;
  }

  return { action_type: action.type, parameters: params };
}
