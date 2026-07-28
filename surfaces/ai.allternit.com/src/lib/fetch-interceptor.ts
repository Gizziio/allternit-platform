/**
 * Fetch Interceptor — injects Clerk JWT into all `/api/*` requests.
 *
 * This is a temporary bridge while migrating from Next.js API routes
 * to the Rust backend. It allows existing `fetch('/api/...')` calls
 * to work without modifying every call site.
 *
 * TODO: Remove once all call sites use apiFetch() or the API client.
 */

type WindowFetch = typeof window.fetch;
type TokenGetter = () => Promise<string | null>;

import {
  getActiveRuntimeId,
  getRuntimeExecutionTarget,
} from './runtime-target';

let currentTokenGetter: TokenGetter | null = null;
let originalEventSource: typeof EventSource | null = null;
let originalWebSocket: typeof WebSocket | null = null;

const RUNTIME_PATH_PREFIXES = [
  '/viz', '/sandbox', '/vm-session', '/rails', '/stream', '/terminal',
  '/mcp', '/platform', '/metrics', '/alabs', '/cowork', '/webhooks',
  '/ws', '/panes', '/status', '/health',
];

function isAllowedRuntimePath(pathname: string): boolean {
  return ['/api', ...RUNTIME_PATH_PREFIXES].some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && Boolean(window.allternitSidecar);
}

function isRuntimeApiUrl(value: string): boolean {
  try {
    const parsed = new URL(value, window.location.origin);
    const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
    return isAllowedRuntimePath(parsed.pathname)
      && (value.startsWith('/') || loopback || parsed.origin === window.location.origin);
  } catch {
    return false;
  }
}

function runtimePath(value: string): string {
  const parsed = new URL(value, window.location.origin);
  return `${parsed.pathname}${parsed.search}`;
}

/**
 * True only for absolute URLs that explicitly name a loopback backend
 * (e.g. http://127.0.0.1:8013/terminal/create). These target the operator's
 * own local API, so they must reach it directly: they are never candidates
 * for the cloud relay or the "no paired runtime" guard, which exist for
 * relative/same-origin runtime paths in the hosted web app.
 */
