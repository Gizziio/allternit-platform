/**
 * Dispatch handoff API client.
 *
 * In development these endpoints are served by the Vite dev server.
 * In production they are backed by allternit-cloud-api
 * (cmd/allternit-cloud-api/src/routes/dispatch_handoff.rs): the desktop mints
 * a short-lived token bound to one of the user's paired runtimes, the phone
 * claims it and receives the runtime id to pair with (iOS
 * EnvironmentStore.claimHandoffToken), and the desktop polls status.
 */

export interface DispatchClaimRequest {
  token: string;
}

export interface DispatchStatusResponse {
  claimed: boolean;
  claimedAt?: number;
  device?: string;
  /** Hosted: the runtime the phone paired with (present once claimed). */
  runtimeId?: string | null;
  expiresAt?: string | null;
}

export interface DispatchMintResponse {
  token: string;
  runtimeId: string;
  expiresAt: string;
}

export interface DispatchAddressResponse {
  url: string;
}

type TokenGetter = () => Promise<string | null>;

// These endpoints are intentionally NOT under /api so they are not redirected
// to the native backend in Electron. In development they are served directly
// by the Vite dev server; the hosted implementation lives on the cloud API
// (outside /api/v1, same as the dev plugin).
const HANDOFF_BASE = '/dispatch/handoff';

const CLOUD_API_BASE = (
  (import.meta as any).env?.NEXT_PUBLIC_ALLTERNIT_CLOUD_API_URL || 'https://allternit-cloud-api.fly.dev'
).replace(/\/$/, '');

function hostedHandoffBase(): string {
  return `${CLOUD_API_BASE}${HANDOFF_BASE}`;
}

async function withAuthHeaders(init: RequestInit | undefined, getToken?: TokenGetter): Promise<RequestInit> {
  const token = getToken ? await getToken().catch(() => null) : null;
  if (!token) return init ?? {};
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return { ...init, headers };
}

/**
 * Dev-first fetch: the Vite plugin answers relative `/dispatch/handoff/*`
 * during development; anywhere else (or when it 404s) the call goes to the
 * hosted cloud API with the Clerk session.
 */
async function handoffFetch(path: string, init?: RequestInit, getToken?: TokenGetter): Promise<Response> {
  const relative = await fetch(`${HANDOFF_BASE}${path}`, init).catch(() => null);
  if (relative && relative.status !== 404) return relative;
  return fetch(`${hostedHandoffBase()}${path}`, await withAuthHeaders(init, getToken));
}

/** Mint a handoff token bound to one of the caller's paired runtimes. */
export async function mintDispatchToken(getToken: TokenGetter, runtimeId?: string): Promise<DispatchMintResponse> {
  const res = await handoffFetch(
    '/mint',
    await withAuthHeaders(
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(runtimeId ? { runtimeId } : {}),
      },
      getToken,
    ),
    getToken,
  );
  if (!res.ok) {
    throw new Error(`Failed to mint dispatch token: ${res.status}`);
  }
  return res.json() as Promise<DispatchMintResponse>;
}

export async function claimDispatchToken(token: string, getToken?: TokenGetter): Promise<void> {
  const res = await handoffFetch('/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token } satisfies DispatchClaimRequest),
  }, getToken);
  if (!res.ok) {
    throw new Error(`Failed to claim dispatch token: ${res.status}`);
  }
}

export async function getDispatchStatus(token: string, getToken?: TokenGetter): Promise<DispatchStatusResponse> {
  const res = await handoffFetch(`/status?token=${encodeURIComponent(token)}`, undefined, getToken);
  if (!res.ok) {
    throw new Error(`Failed to get dispatch status: ${res.status}`);
  }
  return res.json() as Promise<DispatchStatusResponse>;
}

/** Dev-only: ask the dev server for the best LAN URL to put in the QR code. */
export async function getDispatchDevAddress(): Promise<string | null> {
  try {
    const res = await fetch(`${HANDOFF_BASE}/address`);
    if (!res.ok) return null;
    const data = (await res.json()) as DispatchAddressResponse;
    return data.url || null;
  } catch {
    return null;
  }
}
