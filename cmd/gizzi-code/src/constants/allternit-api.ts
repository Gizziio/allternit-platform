/**
 * Allternit API Configuration
 * 
 * Replaces Anthropic API endpoints with Allternit equivalents
 */

// Base URLs
export const ALLTERNIT_BASE_URL = 'https://api.allternit.com'
export const ALLTERNIT_STAGING_BASE_URL = 'https://api-staging.allternit.com'
export const ALLTERNIT_LOCAL_BASE_URL = 'http://localhost:8080'

// OAuth Endpoints
export const ALLTERNIT_OAUTH = {
  BASE_API_URL: ALLTERNIT_BASE_URL,
  API_KEY_URL: `${ALLTERNIT_BASE_URL}/api/oauth/gizzi/create_api_key`,
  ROLES_URL: `${ALLTERNIT_BASE_URL}/api/oauth/gizzi/roles`,
  MCP_PROXY_URL: `${ALLTERNIT_BASE_URL}/mcp-proxy`,
  
  // Staging
  STAGING: {
    BASE_API_URL: ALLTERNIT_STAGING_BASE_URL,
    API_KEY_URL: `${ALLTERNIT_STAGING_BASE_URL}/api/oauth/gizzi/create_api_key`,
    ROLES_URL: `${ALLTERNIT_STAGING_BASE_URL}/api/oauth/gizzi/roles`,
    MCP_PROXY_URL: `${ALLTERNIT_STAGING_BASE_URL}/mcp-proxy`,
  },
  
  // Local
  LOCAL: {
    BASE_API_URL: ALLTERNIT_LOCAL_BASE_URL,
    API_KEY_URL: `${ALLTERNIT_LOCAL_BASE_URL}/api/oauth/gizzi/create_api_key`,
    ROLES_URL: `${ALLTERNIT_LOCAL_BASE_URL}/api/oauth/gizzi/roles`,
    MCP_PROXY_URL: `${ALLTERNIT_LOCAL_BASE_URL}/mcp-proxy`,
  },
} as const

// API Endpoints
export const ALLTERNIT_API = {
  // Files API
  FILES_BASE: ALLTERNIT_BASE_URL,
  FILES_UPLOAD: `${ALLTERNIT_BASE_URL}/v1/files`,
  FILES_CONTENT: (fileId: string) => `${ALLTERNIT_BASE_URL}/v1/files/${fileId}/content`,
  
  // Web fetch tool
  WEB_DOMAIN_INFO: (domain: string) => 
    `${ALLTERNIT_BASE_URL}/api/web/domain_info?domain=${encodeURIComponent(domain)}`,
  
  // Metrics and telemetry
  METRICS: `${ALLTERNIT_BASE_URL}/api/gizzi/metrics`,
  METRICS_OPT_OUT: `${ALLTERNIT_BASE_URL}/api/gizzi/organizations/metrics_enabled`,
  
  // Feedback
  FEEDBACK: `${ALLTERNIT_BASE_URL}/api/gizzi_feedback`,
  TRANSCRIPT_SHARE: `${ALLTERNIT_BASE_URL}/api/gizzi_shared_session_transcripts`,
  
  // MCP Registry
  MCP_REGISTRY: `${ALLTERNIT_BASE_URL}/mcp-registry/v0/servers`,
  
  // Brief tool upload
  BRIEF_UPLOAD: `${ALLTERNIT_BASE_URL}/api/brief/upload`,
  
  // Voice STT
  VOICE_STT: `${ALLTERNIT_BASE_URL}/v1/speech-to-text`,
  
  // GrowthBook (feature flags)
  GROWTHBOOK: `${ALLTERNIT_BASE_URL}/growthbook/`,
  
  // Admin
  ADMIN_REQUESTS: `${ALLTERNIT_BASE_URL}/api/admin/requests`,
  
  // Session ingress
  SESSION_INGRESS: (sessionId: string) => 
    `${ALLTERNIT_BASE_URL}/v1/sessions/${sessionId}/ingress`,
  
  // Analytics
  ANALYTICS: `${ALLTERNIT_BASE_URL}/analytics`,
  FIRST_PARTY_EVENTS: `${ALLTERNIT_BASE_URL}/events`,
  
  // Provider proxy
  PROVIDER_PROXY: `${ALLTERNIT_BASE_URL}/provider-proxy`,
  
  // Upstream proxy
  UPSTREAM_PROXY: ALLTERNIT_BASE_URL,
} as const

// Cloud console — platform.allternit.com. There is no console.allternit.com.
export const ALLTERNIT_CONSOLE = {
  BASE: 'https://platform.allternit.com',
  KEYS: 'https://platform.allternit.com/api-keys',
  SIGNUP: 'https://platform.allternit.com/sign-up',
  LOGIN: 'https://platform.allternit.com/sign-in',
  PLANS: 'https://platform.allternit.com/plans',
  BILLING: 'https://platform.allternit.com/billing',
  MODELS: 'https://platform.allternit.com/models',
} as const

// Web URLs
export const ALLTERNIT_WEB = {
  BASE: 'https://allternit.com',
  CODE: 'https://ai.allternit.com',
  DOCS: 'https://docs.gizziio.com',
  PLATFORM: 'https://platform.allternit.com',
} as const

// Environment detection
export function getAllternitBaseUrl(options?: {
  staging?: boolean
  local?: boolean
}): string {
  if (options?.local) return ALLTERNIT_LOCAL_BASE_URL
  if (options?.staging) return ALLTERNIT_STAGING_BASE_URL
  return ALLTERNIT_BASE_URL
}

// Legacy compatibility - returns Allternit URLs instead of Anthropic
export function getApiUrl(path: string, options?: { staging?: boolean }): string {
  const base = options?.staging ? ALLTERNIT_STAGING_BASE_URL : ALLTERNIT_BASE_URL
  return `${base}${path}`
}
