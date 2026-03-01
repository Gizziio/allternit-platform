/**
 * Budget Calculator Service
 * 
 * Ported from: 6-ui/shell-ui/src/views/runtime/budget.rs
 * 
 * Provides budget metering calculations and statistics.
 */

import {
  BudgetDashboard,
  TenantQuota,
  UsageSummary,
  MeasurementEntry,
  BudgetAlert,
  QuotaForm,
  FormattedUsageStats,
  AlertLevel,
  defaultQuotaForm,
} from '@/types/runtime';

/** Budget percentage calculations */
export interface BudgetPercentages {
  cpu: number;
  memory: number;
  network: number;
  workers: number;
}

/**
 * Budget Calculator
 * 
 * Performs budget calculations ported from Rust implementation.
 */
export class BudgetCalculator {
  private dashboard: BudgetDashboard;

  constructor(dashboard?: Partial<BudgetDashboard>) {
    this.dashboard = {
      quotas: [],
      usage_summary: {
        total_cpu_seconds_used: 0,
        total_memory_mb_seconds_used: 0,
        total_network_bytes_used: 0,
        current_active_workers: 0,
        peak_workers: 0,
      },
      recent_measurements: [],
      alerts: [],
      ...dashboard,
    };
  }

  /** Add a tenant quota */
  addQuota(quota: TenantQuota): void {
    this.dashboard.quotas.push(quota);
  }

  /** Update usage summary */
  updateUsage(usage: UsageSummary): void {
    this.dashboard.usage_summary = usage;
  }

  /** Add measurement entry */
  addMeasurement(measurement: MeasurementEntry): void {
    this.dashboard.recent_measurements.push(measurement);
    // Keep only last 100 measurements (from Rust)
    if (this.dashboard.recent_measurements.length > 100) {
      this.dashboard.recent_measurements.shift();
    }
  }

  /** Add budget alert */
  addAlert(alert: BudgetAlert): void {
    this.dashboard.alerts.push(alert);
    // Keep only last 50 alerts (from Rust)
    if (this.dashboard.alerts.length > 50) {
      this.dashboard.alerts.shift();
    }
  }

  /**
   * Calculate CPU usage percentage for a tenant
   * Ported from: budget.rs cpu_usage_percent()
   */
  cpuUsagePercent(tenantId: string): number | null {
    const quota = this.dashboard.quotas.find(q => q.tenant_id === tenantId);
    if (!quota || quota.cpu_seconds_limit === 0) {
      return null;
    }

    // Simplified calculation - in real impl would track per-tenant usage
    const used = this.dashboard.usage_summary.total_cpu_seconds_used;
    return (used / quota.cpu_seconds_limit) * 100;
  }

  /**
   * Calculate memory usage percentage for a tenant
   * Ported from: budget.rs memory_usage_percent()
   */
  memoryUsagePercent(tenantId: string): number | null {
    const quota = this.dashboard.quotas.find(q => q.tenant_id === tenantId);
    if (!quota || quota.memory_mb_seconds_limit === 0) {
      return null;
    }

    const used = this.dashboard.usage_summary.total_memory_mb_seconds_used;
    return (used / quota.memory_mb_seconds_limit) * 100;
  }

  /**
   * Calculate all percentages for a tenant
   */
  calculatePercentages(tenantId: string, usage: UsageSummary): BudgetPercentages | null {
    const quota = this.dashboard.quotas.find(q => q.tenant_id === tenantId);
    if (!quota) return null;

    return {
      cpu: quota.cpu_seconds_limit > 0 
        ? Math.min(100, (usage.total_cpu_seconds_used / quota.cpu_seconds_limit) * 100)
        : 0,
      memory: quota.memory_mb_seconds_limit > 0
        ? Math.min(100, (usage.total_memory_mb_seconds_used / quota.memory_mb_seconds_limit) * 100)
        : 0,
      network: quota.network_bytes_limit > 0
        ? Math.min(100, (usage.total_network_bytes_used / quota.network_bytes_limit) * 100)
        : 0,
      workers: quota.max_concurrent_workers > 0
        ? Math.min(100, (usage.current_active_workers / quota.max_concurrent_workers) * 100)
        : 0,
    };
  }

