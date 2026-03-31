/**
 * Page-Agent Runner
 *
 * Connects to the thin-client surface-bridge SSE stream (port 3014)
 * and relays page-agent events to platform session subscribers.
 */

import { broadcast, getSession, type PageAgentEvent, type PageAgentSession } from './session-store';

const THIN_CLIENT_BASE = process.env.ALLTERNIT_THIN_CLIENT_URL ?? 'http://127.0.0.1:3014';

export async function startPageAgentRun(session: PageAgentSession): Promise<void> {
  try {
    const res = await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/stream`, {
      signal: session.abortController.signal,
      headers: { Accept: 'text/event-stream' },
    });

    if (!res.ok || !res.body) {
      broadcast(session.sessionId, {
        id: '',
        type: 'error',
        payload: { message: `Failed to connect to page-agent stream: ${res.status}` },
        timestamp: Date.now(),
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      // SSE events are separated by double newlines
      const parts = buf.split('\n\n');
      buf = parts.pop() ?? '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data: ')) continue;
        try {
          const event = JSON.parse(line.slice(6)) as PageAgentEvent;
          broadcast(session.sessionId, event);
          if (event.type === 'done' || event.type === 'error') {
            reader.cancel();
            return;
          }
        } catch {
          // ignore malformed SSE events
        }
      }
    }
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') return;
    const s = getSession(session.sessionId);
    if (!s) return; // session already destroyed
    broadcast(session.sessionId, {
      id: '',
      type: 'error',
      payload: { message: String(err) },
      timestamp: Date.now(),
    });
  }
}

/** Returns true if the thin-client page-agent is reachable and connected. */
export async function checkPageAgentConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/status`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return false;
    const data = await res.json() as { connected?: boolean };
    return data.connected === true;
  } catch {
    return false;
  }
}

/** Stop the currently running page-agent task. */
export async function stopPageAgentTask(): Promise<void> {
  try {
    await fetch(`${THIN_CLIENT_BASE}/v1/page-agent/stop`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // ignore — thin-client may be unavailable
  }
}
