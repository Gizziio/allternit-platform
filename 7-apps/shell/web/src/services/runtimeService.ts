/**
 * Runtime Environment Service
 * 
 * Provides TypeScript API client for DAG N3-N16 runtime settings:
 * - N3: Driver Interface
 * - N4: Process/MicroVM Driver
 * - N11: Economic Model (budget metering)
 * - N12: Replay & Determinism
 * - N14: Versioning
 * - N16: Prewarm Pools
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ============================================================================
// Types
// ============================================================================

export interface DriverConfig {
  driver_type: 'process' | 'container' | 'microvm';
  isolation_level: 'limited' | 'standard' | 'hardened' | 'maximum';
  enabled: boolean;
}

export interface ResourceLimits {
  cpu_millicores: number;
  memory_mib: number;
  budget_credits_per_hour?: number;
}

export interface ReplayConfig {
  capture_level: 'none' | 'minimal' | 'full';
  deterministic_mode: boolean;
  snapshot_interval_seconds: number;
}

export interface PrewarmConfig {
  enabled: boolean;
  pool_size: number;
  warmup_commands: string[];
}

export interface VersioningConfig {
  auto_commit: boolean;
  commit_message_template: string;
  branch_prefix: string;
}

export interface RuntimeSettings {
  driver: DriverConfig;
  resources: ResourceLimits;
  replay: ReplayConfig;
  prewarm: PrewarmConfig;
  versioning: VersioningConfig;
}

export interface DriverInfo {
  type: string;
  name: string;
  description: string;
  isolation: string;
  available: boolean;
  recommended: boolean;
}

export interface DriverStatus {
  driver_type: string;
  status: 'healthy' | 'degraded' | 'unavailable';
  active_instances: number;
  pool_size: number;
}

export interface BudgetStatus {
  credits_remaining: number;
  credits_consumed_this_hour: number;
  projected_hourly_cost: number;
  status: 'healthy' | 'warning' | 'exhausted';
}

export interface PrewarmStatus {
  enabled: boolean;
  pool_size: number;
  available_instances: number;
  warmup_commands: string[];
}

// ============================================================================
// API Client
// ============================================================================

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error ${response.status}: ${error}`);
  }

  return response.json();
}

// ============================================================================
// Settings API
// ============================================================================

/**
 * Get current runtime settings
 */
export async function getRuntimeSettings(): Promise<RuntimeSettings> {
  return apiFetch<RuntimeSettings>('/api/v1/runtime/settings');
}

/**
 * Update runtime settings (partial update supported)
 */
