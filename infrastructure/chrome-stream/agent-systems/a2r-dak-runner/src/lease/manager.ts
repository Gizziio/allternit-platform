/**
 * Lease Manager
 * 
 * Manages lease lifecycle with automatic renewal.
 * Prevents lease expiration during long-running operations.
 */

import { EventEmitter } from 'events';
import { Lease, LeaseId } from '../types';

export interface LeaseManagerConfig {
  /**
   * Rails adapter for lease operations
   */
  railsAdapter: {
    renewLease: (leaseId: LeaseId, additionalSeconds: number) => Promise<boolean>;
    releaseLease: (leaseId: LeaseId) => Promise<boolean>;
  };

  /**
   * Renewal interval in milliseconds (default: 60000 = 1 minute)
   */
  renewalIntervalMs?: number;

  /**
   * Lease extension duration in seconds (default: 300 = 5 minutes)
   */
  extensionSeconds?: number;

  /**
   * Warning threshold - time before expiry to warn (default: 60000 = 1 minute)
   */
  warningThresholdMs?: number;

  /**
   * Max retry attempts for failed renewals (default: 3)
   */
  maxRetries?: number;

  /**
   * Enable auto-renewal (default: true)
   */
  autoRenewal?: boolean;
}

export interface ManagedLease extends Lease {
  /**
   * Unique identifier for this managed lease instance
   */
  managedId: string;

  /**
   * When the lease was acquired
   */
  acquiredAt: Date;

  /**
   * Last renewal timestamp
   */
  lastRenewedAt?: Date;

  /**
   * Number of renewals performed
   */
  renewalCount: number;

  /**
   * Current status
   */
  status: 'active' | 'renewing' | 'expired' | 'released' | 'failed';

  /**
   * Error message if renewal failed
   */
  lastError?: string;
}

export interface LeaseManagerEvents {
  'lease:acquired': (lease: ManagedLease) => void;
  'lease:renewed': (lease: ManagedLease) => void;
  'lease:released': (lease: ManagedLease) => void;
  'lease:expiring': (lease: ManagedLease, timeRemainingMs: number) => void;
  'lease:expired': (lease: ManagedLease) => void;
  'lease:failed': (lease: ManagedLease, error: Error) => void;
  'lease:warning': (lease: ManagedLease, message: string) => void;
}

export declare interface LeaseManager {
  on<E extends keyof LeaseManagerEvents>(event: E, listener: LeaseManagerEvents[E]): this;
  emit<E extends keyof LeaseManagerEvents>(event: E, ...args: Parameters<LeaseManagerEvents[E]>): boolean;
}

export class LeaseManager extends EventEmitter {
  private config: Required<LeaseManagerConfig>;
  private leases: Map<LeaseId, ManagedLease> = new Map();
  private renewalTimers: Map<LeaseId, NodeJS.Timeout> = new Map();
  private warningTimers: Map<LeaseId, NodeJS.Timeout> = new Map();
  private isShuttingDown = false;

  constructor(config: LeaseManagerConfig) {
    super();
    this.config = {
      renewalIntervalMs: 60000,
      extensionSeconds: 300,
      warningThresholdMs: 60000,
      maxRetries: 3,
      autoRenewal: true,
      ...config,
    };
  }

