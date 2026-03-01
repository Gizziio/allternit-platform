/**
 * Pool Manager Service
 * 
 * Ported from: 6-ui/shell-ui/src/views/runtime/prewarm.rs
 * 
 * Manages prewarm pools for runtime environments.
 */

import {
  PrewarmPoolManager,
  PoolStatus,
  PoolStats,
  PoolActivity,
  PoolHealth,
  PoolCreateForm,
  PoolResources,
  ActivityType,
  defaultPoolResources,
} from '@/types/runtime';

/** Pool manager options */
export interface PoolManagerOptions {
  apiBaseUrl: string;
  onPoolUpdate?: (pool: PoolStatus) => void;
  onActivity?: (activity: PoolActivity) => void;
}

/**
 * Pool Manager
 * 
 * Manages prewarm pool lifecycle and statistics.
 */
export class PoolManager {
  private state: PrewarmPoolManager;
  private options: PoolManagerOptions;

  constructor(options: PoolManagerOptions, initialState?: Partial<PrewarmPoolManager>) {
    this.options = options;
    this.state = {
      pools: [],
      selected_pool: undefined,
      stats: {
        total_pools: 0,
        total_instances: 0,
        total_available: 0,
        total_in_use: 0,
        total_warmups_performed: 0,
        total_reuses: 0,
        avg_warmup_time_ms: 0,
      },
      activity_log: [],
      ...initialState,
    };
  }

  /**
   * Calculate pool health
   * Ported from Rust logic
   */
  calculateHealth(pool: PoolStatus): PoolHealth {
    if (pool.available_count === 0) {
      return PoolHealth.Empty;
    }
    
    const ratio = pool.available_count / pool.pool_size;
    if (ratio < 0.2) {
      return PoolHealth.Degraded;
    }
    
    return PoolHealth.Healthy;
  }

  /**
   * Calculate global statistics
   * Ported from Rust aggregation logic
   */
  calculateStats(pools: PoolStatus[]): PoolStats {
    const totalPools = pools.length;
    const totalInstances = pools.reduce((sum, p) => 
      sum + p.available_count + p.in_use_count + p.warming_up_count, 0
    );
    const totalAvailable = pools.reduce((sum, p) => sum + p.available_count, 0);
    const totalInUse = pools.reduce((sum, p) => sum + p.in_use_count, 0);
    
    // Calculate average warmup time (would come from actual metrics)
    const avgWarmupTime = pools.length > 0
      ? pools.reduce((sum, p) => sum + this.estimateWarmupTime(p), 0) / pools.length
      : 0;

    return {
      total_pools: totalPools,
      total_instances: totalInstances,
      total_available: totalAvailable,
      total_in_use: totalInUse,
      total_warmups_performed: this.state.stats.total_warmups_performed,
      total_reuses: this.state.stats.total_reuses,
      avg_warmup_time_ms: Math.round(avgWarmupTime),
    };
  }

  /** Estimate warmup time based on pool image complexity */
  private estimateWarmupTime(pool: PoolStatus): number {
    // Simplified estimation - real impl would use historical data
    const baseTime = 5000; // 5 seconds base
    const imageMultiplier = pool.image.includes('large') ? 2 : 1;
    return baseTime * imageMultiplier;
  }

  /** Create a new pool */
  async createPool(form: PoolCreateForm): Promise<PoolStatus> {
    const response = await fetch(`${this.options.apiBaseUrl}/pools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      throw new Error(`Failed to create pool: ${response.statusText}`);
    }

    const pool: PoolStatus = await response.json();
    
    // Add to state
    this.state.pools.push(pool);
    this.state.stats = this.calculateStats(this.state.pools);
    
    // Log activity
    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: pool.name,
      activity_type: ActivityType.InstanceCreated,
      details: `Created pool with ${form.pool_size} instances`,
    });

    this.options.onPoolUpdate?.(pool);
    return pool;
  }

  /** Destroy a pool */
  async destroyPool(poolName: string): Promise<void> {
    const response = await fetch(`${this.options.apiBaseUrl}/pools/${poolName}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to destroy pool: ${response.statusText}`);
    }

    // Remove from state
    this.state.pools = this.state.pools.filter(p => p.name !== poolName);
    this.state.stats = this.calculateStats(this.state.pools);

    // Log activity
    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: poolName,
      activity_type: ActivityType.InstanceDestroyed,
      details: 'Pool destroyed',
    });
  }

  /** Trigger manual warmup for a pool */
  async warmupPool(poolName: string): Promise<void> {
    const pool = this.state.pools.find(p => p.name === poolName);
    if (!pool) {
      throw new Error(`Pool not found: ${poolName}`);
    }

    // Log warmup start
    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: poolName,
      activity_type: ActivityType.WarmupStarted,
      details: 'Manual warmup triggered',
    });

    const response = await fetch(`${this.options.apiBaseUrl}/pools/${poolName}/warmup`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to warmup pool: ${response.statusText}`);
    }

