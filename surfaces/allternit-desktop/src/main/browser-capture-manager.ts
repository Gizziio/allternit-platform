/**
 * Browser API Capture Manager
 *
 * Records network traffic from the default Electron session and produces a
 * HAR-style archive that can be ingested by the platform's HAR-derived API
 * service. This lets users capture API calls made by a website in the ACI
 * browser and turn them into reusable contracts.
 */

import { session, type WebContents, type OnBeforeRequestListenerDetails, type OnHeadersReceivedListenerDetails, type OnCompletedListenerDetails } from 'electron';
import log from 'electron-log';

interface HarHeader {
  name: string;
  value: string;
}

interface HarParam {
  name: string;
  value: string;
}

interface HarPostData {
  mimeType: string;
  text: string;
}

interface HarRequest {
  method: string;
  url: string;
  headers: HarHeader[];
  queryString: HarParam[];
  postData?: HarPostData;
}

interface HarResponse {
  status: number;
  statusText: string;
  headers: HarHeader[];
  content?: {
    mimeType?: string;
    size?: number;
  };
}

interface HarEntry {
  startedDateTime: string;
  time: number;
  request: HarRequest;
  response: HarResponse;
}

interface CaptureSession {
  id: string;
  startedAt: number;
  filterUrls?: string[];
  entries: HarEntry[];
  requestStates: Map<string | number, Partial<HarEntry>>;
}

const activeSessions = new Map<string, CaptureSession>();

function parseQueryString(urlString: string): HarParam[] {
  try {
    const url = new URL(urlString);
    return Array.from(url.searchParams.entries()).map(([name, value]) => ({ name, value }));
  } catch {
    return [];
  }
}

function headersToArray(headers: Record<string, string | string[]>): HarHeader[] {
  const result: HarHeader[] = [];
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        result.push({ name, value: v });
      }
    } else {
      result.push({ name, value: value ?? '' });
    }
  }
  return result;
}

function matchesFilter(url: string, filterUrls?: string[]): boolean {
  if (!filterUrls || filterUrls.length === 0) return true;
  return filterUrls.some((pattern) => {
    // Support simple glob patterns like *://example.com/*
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\*\*\*/g, '.*')
          .replace(/\*\*/g, '.*')
          .replace(/\*/g, '[^/]*')
          .replace(/\?/g, '.') +
        '$'
    );
    return regex.test(url);
  });
}

function buildHar(sessionData: CaptureSession): unknown {
  const pages: unknown[] = [];
  const hosts = new Set<string>();
  for (const entry of sessionData.entries) {
    try {
      hosts.add(new URL(entry.request.url).hostname);
    } catch {}
  }

  return {
    log: {
      version: '1.2',
      creator: { name: 'Allternit Browser Capture', version: '1.0.0' },
      pages,
      entries: sessionData.entries,
      comment: `Captured by Allternit Desktop for ${Array.from(hosts).join(', ')}`,
    },
  };
}

