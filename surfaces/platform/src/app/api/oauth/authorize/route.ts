/**
 * POST /api/oauth/authorize
 *
 * Called by the client-side authorize page after the user clicks "Authorize".
 * Validates the Clerk session server-side, then issues an authorization code.
 *
 * Body (JSON):
 *   { clientId, redirectUri, state, codeChallenge?, codeChallengeMethod? }
 *
 * Response:
 *   { code, redirectUri, state }  — client appends code+state to redirectUri
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createAuthCode } from '@/lib/oauth-codes';
import { getOAuthApp, isAllowedRedirectUri } from '@/config/oauth-apps';

export async function POST(req: NextRequest) {
  // Validate Clerk session
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: {
    clientId?: string;
    redirectUri?: string;
    state?: string;
    userEmail?: string;
    codeChallenge?: string;
    codeChallengeMethod?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const { clientId, redirectUri, state, userEmail, codeChallenge, codeChallengeMethod } = body;

  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const app = getOAuthApp(clientId);
  if (!app) {
    return NextResponse.json({ error: 'unknown_client' }, { status: 400 });
  }
  if (!isAllowedRedirectUri(app, redirectUri)) {
    return NextResponse.json({ error: 'redirect_uri_mismatch' }, { status: 400 });
  }

  const code = createAuthCode({
    clientId,
    redirectUri,
    userId,
    userEmail: userEmail ?? '',
    codeChallenge,
    codeChallengeMethod,
    scope: app.scopes.join(' '),
  });

  return NextResponse.json({ code, redirectUri, state: state ?? '' });
}
