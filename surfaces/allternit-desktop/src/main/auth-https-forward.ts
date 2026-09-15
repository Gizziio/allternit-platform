/**
 * Forward https requests that the auth partition intercepted so it could
 * serve the fake accounts.* origin. protocol.handle('https') owns the whole
 * scheme — session.fetch() on the same partition re-enters the handler and
 * deadlocks (Clerk JS then times out). Callers must use net.fetch with
 * bypassCustomProtocolHandlers, then persist Set-Cookie onto the auth jar.
 */
import type { Cookie } from 'electron';

export interface ForwardFetchInit {
  method: string;
  headers: Headers;
  body?: ArrayBuffer | null;
  bypassCustomProtocolHandlers: true;
}

export async function buildAuthForwardInit(
  request: Request,
  cookies: Array<{ name: string; value: string }>,
): Promise<ForwardFetchInit> {
  const headers = new Headers(request.headers);
  if (!headers.has('cookie') && cookies.length > 0) {
    headers.set(
      'Cookie',
      cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; '),
    );
  }
  const body =
    request.method !== 'GET' && request.method !== 'HEAD' ? await request.arrayBuffer() : null;
  const init: ForwardFetchInit = {
    method: request.method,
    headers,
    bypassCustomProtocolHandlers: true,
  };
  if (body && body.byteLength > 0) {
    init.body = body;
  }
  return init;
}

export function cookieFromSetCookieHeader(setCookie: string, requestUrl: string): Cookie {
  const url = new URL(requestUrl);
  const segments = setCookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const [nameValue, ...attrs] = segments;
  const eq = nameValue.indexOf('=');
  const name = eq === -1 ? nameValue : nameValue.slice(0, eq);
  const value = eq === -1 ? '' : nameValue.slice(eq + 1);
  let domain: string | undefined;
  let path = '/';
  let secure = false;
  let httpOnly = false;
  let sameSite: Cookie['sameSite'] = 'unspecified';
  let expirationDate: number | undefined;
  for (const attr of attrs) {
    const idx = attr.indexOf('=');
    const key = (idx === -1 ? attr : attr.slice(0, idx)).trim().toLowerCase();
    const val = idx === -1 ? '' : attr.slice(idx + 1).trim();
    switch (key) {
      case 'domain':
        domain = val;
        break;
      case 'path':
        path = val || '/';
        break;
      case 'secure':
        secure = true;
        break;
      case 'httponly':
        httpOnly = true;
        break;
      case 'samesite': {
        const lower = val.toLowerCase();
        sameSite =
          lower === 'none' ? 'no_restriction' : lower === 'strict' ? 'strict' : lower === 'lax' ? 'lax' : 'unspecified';
        break;
      }
      case 'max-age': {
        const n = Number(val);
        if (Number.isFinite(n)) expirationDate = Date.now() / 1000 + n;
        break;
      }
      case 'expires': {
        const t = Date.parse(val);
        if (!Number.isNaN(t)) expirationDate = t / 1000;
        break;
      }
    }
  }
  return {
    name,
    value,
    domain: domain || url.hostname,
    path,
    secure: secure || url.protocol === 'https:',
    httpOnly,
    session: expirationDate === undefined,
    ...(expirationDate !== undefined ? { expirationDate } : {}),
    sameSite,
  };
}

export function setCookiesFromResponse(response: Response): string[] {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}
