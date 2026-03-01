/**
 * Lease Auto-Renew Supervisor
 *
 * Implements SYSTEM_LAW.md LAW-AUT-003 (Lease Continuity Rule)
 * 
 * Requirements:
 * - Renew at T-60 seconds before expiry
 * - Background renewer runs continuously during execution
 * - Hard fail to "paused" state if renew denied
 * - Emit lease renewal receipts for audit trail
 */

import { EventEmitter } from 'events';
import { RailsHttpAdapter } from '../adapters/rails_http';
import { Lease, LeaseId, ReceiptId } from '../types';

export interface LeaseRenewConfig {
  renewThresholdSeconds: number;  // Renew when lease has this many seconds remaining
  renewExtendSeconds: number;      // Extend lease by this many seconds
  checkIntervalMs: number;         // Check leases every X milliseconds
  maxRetries: number;              // Max retries before giving up
}

export interface LeaseRenewEvent {
  leaseId: LeaseId;
  previousExpiry: string;
  newExpiry: string;
  renewedAt: string;
  receiptId: ReceiptId;
}

export interface LeaseExpiredEvent {
  leaseId: LeaseId;
  expiredAt: string;
  reason: string;
}

export class LeaseRenewSupervisor extends EventEmitter {
  private rails: RailsHttpAdapter;
  private config: LeaseRenewConfig;
  private activeLeases: Map<LeaseId, Lease>;
  private renewTimers: Map<LeaseId, NodeJS.Timeout>;
  private running: boolean;

  constructor(
    rails: RailsHttpAdapter,
    config: LeaseRenewConfig = {
      renewThresholdSeconds: 60,
      renewExtendSeconds: 300,  // 5 minutes
      checkIntervalMs: 10000,    // Check every 10 seconds
      maxRetries: 3,
    }
  ) {
    super();
    this.rails = rails;
    this.config = config;
    this.activeLeases = new Map();
    this.renewTimers = new Map();
    this.running = false;
  }

  /**
   * Start the lease renew supervisor
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.emit('supervisor:started');

    // Start periodic lease check
    this.startPeriodicCheck();
  }

  /**
   * Stop the lease renew supervisor
   */
  stop(): void {
    this.running = false;

    // Clear all timers
    for (const timer of this.renewTimers.values()) {
      clearInterval(timer);
    }
    this.renewTimers.clear();

    this.emit('supervisor:stopped');
  }

  /**
   * Register a lease for auto-renewal
   */
  async registerLease(lease: Lease): Promise<void> {
    this.activeLeases.set(lease.leaseId, lease);
    this.emit('lease:registered', { leaseId: lease.leaseId });

    // Schedule renewal if needed
    this.scheduleRenew(lease);
  }

  /**
   * Unregister a lease (no longer needs renewal)
   */
  unregisterLease(leaseId: LeaseId): void {
    this.activeLeases.delete(leaseId);

    // Clear renewal timer
    const timer = this.renewTimers.get(leaseId);
    if (timer) {
      clearTimeout(timer);
      this.renewTimers.delete(leaseId);
    }

    this.emit('lease:unregistered', { leaseId });
  }

  /**
   * Manually renew a lease immediately
   */
  async renewLeaseNow(leaseId: LeaseId): Promise<Lease | null> {
    const lease = this.activeLeases.get(leaseId);
    if (!lease) {
      this.emit('renew:error', {
        leaseId,
        error: 'Lease not registered',
      });
      return null;
    }

    try {
      const renewedLease = await this.rails.renewLease(
        leaseId,
        this.config.renewExtendSeconds
      );

      // Update active lease
      this.activeLeases.set(leaseId, renewedLease);

      // Emit renewal event
      const event: LeaseRenewEvent = {
        leaseId,
        previousExpiry: lease.expiresAt,
        newExpiry: renewedLease.expiresAt,
        renewedAt: new Date().toISOString(),
        receiptId: `rcpt_lease_renew_${Date.now()}`,
      };

      this.emit('lease:renewed', event);
      return renewedLease;
    } catch (error) {
      this.emit('renew:error', {
        leaseId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Hard fail - pause execution
      this.emit('lease:expired', {
        leaseId,
        expiredAt: new Date().toISOString(),
        reason: 'Renewal denied',
      } as LeaseExpiredEvent);

      return null;
    }
  }

  /**
   * Check if a lease needs renewal
   */
  needsRenewal(lease: Lease): boolean {
    const now = new Date();
    const expiry = new Date(lease.expiresAt);
    const timeRemaining = expiry.getTime() - now.getTime();
    const thresholdMs = this.config.renewThresholdSeconds * 1000;

    return timeRemaining < thresholdMs;
  }

  /**
   * Schedule renewal for a lease
   */
  private scheduleRenew(lease: Lease): void {
    // Clear existing timer
    const existingTimer = this.renewTimers.get(lease.leaseId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Calculate when to renew
    const now = new Date();
    const expiry = new Date(lease.expiresAt);
    const timeRemaining = expiry.getTime() - now.getTime();
    const renewTime = timeRemaining - (this.config.renewThresholdSeconds * 1000);

    if (renewTime > 0) {
      // Schedule renewal
      const timer = setTimeout(() => {
        this.renewLeaseNow(lease.leaseId);
      }, renewTime);

      this.renewTimers.set(lease.leaseId, timer);
    } else {
      // Already needs renewal - renew now
      this.renewLeaseNow(lease.leaseId);
    }
  }

  /**
   * Periodic check for leases needing renewal
   */
  private startPeriodicCheck(): void {
    const checkInterval = setInterval(() => {
      if (!this.running) {
        return;
      }

      // Check all active leases
      for (const lease of this.activeLeases.values()) {
        if (this.needsRenewal(lease)) {
          this.renewLeaseNow(lease.leaseId);
        }
      }
    }, this.config.checkIntervalMs);

    // Store interval for cleanup
    this.renewTimers.set('__periodic_check__' as unknown as LeaseId, checkInterval);
  }

  /**
   * Get all active leases
   */
  getActiveLeases(): Lease[] {
    return Array.from(this.activeLeases.values());
  }

  /**
   * Get lease by ID
   */
  getLease(leaseId: LeaseId): Lease | undefined {
    return this.activeLeases.get(leaseId);
  }
}

// Factory function
export function createLeaseRenewSupervisor(
  rails: RailsHttpAdapter,
  config?: LeaseRenewConfig
): LeaseRenewSupervisor {
  return new LeaseRenewSupervisor(rails, config);
}