export function createCaptureSession(options?: { filterUrls?: string[] }): { sessionId: string } {
  const id = `capture-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeSessions.set(id, {
    id,
    startedAt: Date.now(),
    filterUrls: options?.filterUrls,
    entries: [],
    requestStates: new Map(),
  });

  const sess = session.defaultSession;
  if (!sess) {
    throw new Error('No default Electron session available');
  }

  try {
    sess.webRequest.onBeforeRequest(attachOnBeforeRequest(id));
    sess.webRequest.onBeforeSendHeaders(attachOnBeforeSendHeaders(id));
    sess.webRequest.onHeadersReceived(attachOnHeadersReceived(id));
    sess.webRequest.onCompleted(attachOnCompleted(id));
  } catch (error) {
    activeSessions.delete(id);
    throw error;
  }

  log.info('[BrowserCapture] Started session', id);
  return { sessionId: id };
}

export function stopCaptureSession(sessionId: string): { har: string } | null {
  const sessionData = activeSessions.get(sessionId);
  if (!sessionData) return null;

  const sess = session.defaultSession;
  if (sess) {
    sess.webRequest.onBeforeRequest(null);
    sess.webRequest.onBeforeSendHeaders(null);
    sess.webRequest.onHeadersReceived(null);
    sess.webRequest.onCompleted(null);
  }

  activeSessions.delete(sessionId);
  const har = JSON.stringify(buildHar(sessionData));
  log.info('[BrowserCapture] Stopped session', sessionId, 'entries:', sessionData.entries.length);
  return { har };
}

function requestKey(id: string | number): string | number {
  return id;
}

function attachOnBeforeRequest(sessionId: string) {
  return (details: OnBeforeRequestListenerDetails, callback: (response: Electron.CallbackResponse) => void) => {
    const sessionData = activeSessions.get(sessionId);
    if (!sessionData) {
      callback({});
      return;
    }

    if (!matchesFilter(details.url, sessionData.filterUrls)) {
      callback({});
      return;
    }

    const entry: Partial<HarEntry> = {
      startedDateTime: new Date(details.timestamp).toISOString(),
      request: {
        method: details.method,
        url: details.url,
        headers: [],
        queryString: parseQueryString(details.url),
      },
    };

    if (details.uploadData && details.uploadData.length > 0) {
      const parts: string[] = [];
      let mimeType = 'application/octet-stream';
      for (const data of details.uploadData) {
        if ('blobUUID' in data) {
          // Cannot read blob data via webRequest; leave empty placeholder.
          parts.push('');
        } else if (data.bytes) {
          parts.push(data.bytes.toString('utf8'));
        }
      }
      // Best-effort mime type from headers isn't available here yet.
      entry.request!.postData = { mimeType, text: parts.join('') };
    }

    sessionData.requestStates.set(requestKey(details.id), entry);
    callback({});
  };
}

function attachOnBeforeSendHeaders(sessionId: string) {
  return (details: Electron.OnBeforeSendHeadersListenerDetails, callback: (response: Electron.BeforeSendResponse) => void) => {
    const sessionData = activeSessions.get(sessionId);
    if (!sessionData) {
      callback({});
      return;
    }

    const state = sessionData.requestStates.get(requestKey(details.id));
    if (state && state.request) {
      state.request.headers = headersToArray(details.requestHeaders);
    }
    callback({});
  };
}

function attachOnHeadersReceived(sessionId: string) {
  return (details: OnHeadersReceivedListenerDetails, callback: (response: Electron.HeadersReceivedResponse) => void) => {
    const sessionData = activeSessions.get(sessionId);
    if (!sessionData) {
      callback({});
      return;
    }

    const state = sessionData.requestStates.get(requestKey(details.id));
    if (state) {
      state.response = {
        status: details.statusCode,
        statusText: details.statusLine?.split(' ').slice(2).join(' ') ?? '',
        headers: headersToArray(details.responseHeaders ?? {}),
      };
    }
    callback({});
  };
}

function attachOnCompleted(sessionId: string) {
  return (details: OnCompletedListenerDetails) => {
    const sessionData = activeSessions.get(sessionId);
    if (!sessionData) return;

    const key = requestKey(details.id);
    const state = sessionData.requestStates.get(key);
    if (!state) return;

    const entry: HarEntry = {
      startedDateTime: state.startedDateTime ?? new Date().toISOString(),
      time: Date.now() - new Date(state.startedDateTime ?? Date.now()).getTime(),
      request: state.request!,
      response: state.response ?? {
        status: details.statusCode,
        statusText: '',
        headers: [],
      },
    };

    sessionData.entries.push(entry);
    sessionData.requestStates.delete(key);
  };
}

export function listCaptureSessions(): Array<{ id: string; startedAt: number; entries: number }> {
  return Array.from(activeSessions.values()).map((s) => ({
    id: s.id,
    startedAt: s.startedAt,
    entries: s.entries.length,
  }));
}

export function isCaptureAvailable(): boolean {
  return session.defaultSession != null;
}