  /**
   * Get formatted usage statistics
   * Ported from: budget.rs get_stats()
   */
  getStats(): FormattedUsageStats {
    const usage = this.dashboard.usage_summary;
    
    return {
      total_cpu_hours: (usage.total_cpu_seconds_used / 3600).toFixed(2),
      total_memory_gb_hours: (usage.total_memory_mb_seconds_used / 3600 / 1024).toFixed(2),
      network_gb: (usage.total_network_bytes_used / 1_073_741_824).toFixed(2),
      active_workers: usage.current_active_workers.toString(),
    };
  }

  /**
   * Get total usage across all tenants
   */
  getTotalUsage(): UsageSummary {
    // In a real implementation, this would aggregate per-tenant usage
    // For now, return the summary
    return { ...this.dashboard.usage_summary };
  }

  /**
   * Check if any quotas are exceeded
   */
  checkQuotaExceeded(tenantId: string): AlertLevel | null {
    const cpuPercent = this.cpuUsagePercent(tenantId);
    const memoryPercent = this.memoryUsagePercent(tenantId);

    if (cpuPercent === null || memoryPercent === null) {
      return null;
    }

    if (cpuPercent >= 100 || memoryPercent >= 100) {
      return AlertLevel.Critical;
    }
    if (cpuPercent >= 80 || memoryPercent >= 80) {
      return AlertLevel.Warning;
    }
    return null;
  }

  /**
   * Get active alerts for a tenant
   */
  getAlertsForTenant(tenantId: string): BudgetAlert[] {
    return this.dashboard.alerts.filter(a => a.tenant_id === tenantId);
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): BudgetAlert[] {
    return this.dashboard.alerts.filter(a => a.level === AlertLevel.Critical);
  }

  /**
   * Create a new quota from form data
   */
  createQuotaFromForm(form: QuotaForm): TenantQuota {
    const now = new Date();
    const validUntil = form.valid_days 
      ? new Date(now.getTime() + form.valid_days * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    return {
      tenant_id: form.tenant_id,
      quota_id: `quota-${Date.now()}`,
      cpu_seconds_limit: form.cpu_seconds_limit,
      memory_mb_seconds_limit: form.memory_mb_seconds_limit,
      network_bytes_limit: form.network_bytes_limit,
      max_concurrent_workers: form.max_concurrent_workers,
      valid_until: validUntil,
    };
  }

  /** Get the dashboard state */
  getDashboard(): BudgetDashboard {
    return { ...this.dashboard };
  }

  /** Get quotas */
  getQuotas(): TenantQuota[] {
    return [...this.dashboard.quotas];
  }

  /** Get recent measurements */
  getRecentMeasurements(): MeasurementEntry[] {
    return [...this.dashboard.recent_measurements];
  }
}

/** Create a budget calculator */
export function createBudgetCalculator(dashboard?: Partial<BudgetDashboard>): BudgetCalculator {
  return new BudgetCalculator(dashboard);
}

/** Calculate budget percentages helper */
export function calculateBudgetPercentages(
  quota: TenantQuota,
  usage: UsageSummary
): BudgetPercentages {
  return {
    cpu: quota.cpu_seconds_limit > 0 
      ? Math.min(100, (usage.total_cpu_seconds_used / quota.cpu_seconds_limit) * 100)
      : 0,
    memory: quota.memory_mb_seconds_limit > 0
      ? Math.min(100, (usage.total_memory_mb_seconds_used / quota.memory_mb_seconds_limit) * 100)
      : 0,
    network: quota.network_bytes_limit > 0
      ? Math.min(100, (usage.total_network_bytes_used / quota.network_bytes_limit) * 100)
      : 0,
    workers: quota.max_concurrent_workers > 0
      ? Math.min(100, (usage.current_active_workers / quota.max_concurrent_workers) * 100)
      : 0,
  };
}

/** Format bytes to human readable */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/** Format seconds to hours */
export function formatHours(seconds: number): string {
  return (seconds / 3600).toFixed(2);
}

export { defaultQuotaForm };
