import type { AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS } from '@/services/analytics/index.js'

export type APIProvider = 'firstParty'

export function getAPIProvider(): APIProvider {
  return 'firstParty'
}

export function getAPIProviderForStatsig(): AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS {
  return getAPIProvider() as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS
}

/**
 * Check if ALLTERNIT_BASE_URL is a first-party Anthropic API URL.
 * Returns true if not set (default API) or points to api.allternit.com
 * (or api-staging.allternit.com for ant users).
 */
export function isFirstPartyAnthropicBaseUrl(): boolean {
  const baseUrl = process.env.ALLTERNIT_BASE_URL
  if (!baseUrl) {
    return true
  }
  try {
    const host = new URL(baseUrl).host
    const allowedHosts = ['api.allternit.com', 'api.anthropic.com', 'api-staging.anthropic.com', 'localhost', '127.0.0.1']
    if (process.env.USER_TYPE === 'ant') {
      allowedHosts.push('api-staging.allternit.com')
    }
    return allowedHosts.includes(host) || host.endsWith('.allternit.com') || host.endsWith('.anthropic.com')
  } catch {
    return false
  }
}

