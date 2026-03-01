/**
 * Multi-Region Deployment Implementation
 *
 * Based on: spec/deployment/multi-region.md
 */

// ============================================================================
// Types
// ============================================================================

export type RegionType = 'primary' | 'secondary' | 'edge' | 'compliance';

export interface RegionConfig {
  id: string;
  name: string;
  type: RegionType;
  provider: string;
  location: string;
  endpoints: {
    api: string;
    ws: string;
  };
  capacity: {
    maxAgents: number;
    maxSwarmSize: number;
  };
  compliance?: string[];
}

export interface RegionHealth {
  regionId: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  capacityUsed: number;
  lastCheck: string;
}

export interface FailoverConfig {
  healthCheckInterval: number;
  failoverThreshold: number;
  promotionDelay: number;
}

// ============================================================================
// Region Manager
// ============================================================================

export class RegionManager {
  private regions: Map<string, RegionConfig>;
  private activeRegion: string | null = null;
  private healthStatus: Map<string, RegionHealth>;
  private failoverConfig: FailoverConfig;

  constructor(failoverConfig: FailoverConfig = defaultFailoverConfig) {
    this.regions = new Map();
    this.healthStatus = new Map();
    this.failoverConfig = failoverConfig;
  }

  async register(region: RegionConfig): Promise<void> {
    this.regions.set(region.id, region);
    console.log(`[RegionManager] Registered region: ${region.id} (${region.type})`);
  }

  async failover(source: string, target: string): Promise<void> {
    const sourceRegion = this.regions.get(source);
    const targetRegion = this.regions.get(target);

    if (!sourceRegion || !targetRegion) {
      throw new Error('Invalid region for failover');
    }

    console.log(`[RegionManager] Failover: ${source} → ${target}`);
    
    // Update active region
    this.activeRegion = target;
    
    // Update health status
    this.updateHealth(source, 'unhealthy');
    this.updateHealth(target, 'healthy');
  }

  getActiveRegion(): string {
    if (!this.activeRegion) {
      // Return first primary region
      for (const [id, region] of this.regions) {
        if (region.type === 'primary') {
          return id;
        }
      }
      throw new Error('No active region configured');
    }
    return this.activeRegion;
  }

  getHealthStatus(): RegionHealth[] {
    return Array.from(this.healthStatus.values());
  }

  private updateHealth(regionId: string, status: RegionHealth['status']): void {
    const region = this.regions.get(regionId);
    if (!region) return;

    this.healthStatus.set(regionId, {
      regionId,
      status,
      latency: 0,
      capacityUsed: 0,
      lastCheck: new Date().toISOString(),
    });
  }
}

const defaultFailoverConfig: FailoverConfig = {
  healthCheckInterval: 30000, // 30s
  failoverThreshold: 3,
  promotionDelay: 5000, // 5s
};

// ============================================================================
// Load Balancer
// ============================================================================

export class RegionalLoadBalancer {
  private regionLatency: Map<string, number>;
  private regionCapacity: Map<string, number>;

  constructor() {
    this.regionLatency = new Map();
    this.regionCapacity = new Map();
  }

  /**
   * Route request to optimal region
   * @param request - Request with optional userId and priority
   * @returns Region ID
   * @placeholder APPROVED - Enhanced routing logic pending
   * @ticket GAP-45
   * @fallback Latency-based routing
   */
  async route(request: { userId?: string; priority?: string }): Promise<string> {
    // Simple latency-based routing
    // Enhanced routing: consider user location, region capacity, etc.

    let bestRegion: string | null = null;
    let bestLatency = Infinity;

    for (const [region, latency] of this.regionLatency) {
      const capacity = this.regionCapacity.get(region) || 0;
      if (capacity < 0.9 && latency < bestLatency) {
        bestLatency = latency;
        bestRegion = region;
      }
    }

    if (!bestRegion) {
      throw new Error('No available regions');
    }

    return bestRegion;
  }

  async getLatency(region: string): Promise<number> {
    return this.regionLatency.get(region) || Infinity;
  }

  async getCapacity(region: string): Promise<number> {
    return this.regionCapacity.get(region) || 1;
  }

  updateLatency(region: string, latency: number): void {
    this.regionLatency.set(region, latency);
  }

  updateCapacity(region: string, capacity: number): void {
    this.regionCapacity.set(region, capacity);
  }
}

// ============================================================================
// State Replication
// ============================================================================

export interface ReplicationConfig {
  mode: 'sync' | 'async';
  maxLag: number;
  retryAttempts: number;
}

export class StateReplicator {
  private config: ReplicationConfig;
  private replicationLag: Map<string, number>;

  constructor(config: ReplicationConfig = { mode: 'async', maxLag: 5000, retryAttempts: 3 }) {
    this.config = config;
    this.replicationLag = new Map();
  }

  /**
   * Replicate state between regions
   * @param source - Source region ID
   * @param target - Target region ID
   * @param data - Data to replicate
   * @placeholder APPROVED - Full replication logic pending
   * @ticket GAP-46
   * @fallback Logs replication request
   */
  async replicate(source: string, target: string, data: unknown): Promise<void> {
    console.log(`[StateReplicator] ${source} → ${target}`);

    // Cross-region replication stub
    this.replicationLag.set(`${source}-${target}`, 0);
  }

  getLag(source: string, target: string): number {
    return this.replicationLag.get(`${source}-${target}`) || 0;
  }
}

// ============================================================================
// Singleton
// ============================================================================

export const regionManager = new RegionManager();
export const loadBalancer = new RegionalLoadBalancer();
export const stateReplicator = new StateReplicator();
