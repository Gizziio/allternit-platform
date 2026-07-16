/**
 * Terminal API client for the local tmux-backed PTY service.
 *
 * Centralizes create/input/close/stream calls so every terminal surface
 * (drawer, canvas tiles, side pane) uses the same auth headers and URL
 * resolution instead of duplicating half the logic.
 */

import {
  getRuntimeGatewayBaseUrl,
  getRuntimeGatewayBaseUrlSync,
  getRuntimeGatewayTokenSync,
} from '@/lib/runtime-backend-client';

const TERMINAL_SESSION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TerminalSessionOptions {
  cwd?: string;
  shell?: string;
  cols?: number;
  rows?: number;
}

export interface TerminalCreateResponse {
  sessionId: string;
}

interface TerminalConnection {
  baseUrl: string;
  token: string | null;
}

const terminalConnections = new Map<string, TerminalConnection>();

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/g, '');
}

function currentTerminalConnection(): TerminalConnection {
  return {
    baseUrl: normalizeBaseUrl(getRuntimeGatewayBaseUrlSync()),
    token: getRuntimeGatewayTokenSync(),
  };
}

async function resolveTerminalConnection(): Promise<TerminalConnection> {
  return {
    baseUrl: normalizeBaseUrl(await getRuntimeGatewayBaseUrl()),
    token: getRuntimeGatewayTokenSync(),
  };
}

function connectionForSession(remoteSessionId: string): TerminalConnection {
  return terminalConnections.get(remoteSessionId) ?? currentTerminalConnection();
}

function terminalUrl(path: string, connection: TerminalConnection): string {
  return `${connection.baseUrl}${path}`;
}

function terminalHeaders(
  connection: TerminalConnection = currentTerminalConnection(),
  includeContentType = true,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeContentType) headers['Content-Type'] = 'application/json';
  const localToken = typeof window !== 'undefined' ? window.localStorage.getItem('allternit_token') : null;
  const token = localToken || connection.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    details?: string;
  } | null;
  return new Error(body?.message || body?.details || body?.error || `${fallback}: ${response.status}`);
}