    // Update pool status
    pool.warming_up_count = pool.pool_size - pool.available_count - pool.in_use_count;
    pool.status = this.calculateHealth(pool);
    
    // Update stats
    this.state.stats.total_warmups_performed++;
    
    // Log warmup complete
    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: poolName,
      activity_type: ActivityType.WarmupCompleted,
      details: 'Warmup completed',
    });

    this.options.onPoolUpdate?.(pool);
  }

  /** Acquire an instance from a pool */
  async acquireInstance(poolName: string): Promise<string> {
    const pool = this.state.pools.find(p => p.name === poolName);
    if (!pool) {
      throw new Error(`Pool not found: ${poolName}`);
    }

    if (pool.available_count === 0) {
      throw new Error(`No available instances in pool: ${poolName}`);
    }

    const response = await fetch(`${this.options.apiBaseUrl}/pools/${poolName}/acquire`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to acquire instance: ${response.statusText}`);
    }

    const { instanceId } = await response.json();

    // Update pool state
    pool.available_count--;
    pool.in_use_count++;
    pool.last_activity = new Date().toISOString();
    pool.status = this.calculateHealth(pool);

    this.state.stats.total_reuses++;
    this.state.stats = this.calculateStats(this.state.pools);

    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: poolName,
      activity_type: ActivityType.InstanceAcquired,
      details: `Acquired instance ${instanceId}`,
    });

    this.options.onPoolUpdate?.(pool);
    return instanceId;
  }

  /** Release an instance back to a pool */
  async releaseInstance(poolName: string, instanceId: string): Promise<void> {
    const pool = this.state.pools.find(p => p.name === poolName);
    if (!pool) {
      throw new Error(`Pool not found: ${poolName}`);
    }

    await fetch(`${this.options.apiBaseUrl}/pools/${poolName}/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId }),
    });

    // Update pool state
    pool.in_use_count--;
    pool.available_count++;
    pool.last_activity = new Date().toISOString();
    pool.status = this.calculateHealth(pool);

    this.state.stats = this.calculateStats(this.state.pools);

    this.logActivity({
      timestamp: new Date().toISOString(),
      pool_name: poolName,
      activity_type: ActivityType.InstanceReleased,
      details: `Released instance ${instanceId}`,
    });

    this.options.onPoolUpdate?.(pool);
  }

  /** Refresh pool status from backend */
  async refreshPools(): Promise<void> {
    const response = await fetch(`${this.options.apiBaseUrl}/pools`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch pools: ${response.statusText}`);
    }

    const pools: PoolStatus[] = await response.json();
    
    // Recalculate health for each pool
    pools.forEach(pool => {
      pool.status = this.calculateHealth(pool);
    });

    this.state.pools = pools;
    this.state.stats = this.calculateStats(pools);
  }

  /** Get pool by name */
  getPool(name: string): PoolStatus | undefined {
    return this.state.pools.find(p => p.name === name);
  }

  /** Get all pools */
  getPools(): PoolStatus[] {
    return [...this.state.pools];
  }

  /** Get pools by health status */
  getPoolsByHealth(health: PoolHealth): PoolStatus[] {
    return this.state.pools.filter(p => p.status === health);
  }

  /** Get global statistics */
  getStats(): PoolStats {
    return { ...this.state.stats };
  }

  /** Get recent activity */
  getActivityLog(limit: number = 50): PoolActivity[] {
    return this.state.activity_log.slice(-limit);
  }

  /** Select a pool for detail view */
  selectPool(poolName: string | undefined): void {
    this.state.selected_pool = poolName;
  }

  /** Get selected pool */
  getSelectedPool(): PoolStatus | undefined {
    if (!this.state.selected_pool) return undefined;
    return this.getPool(this.state.selected_pool);
  }

  /** Log activity */
  private logActivity(activity: PoolActivity): void {
    this.state.activity_log.push(activity);
    // Keep only last 100 entries
    if (this.state.activity_log.length > 100) {
      this.state.activity_log.shift();
    }
    this.options.onActivity?.(activity);
  }

  /** Get the full state */
  getState(): PrewarmPoolManager {
    return { ...this.state };
  }
}

/** Create a pool manager */
export function createPoolManager(
  options: PoolManagerOptions,
  initialState?: Partial<PrewarmPoolManager>
): PoolManager {
  return new PoolManager(options, initialState);
}

/** Default pool creation form */
export function createDefaultPoolForm(name: string, image: string): PoolCreateForm {
  return {
    name,
    image,
    pool_size: 5,
    warmup_commands: [],
    idle_timeout_seconds: 3600,
    resources: { ...defaultPoolResources },
  };
}