  /**
   * Register a lease for management
   */
  async acquireLease(lease: Lease): Promise<ManagedLease> {
    if (this.isShuttingDown) {
      throw new Error('LeaseManager is shutting down');
    }

    const managedId = `managed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(lease.expiresAt);

    // Check if lease is already expired
    if (expiresAt <= now) {
      throw new Error(`Lease ${lease.leaseId} is already expired`);
    }

    const managedLease: ManagedLease = {
      ...lease,
      managedId,
      acquiredAt: now,
      renewalCount: 0,
      status: 'active',
    };

    this.leases.set(lease.leaseId, managedLease);

    // Set up auto-renewal if enabled
    if (this.config.autoRenewal) {
      this.scheduleRenewal(lease.leaseId);
    }

    // Set up warning timer
    this.scheduleWarning(lease.leaseId);

    this.emit('lease:acquired', managedLease);

    return managedLease;
  }

  /**
   * Manually renew a lease
   */
  async renewLease(leaseId: LeaseId): Promise<boolean> {
    const lease = this.leases.get(leaseId);
    if (!lease) {
      throw new Error(`Lease ${leaseId} not found`);
    }

    if (lease.status === 'released' || lease.status === 'expired') {
      throw new Error(`Cannot renew lease ${leaseId}: status is ${lease.status}`);
    }

    lease.status = 'renewing';

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const success = await this.config.railsAdapter.renewLease(
          leaseId,
          this.config.extensionSeconds
        );

        if (success) {
          // Update lease expiry
          const newExpiresAt = new Date();
          newExpiresAt.setSeconds(newExpiresAt.getSeconds() + this.config.extensionSeconds);

          lease.expiresAt = newExpiresAt.toISOString();
          lease.lastRenewedAt = new Date();
          lease.renewalCount++;
          lease.status = 'active';
          lease.lastError = undefined;

          this.emit('lease:renewed', lease);

          // Reschedule renewal
          this.clearTimers(leaseId);
          this.scheduleRenewal(leaseId);
          this.scheduleWarning(leaseId);

          return true;
        } else {
          throw new Error('Rails returned unsuccessful renewal');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        lease.lastError = errorMessage;

        if (attempt < this.config.maxRetries) {
          // Wait before retry (exponential backoff)
          const delayMs = Math.pow(2, attempt) * 1000;
          await this.sleep(delayMs);
        } else {
          lease.status = 'failed';
          this.emit('lease:failed', lease, error instanceof Error ? error : new Error(errorMessage));
          return false;
        }
      }
    }

    return false;
  }

  /**
   * Release a lease
   */
  async releaseLease(leaseId: LeaseId): Promise<boolean> {
    const lease = this.leases.get(leaseId);
    if (!lease) {
      return false;
    }

    // Clear timers
    this.clearTimers(leaseId);

    try {
      const success = await this.config.railsAdapter.releaseLease(leaseId);

      if (success) {
        lease.status = 'released';
        this.emit('lease:released', lease);
        this.leases.delete(leaseId);
        return true;
      } else {
        this.emit('lease:warning', lease, 'Release returned unsuccessful');
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.emit('lease:warning', lease, `Release failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get a managed lease
   */
  getLease(leaseId: LeaseId): ManagedLease | undefined {
    return this.leases.get(leaseId);
  }

  /**
   * Get all managed leases
   */
  getAllLeases(): ManagedLease[] {
    return Array.from(this.leases.values());
  }

  /**
   * Get active leases
   */
  getActiveLeases(): ManagedLease[] {
    return this.getAllLeases().filter(l => l.status === 'active');
  }

  /**
   * Check if a lease is still valid
   */
  isLeaseValid(leaseId: LeaseId): boolean {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    if (lease.status !== 'active' && lease.status !== 'renewing') return false;

    const expiresAt = new Date(lease.expiresAt);
    return expiresAt > new Date();
  }

  /**
   * Get time remaining for a lease
   */
  getTimeRemaining(leaseId: LeaseId): number {
    const lease = this.leases.get(leaseId);
    if (!lease) return 0;

    const expiresAt = new Date(lease.expiresAt);
    const now = new Date();
    return Math.max(0, expiresAt.getTime() - now.getTime());
  }

  /**
   * Renew all active leases immediately
   */
  async renewAll(): Promise<Map<LeaseId, boolean>> {
    const results = new Map<LeaseId, boolean>();

    for (const leaseId of this.leases.keys()) {
      const lease = this.leases.get(leaseId);
      if (lease && lease.status === 'active') {
        results.set(leaseId, await this.renewLease(leaseId));
      }
    }

    return results;
  }

  /**
   * Release all leases
   */
  async releaseAll(): Promise<void> {
    const leaseIds = Array.from(this.leases.keys());

    for (const leaseId of leaseIds) {
      await this.releaseLease(leaseId);
    }
  }

  /**
   * Graceful shutdown - release all leases
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    // Clear all timers
    for (const leaseId of this.renewalTimers.keys()) {
      this.clearTimers(leaseId);
    }

    // Release all leases
    await this.releaseAll();

    // Remove all listeners
    this.removeAllListeners();
  }

  /**
   * Get manager statistics
   */
  getStats(): {
    totalLeases: number;
    activeLeases: number;
    renewingLeases: number;
    expiredLeases: number;
    releasedLeases: number;
    failedLeases: number;
    totalRenewals: number;
  } {
    const leases = this.getAllLeases();
    return {
      totalLeases: leases.length,
      activeLeases: leases.filter(l => l.status === 'active').length,
      renewingLeases: leases.filter(l => l.status === 'renewing').length,
      expiredLeases: leases.filter(l => l.status === 'expired').length,
      releasedLeases: leases.filter(l => l.status === 'released').length,
      failedLeases: leases.filter(l => l.status === 'failed').length,
      totalRenewals: leases.reduce((sum, l) => sum + l.renewalCount, 0),
    };
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private scheduleRenewal(leaseId: LeaseId): void {
    const timer = setInterval(async () => {
      const lease = this.leases.get(leaseId);
      if (!lease || lease.status !== 'active') {
        this.clearTimers(leaseId);
        return;
      }

      // Check if renewal is needed (if expiry is within 2x renewal interval)
      const timeRemaining = this.getTimeRemaining(leaseId);
      if (timeRemaining < this.config.renewalIntervalMs * 2) {
        await this.renewLease(leaseId);
      }
    }, this.config.renewalIntervalMs);

    this.renewalTimers.set(leaseId, timer);
  }

  private scheduleWarning(leaseId: LeaseId): void {
    const lease = this.leases.get(leaseId);
    if (!lease) return;

    const timeRemaining = this.getTimeRemaining(leaseId);
    const warningTime = timeRemaining - this.config.warningThresholdMs;

    if (warningTime > 0) {
      const timer = setTimeout(() => {
        const currentLease = this.leases.get(leaseId);
        if (currentLease && currentLease.status === 'active') {
          const remaining = this.getTimeRemaining(leaseId);
          this.emit('lease:expiring', currentLease, remaining);
        }
      }, warningTime);

      this.warningTimers.set(leaseId, timer);
    }
  }

  private clearTimers(leaseId: LeaseId): void {
    const renewalTimer = this.renewalTimers.get(leaseId);
    if (renewalTimer) {
      clearInterval(renewalTimer);
      this.renewalTimers.delete(leaseId);
    }

    const warningTimer = this.warningTimers.get(leaseId);
    if (warningTimer) {
      clearTimeout(warningTimer);
      this.warningTimers.delete(leaseId);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createLeaseManager(config: LeaseManagerConfig): LeaseManager {
  return new LeaseManager(config);
}