export async function updateRuntimeSettings(
  settings: Partial<RuntimeSettings>
): Promise<RuntimeSettings> {
  return apiFetch<RuntimeSettings>('/api/v1/runtime/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

/**
 * Reset settings to defaults
 */
export async function resetRuntimeSettings(): Promise<RuntimeSettings> {
  return apiFetch<RuntimeSettings>('/api/v1/runtime/settings/reset', {
    method: 'POST',
  });
}

// ============================================================================
// Driver API (N3, N4)
// ============================================================================

/**
 * List available execution drivers
 */
export async function listDrivers(): Promise<DriverInfo[]> {
  return apiFetch<DriverInfo[]>('/api/v1/runtime/drivers');
}

/**
 * Get driver status
 */
export async function getDriverStatus(driverType: string): Promise<DriverStatus> {
  return apiFetch<DriverStatus>(`/api/v1/runtime/drivers/${driverType}/status`);
}

/**
 * Activate a driver
 */
export async function activateDriver(driverType: string): Promise<{ status: string; driver: string }> {
  return apiFetch<{ status: string; driver: string }>(`/api/v1/runtime/drivers/${driverType}/activate`, {
    method: 'POST',
  });
}

// ============================================================================
// Budget API (N11)
// ============================================================================

/**
 * Get budget status
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  return apiFetch<BudgetStatus>('/api/v1/runtime/budget');
}

/**
 * Set budget quota
 */
export async function setBudgetQuota(creditsPerHour: number): Promise<{ status: string; credits_per_hour: number }> {
  return apiFetch<{ status: string; credits_per_hour: number }>('/api/v1/runtime/budget/quota', {
    method: 'POST',
    body: JSON.stringify({ credits_per_hour: creditsPerHour }),
  });
}

// ============================================================================
// Replay API (N12)
// ============================================================================

/**
 * List replay sessions
 */
export async function listReplaySessions(): Promise<unknown[]> {
  return apiFetch<unknown[]>('/api/v1/runtime/replay/sessions');
}

/**
 * Get replay session details
 */
export async function getReplaySession(sessionId: string): Promise<unknown> {
  return apiFetch<unknown>(`/api/v1/runtime/replay/sessions/${sessionId}`);
}

/**
 * Execute replay
 */
export async function executeReplay(
  sessionId: string,
  deterministic: boolean = true
): Promise<{ status: string; session_id: string }> {
  return apiFetch<{ status: string; session_id: string }>(`/api/v1/runtime/replay/sessions/${sessionId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ deterministic }),
  });
}

// ============================================================================
// Prewarm API (N16)
// ============================================================================

/**
 * Get prewarm pool status
 */
export async function getPrewarmStatus(): Promise<PrewarmStatus> {
  return apiFetch<PrewarmStatus>('/api/v1/runtime/prewarm/status');
}

/**
 * Update prewarm pool size
 */
export async function updatePrewarmPool(poolSize: number): Promise<{ status: string; pool_size: number }> {
  return apiFetch<{ status: string; pool_size: number }>('/api/v1/runtime/prewarm/pool', {
    method: 'POST',
    body: JSON.stringify({ pool_size: poolSize }),
  });
}

/**
 * Trigger warmup
 */
export async function triggerWarmup(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/v1/runtime/prewarm/warmup', {
    method: 'POST',
  });
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Update driver configuration
 */
export async function updateDriverConfig(config: DriverConfig): Promise<RuntimeSettings> {
  return updateRuntimeSettings({ driver: config });
}

/**
 * Update resource limits
 */
export async function updateResourceLimits(limits: ResourceLimits): Promise<RuntimeSettings> {
  return updateRuntimeSettings({ resources: limits });
}

/**
 * Update replay configuration
 */
export async function updateReplayConfig(config: ReplayConfig): Promise<RuntimeSettings> {
  return updateRuntimeSettings({ replay: config });
}

/**
 * Update prewarm configuration
 */
export async function updatePrewarmConfig(config: PrewarmConfig): Promise<RuntimeSettings> {
  return updateRuntimeSettings({ prewarm: config });
}

/**
 * Update versioning configuration
 */
export async function updateVersioningConfig(config: VersioningConfig): Promise<RuntimeSettings> {
  return updateRuntimeSettings({ versioning: config });
}

// ============================================================================
// Environment API (N5)
// ============================================================================

export type EnvironmentSource = 'devcontainer' | 'nix' | 'dockerfile' | 'image';

export interface EnvironmentConfig {
  source: EnvironmentSource;
  uri: string;
  resolved?: EnvironmentSpecResponse;
}

export interface FeatureSpec {
  id: string;
  options: Record<string, unknown>;
}

export interface MountSpec {
  source: string;
  target: string;
  mount_type: 'bind' | 'volume' | 'tmpfs' | 'secret';
  read_only: boolean;
}

export interface ResourceRequirementsResponse {
  cpus?: number;
  memory_gb?: number;
  disk_gb?: number;
}

export interface A2rEnvironmentConfig {
  driver?: string;
  isolation?: string;
  enable_prewarm: boolean;
}

export interface EnvironmentSpecResponse {
  id: string;
  source: EnvironmentSource;
  source_uri: string;
  image: string;
  image_digest?: string;
  workspace_folder: string;
  env_vars: Record<string, string>;
  packages: string[];
  features: FeatureSpec[];
  mounts: MountSpec[];
  post_create_commands: string[];
  resources: ResourceRequirementsResponse;
  a2r_config: A2rEnvironmentConfig;
}

export interface ResolveEnvironmentRequest {
  source: string;
}

export interface ConvertEnvironmentRequest {
  source: string;
  format: 'rootfs' | 'initramfs';
}

export interface ConvertEnvironmentResponse {
  success: boolean;
  format: string;
  path: string;
  image_ref: string;
}

export interface EnvironmentTemplate {
  id: string;
  name: string;
  description: string;
  image: string;
  source: EnvironmentSource;
  tags: string[];
}

export interface EnvironmentHealthResponse {
  status: 'healthy' | 'degraded' | 'unavailable';
  cache_entries: number;
  cache_size_mb: number;
}

/**
 * Resolve environment from source URI
 */
export async function resolveEnvironment(source: string): Promise<EnvironmentSpecResponse> {
  return apiFetch<EnvironmentSpecResponse>('/api/v1/environment/resolve', {
    method: 'POST',
    body: JSON.stringify({ source }),
  });
}

/**
 * Convert environment to rootfs/initramfs
 */
export async function convertEnvironment(
  source: string,
  format: 'rootfs' | 'initramfs'
): Promise<ConvertEnvironmentResponse> {
  return apiFetch<ConvertEnvironmentResponse>('/api/v1/environment/convert', {
    method: 'POST',
    body: JSON.stringify({ source, format }),
  });
}

/**
 * List cached environments
 */
export async function listCachedEnvironments(): Promise<EnvironmentSpecResponse[]> {
  return apiFetch<EnvironmentSpecResponse[]>('/api/v1/environment/cached');
}

/**
 * Get environment service health
 */
export async function getEnvironmentHealth(): Promise<EnvironmentHealthResponse> {
  return apiFetch<EnvironmentHealthResponse>('/api/v1/environment/health');
}

/**
 * List environment templates
 */
export async function listEnvironmentTemplates(): Promise<EnvironmentTemplate[]> {
  return apiFetch<EnvironmentTemplate[]>('/api/v1/environment/templates');
}

/**
 * Get default environment configuration
 */
export function getDefaultEnvironmentConfig(): EnvironmentConfig {
  return {
    source: 'devcontainer',
    uri: 'mcr.microsoft.com/devcontainers/typescript-node:18',
  };
}
