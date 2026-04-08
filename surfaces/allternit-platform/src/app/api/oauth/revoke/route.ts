/**
 * POST /api/oauth/revoke
 *
 * OAuth 2.0 Token Revocation (RFC 7009).
 * Revokes an access token or refresh token.
 *
 * Always returns 200 per spec — callers must not rely on error responses
 * to determine whether a token was valid.
 *
 * Request body (application/x-www-form-urlencoded or JSON):
 *   token            = <access_token or refresh_token>
 *   token_type_hint  = "access_token" | "refresh_token"  (optional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/oauth-tokens';

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  let token: string | null = null;
  let hint: string | null = null;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = new URLSearchParams(await req.text());
    token = body.get('token');
    hint  = body.get('token_type_hint');
  } else {
    try {
      const json = await req.json() as { token?: string; token_type_hint?: string };
      token = json.token ?? null;
      hint  = json.token_type_hint ?? null;
    } catch {
      // Per RFC 7009 §2.2 — always return 200
      return ok();
    }
  }

  if (token) {
    const typedHint = hint === 'access_token' || hint === 'refresh_token' ? hint : undefined;
    await revokeToken(token, typedHint).catch(() => {});
  }

  return ok();
}

function ok() {
  return new NextResponse(null, {
    status: 200,
    headers: { 'Cache-Control': 'no-store' },
  });
}
