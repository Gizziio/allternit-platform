/**
 * Secure storage types
 */

// MCP OAuth token data stored per server
export interface MCPOAuthTokenEntry {
  serverName: string
  serverUrl: string
  accessToken: string
  refreshToken?: string
  expiresAt: number
  scope?: string
  clientId?: string
  clientSecret?: string
  stepUpScope?: string
  discoveryState?: {
    authorizationServerUrl?: string
    resourceMetadataUrl?: string
  }
}

// MCP OAuth storage structure - keyed by server identifier
export interface MCPOAuthStorage {
  [serverKey: string]: MCPOAuthTokenEntry
}

// XAA IdP token entry
export interface MCPXaaIdpEntry {
  idToken: string
  expiresAt: number
}

// XAA IdP storage - keyed by normalized issuer URL
export interface MCPXaaIdpStorage {
  [issuerKey: string]: MCPXaaIdpEntry
}

// XAA IdP config entry
export interface MCPXaaIdpConfigEntry {
  clientSecret?: string
}

// XAA IdP config storage - keyed by normalized issuer URL
export interface MCPXaaIdpConfigStorage {
  [issuerKey: string]: MCPXaaIdpConfigEntry
}

// MCP OAuth client config entry
export interface MCPOAuthClientConfigEntry {
  clientSecret?: string
}

// MCP OAuth client config storage - keyed by server identifier
export interface MCPOAuthClientConfigStorage {
  [serverKey: string]: MCPOAuthClientConfigEntry
}

// Main secure storage data structure
export interface SecureStorageData {
  mcpOAuth?: MCPOAuthStorage
  mcpOAuthClientConfig?: MCPOAuthClientConfigStorage
  mcpClientConfig?: Record<string, unknown>
  mcpClientMetadata?: Record<string, unknown>
  pluginSecrets?: Record<string, Record<string, string>>
  mcpXaaIdp?: MCPXaaIdpStorage
  mcpXaaIdpConfig?: MCPXaaIdpConfigStorage
  claudeAiOauth?: unknown
  [key: string]: unknown
}

export interface SecureStorage {
  name?: string
  getItem?(key: string): Promise<string | null>
  setItem?(key: string, value: string): Promise<void>
  removeItem?(key: string): Promise<void>
  clear?(): Promise<void>
  read(key?: string): SecureStorageData | null
  update(data: SecureStorageData): { success: boolean; warning?: string }
  readAsync?(): Promise<SecureStorageData | null>
  delete(): boolean | Promise<void>
}

export interface SecureStorageConfig {
  serviceName: string
  accountName: string
}

export interface KeychainCredentials {
  account: string
  password: string
  service?: string
}

export type StorageBackend = 'keychain' | 'file' | 'plaintext'
