/**
 * Cloud control-plane API helpers.
 *
 * The cloud-api control plane (`getCloudApiBaseUrl()`) serves the
 * Clerk-authed user-level namespaces — `/api/v1/agent-sessions`,
 * `/api/v1/office/*`, `/api/v1/beta/*` — by resolving the caller's registered
 * data-plane node and relaying verbatim. Auth is `Authorization: Bearer`
 * only: `cmd/allternit-cloud-api/src/auth/clerk.rs` reads no session cookie,
 * so SSE consumers must stream over authenticated fetch rather than
 * `EventSource`.
 *
 * The bearer token is the same Clerk session JWT the platform auth provider
 * syncs into `localStorage['allternit_token']` (see platform-auth-client.tsx),
 * so `buildAuthHeaders()` works from non-React stores and services.
 */

import { getCloudApiBaseUrl } from '@/lib/env';
import { buildAuthHeaders } from '@/lib/agents/api-config';
import { isFabricSessionPwaHost } from '@/lib/fabric-session-pwa';

/** Build an absolute cloud-api URL for a path such as `/api/v1/agent-sessions`. */
export function cloudApiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getCloudApiBaseUrl()}${normalized}`;
}

/**
 * Public Allternit Cloud origin for the model catalog and billing reads.
 * Loopback `getCloudApiBaseUrl()` is the local control plane, not api.allternit.com.
 */
export function allternitCloudOrigin(): string {
  if (typeof window !== 'undefined' && isFabricSessionPwaHost(window.location.hostname)) {
    return window.location.origin;
  }
  const base = getCloudApiBaseUrl().replace(/\/+$/, '');
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|$)/i.test(base)) {
    return 'https://api.allternit.com';
  }
  return base;
}

/**
 * fetch() against the cloud-api origin with the Clerk bearer attached.
 * Absolute `api.allternit.com` URLs skip the runtime fetch interceptor.
 * On the Fabric Session PWA, `allternitCloudOrigin()` is this page's origin
 * and those `/api/v1/runtime-devices` calls must also skip the interceptor
 * (they are control-plane, forwarded by the fabrictransport API worker).
 */
export type CloudBillingUsage = {
  plan: string;
  label: string;
  credits: number | null;
  monthToDateUsageUsd: number | null;
  weeklyLimit?: number;
  weeklyUsed?: number;
  recentTransactions?: Array<{
    amount_usd?: number;
    amountUsd?: number;
    source?: string;
    created_at?: string;
    createdAt?: string;
  }>;
};

/**
 * Live Allternit subscription meter from production billing routes.
 * Used when `/api/v1/me/usage` is not deployed yet or returns empty Free.
 */
export async function fetchCloudBillingUsage(): Promise<CloudBillingUsage | null> {
  try {
    const headers = await buildAuthHeaders();
    if (!headers.Authorization) return null;
    const origin = allternitCloudOrigin();
    const [subRes, credRes] = await Promise.all([
      fetch(`${origin}/api/v1/billing/subscription`, { headers }),
      fetch(`${origin}/api/v1/billing/credits`, { headers }),
    ]);
    if (!subRes.ok && !credRes.ok) return null;
    const sub = subRes.ok
      ? await subRes.json() as { plan_id?: string; label?: string }
      : {};
    const cred = credRes.ok
      ? await credRes.json() as {
          balance_usd?: number;
          month_to_date_usage_usd?: number;
          recent_transactions?: CloudBillingUsage['recentTransactions'];
          free_inference?: {
            remaining_usd?: number;
            monthly_allowance_usd?: number;
            used_usd?: number;
          };
        }
      : {};
    const balance = typeof cred.balance_usd === 'number' ? cred.balance_usd : null;
    const freeRemaining = cred.free_inference?.remaining_usd;
    const credits = balance != null && balance > 0
      ? balance
      : (typeof freeRemaining === 'number' ? freeRemaining : balance);
    const plan = sub.plan_id || 'free';
    const label = sub.label || `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
    return {
      plan,
      label,
      credits,
      monthToDateUsageUsd: typeof cred.month_to_date_usage_usd === 'number'
        ? cred.month_to_date_usage_usd
        : null,
      weeklyLimit: cred.free_inference?.monthly_allowance_usd,
      weeklyUsed: cred.free_inference?.used_usd,
      recentTransactions: cred.recent_transactions,
    };
  } catch {
    return null;
  }
}

