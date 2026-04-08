/**
 * In-process OAuth authorization code store.
 *
 * Codes are single-use, expire after 5 minutes, and are tied to
 * a specific clientId + redirectUri + userId + PKCE challenge.
 *
 * For multi-instance deployments replace with Vercel KV or Redis.
 */

interface StoredCode {
  code: string;
  clientId: string;
  redirectUri: string;
  userId: string;
  userEmail: string;
  codeChallenge?: string;       // PKCE S256 challenge
  codeChallengeMethod?: string; // 'S256' | 'plain'
  scope: string;
  expiresAt: number;
  used: boolean;
}

// Module-level store — survives across requests in the same Node.js process.
const codeStore = new Map<string, StoredCode>();

// Sweep expired codes every 5 minutes.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of codeStore.entries()) {
      if (entry.expiresAt < now || entry.used) codeStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

export function createAuthCode(params: {
  clientId: string;
  redirectUri: string;
  userId: string;
  userEmail: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  scope?: string;
}): string {
  const code = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  codeStore.set(code, {
    code,
    ...params,
    scope: params.scope ?? 'openid profile email',
    expiresAt: Date.now() + 5 * 60 * 1000,
    used: false,
  });
  return code;
}

export function consumeAuthCode(code: string): StoredCode | null {
  const entry = codeStore.get(code);
  if (!entry) return null;
  if (entry.used || entry.expiresAt < Date.now()) {
    codeStore.delete(code);
    return null;
  }
  entry.used = true;
  codeStore.delete(code);
  return entry;
}
