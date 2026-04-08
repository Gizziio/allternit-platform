/**
 * Mesh Network Types - BYOC WireGuard/Headscale/Tailscale Integration
 * 
 * Production-grade types for user-hosted mesh networking.
 */

// ============================================================================
// Provider Types
// ============================================================================

export type MeshProvider = 'headscale' | 'tailscale';

export interface MeshProviderConfig {
  provider: MeshProvider;
  name: string;
  description: string;
  serverUrl: string;
  authKey?: string;
  apiKey?: string;
}

// ============================================================================
// Headscale Types
// ============================================================================

export interface HeadscaleServerConfig {
  /** Server name/label */
  name: string;
  /** Headscale server URL (e.g., https://headscale.example.com) */
  serverUrl: string;
  /** API key for management */
  apiKey: string;
  /** Pre-auth key for node registration */
  preAuthKey?: string;
  /** Namespace for this user's devices */
  namespace: string;
}

export interface HeadscaleNode {
  id: string;
  machineId: string;
  ipAddresses: string[];
  name: string;
  user: string;
  lastSeen: string;
  lastSuccessfulUpdate: string;
  expiry: string;
  preAuthKeyExpired: boolean;
  forcedTags: string[];
  validTags: string[];
  invalidTags: string[];
  online: boolean;
  os: string;
  arch: string;
  keyExpiry: string;
}

export interface HeadscalePreAuthKey {
  user: string;
  id: string;
  key: string;
  reusable: boolean;
  ephemeral: boolean;
  used: boolean;
  expiration: string;
  createdAt: string;
  aclTags: string[];
}

// ============================================================================
// Tailscale Types
// ============================================================================

export interface TailscaleServerConfig {
  /** Tailnet name (e.g., user.github) */
  tailnet: string;
  /** OAuth client ID */
  clientId: string;
  /** OAuth client secret */
  clientSecret: string;
  /** Auth key for node registration */
  authKey?: string;
}

export interface TailscaleDevice {
  id: string;
  nodeId: string;
  user: string;
  name: string;
  hostname: string;
  machineKey: string;
  nodeKey: string;
  os: string;
  updateAvailable: boolean;
  created: string;
  lastSeen: string;
  keyExpiryDisabled: boolean;
  expires: string;
  authorized: boolean;
  isExternal: boolean;
  tags: string[];
  addresses: string[];
  enabledRoutes: string[];
}

// ============================================================================
// Agent Types
// ============================================================================

export interface MeshAgentConfig {
  /** Unique agent ID */
  agentId: string;
  /** User's VPS ID */
  nodeId: string;
  /** Which mesh provider */
  provider: MeshProvider;
  /** Server configuration */
  serverConfig: HeadscaleServerConfig | TailscaleServerConfig;
  /** Agent version */
  version: string;
  /** Auto-update enabled */
  autoUpdate: boolean;
  /** Update channel: stable, beta, nightly */
  updateChannel: 'stable' | 'beta' | 'nightly';
  /** Health check interval (ms) */
  healthCheckInterval: number;
  /** WireGuard listen port (0 = auto) */
  listenPort: number;
}

export interface MeshAgentStatus {
  agentId: string;
  state: 'connecting' | 'connected' | 'disconnected' | 'error';
  version: string;
  lastSeen: string;
  wireguardIp?: string;
  publicKey?: string;
  endpoints: string[];
  allowedIps: string[];
  rxBytes: number;
  txBytes: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  latencyMs?: number;
  errorMessage?: string;
}

// ============================================================================
// Platform Peer Types
// ============================================================================

export interface PlatformPeerConfig {
  /** User ID this peer belongs to */
  userId: string;
  /** Mesh network ID */
  meshId: string;
  /** WireGuard private key (ephemeral, rotated) */
  privateKey: string;
  /** WireGuard public key */
  publicKey: string;
  /** Internal mesh IP assigned to platform */
  meshIp: string;
  /** Routes we advertise */
  routes: string[];
  /** DNS config */
  dns: string[];
}

// ============================================================================
// Invitation Types (User invites Allternit to their mesh)
// ============================================================================

export interface MeshInvitation {
  id: string;
  /** User who created the invitation */
  userId: string;
  /** Which provider */
  provider: MeshProvider;
  /** Server URL */
  serverUrl: string;
  /** Pre-auth key for joining */
  preAuthKey: string;
  /** Expiration time */
  expiresAt: string;
  /** Creation time */
  createdAt: string;
  /** Whether invitation has been used */
  used: boolean;
  /** Tags to apply to platform peer */
  tags: string[];
}

export interface MeshJoinRequest {
  invitationId: string;
  /** Platform's WireGuard public key */
  platformPublicKey: string;
  /** Platform's mesh IP */
  platformMeshIp: string;
  /** ACL tags requested */
  requestedTags: string[];
}

// ============================================================================
// Auto-Update Types
// ============================================================================

export interface AgentUpdateInfo {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  downloadUrl: string;
  checksum: string;
  releaseNotes: string;
  critical: boolean;
}

export interface AgentUpdateProgress {
  state: 'checking' | 'downloading' | 'verifying' | 'installing' | 'restarting' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  error?: string;
}

// ============================================================================
// Health & Metrics Types
// ============================================================================

export interface MeshHealthStatus {
  agentId: string;
  timestamp: string;
  checks: {
    wireguard: 'healthy' | 'degraded' | 'unhealthy';
    connectionToServer: 'healthy' | 'degraded' | 'unhealthy';
    connectionToPlatform: 'healthy' | 'degraded' | 'unhealthy' | 'not-required';
    dnsResolution: 'healthy' | 'degraded' | 'unhealthy';
  };
  metrics: {
    latencyP50: number;
    latencyP99: number;
    packetLoss: number;
    throughputRx: number;
    throughputTx: number;
  };
}

// ============================================================================
// VPS Registration Types
// ============================================================================

export interface VPSRegistrationRequest {
  /** User's VPS public IP */
  publicIp: string;
  /** VPS hostname */
  hostname: string;
  /** Operating system */
  os: 'linux' | 'freebsd' | 'openbsd';
  /** Architecture */
  arch: 'amd64' | 'arm64' | 'arm';
  /** Which mesh provider to use */
  provider: MeshProvider;
  /** Provider-specific config */
  providerConfig: HeadscaleServerConfig | TailscaleServerConfig;
}

export interface VPSRegistrationResponse {
  /** Agent ID assigned */
  agentId: string;
  /** Installation script URL */
  installScriptUrl: string;
  /** One-time setup token */
  setupToken: string;
  /** WireGuard config for the VPS */
  wireguardConfig?: {
    privateKey: string;
    publicKey: string;
    addresses: string[];
    dns: string[];
  };
}
