// @ts-nocheck
/**
 * Shared bridge auth/URL resolution. Consolidates the ant-only
 * GIZZI_BRIDGE_* dev overrides that were previously copy-pasted across
 * a dozen files — inboundAttachments, BriefTool/upload, bridgeMain,
 * initReplBridge, remoteBridgeCore, daemon workers, /rename,
 * /remote-control.
 *
 * Two layers: *Override() returns the ant-only env var (or undefined);
 * the non-Override versions fall through to the real OAuth store/config.
 * Callers that compose with a different auth source (e.g. daemon workers
 * using IPC auth) use the Override getters directly.
 */

import { getOauthConfig } from '../constants/oauth'

// Lazily loaded to avoid a static circular import through utils/auth.js
// (requires async module init). getBridgeAccessToken must stay synchronous
// — it's called directly by sync code paths and handed out as a plain
// callback reference (getAccessToken: getBridgeAccessToken) elsewhere — so
// this is kicked off eagerly at module load rather than awaited inline.
let authModule: typeof import('../utils/auth') | undefined
void import('../utils/auth').then(m => {
  authModule = m
})

/** Ant-only dev override: GIZZI_BRIDGE_OAUTH_TOKEN, else undefined. */
export function getBridgeTokenOverride(): string | undefined {
  return (
    (process.env.USER_TYPE === 'ant' &&
      process.env.GIZZI_BRIDGE_OAUTH_TOKEN) ||
    undefined
  )
}

/** Ant-only dev override: GIZZI_BRIDGE_BASE_URL, else undefined. */
export function getBridgeBaseUrlOverride(): string | undefined {
  return (
    (process.env.USER_TYPE === 'ant' && process.env.GIZZI_BRIDGE_BASE_URL) ||
    undefined
  )
}

/**
 * Access token for bridge API calls: dev override first, then the OAuth
 * keychain. Undefined means "not logged in".
 */
export function getBridgeAccessToken(): string | undefined {
  return (
    getBridgeTokenOverride() ?? authModule?.getClaudeAIOAuthTokens()?.accessToken
  )
}

/**
 * Base URL for bridge API calls: dev override first, then the production
 * OAuth config. Always returns a URL.
 */
export function getBridgeBaseUrl(): string {
  return getBridgeBaseUrlOverride() ?? getOauthConfig().BASE_API_URL
}