export async function cloudApiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const authHeaders = await buildAuthHeaders();
  return fetch(cloudApiUrl(path), {
    ...init,
    headers: {
      ...authHeaders,
      ...(init.headers || {}),
    },
  });
}

/**
 * Fetch-streaming EventSource for cloud-api SSE routes (e.g.
 * `/api/v1/agent-sessions/sync`). Native EventSource cannot set the
 * Authorization header and cloud-api accepts no session cookie, so the stream
 * is consumed with authenticated fetch and surfaced through the EventSource
 * interface (`onopen`/`onmessage`/`onerror` + `addEventListener`).
 *
 * Unlike a native EventSource this does NOT auto-reconnect: on stream failure
 * it emits a single `error` event and closes. Both current consumers
 * (mode-session-store `connectSessionSync`, session-composer-state) drive
 * their own retry loops from `onerror`, which keeps reconnect policy in one
 * place per consumer.
 */
export interface CloudApiEventSourceOptions {
  /** SSE cursor from a previous connection; sent as Last-Event-ID. */
  lastEventId?: string;
}

export class CloudApiEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;
  readonly url: string;
  readonly withCredentials = false;
  readyState = CloudApiEventSource.CONNECTING;
  lastEventId = "";
  onopen: ((this: EventSource, event: Event) => unknown) | null = null;
  onmessage: ((this: EventSource, event: MessageEvent) => unknown) | null = null;
  onerror: ((this: EventSource, event: Event) => unknown) | null = null;

  private controller: AbortController | null = null;
  private closed = false;

  constructor(path: string, options: CloudApiEventSourceOptions = {}) {
    super();
    this.url = cloudApiUrl(path);
    if (options.lastEventId) this.lastEventId = options.lastEventId;
    void this.connect();
  }

  close(): void {
    this.closed = true;
    this.readyState = CloudApiEventSource.CLOSED;
    this.controller?.abort();
    this.controller = null;
  }

  private emitOpen(): void {
    const event = new Event('open');
    this.onopen?.call(this as unknown as EventSource, event);
    this.dispatchEvent(event);
  }

  private emitError(): void {
    if (this.readyState === CloudApiEventSource.CLOSED) return;
    this.readyState = CloudApiEventSource.CLOSED;
    const event = new Event('error');
    this.onerror?.call(this as unknown as EventSource, event);
    this.dispatchEvent(event);
  }

  private emitMessage(type: string, data: string): void {
    const event = new MessageEvent(type, {
      data,
      origin: this.url,
      lastEventId: this.lastEventId,
    });
    if (type === 'message') {
      this.onmessage?.call(this as unknown as EventSource, event);
    }
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
      else if (field === 'id' && value) this.lastEventId = value;
    }
    if (data.length) this.emitMessage(eventType, data.join('\n'));
  }

  private async connect(): Promise<void> {
    this.controller = new AbortController();
    try {
      const authHeaders = await buildAuthHeaders();
      const response = await fetch(this.url, {
        headers: {
          Accept: 'text/event-stream',
          ...authHeaders,
          ...(this.lastEventId ? { 'Last-Event-ID': this.lastEventId } : {}),
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: this.controller.signal,
      });
      if (this.closed) return;
      if (!response.ok || !response.body) {
        throw new Error(`Cloud event stream unavailable (${response.status})`);
      }
      this.readyState = CloudApiEventSource.OPEN;
      this.emitOpen();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffered = '';
      try {
        while (!this.closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffered += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
          let boundary = buffered.indexOf('\n\n');
          while (boundary !== -1) {
            this.consumeBlock(buffered.slice(0, boundary));
            buffered = buffered.slice(boundary + 2);
            boundary = buffered.indexOf('\n\n');
          }
        }
      } finally {
        reader.releaseLock();
      }
      // Stream ended (server closed or network drop): surface as an error so
      // consumers run their reconnect logic.
      if (!this.closed) this.emitError();
    } catch (error) {
      if (this.closed || (error instanceof DOMException && error.name === 'AbortError')) {
        return;
      }
      this.emitError();
    }
  }
}

/** Create an authenticated SSE source for a cloud-api route. */
export function createCloudApiEventSource(
  path: string,
  options?: CloudApiEventSourceOptions,
): EventSource {
  return new CloudApiEventSource(path, options) as unknown as EventSource;
}
