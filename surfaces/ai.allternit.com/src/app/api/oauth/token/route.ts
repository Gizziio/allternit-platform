/**
 * POST /api/oauth/token
 *
 * OAuth 2.0 token endpoint (RFC 6749).
 * Supported grant types:
 *   - authorization_code  (§4.1.3) with PKCE S256 (RFC 7636)
 *   - refresh_token       (§6)     with single-use rotation
 *
 * Request body (application/x-www-form-urlencoded or JSON):
 *   grant_type     = "authorization_code" | "refresh_token"
 *   -- authorization_code --
 *   code           = <authorization code>
 *   redirect_uri   = <must match authorize request>
 *   client_id      = <registered client ID>
 *   code_verifier  = <PKCE verifier> (required when challenge was sent)
 *   -- refresh_token --
 *   refresh_token  = <opaque refresh token>
 *   client_id      = <registered client ID>
 *
 * Response:
 *   { access_token, refresh_token, token_type, expires_in, scope }
 */

import { NextRequest, NextResponse } from 'next/server';
import { consumeAuthCode } from '@/lib/oauth-codes';
import { issueTokenPair, rotateRefreshToken } from '@/lib/oauth-tokens';
import { getOAuthApp, isAllowedRedirectUri } from '@/config/oauth-apps';

// ─── PKCE S256 verification ────────────────────────────────────────────────────

async function verifyPKCE(verifier: string, storedChallenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return b64 === storedChallenge;
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  let params: URLSearchParams;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    params = new URLSearchParams(await req.text());
  } else {
    try {
      const json = await req.json();
      params = new URLSearchParams(json);
    } catch {
      return errorResponse('invalid_request', 'Unsupported content type', 400);
    }
  }

  const grantType = params.get('grant_type');
  const clientId  = params.get('client_id');

  if (!clientId) return errorResponse('invalid_request', 'Missing client_id', 400);

  const app = getOAuthApp(clientId);
  if (!app) return errorResponse('invalid_client', 'Unknown client_id', 401);

  // ── refresh_token grant ──────────────────────────────────────────────────────
  if (grantType === 'refresh_token') {
    const refreshToken = params.get('refresh_token');
    if (!refreshToken) return errorResponse('invalid_request', 'Missing refresh_token', 400);

    const pair = await rotateRefreshToken(refreshToken);
    if (!pair) return errorResponse('invalid_grant', 'Refresh token is invalid or expired', 400);

    // Ensure the token belongs to the same client
    // (rotateRefreshToken re-issues from stored payload, clientId is in the payload)
    return tokenResponse(pair);
  }

  // ── authorization_code grant ─────────────────────────────────────────────────
  if (grantType !== 'authorization_code') {
    return errorResponse('unsupported_grant_type', 'Supported: authorization_code, refresh_token', 400);
  }

  const code        = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const codeVerifier = params.get('code_verifier');

  if (!code || !redirectUri) {
    return errorResponse('invalid_request', 'Missing required parameters', 400);
  }
  if (!isAllowedRedirectUri(app, redirectUri)) {
    return errorResponse('invalid_grant', 'redirect_uri mismatch', 400);
  }

  const stored = await consumeAuthCode(code);
  if (!stored) return errorResponse('invalid_grant', 'Authorization code is invalid or expired', 400);
  if (stored.clientId !== clientId) return errorResponse('invalid_grant', 'client_id mismatch', 400);
  if (stored.redirectUri !== redirectUri) return errorResponse('invalid_grant', 'redirect_uri mismatch', 400);

  // PKCE
  if (stored.codeChallenge) {
    if (!codeVerifier) return errorResponse('invalid_grant', 'code_verifier required', 400);
    const method = stored.codeChallengeMethod ?? 'S256';
    const valid = method === 'S256'
      ? await verifyPKCE(codeVerifier, stored.codeChallenge)
      : codeVerifier === stored.codeChallenge;
    if (!valid) return errorResponse('invalid_grant', 'PKCE verification failed', 400);
  }

  const pair = await issueTokenPair({
    userId: stored.userId,
    userEmail: stored.userEmail,
    clientId,
    scope: stored.scope,
  });

  return tokenResponse(pair);
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function tokenResponse(pair: { access_token: string; refresh_token: string; token_type: string; expires_in: number; scope: string }) {
  return NextResponse.json(pair, {
    status: 200,
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  });
}

function errorResponse(error: string, description: string, status: number) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
