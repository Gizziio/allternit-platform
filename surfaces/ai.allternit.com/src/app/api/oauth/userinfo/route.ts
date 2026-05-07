/**
 * GET /api/oauth/userinfo
 *
 * OIDC UserInfo endpoint (OpenID Connect Core §5.3).
 * Returns standard claims for the authenticated user.
 *
 * Authorization: Bearer <access_token>
 *
 * Response:
 *   { sub, email, client_id, scope }
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateAccessToken } from '@/lib/oauth-tokens';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return errorResponse('invalid_token', 'Bearer token required', 401);
  }

  const token = auth.slice(7).trim();
  const payload = await validateAccessToken(token);
  if (!payload) {
    return errorResponse('invalid_token', 'Token is invalid, expired, or revoked', 401);
  }

  return NextResponse.json({
    sub: payload.userId,
    email: payload.userEmail,
    client_id: payload.clientId,
    scope: payload.scope,
  });
}

// POST is also valid per OIDC spec (§5.3.1) — same logic
export { GET as POST };

function errorResponse(error: string, description: string, status: number) {
  return NextResponse.json(
    { error, error_description: description },
    {
      status,
      headers: {
        'WWW-Authenticate': `Bearer error="${error}", error_description="${description}"`,
        'Cache-Control': 'no-store',
      },
    },
  );
}
