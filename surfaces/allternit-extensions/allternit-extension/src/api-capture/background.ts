/**
 * Extension-based API capture using chrome.debugger (Chrome DevTools Protocol).
 *
 * Limitations vs. desktop Electron capture:
 * - Requires the `debugger` permission and shows Chrome's "Remote debugging" bar.
 * - Can only attach to one tab at a time per extension.
 * - Response bodies are fetched asynchronously and may fail for large/binary payloads.
 *
 * This module exposes a message-based API that the platform renderer can call
 * via chrome.runtime.sendMessage when the extension is installed and connected.
 */

interface CaptureSession {
  sessionId: string;
  tabId: number;
  startedAt: number;
  entries: HarEntry[];
  requestStates: Map<string, Partial<HarEntry>>;
}

interface HarHeader {
  name: string;
  value: string;
}

interface HarParam {
  name: string;
  value: string;
}

interface HarRequest {
  method: string;
  url: string;
  headers: HarHeader[];
  queryString: HarParam[];
  postData?: { mimeType: string; text: string };
}

interface HarResponse {
  status: number;
  statusText: string;
  headers: HarHeader[];
  content?: { mimeType?: string; size?: number; text?: string };
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
}

const activeSessions = new Map<string, CaptureSession>();

chrome.debugger?.onEvent?.addListener((source, method, params) => {
  if (!source.tabId) return;

  const session = Array.from(activeSessions.values()).find((s) => s.tabId === source.tabId);
  if (!session) return;

  switch (method) {
    case 'Network.requestWillBeSent': {
      const p = params as NetworkRequestWillBeSentParams;
      const url = new URL(p.request.url);
      const entry: Partial<HarEntry> = {
        startedDateTime: new Date(p.wallTime * 1000).toISOString(),
        request: {
          method: p.request.method,
          url: p.request.url,
          headers: Object.entries(p.request.headers || {}).map(([name, value]) => ({ name, value: String(value) })),
          queryString: Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value })),
        },
      };
      if (p.request.postData) {
        entry.request!.postData = {
          mimeType: p.request.headers?.['Content-Type'] || 'application/octet-stream',
          text: p.request.postData,
        };
      }
      session.requestStates.set(p.requestId, entry);
      break;
    }
    case 'Network.responseReceived': {
      const p = params as NetworkResponseReceivedParams;
      const state = session.requestStates.get(p.requestId);
      if (!state) return;

      const headers = Object.entries(p.response.headers || {}).map(([name, value]) => ({ name, value: String(value) }));
      const contentType = p.response.headers?.['content-type'] || p.response.mimeType;
      const contentLength = p.response.headers?.['content-length']
        ? parseInt(String(p.response.headers['content-length']), 10)
        : undefined;

      state.response = {
        status: p.response.status,
        statusText: p.response.statusText || '',
        headers,
        content: {
          mimeType: contentType,
          size: contentLength,
        },
      };
      break;
    }
    case 'Network.loadingFinished': {
      const p = params as NetworkLoadingFinishedParams;
      const state = session.requestStates.get(p.requestId);
      if (!state || !state.request) return;

      // Best-effort response body fetch.
      void fetchResponseBody(session.tabId, p.requestId).then((body) => {
        if (body && state.response?.content) {
          state.response.content.text = body;
        }
      });

      const entry: HarEntry = {
        startedDateTime: state.startedDateTime ?? new Date().toISOString(),
        time: Date.now() - new Date(state.startedDateTime ?? Date.now()).getTime(),
        request: state.request,
        response: state.response ?? { status: 0, statusText: '', headers: [] },
      };
      session.entries.push(entry);
      session.requestStates.delete(p.requestId);
      break;
    }
  }
});

async function fetchResponseBody(tabId: number, requestId: string): Promise<string | undefined> {
  try {
    const result = (await chrome.debugger.sendCommand({ tabId }, 'Network.getResponseBody', {
      requestId,
    })) as { body?: string; base64Encoded?: boolean };
    return result.body;
  } catch {
    return undefined;
  }
}

export async function startCapture(tabId: number, filterUrls?: string[]): Promise<{ sessionId: string }> {
  if (!chrome.debugger) {
    throw new Error('chrome.debugger is not available');
  }

  // Detach any existing debugger session on this tab.
  try {
    await chrome.debugger.detach({ tabId });
  } catch {
    // ignore
  }

  await chrome.debugger.attach({ tabId }, '1.3');
  await chrome.debugger.sendCommand({ tabId }, 'Network.enable');

  const sessionId = `ext-capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeSessions.set(sessionId, {
    sessionId,
    tabId,
    startedAt: Date.now(),
    entries: [],
    requestStates: new Map(),
  });

  return { sessionId };
}

export async function stopCapture(sessionId: string): Promise<{ har: string }> {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error('Capture session not found');
  }

  activeSessions.delete(sessionId);

  try {
    await chrome.debugger.sendCommand({ tabId: session.tabId }, 'Network.disable');
    await chrome.debugger.detach({ tabId: session.tabId });
  } catch {
    // ignore
  }

  const hosts = new Set<string>();
  for (const entry of session.entries) {
    try {
      hosts.add(new URL(entry.request.url).hostname);
    } catch {}
  }

  const har = JSON.stringify({
    log: {
      version: '1.2',
      creator: { name: 'Allternit Extension Capture', version: '1.0.0' },
      pages: [],
      entries: session.entries,
      comment: `Captured by Allternit Extension for ${Array.from(hosts).join(', ')}`,
    },
  });

  return { har };
}

export function isCaptureAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.debugger);
}

interface NetworkRequestWillBeSentParams {
  requestId: string;
  wallTime: number;
  request: {
    method: string;
    url: string;
    headers?: Record<string, unknown>;
    postData?: string;
  };
}

interface NetworkResponseReceivedParams {
  requestId: string;
  response: {
    status: number;
    statusText?: string;
    mimeType: string;
    headers?: Record<string, unknown>;
  };
}

interface NetworkLoadingFinishedParams {
  requestId: string;
  encodedDataLength: number;
}