function isLocalOperatorApiUrl(value: string): boolean {
  try {
    if (!/^(https?|wss?):\/\//i.test(value)) return false;
    const parsed = new URL(value);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

/**
 * True for absolute URLs whose host is a tailnet mesh address
 * (100.64.0.0/10) — gizzi instances registered in `gizzi_instances` use
 * these. The renderer's network stack cannot route them; inside the desktop
 * shell they are bridged through Electron main's mesh proxy
 * (`window.allternit.mesh.proxyFor`) to a loopback URL.
 */
function isMeshUrl(value: string): boolean {
  try {
    if (!/^(https?|wss?):\/\//i.test(value)) return false;
    const match = /^100\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(new URL(value).hostname);
    return !!match && Number(match[1]) >= 64 && Number(match[1]) <= 127;
  } catch {
    return false;
  }
}

/** The desktop mesh bridge, when running inside Electron. */
function meshBridge(): { proxyFor(instanceUrl: string): Promise<string> } | undefined {
  return isDesktopShell() ? window.allternit?.mesh : undefined;
}

/** Rewrite a ws(s):// mesh URL to the loopback proxy URL Electron main hands back. */
async function resolveMeshWebSocketUrl(value: string): Promise<string> {
  const bridge = meshBridge();
  if (!bridge) throw new Error('Mesh bridge is unavailable');
  const proxied = new URL(await bridge.proxyFor(value));
  proxied.protocol = proxied.protocol === 'https:' ? 'wss:' : 'ws:';
  return proxied.toString();
}

/**
 * True when the UI itself is served from a loopback origin (the Vite dev
 * server, or the API's own static host). Such a UI is a local operator UI:
 * its same-origin/relative API calls are answered by the local backend
 * (directly or via the dev proxy), never by a cloud-paired runtime.
 */
function isLocalOperatorUi(): boolean {
  return window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
}

function shouldUseLocalRuntime(): boolean {
  return isLocalOperatorUi() && getRuntimeExecutionTarget() !== 'cloud';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function cloudApiBaseUrl(): string {
  return ((import.meta as any).env?.NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL || 'https://allternit-cloud-api.fly.dev').replace(/\/$/, '');
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit): Promise<{ body: string; bodyEncoding: string }> {
  const supplied = init?.body;
  if (typeof supplied === 'string') return { body: supplied, bodyEncoding: 'utf8' };
  if (supplied instanceof URLSearchParams) return { body: supplied.toString(), bodyEncoding: 'utf8' };
  if (supplied instanceof Blob) return { body: bytesToBase64(new Uint8Array(await supplied.arrayBuffer())), bodyEncoding: 'base64' };
  if (supplied instanceof ArrayBuffer) return { body: bytesToBase64(new Uint8Array(supplied)), bodyEncoding: 'base64' };
  if (ArrayBuffer.isView(supplied)) {
    return { body: bytesToBase64(new Uint8Array(supplied.buffer, supplied.byteOffset, supplied.byteLength)), bodyEncoding: 'base64' };
  }
  if (typeof Request !== 'undefined' && input instanceof Request && !['GET', 'HEAD'].includes(input.method.toUpperCase())) {
    return { body: bytesToBase64(new Uint8Array(await input.clone().arrayBuffer())), bodyEncoding: 'base64' };
  }
  return { body: '', bodyEncoding: 'utf8' };
}

class RuntimeFetchEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials: boolean;
  readyState = RuntimeFetchEventSource.CONNECTING;
  onopen: ((this: EventSource, event: Event) => any) | null = null;
  onmessage: ((this: EventSource, event: MessageEvent) => any) | null = null;
  onerror: ((this: EventSource, event: Event) => any) | null = null;

  private controller: AbortController | null = null;
  private retryMilliseconds = 3_000;
  private lastEventId = '';
  private closed = false;

  constructor(url: string | URL, options?: EventSourceInit) {
    super();
    this.url = String(url);
    this.withCredentials = Boolean(options?.withCredentials);
    void this.connect();
  }

  close(): void {
    this.closed = true;
    this.readyState = RuntimeFetchEventSource.CLOSED;
    this.controller?.abort();
    this.controller = null;
  }

  private emitOpen(): void {
    const event = new Event('open');
    this.onopen?.call(this as unknown as EventSource, event);
    this.dispatchEvent(event);
  }

  private emitError(): void {
    const event = new Event('error');
    this.onerror?.call(this as unknown as EventSource, event);
    this.dispatchEvent(event);
  }

  private emitMessage(type: string, data: string): void {
    const event = new MessageEvent(type, { data, lastEventId: this.lastEventId, origin: window.location.origin });
    if (type === 'message') this.onmessage?.call(this as unknown as EventSource, event);
    this.dispatchEvent(event);
  }

  private consumeBlock(block: string): void {
    let eventType = 'message';
    const data: string[] = [];
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const separator = line.indexOf(':');
      const field = separator === -1 ? line : line.slice(0, separator);
      let value = separator === -1 ? '' : line.slice(separator + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'data') data.push(value);
      else if (field === 'event' && value) eventType = value;
      else if (field === 'id' && !value.includes('\0')) this.lastEventId = value;
      else if (field === 'retry' && /^\d+$/.test(value)) this.retryMilliseconds = Number(value);
    }
    if (data.length) this.emitMessage(eventType, data.join('\n'));
  }

  private async connect(): Promise<void> {
    while (!this.closed) {
      this.readyState = RuntimeFetchEventSource.CONNECTING;
      this.controller = new AbortController();
      try {
        const headers = new Headers({ Accept: 'text/event-stream' });
        if (this.lastEventId) headers.set('Last-Event-ID', this.lastEventId);
        const response = await window.fetch(this.url, {
          headers,
          credentials: this.withCredentials ? 'include' : 'same-origin',
          cache: 'no-store',
          signal: this.controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`Event stream unavailable (${response.status})`);
        this.readyState = RuntimeFetchEventSource.OPEN;
        this.emitOpen();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = '';
        while (!this.closed) {
          const { done, value } = await reader.read();
          buffered += decoder.decode(value, { stream: !done }).replace(/\r\n?/g, '\n');
          let boundary = buffered.indexOf('\n\n');
          while (boundary !== -1) {
            this.consumeBlock(buffered.slice(0, boundary));
            buffered = buffered.slice(boundary + 2);
            boundary = buffered.indexOf('\n\n');
          }
          if (done) break;
        }
      } catch (error) {
        if (this.closed || (error instanceof DOMException && error.name === 'AbortError')) return;
      } finally {
        this.controller = null;
      }
      if (this.closed) return;
      this.readyState = RuntimeFetchEventSource.CONNECTING;
      this.emitError();
      await new Promise((resolve) => window.setTimeout(resolve, this.retryMilliseconds));
    }
  }
}

function installEventSourceInterceptor(): void {
  if (typeof window === 'undefined' || originalEventSource || typeof window.EventSource === 'undefined') return;
  originalEventSource = window.EventSource;
  const NativeEventSource = originalEventSource;
  const RuntimeAwareEventSource = function (url: string | URL, options?: EventSourceInit): EventSource {
    const value = String(url);
    // Mesh URLs go through the fetch-based EventSource too: its window.fetch
    // call is intercepted and rewritten to the desktop's mesh loopback proxy.
    return isRuntimeApiUrl(value) || (isDesktopShell() && isMeshUrl(value))
      ? new RuntimeFetchEventSource(url, options) as unknown as EventSource
      : new NativeEventSource(url, options);
  } as unknown as typeof EventSource;
  Object.defineProperties(RuntimeAwareEventSource, {
    CONNECTING: { value: NativeEventSource.CONNECTING },
    OPEN: { value: NativeEventSource.OPEN },
    CLOSED: { value: NativeEventSource.CLOSED },
  });
  RuntimeAwareEventSource.prototype = NativeEventSource.prototype;
  window.EventSource = RuntimeAwareEventSource;
}

class RuntimeRelayWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly url: string;
  protocol = '';
  extensions = '';
  readyState = RuntimeRelayWebSocket.CONNECTING;
  onopen: ((this: WebSocket, event: Event) => any) | null = null;
  onmessage: ((this: WebSocket, event: MessageEvent) => any) | null = null;
  onerror: ((this: WebSocket, event: Event) => any) | null = null;
  onclose: ((this: WebSocket, event: CloseEvent) => any) | null = null;

  private native: WebSocket | null = null;
  private queued: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  private requestedBinaryType: BinaryType = 'blob';
  private closeRequest: { code?: number; reason?: string } | null = null;

  constructor(url: string | URL) {
    super();
    this.url = String(url);
    void this.connect();
  }

  get binaryType(): BinaryType {
    return this.native?.binaryType || this.requestedBinaryType;
  }

  set binaryType(value: BinaryType) {
    this.requestedBinaryType = value;
    if (this.native) this.native.binaryType = value;
  }

  get bufferedAmount(): number {
    return this.native?.bufferedAmount || 0;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState === RuntimeRelayWebSocket.CONNECTING) {
      this.queued.push(data);
      return;
    }
    if (this.readyState !== RuntimeRelayWebSocket.OPEN || !this.native) {
      throw new DOMException('WebSocket is not open', 'InvalidStateError');
    }
    this.native.send(data);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === RuntimeRelayWebSocket.CLOSED) return;
    this.readyState = RuntimeRelayWebSocket.CLOSING;
    this.closeRequest = { code, reason };
    if (this.native) this.native.close(code, reason);
  }

  private emitFailure(message: string): void {
    if (this.readyState === RuntimeRelayWebSocket.CLOSED) return;
    const error = new Event('error');
    this.onerror?.call(this as unknown as WebSocket, error);
    this.dispatchEvent(error);
    this.finishClose(new CloseEvent('close', { code: 1008, reason: message, wasClean: false }));
  }

  private finishClose(event: CloseEvent): void {
    if (this.readyState === RuntimeRelayWebSocket.CLOSED) return;
    this.readyState = RuntimeRelayWebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, event);
    this.dispatchEvent(event);
  }

  private async connect(): Promise<void> {
    const runtimeId = getActiveRuntimeId();
    const token = currentTokenGetter
      ? await currentTokenGetter().catch(() => null)
      : localStorage.getItem('allternit_token');
    if (!runtimeId || !token || !originalWebSocket) {
      this.emitFailure('No paired Allternit runtime is available');
      return;
    }
    const NativeWebSocket = originalWebSocket;
    try {
      const base = cloudApiBaseUrl();
      const ticketResponse = await window.fetch(
        `${base}/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/socket-ticket`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ path: runtimePath(this.url) }),
        },
      );
      if (!ticketResponse.ok) throw new Error(`Runtime socket unavailable (${ticketResponse.status})`);
      const { ticket } = await ticketResponse.json() as { ticket?: string };
      if (!ticket) throw new Error('Runtime socket ticket was not issued');
      const relayUrl = new URL(`${base}/api/v1/runtime-devices/${encodeURIComponent(runtimeId)}/socket`);
      relayUrl.protocol = relayUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      relayUrl.searchParams.set('ticket', ticket);
      const socket = new NativeWebSocket(relayUrl);
      this.native = socket;
      socket.binaryType = this.requestedBinaryType;
      if (this.closeRequest) {
        socket.close(this.closeRequest.code, this.closeRequest.reason);
        return;
      }
      socket.onmessage = (event) => {
        if (this.readyState === RuntimeRelayWebSocket.CONNECTING && typeof event.data === 'string') {
          try {
            if (JSON.parse(event.data)?.type === 'allternit_socket_ready') {
              this.readyState = RuntimeRelayWebSocket.OPEN;
              const opened = new Event('open');
              this.onopen?.call(this as unknown as WebSocket, opened);
              this.dispatchEvent(opened);
              for (const data of this.queued.splice(0)) socket.send(data);
              return;
            }
          } catch {
            // A normal runtime message may be JSON; it is delivered below.
          }
        }
        if (this.readyState !== RuntimeRelayWebSocket.OPEN) return;
        const message = new MessageEvent('message', { data: event.data, origin: window.location.origin });
        this.onmessage?.call(this as unknown as WebSocket, message);
        this.dispatchEvent(message);
      };
      socket.onerror = () => {
        const error = new Event('error');
        this.onerror?.call(this as unknown as WebSocket, error);
        this.dispatchEvent(error);
      };
      socket.onclose = (event) => this.finishClose(new CloseEvent('close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      }));
    } catch (error) {
      this.emitFailure(error instanceof Error ? error.message : 'Runtime socket failed');
    }
  }
}

