/**
 * OAuth token injection for sandboxed miniapp runtimes.
 *
 * Pure helpers shared between the lifecycle manager and tests. The flow:
 * a miniapp manifest declares `oauth: { <providerId>: <provider config> }`;
 * that declaration is part of the runtime registration and therefore covered
 * by the SHA-256 approval fingerprint — adding or changing a provider
 * invalidates the existing approval. At start time the main process resolves
 * a fresh access token for each declared provider (refreshing if needed, via
 * the OAuth broker) and injects it as an environment variable. Tokens travel
 * from the broker straight into the child environment; they never cross IPC
 * and are never written to disk in plaintext.
 */

/** Provider ids follow the broker's pattern; env names are derived safely. */
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

const ENV_PREFIX = 'ALLTERNIT_OAUTH_TOKEN_';

/**
 * Environment variable name for a provider's access token, or null when the
 * provider id is invalid. Non-alphanumerics map to '_', e.g. provider
 * "google-drive" → ALLTERNIT_OAUTH_TOKEN_GOOGLE_DRIVE.
 */
export function oauthEnvVarName(providerId: string): string | null {
  if (!PROVIDER_ID_PATTERN.test(providerId)) return null;
  return `${ENV_PREFIX}${providerId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
}

export interface OAuthProviderDeclaration {
  providerId: string;
  envName: string;
}

/**
 * Validate a manifest `oauth` declaration and return the injectable provider
 * list. Rejects invalid provider ids and declarations whose environment
 * variable names would collide after sanitization ("a-b" vs "a.b").
 */
export function collectOAuthProviders(
  declaration: unknown,
): { providers: OAuthProviderDeclaration[]; error?: string } {
  if (declaration === undefined || declaration === null) return { providers: [] };
  if (typeof declaration !== 'object' || Array.isArray(declaration)) {
    return { providers: [], error: 'oauth must be an object keyed by provider id' };
  }
  const entries = Object.entries(declaration as Record<string, unknown>);
  if (entries.length > 16) return { providers: [], error: 'oauth declares too many providers (max 16)' };
  const providers: OAuthProviderDeclaration[] = [];
  const seenEnvNames = new Set<string>();
  for (const [providerId, config] of entries) {
    const envName = oauthEnvVarName(providerId);
    if (!envName) return { providers: [], error: `Invalid OAuth provider id: ${providerId}` };
    if (seenEnvNames.has(envName)) {
      return { providers: [], error: `OAuth provider ids collide after sanitization: ${providerId}` };
    }
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
      return { providers: [], error: `OAuth provider ${providerId} must be a configuration object` };
    }
    seenEnvNames.add(envName);
    providers.push({ providerId, envName });
  }
  return { providers };
}

/**
 * Build the environment slice for resolved tokens. Entries without a token
 * (no connected account, needs reauth) are simply absent — a runtime must
 * never receive an empty or placeholder token.
 */
export function buildOAuthEnv(tokens: Record<string, string | null | undefined>): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [envName, token] of Object.entries(tokens)) {
    if (!envName.startsWith(ENV_PREFIX)) continue;
    if (typeof token !== 'string' || token.length === 0) continue;
    environment[envName] = token;
  }
  return environment;
}
