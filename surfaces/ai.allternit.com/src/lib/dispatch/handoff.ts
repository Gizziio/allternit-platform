/**
 * Dispatch handoff API client.
 *
 * In development these endpoints are served by the Vite dev server.
 * In production they should be backed by the Allternit API so a phone
 * scanning the QR code can claim the token and the desktop can detect it.
 */

export interface DispatchClaimRequest {
  token: string;
}

export interface DispatchStatusResponse {
  claimed: boolean;
  claimedAt?: number;
  device?: string;
}

export interface DispatchAddressResponse {
  url: string;
}

// These endpoints are intentionally NOT under /api so they are not redirected
// to the native backend in Electron. In development they are served directly
// by the Vite dev server; in production they must be implemented by the
// hosted Allternit backend.
const HANDOFF_BASE = '/dispatch/handoff';

export async function claimDispatchToken(token: string): Promise<void> {
  const res = await fetch(`${HANDOFF_BASE}/claim`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token } satisfies DispatchClaimRequest),
  });
  if (!res.ok) {
    throw new Error(`Failed to claim dispatch token: ${res.status}`);
  }
}

export async function getDispatchStatus(token: string): Promise<DispatchStatusResponse> {
  const res = await fetch(`${HANDOFF_BASE}/status?token=${encodeURIComponent(token)}`);
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
