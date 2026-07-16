/**
 * Gizzi Brain Client - runs ACI page-agent goals on the local gizzi runtime
 *
 * Replaces the old page-agent bridge (port 3014) transport. Talks directly to
 * the `gizzi-code serve` HTTP API (default http://127.0.0.1:4096):
 *
 *   POST /v1/session                      -> create a session
 *   GET  /v1/event                        -> SSE stream of runtime events
 *   POST /v1/session/:id/message          -> run the goal (resolves when done)
 *   POST /v1/session/:id/abort            -> stop the run
 *   POST /v1/permission/:requestID/reply  -> auto-approve permission prompts
 *
 * In the Electron shell the sidecar returns a credential-brokering custom URL.
 * Electron main owns the internal runtime credential. Outside Electron we fall
 * back to the default loopback URL.
 */

import type { PageAgentBridgeConfig } from '@/lib/page-agent/config';
import type { PageAgentActivity, PageAgentHistoricalEvent } from './browserAgent.store';

const FALLBACK_GIZZI_BASE = 'http://127.0.0.1:4096';
const MAX_OUTPUT_LENGTH = 500;

interface GizziConnection {
  base: string;
  headers: Record<string, string>;
}

interface GizziBrainCallbacks {
  onSession?: (sessionId: string) => void;
  onActivity?: (activity: PageAgentActivity) => void;
  onHistoryEvent?: (event: PageAgentHistoricalEvent) => void;
  onDone?: (result: { success: boolean; data?: string }) => void;
}

interface ActiveRun {
  controller: AbortController;
  base: string;
  headers: Record<string, string>;
}

const activeRuns = new Map<string, ActiveRun>();

async function resolveGizziConnection(): Promise<GizziConnection> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const sidecar = typeof window !== 'undefined' ? window.allternitSidecar : undefined;

  if (sidecar && typeof sidecar.getApiUrl === 'function') {
    try {
      const apiUrl = await sidecar.getApiUrl();
      if (apiUrl) {
        return { base: apiUrl.replace(/\/$/, ''), headers };
      }
    } catch {
      // fall through to loopback default
    }
  }

  return { base: FALLBACK_GIZZI_BASE, headers };
}

// ── Gizzi event shapes ────────────────────────────────────────

interface GizziEvent {
  type: string;
  properties?: Record<string, unknown>;
}

interface GizziToolState {
  status?: string;
  input?: unknown;
  output?: unknown;
  error?: unknown;
  time?: { start?: number; end?: number };
}

interface GizziPart {
  type?: string;
  tool?: string;
  sessionID?: string;
  state?: GizziToolState;
}

function toOutputString(value: unknown): string {
  if (value == null) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.slice(0, MAX_OUTPUT_LENGTH);
}

function matchesSession(properties: Record<string, unknown> | undefined, sessionId: string): boolean {
  const eventSessionId = properties?.sessionID;
  return typeof eventSessionId !== 'string' || eventSessionId === sessionId;
}

