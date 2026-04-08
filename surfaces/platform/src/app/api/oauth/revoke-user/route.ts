/**
 * POST /api/oauth/revoke-user
 *
 * Revokes all OAuth tokens previously issued to the currently signed-in user.
 * Uses a not-before timestamp so new tokens can still be issued after revocation.
 *
 * Called from Settings → Gizzi Code → "Revoke Access".
 * Authenticated via Clerk session (not OAuth Bearer token).
 */

import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/server-auth';
import { revokeAllTokensForUser } from '@/lib/oauth-tokens';

export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  const { userId } = await getAuth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  await revokeAllTokensForUser(userId);

  return NextResponse.json({ revoked: true });
}
