/**
 * Runtime Environment Types
 * 
 * Ported from: 6-ui/shell-ui/src/views/runtime/*.rs
 * 
 * Shell UI components for managing the execution stack:
 * - Runtime settings (drivers, resources, replay, prewarm)
 * - Budget metering dashboard
 * - Replay capture manager
 * - Prewarm pool manager
 */

import type { ViewportSize } from './browser';

// Re-export for hooks
export type { BudgetPercentages } from '@/services/budgetCalculator';

// ============================================================================
// Budget Metering Types
// ============================================================================

/** Budget dashboard state */
export interface BudgetDashboard {
  /** Current tenant quotas */
  quotas: TenantQuota[];
  /** Current usage summary */
  usage_summary: UsageSummary;
  /** Recent measurements */
  recent_measurements: MeasurementEntry[];
  /** Active alerts */
  alerts: BudgetAlert[];
}

/** Tenant quota display */
export interface TenantQuota {
  tenant_id: string;
  quota_id: string;
  cpu_seconds_limit: number;
  memory_mb_seconds_limit: number;
  network_bytes_limit: number;
  max_concurrent_workers: number;
  valid_until?: string;
}

/** Current usage summary */
export interface UsageSummary {
  total_cpu_seconds_used: number;
  total_memory_mb_seconds_used: number;
  total_network_bytes_used: number;
  current_active_workers: number;
  peak_workers: number;
}

/** Individual measurement entry */
export interface MeasurementEntry {
  measurement_id: string;
  run_id: string;
  timestamp: string;
  cpu_seconds_delta: number;
  memory_mb_current: number;
  network_bytes_sent: number;
  network_bytes_received: number;
}

/** Budget alert/warning */
export interface BudgetAlert {
  level: AlertLevel;
  message: string;
  timestamp: string;
  tenant_id: string;
}

/** Alert severity level */
export enum AlertLevel {
  Info = 'info',
  Warning = 'warning',
  Critical = 'critical',
}

/** Budget quota creation form */
export interface QuotaForm {
  tenant_id: string;
  cpu_seconds_limit: number;
  memory_mb_seconds_limit: number;
  network_bytes_limit: number;
  max_concurrent_workers: number;
  valid_days?: number;
}

/** Default quota form values */
export const defaultQuotaForm: QuotaForm = {
  tenant_id: 'default',
  cpu_seconds_limit: 3600, // 1 hour
  memory_mb_seconds_limit: 3600 * 1024, // 1GB for 1 hour
  network_bytes_limit: 1_073_741_824, // 1 GB
  max_concurrent_workers: 10,
  valid_days: 30,
};

/** Usage statistics in formatted form */
export interface FormattedUsageStats {
  total_cpu_hours: string;
  total_memory_gb_hours: string;
  network_gb: string;
  active_workers: string;
}

// ============================================================================
// Prewarm Pool Types
// ============================================================================

/** Prewarm pool manager state */
export interface PrewarmPoolManager {
  /** Available pools */
  pools: PoolStatus[];
  /** Selected pool for details */
  selected_pool?: string;
  /** Global statistics */
  stats: PoolStats;
  /** Recent activity */
  activity_log: PoolActivity[];
}

/** Pool status display */
export interface PoolStatus {
  name: string;
  image: string;
  pool_size: number;
  available_count: number;
  in_use_count: number;
  warming_up_count: number;
  status: PoolHealth;
  created_at: string;
  last_activity: string;
}

/** Pool health status */
export enum PoolHealth {
  Healthy = 'healthy',
  Degraded = 'degraded',
  Empty = 'empty',
  Error = 'error',
}

/** Pool error info */
export interface PoolError {
  message: string;
  code: string;
}

/** Pool statistics */
export interface PoolStats {
  total_pools: number;
  total_instances: number;
  total_available: number;
  total_in_use: number;
  total_warmups_performed: number;
  total_reuses: number;
  avg_warmup_time_ms: number;
}