export async function runGizziBrainTask(options: {
  goal: string;
  config?: PageAgentBridgeConfig;
  callbacks: GizziBrainCallbacks;
}): Promise<void> {
  const { goal, config, callbacks } = options;
  let finalized = false;
  let connection: GizziConnection | null = null;
  let sessionId: string | null = null;

  const finalize = (result: { success: boolean; data?: string }) => {
    if (finalized) return;
    finalized = true;
    if (sessionId) activeRuns.delete(sessionId);
    callbacks.onDone?.(result);
  };

  try {
    connection = await resolveGizziConnection();
  } catch {
    finalize({ success: false, data: 'Could not reach the gizzi brain.' });
    return;
  }

  const { base, headers } = connection;

  // 1. Create the session (browser tool pre-approved)
  try {
    const res = await fetch(`${base}/v1/session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title: goal.slice(0, 80),
        surface: 'browser',
        permission: [{ permission: 'browser', action: 'allow', pattern: '*' }],
      }),
    });
    if (!res.ok) {
      finalize({ success: false, data: `Gizzi brain rejected the session (${res.status}).` });
      return;
    }
    const body = (await res.json()) as { id?: string };
    if (!body.id) {
      finalize({ success: false, data: 'Gizzi brain did not return a session.' });
      return;
    }
    sessionId = body.id;
  } catch {
    finalize({ success: false, data: 'Could not reach the gizzi brain.' });
    return;
  }

  callbacks.onSession?.(sessionId);

  const controller = new AbortController();
  activeRuns.set(sessionId, { controller, base, headers });
  const activeSessionId = sessionId;

  // 2. Listen to the runtime event stream (fetch-based SSE so we can send auth)
  const handleEvent = (event: GizziEvent) => {
    if (!event || typeof event.type !== 'string') return;
    const properties = event.properties;
    if (!matchesSession(properties, activeSessionId)) return;

    if (event.type === 'message.part.updated') {
      const part = properties?.part as GizziPart | undefined;
      if (!part) return;

      if (part.type === 'reasoning') {
        callbacks.onActivity?.({ type: 'thinking' });
        return;
      }

      if (part.type === 'tool') {
        const tool = part.tool ?? 'tool';
        const state = part.state ?? {};
        if (state.status === 'running' || state.status === 'pending') {
          callbacks.onActivity?.({ type: 'executing', tool, input: state.input });
        } else if (state.status === 'completed') {
          const output = toOutputString(state.output);
          const duration =
            typeof state.time?.start === 'number' && typeof state.time?.end === 'number'
              ? state.time.end - state.time.start
              : undefined;
          callbacks.onActivity?.({ type: 'executed', tool, input: state.input, output, duration });
          callbacks.onHistoryEvent?.({
            type: 'step',
            action: { name: tool, input: state.input, output },
          });
        } else if (state.status === 'error') {
          const message = toOutputString(state.error) || 'Tool failed.';
          callbacks.onActivity?.({ type: 'error', message });
          callbacks.onHistoryEvent?.({
            type: 'step',
            action: { name: tool, input: state.input, output: message },
          });
        }
      }
      return;
    }

    if (event.type === 'session.status') {
      const status = properties?.status as { type?: string; attempt?: number; message?: string } | undefined;
      if (status?.type === 'retry') {
        const attempt = typeof status.attempt === 'number' ? status.attempt : 1;
        callbacks.onActivity?.({ type: 'retrying', attempt, maxAttempts: attempt });
      } else if (status?.type === 'busy') {
        callbacks.onActivity?.({ type: 'thinking' });
      }
      return;
    }

    if (event.type === 'session.error') {
      const error = properties?.error as { message?: string } | undefined;
      const message = error?.message ?? 'The gizzi brain hit an error.';
      callbacks.onHistoryEvent?.({ type: 'error', message });
      finalize({ success: false, data: message });
      return;
    }

    if (event.type === 'permission.asked') {
      const requestId = properties?.id;
      if (typeof requestId === 'string') {
        void fetch(`${base}/v1/permission/${encodeURIComponent(requestId)}/reply`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ reply: 'once' }),
        }).catch(() => {});
      }
    }
  };

  const listenPromise = (async () => {
    try {
      const res = await fetch(`${base}/v1/event`, { headers, signal: controller.signal });
      if (!res.ok || !res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            handleEvent(JSON.parse(line.slice(6)) as GizziEvent);
          } catch {
            // ignore malformed SSE frames
          }
        }
      }
    } catch {
      // aborted or stream dropped; completion is driven by the message POST
    }
  })();

  // 3. Send the goal; the POST resolves when the whole agent loop ends
  try {
    const body: Record<string, unknown> = {
      parts: [{ type: 'text', text: goal }],
    };
    if (config?.systemInstruction) {
      body.system = config.systemInstruction;
    }

    const res = await fetch(`${base}/v1/session/${encodeURIComponent(activeSessionId)}/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      finalize({ success: false, data: `Gizzi brain run failed (${res.status}).` });
      return;
    }

    const message = (await res.json()) as { parts?: Array<{ type?: string; text?: string }> };
    const finalText = (message.parts ?? [])
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text as string)
      .join('\n')
      .trim();

    finalize({ success: true, data: finalText || 'Task completed.' });
  } catch {
    if (!finalized) {
      finalize({ success: false, data: 'Could not reach the gizzi brain.' });
    }
  } finally {
    controller.abort();
    void listenPromise;
  }
}

export async function stopGizziBrainTask(sessionId: string): Promise<void> {
  const run = activeRuns.get(sessionId);
  activeRuns.delete(sessionId);
  run?.controller.abort();
  if (!run) return;

  try {
    await fetch(`${run.base}/v1/session/${encodeURIComponent(sessionId)}/abort`, {
      method: 'POST',
      headers: run.headers,
    });
  } catch {
    // best-effort stop
  }
}
