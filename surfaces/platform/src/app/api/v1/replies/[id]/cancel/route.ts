/**
 * POST /v1/replies/:id/cancel
 *
 * Proxies the cancel signal to the user's configured backend (VPS gateway).
 * When no backend is configured the client closing the connection is the
 * cancellation mechanism — return 202 and let req.signal do the work.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import {
  resolveRuntimeBackendForAuthUserId,
  toGatewayAuthorizationHeader,
} from '@/lib/runtime-backend';

export const runtime = 'nodejs';

const TERMINAL_SERVER_URL =
  process.env.TERMINAL_SERVER_URL ?? 'http://127.0.0.1:4096';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const resolved = await resolveRuntimeBackendForAuthUserId(userId).catch(() => null);
  const gatewayUrl = resolved?.gatewayUrl ?? null;
  const gatewayToken = resolved?.gatewayToken ?? null;

  // ── VPS / remote gateway ──────────────────────────────────────────────────
  const targetBase =
    gatewayUrl ??
    (process.env.VITE_ALLTERNIT_GATEWAY_URL
      ? process.env.VITE_ALLTERNIT_GATEWAY_URL.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')
      : null);

  if (targetBase) {
    const authorization = toGatewayAuthorizationHeader(gatewayToken);
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (authorization) headers['Authorization'] = authorization;

    try {
      const res = await fetch(`${targetBase}/v1/replies/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(5000),
      });
      return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
      });
    } catch {
      // Backend unreachable — fall through to best-effort 202
    }
  }

  // ── Local Gizzi terminal server ───────────────────────────────────────────
  try {
    await fetch(`${TERMINAL_SERVER_URL}/v1/replies/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Best-effort — client disconnect is the real cancel signal here
  }

  return NextResponse.json(
    { reply_id: id, status: 'cancelling', message: 'Cancel signal forwarded.' },
    { status: 202 },
  );
}
