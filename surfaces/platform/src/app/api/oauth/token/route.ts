/**
 * POST /api/oauth/token
 *
 * OAuth 2.0 authorization code exchange (RFC 6749 §4.1.3).
 * Supports PKCE (S256) per RFC 7636.
 *
 * Request body (application/x-www-form-urlencoded):
 *   grant_type     = "authorization_code"
 *   code           = <authorization code from /oauth/authorize>
 *   redirect_uri   = <must match the one used during authorize>
 *   client_id      = <registered client ID>
 *   code_verifier  = <PKCE verifier> (required if challenge was sent)
 *
 * Response (application/json):
 *   { access_token, token_type, expires_in, scope }
 */

import { NextRequest, NextResponse } from 'next/server';
import { consumeAuthCode } from '@/lib/oauth-codes';
import { getOAuthApp, isAllowedRedirectUri } from '@/config/oauth-apps';

// ------------------------------------------------------------------
// PKCE S256 verification
// ------------------------------------------------------------------
async function verifyPKCE(verifier: string, storedChallenge: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return b64 === storedChallenge;
}

// ------------------------------------------------------------------
// Minimal signed access token (HMAC-SHA256 JWT-lite)
// ------------------------------------------------------------------
async function signAccessToken(payload: Record<string, unknown>): Promise<string> {
  const secret = process.env.OAUTH_TOKEN_SECRET ?? 'allternit-oauth-dev-secret-change-in-prod';
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const body = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const signingInput = `${header}.${body}`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${signingInput}.${sigB64}`;
}

// ------------------------------------------------------------------
// Route handler
// ------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';

  let params: URLSearchParams;
  if (contentType.includes('application/x-www-form-urlencoded')) {
    params = new URLSearchParams(await req.text());
  } else {
    // Also accept JSON body for developer convenience
    try {
      const json = await req.json();
      params = new URLSearchParams(json);
    } catch {
      return errorResponse('invalid_request', 'Unsupported content type', 400);
    }
  }

  const grantType = params.get('grant_type');
  const code = params.get('code');
  const redirectUri = params.get('redirect_uri');
  const clientId = params.get('client_id');
  const codeVerifier = params.get('code_verifier');

  if (grantType !== 'authorization_code') {
    return errorResponse('unsupported_grant_type', 'Only authorization_code is supported', 400);
  }
  if (!code || !redirectUri || !clientId) {
    return errorResponse('invalid_request', 'Missing required parameters', 400);
  }

  // Validate client
  const app = getOAuthApp(clientId);
  if (!app) {
    return errorResponse('invalid_client', 'Unknown client_id', 401);
  }
  if (!isAllowedRedirectUri(app, redirectUri)) {
    return errorResponse('invalid_grant', 'redirect_uri mismatch', 400);
  }

  // Consume and validate code
  const stored = consumeAuthCode(code);
  if (!stored) {
    return errorResponse('invalid_grant', 'Authorization code is invalid or expired', 400);
  }
  if (stored.clientId !== clientId) {
    return errorResponse('invalid_grant', 'client_id mismatch', 400);
  }
  if (stored.redirectUri !== redirectUri) {
    return errorResponse('invalid_grant', 'redirect_uri mismatch', 400);
  }

  // PKCE verification
  if (stored.codeChallenge) {
    if (!codeVerifier) {
      return errorResponse('invalid_grant', 'code_verifier required', 400);
    }
    const method = stored.codeChallengeMethod ?? 'S256';
    const valid = method === 'S256'
      ? await verifyPKCE(codeVerifier, stored.codeChallenge)
      : codeVerifier === stored.codeChallenge; // plain (not recommended)
    if (!valid) {
      return errorResponse('invalid_grant', 'PKCE verification failed', 400);
    }
  }

  // Issue access token (1 hour)
  const expiresIn = 3600;
  const iat = Math.floor(Date.now() / 1000);
  const accessToken = await signAccessToken({
    iss: 'https://platform.allternit.com',
    sub: stored.userId,
    email: stored.userEmail,
    client_id: clientId,
    scope: stored.scope,
    iat,
    exp: iat + expiresIn,
  });

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: stored.scope,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'Pragma': 'no-cache',
      },
    },
  );
}

function errorResponse(error: string, description: string, status: number) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}