/**
 * WebSocket shim for mesh (100.64.0.0/10) URLs inside the desktop shell.
 * The native WebSocket constructor is synchronous but the mesh proxy lookup
 * is async, so this defers the real connect until Electron main resolves the
 * loopback proxy URL, queueing sends in the meantime (the same pattern as
 * RuntimeRelayWebSocket).
 */
class MeshProxyWebSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;
  readonly url: string;
  protocol = '';
  extensions = '';
  readyState = MeshProxyWebSocket.CONNECTING;
  onopen: ((this: WebSocket, event: Event) => any) | null = null;
  onmessage: ((this: WebSocket, event: MessageEvent) => any) | null = null;
  onerror: ((this: WebSocket, event: Event) => any) | null = null;
  onclose: ((this: WebSocket, event: CloseEvent) => any) | null = null;

  private native: WebSocket | null = null;
  private queued: Array<string | ArrayBufferLike | Blob | ArrayBufferView> = [];
  private requestedBinaryType: BinaryType = 'blob';

  constructor(url: string | URL, private protocols?: string | string[]) {
    super();
    this.url = String(url);
    void this.connect();
  }

  get binaryType(): BinaryType {
    return this.native?.binaryType || this.requestedBinaryType;
  }

  set binaryType(value: BinaryType) {
    this.requestedBinaryType = value;
    if (this.native) this.native.binaryType = value;
  }

  get bufferedAmount(): number {
    return this.native?.bufferedAmount || 0;
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this.readyState === MeshProxyWebSocket.CONNECTING) {
      this.queued.push(data);
      return;
    }
    if (this.readyState !== MeshProxyWebSocket.OPEN || !this.native) {
      throw new DOMException('WebSocket is not open', 'InvalidStateError');
    }
    this.native.send(data);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MeshProxyWebSocket.CLOSED) return;
    this.readyState = this.native ? MeshProxyWebSocket.CLOSING : MeshProxyWebSocket.CLOSED;
    this.native?.close(code, reason);
  }

  private emitFailure(message: string): void {
    if (this.readyState === MeshProxyWebSocket.CLOSED) return;
    const error = new Event('error');
    this.onerror?.call(this as unknown as WebSocket, error);
    this.dispatchEvent(error);
    this.finishClose(new CloseEvent('close', { code: 1008, reason: message, wasClean: false }));
  }

  private finishClose(event: CloseEvent): void {
    if (this.readyState === MeshProxyWebSocket.CLOSED) return;
    this.readyState = MeshProxyWebSocket.CLOSED;
    this.onclose?.call(this as unknown as WebSocket, event);
    this.dispatchEvent(event);
  }

  private async connect(): Promise<void> {
    if (!originalWebSocket) {
      this.emitFailure('WebSocket is unavailable');
      return;
    }
    const NativeWebSocket = originalWebSocket;
    try {
      const proxiedUrl = await resolveMeshWebSocketUrl(this.url);
      if (this.readyState === MeshProxyWebSocket.CLOSED) return;
      const socket = this.protocols === undefined
        ? new NativeWebSocket(proxiedUrl)
        : new NativeWebSocket(proxiedUrl, this.protocols);
      this.native = socket;
      socket.binaryType = this.requestedBinaryType;
      socket.onopen = () => {
        this.readyState = MeshProxyWebSocket.OPEN;
        const opened = new Event('open');
        this.onopen?.call(this as unknown as WebSocket, opened);
        this.dispatchEvent(opened);
        for (const data of this.queued.splice(0)) socket.send(data);
      };
      socket.onmessage = (event) => {
        if (this.readyState !== MeshProxyWebSocket.OPEN) return;
        const message = new MessageEvent('message', { data: event.data, origin: window.location.origin });
        this.onmessage?.call(this as unknown as WebSocket, message);
        this.dispatchEvent(message);
      };
      socket.onerror = () => {
        const error = new Event('error');
        this.onerror?.call(this as unknown as WebSocket, error);
        this.dispatchEvent(error);
      };
      socket.onclose = (event) => this.finishClose(new CloseEvent('close', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      }));
    } catch (error) {
      this.emitFailure(error instanceof Error ? error.message : 'Mesh socket failed');
    }
  }
}

