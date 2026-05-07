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
import { getAuth } from '@/lib/server-auth';
import { createAuthCode } from '@/lib/oauth-codes';
import { getOAuthApp, isAllowedRedirectUri } from '@/config/oauth-apps';

export async function POST(req: NextRequest) {
  try {
    // Validate session (handles Clerk and local dev fallback)
    const authState = await getAuth();
    const { userId } = authState;
    console.info('[oauth-authorize] Auth state resolved', {
      userId,
      sessionId: authState.sessionId,
      orgId: authState.orgId,
      hasAuthorizationHeader: Boolean(req.headers.get('authorization')),
      hasDesktopHeader: Boolean(req.headers.get('x-allternit-desktop-access-token')),
    });
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
    console.info('[oauth-authorize] Request payload received', {
      clientId,
      redirectUri,
      statePresent: Boolean(state),
      userEmailPresent: Boolean(userEmail),
      codeChallengePresent: Boolean(codeChallenge),
      codeChallengeMethod,
    });

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

    const code = await createAuthCode({
      clientId,
      redirectUri,
      userId,
      userEmail: userEmail ?? '',
      codeChallenge,
      codeChallengeMethod,
      scope: app.scopes.join(' '),
    });
    console.info('[oauth-authorize] Authorization code issued', {
      clientId,
      redirectUri,
      userId,
      codePrefix: code.slice(0, 12),
    });

    return NextResponse.json({ code, redirectUri, state: state ?? '' });
  } catch (error) {
    console.error('[oauth-authorize] Failed to issue authorization code:', error);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
