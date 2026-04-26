/**
 * OAuth client registry
 *
 * Add new first-party apps here — no code change to the authorize page needed.
 * In production this should be backed by a database; this file is the seed/fallback.
 */

export interface OAuthAppConfig {
  clientId: string;
  name: string;
  /** Allowed redirect URI prefixes (exact match or prefix) */
  allowedRedirectUris: string[];
  scopes: string[];
}

const OAUTH_APPS: OAuthAppConfig[] = [
  {
    clientId: 'gizzi-code',
    name: 'Gizzi Code',
    allowedRedirectUris: ['http://localhost', 'allternit://', 'gizzi://'],
    scopes: [
      'Access your Allternit profile information',
      'Contribute to your Allternit subscription usage',
      'Access your Gizzi Code sessions',
      'Use and manage your AI connectors',
      'Upload files on your behalf',
      'Your privacy settings apply to coding sessions',
    ],
  },
  {
    clientId: 'gizzi-browser',
    name: 'Gizzi Browser',
    allowedRedirectUris: ['http://localhost', 'allternit://', 'gizzi://'],
    scopes: [
      'Access your Allternit profile information',
      'Use and manage your browser sessions',
      'Navigate the web on your behalf',
      'Access saved bookmarks and history',
    ],
  },
  {
    clientId: 'allternit-desktop',
    name: 'Allternit Desktop',
    allowedRedirectUris: ['allternit://auth/callback'],
    scopes: [
      'Access your Allternit profile information',
      'Use your hosted account to unlock the desktop app',
      'Keep the desktop shell linked to your Allternit workspace',
      'Authorize the local platform backend on your behalf',
    ],
  },
];

const APP_MAP = new Map(OAUTH_APPS.map((a) => [a.clientId, a]));

export function getOAuthApp(clientId: string): OAuthAppConfig | null {
  return APP_MAP.get(clientId) ?? null;
}

export function isAllowedRedirectUri(app: OAuthAppConfig, redirectUri: string): boolean {
  return app.allowedRedirectUris.some(
    (allowed) => redirectUri === allowed || redirectUri.startsWith(allowed),
  );
}

export { OAUTH_APPS };
