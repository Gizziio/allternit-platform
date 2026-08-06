/**
 * Strip credentials embedded in URLs (e.g. a Git PAT baked into an authenticated
 * remote `https://<token>@github.com/...`). Git error messages echo the full
 * command — including that URL — so any error we surface to the client or write
 * to the logs would otherwise leak the token. Apply this to every git error
 * before it leaves the process.
 */
export function redactUrlCreds(input: unknown): string {
  const s = typeof input === 'string' ? input : String(input ?? '');
  // scheme://<userinfo>@host  →  scheme://***@host   (userinfo = user[:pass] or token)
  return s.replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, '$1***@');
}