export async function createTerminalSession(options: TerminalSessionOptions = {}): Promise<string> {
  const connection = await resolveTerminalConnection();
  const response = await fetch(terminalUrl('/terminal/create', connection), {
    method: 'POST',
    headers: terminalHeaders(connection),
    credentials: 'include',
    body: JSON.stringify({
      shell: options.shell ?? '/bin/zsh',
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
      cwd: options.cwd,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    details?: string;
    sessionId?: string;
    session_id?: string;
    data?: { session_id?: string };
  };

  if (!response.ok || body.success === false) {
    throw new Error(body.message || body.details || `Failed to create terminal: ${response.status}`);
  }

  const sessionId = body.sessionId ?? body.session_id ?? body.data?.session_id;
  if (!sessionId) {
    throw new Error('Terminal service did not return a session id');
  }
  if (!TERMINAL_SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error('Terminal service returned an invalid session identifier');
  }
  terminalConnections.set(sessionId, connection);
  return sessionId;
}

export async function sendTerminalInput(remoteSessionId: string, data: string): Promise<void> {
  const connection = connectionForSession(remoteSessionId);
  const response = await fetch(terminalUrl(`/terminal/${remoteSessionId}/input`, connection), {
    method: 'POST',
    headers: terminalHeaders(connection),
    credentials: 'include',
    body: JSON.stringify({ session_id: remoteSessionId, content: data }),
  });
  if (!response.ok) throw await responseError(response, 'Terminal input failed');
}

export async function resizeTerminal(remoteSessionId: string, cols: number, rows: number): Promise<void> {
  const connection = connectionForSession(remoteSessionId);
  const response = await fetch(terminalUrl(`/terminal/${remoteSessionId}/resize`, connection), {
    method: 'POST',
    headers: terminalHeaders(connection),
    credentials: 'include',
    body: JSON.stringify({ session_id: remoteSessionId, cols, rows }),
  });
  if (!response.ok) throw await responseError(response, 'Terminal resize failed');
}

export async function closeTerminalSession(remoteSessionId: string): Promise<void> {
  const connection = connectionForSession(remoteSessionId);
  try {
    await fetch(terminalUrl(`/terminal/${remoteSessionId}/close`, connection), {
      method: 'POST',
      headers: terminalHeaders(connection),
      credentials: 'include',
      body: JSON.stringify({ session_id: remoteSessionId }),
    });
  } catch {
    // The local session is already being discarded; do not strand UI teardown
    // when the remote runtime has stopped.
  } finally {
    terminalConnections.delete(remoteSessionId);
  }
}

export interface TerminalStreamMessage {
  type: string;
  data?: string;
}

/**
 * Subscribe to a terminal SSE stream with auth-aware fallbacks.
 *
 * Uses EventSource when possible. If the stream fails immediately, falls back
 * to a fetch-based reader so we can send Authorization headers on networks
 * where the localhost auth bypass is not available.
 */
export function subscribeTerminalStream(
  remoteSessionId: string,
  handlers: {
    onOpen?: () => void;
    onMessage: (message: TerminalStreamMessage) => void;
    onError: (message?: string) => void;
    onClose?: () => void;
  }
): () => void {
  let closed = false;
  let cleanupTransport = () => {};
  const connection = connectionForSession(remoteSessionId);
  const url = terminalUrl(`/terminal/${remoteSessionId}/stream`, connection);
  const guardedHandlers = {
    onOpen: () => {
      if (!closed) handlers.onOpen?.();
    },
    onMessage: (message: TerminalStreamMessage) => {
      if (!closed) handlers.onMessage(message);
    },
    onError: (message?: string) => {
      if (!closed) handlers.onError(message);
    },
    onClose: () => {
      if (!closed) handlers.onClose?.();
    },
  };

  const eventSource = new EventSource(url);
  cleanupTransport = () => eventSource.close();

  eventSource.onopen = guardedHandlers.onOpen;
  eventSource.onmessage = (event) => {
    try {
      guardedHandlers.onMessage(JSON.parse(event.data) as TerminalStreamMessage);
    } catch {
      guardedHandlers.onMessage({ type: 'data', data: event.data });
    }
  };

  eventSource.onerror = () => {
    if (closed) return;
    eventSource.close();
    cleanupTransport = subscribeTerminalStreamFetch(url, connection, guardedHandlers);
  };

  return () => {
    closed = true;
    cleanupTransport();
  };
}

function subscribeTerminalStreamFetch(
  url: string,
  connection: TerminalConnection,
  handlers: {
    onOpen?: () => void;
    onMessage: (message: TerminalStreamMessage) => void;
    onError: (message?: string) => void;
    onClose?: () => void;
  },
): () => void {
  let abortController: AbortController | null = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let buffer = '';

  const cleanup = () => {
    abortController?.abort();
    abortController = null;
    reader
      ?.cancel()
      .catch(() => {})
      .finally(() => {
        reader = null;
      });
  };

  fetch(url, {
    headers: terminalHeaders(connection, false),
    credentials: 'include',
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Stream returned ${response.status}`);
      }
      if (!response.body) {
        throw new Error('Stream response has no body');
      }
      handlers.onOpen?.();
      reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (abortController) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const data = frame
            .split(/\r?\n/)
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart())
            .join('\n');
          if (!data) continue;
          try {
            handlers.onMessage(JSON.parse(data) as TerminalStreamMessage);
          } catch {
            handlers.onMessage({ type: 'data', data });
          }
        }
      }
      handlers.onClose?.();
    })
    .catch((error: unknown) => {
      if ((error as Error)?.name === 'AbortError') return;
      handlers.onError?.(error instanceof Error ? error.message : 'Terminal stream disconnected');
    });

  return cleanup;
}