function installWebSocketInterceptor(): void {  if (typeof window === 'undefined' || originalWebSocket || typeof window.WebSocket === 'undefined') return;
  originalWebSocket = window.WebSocket;
  const NativeWebSocket = originalWebSocket;
  const RuntimeAwareWebSocket = function (
    url: string | URL,
    protocols?: string | string[],
  ): WebSocket {
    if (isDesktopShell() && isMeshUrl(String(url))) {
      return new MeshProxyWebSocket(url, protocols) as unknown as WebSocket;
    }
    if (!isDesktopShell() && isRuntimeApiUrl(String(url)) && !isLocalOperatorApiUrl(String(url)) && !shouldUseLocalRuntime()) {
      return new RuntimeRelayWebSocket(url) as unknown as WebSocket;
    }
    return protocols === undefined ? new NativeWebSocket(url) : new NativeWebSocket(url, protocols);
  } as unknown as typeof WebSocket;
  Object.defineProperties(RuntimeAwareWebSocket, {
    CONNECTING: { value: NativeWebSocket.CONNECTING },
    OPEN: { value: NativeWebSocket.OPEN },
    CLOSING: { value: NativeWebSocket.CLOSING },
    CLOSED: { value: NativeWebSocket.CLOSED },
  });
  RuntimeAwareWebSocket.prototype = NativeWebSocket.prototype;
  window.WebSocket = RuntimeAwareWebSocket;
}

