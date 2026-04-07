import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface AuthClaims {
  sub?: string;
  user_id?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  [key: string]: unknown;
}

export interface AuthSuccess {
  ok: true;
  userId: string;
  claims: AuthClaims;
  mode: 'jwt' | 'dev-token' | 'opaque';
}

export interface AuthFailure {
  ok: false;
  error: string;
}

export type AuthResult = AuthSuccess | AuthFailure;

export function validateAuthToken(
  token: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): AuthResult {
  if (!token) {
    return { ok: false, error: 'Missing authentication token' };
  }

  if (token === 'dev-token') {
    if (!isEnabled(env.ALLOW_DEV_TOKEN)) {
      return { ok: false, error: 'dev-token is disabled' };
    }

    return {
      ok: true,
      userId: 'dev-user',
      claims: {
        sub: 'dev-user',
        auth_mode: 'dev-token',
      },
      mode: 'dev-token',
    };
  }

  const jwtSecret = env.JWT_SECRET || env.ALLTERNIT_JWT_SECRET;
  if (looksLikeJwt(token)) {
    if (!jwtSecret) {
      return { ok: false, error: 'JWT_SECRET is not configured' };
    }

    try {
      const claims = decodeJwt(token, jwtSecret);
      const audience = env.JWT_AUDIENCE;
      if (audience && !matchesAudience(claims.aud, audience)) {
        return { ok: false, error: 'Token audience mismatch' };
      }

      return {
        ok: true,
        userId: resolveUserId(claims, token),
        claims,
        mode: 'jwt',
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Invalid authentication token',
      };
    }
  }

  if (jwtSecret && !isEnabled(env.ALLOW_INSECURE_TOKENS)) {
    return {
      ok: false,
      error: 'Opaque tokens are disabled when JWT validation is configured',
    };
  }

  const userId = `opaque-${fingerprintToken(token)}`;
  return {
    ok: true,
    userId,
    claims: {
      sub: userId,
      auth_mode: 'opaque',
    },
    mode: 'opaque',
  };
}

function decodeJwt(token: string, secret: string): AuthClaims {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = parseJwtPart<Record<string, unknown>>(encodedHeader, 'header');
  const claims = parseJwtPart<AuthClaims>(encodedPayload, 'payload');
  const algorithm = typeof header.alg === 'string' ? header.alg : undefined;
  const digestName = getDigestName(algorithm);
  if (!digestName) {
    throw new Error('Unsupported JWT algorithm');
  }

  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac(digestName, secret).update(signingInput).digest();
  const providedSignature = base64urlDecode(encodedSignature);
  if (expectedSignature.length !== providedSignature.length) {
    throw new Error('Invalid JWT signature');
  }
  if (!timingSafeEqual(expectedSignature, providedSignature)) {
    throw new Error('Invalid JWT signature');
  }

  const now = Math.floor(Date.now() / 1000);
  const notBefore = coerceNumericDate(claims.nbf, 'nbf');
  const expiresAt = coerceNumericDate(claims.exp, 'exp');
  if (notBefore !== undefined && notBefore > now) {
    throw new Error('JWT is not valid yet');
  }
  if (expiresAt !== undefined && expiresAt <= now) {
    throw new Error('JWT has expired');
  }

  return claims;
}

function parseJwtPart<T>(value: string, label: string): T {
  try {
    return JSON.parse(base64urlDecode(value).toString('utf8')) as T;
  } catch (error) {
    throw new Error(`Invalid JWT ${label}` , { cause: error });
  }
}

function getDigestName(algorithm: string | undefined): 'sha256' | 'sha384' | 'sha512' | undefined {
  if (algorithm === 'HS256') {
    return 'sha256';
  }
  if (algorithm === 'HS384') {
    return 'sha384';
  }
  if (algorithm === 'HS512') {
    return 'sha512';
  }
  return undefined;
}

function coerceNumericDate(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid JWT ${label} claim`);
  }
  return parsed;
}

function resolveUserId(claims: AuthClaims, token: string): string {
  const candidate = [claims.sub, claims.user_id].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  return candidate ?? `user-${fingerprintToken(token)}`;
}

function matchesAudience(audienceClaim: AuthClaims['aud'], expectedAudience: string): boolean {
  if (typeof audienceClaim === 'string') {
    return audienceClaim === expectedAudience;
  }
  if (Array.isArray(audienceClaim)) {
    return audienceClaim.includes(expectedAudience);
  }
  return false;
}

function looksLikeJwt(token: string): boolean {
  return token.split('.').length === 3;
}

function isEnabled(value: string | undefined): boolean {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
}

function fingerprintToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function base64urlDecode(value: string): Buffer {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, 'base64');
}