/** Pool activity entry */
export interface PoolActivity {
  timestamp: string;
  pool_name: string;
  activity_type: ActivityType;
  details: string;
}

/** Activity type */
export enum ActivityType {
  InstanceAcquired = 'instance_acquired',
  InstanceReleased = 'instance_released',
  InstanceCreated = 'instance_created',
  InstanceDestroyed = 'instance_destroyed',
  WarmupStarted = 'warmup_started',
  WarmupCompleted = 'warmup_completed',
  CleanupPerformed = 'cleanup_performed',
  Error = 'error',
}

/** Pool creation form */
export interface PoolCreateForm {
  name: string;
  image: string;
  pool_size: number;
  warmup_commands: string[];
  idle_timeout_seconds: number;
  resources: PoolResources;
}

/** Pool resource configuration */
export interface PoolResources {
  cpu_millicores: number;
  memory_mib: number;
  disk_mib: number;
}

/** Default pool resources */
export const defaultPoolResources: PoolResources = {
  cpu_millicores: 500,
  memory_mib: 512,
  disk_mib: 1024,
};

// ============================================================================
// Replay Manager Types
// ============================================================================

/** Replay manager state */
export interface ReplayManager {
  /** Available replays */
  replays: ReplayEntry[];
  /** Selected replay */
  selected_replay?: string;
  /** Recording state */
  is_recording: boolean;
  /** Active session */
  active_session?: ReplaySession;
}

/** Replay entry */
export interface ReplayEntry {
  replay_id: string;
  name: string;
  description: string;
  created_at: string;
  duration_ms: number;
  event_count: number;
  size_bytes: number;
  tags: string[];
}

/** Replay session (active recording) */
export interface ReplaySession {
  session_id: string;
  started_at: string;
  events: ReplayEvent[];
  metadata: ReplayMetadata;
}

/** Replay event */
export interface ReplayEvent {
  sequence: number;
  timestamp: string;
  type: ReplayEventType;
  data: unknown;
}

/** Replay event types */
export enum ReplayEventType {
  Navigation = 'navigation',
  Click = 'click',
  Input = 'input',
  Scroll = 'scroll',
  Resize = 'resize',
  Network = 'network',
  Console = 'console',
  Error = 'error',
}

/** Replay metadata */
export interface ReplayMetadata {
  url: string;
  user_agent: string;
  viewport: ViewportSize;
  initial_timestamp: string;
}

// ============================================================================
// Runtime Settings Types
// ============================================================================

/** Runtime driver type */
export enum RuntimeDriver {
  Process = 'process',
  Microvm = 'microvm',
  Wasm = 'wasm',
}

/** Runtime settings */
export interface RuntimeSettings {
  driver: RuntimeDriver;
  resources: RuntimeResources;
  sandbox: SandboxConfig;
  logging: LoggingConfig;
}

/** Runtime resources */
export interface RuntimeResources {
  max_cpu_percent: number;
  max_memory_mb: number;
  max_disk_mb: number;
  max_network_mbps: number;
}

/** Sandbox configuration */
export interface SandboxConfig {
  enabled: boolean;
  network_access: boolean;
  file_system_access: 'none' | 'read_only' | 'read_write';
  allowed_syscalls: string[];
}

/** Logging configuration */
export interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  output: 'console' | 'file' | 'both';
  format: 'json' | 'pretty';
  retention_days: number;
}

/** Default runtime settings */
export const defaultRuntimeSettings: RuntimeSettings = {
  driver: RuntimeDriver.Process,
  resources: {
    max_cpu_percent: 50,
    max_memory_mb: 512,
    max_disk_mb: 1024,
    max_network_mbps: 10,
  },
  sandbox: {
    enabled: true,
    network_access: true,
    file_system_access: 'read_only',
    allowed_syscalls: [],
  },
  logging: {
    level: 'info',
    output: 'console',
    format: 'pretty',
    retention_days: 7,
  },
};