export function installFetchInterceptor(getToken?: TokenGetter): void {
  if (typeof window === 'undefined') return
  if (getToken) currentTokenGetter = getToken
  if ((window as any).__allternitFetchInterceptorInstalled) return

  const originalFetch = window.fetch

  const interceptedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    let url = typeof input === 'string' ? input : input.toString()

    // Mesh (Allternit tailnet) URLs cannot be routed by the renderer's
    // network stack; Electron main bridges them to a loopback proxy into the
    // tailnet. The rewritten loopback URL then flows through the normal
    // classification below (local operator pass-through, no cloud relay).
    if (isDesktopShell() && isMeshUrl(url)) {
      const bridge = meshBridge()
      if (bridge) {
        const proxied = await bridge.proxyFor(url)
        if (proxied !== url) {
          input = typeof Request !== 'undefined' && input instanceof Request
            ? new Request(proxied, input)
            : proxied
          url = proxied
        }
      }
    }

    const isApiRequest = typeof url === 'string' && isRuntimeApiUrl(url)

    if (!isApiRequest) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    const token = currentTokenGetter
      ? await currentTokenGetter().catch(() => null)
      : localStorage.getItem('allternit_token')
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    // Desktop runtime credentials are deliberately unavailable here. Electron
    // main injects them only while brokering requests to the loopback API.

    // Local operator API: an absolute loopback URL names this machine's own
    // backend, and a UI served from a loopback origin makes its same-origin
    // calls against that same local backend — in both cases skip the cloud
    // relay and the paired-runtime guard entirely.
    if (isLocalOperatorApiUrl(url) || shouldUseLocalRuntime()) {
      return originalFetch(input, {
        ...init,
        headers,
      })
    }

    const activeRuntimeId = getActiveRuntimeId()
    if (!isDesktopShell() && activeRuntimeId && isRuntimeApiUrl(url) && token) {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase()
      const serialized = await requestBody(input, init)
      const forwardedHeaders: Record<string, string> = {}
      for (const name of ['accept', 'content-type', 'if-none-match', 'if-modified-since', 'last-event-id', 'x-request-id']) {
        const value = headers.get(name)
        if (value) forwardedHeaders[name] = value
      }
      const cloudBase = cloudApiBaseUrl()
      const relayResponse = await originalFetch(
        `${cloudBase}/api/v1/runtime-devices/${encodeURIComponent(activeRuntimeId)}/proxy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            method,
            path: runtimePath(url),
            headers: forwardedHeaders,
            body: serialized.body,
            bodyEncoding: serialized.bodyEncoding,
          }),
        },
      )
      // The cloud endpoint returns the runtime's status, headers, and streaming
      // body directly. Returning it untouched preserves SSE/chat backpressure.
      return relayResponse
    }

    if (!isDesktopShell() && isRuntimeApiUrl(url)) {
      return new Response(JSON.stringify({
        error: 'runtime_unavailable',
        message: 'No paired Allternit runtime is online. Open Allternit Desktop or start your VPS runtime.',
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return originalFetch(input, {
      ...init,
      headers,
    })
  }

  window.fetch = Object.assign(interceptedFetch, originalFetch) as WindowFetch
  installEventSourceInterceptor()
  installWebSocketInterceptor()

  ;(window as any).__allternitFetchInterceptorInstalled = true
  console.debug('[FetchInterceptor] Installed for /api/* requests')
}
