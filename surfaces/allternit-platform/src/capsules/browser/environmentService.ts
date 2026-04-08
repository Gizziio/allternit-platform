/**
 * Environment Service - Runtime Target Management
 * 
 * Implements environment switching between:
 * - Cloud (hosted)
 * - BYOC VPS (customer infrastructure)
 * - Hybrid (cloud + VPS)
 * 
 * Integrates with 8-cloud crates:
 * - allternit-cloud-core
 * - allternit-cloud-api
 * - allternit-cloud-deploy
 */

import { v4 as uuidv4 } from 'uuid';
import { getAuditTrailService } from './auditTrailService';
import { getRedisClient } from '@/lib/redis/client';

// ============================================================================
// Types
// ============================================================================

export type EnvironmentType = 'cloud' | 'byoc-vps' | 'hybrid';

export type EnvironmentStatus = 'active' | 'inactive' | 'degraded' | 'provisioning';

export interface EnvironmentTarget {
  id: string;
  type: EnvironmentType;
  name: string;
  description: string;
  status: EnvironmentStatus;
  region?: string;
  instances?: number;
  cpuUsage?: number;
  memoryUsage?: number;
  createdAt: string;
  updatedAt: string;
}

export interface EnvironmentConfig {
  currentEnvironment: EnvironmentType;
  autoSwitch: boolean;
  fallbackEnvironment: EnvironmentType;
}

// ============================================================================
// Environment Store Interface
// ============================================================================

export interface EnvironmentStore {
  // Targets
  getTargets(): Promise<EnvironmentTarget[]>;
  getTarget(id: string): Promise<EnvironmentTarget | null>;
  addTarget(target: Omit<EnvironmentTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvironmentTarget>;
  updateTarget(id: string, updates: Partial<EnvironmentTarget>): Promise<void>;
  removeTarget(id: string): Promise<void>;

  // Configuration
  getConfig(): Promise<EnvironmentConfig>;
  setConfig(config: EnvironmentConfig): Promise<void>;

  // Status
  updateStatus(id: string, status: EnvironmentStatus, metrics?: { cpuUsage?: number; memoryUsage?: number }): Promise<void>;
}

// ============================================================================
// In-Memory Store (for development)
// TODO: Replace with 8-cloud integration for production
// ============================================================================

export class InMemoryEnvironmentStore implements EnvironmentStore {
  private targets: Map<string, EnvironmentTarget> = new Map();
  private config: EnvironmentConfig = {
    currentEnvironment: 'cloud',
    autoSwitch: false,
    fallbackEnvironment: 'cloud',
  };

  constructor() {
    // Initialize with default targets
    this.targets.set('cloud-default', {
      id: 'cloud-default',
      type: 'cloud',
      name: 'Allternit Cloud',
      description: 'Hosted execution plane',
      status: 'active',
      region: 'us-east-1',
      instances: 3,
      cpuUsage: 45,
      memoryUsage: 62,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.targets.set('byoc-default', {
      id: 'byoc-default',
      type: 'byoc-vps',
      name: 'BYOC VPS',
      description: 'Your infrastructure',
      status: 'inactive',
      region: 'Custom',
      instances: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    this.targets.set('hybrid-default', {
      id: 'hybrid-default',
      type: 'hybrid',
      name: 'Hybrid',
      description: 'Cloud + VPS combined',
      status: 'inactive',
      region: 'Multi-region',
      instances: 3,
      cpuUsage: 52,
      memoryUsage: 68,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async getTargets(): Promise<EnvironmentTarget[]> {
    return Array.from(this.targets.values());
  }

  async getTarget(id: string): Promise<EnvironmentTarget | null> {
    return this.targets.get(id) || null;
  }

  async addTarget(target: Omit<EnvironmentTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<EnvironmentTarget> {
    const newTarget: EnvironmentTarget = {
      ...target,
      id: 'env_' + uuidv4().slice(0, 8),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.targets.set(newTarget.id, newTarget);
    return newTarget;
  }

  async updateTarget(id: string, updates: Partial<EnvironmentTarget>): Promise<void> {
    const target = this.targets.get(id);
    if (!target) throw new Error(`Target ${id} not found`);

    const updated = {
      ...target,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    this.targets.set(id, updated);
  }

  async removeTarget(id: string): Promise<void> {
    this.targets.delete(id);
  }

  async getConfig(): Promise<EnvironmentConfig> {
    return { ...this.config };
  }

  async setConfig(config: EnvironmentConfig): Promise<void> {
    this.config = { ...config };
  }

  async updateStatus(
    id: string,
    status: EnvironmentStatus,
    metrics?: { cpuUsage?: number; memoryUsage?: number }
  ): Promise<void> {
    const target = this.targets.get(id);
    if (!target) throw new Error(`Target ${id} not found`);

    const updated = {
      ...target,
      status,
      ...(metrics?.cpuUsage !== undefined && { cpuUsage: metrics.cpuUsage }),
      ...(metrics?.memoryUsage !== undefined && { memoryUsage: metrics.memoryUsage }),
      updatedAt: new Date().toISOString(),
    };
    this.targets.set(id, updated);
  }
}

// ============================================================================
// Environment Manager
// ============================================================================

export class EnvironmentManager {
  private store: EnvironmentStore;

  constructor(store: EnvironmentStore) {
    this.store = store;
  }

  /**
   * Get current environment
   */
  async getCurrentEnvironment(): Promise<EnvironmentType> {
    const config = await this.store.getConfig();
    return config.currentEnvironment;
  }

  /**
   * Switch to different environment
   */
  async switchEnvironment(type: EnvironmentType): Promise<void> {
    const config = await this.store.getConfig();
    const audit = getAuditTrailService();

    if (config.currentEnvironment === type) {
      return;  // Already on this environment
    }

    // Update config
    await this.store.setConfig({
      ...config,
      currentEnvironment: type,
    });

    // Update target status
    const targets = await this.store.getTargets();
    for (const target of targets) {
      if (target.type === type) {
        await this.store.updateStatus(target.id, 'active');
      } else if (target.type === config.currentEnvironment) {
        await this.store.updateStatus(target.id, 'inactive');
      }
    }

    // Log audit event
    await audit.recordEnvironmentChange({
      action: 'switch',
      from_env: config.currentEnvironment,
      to_env: type,
    });
  }

  /**
   * Get all available environments
   */
  async getEnvironments(): Promise<EnvironmentTarget[]> {
    return this.store.getTargets();
  }

  /**
   * Get environment health metrics
   */
  async getEnvironmentHealth(type: EnvironmentType): Promise<{
    status: EnvironmentStatus;
    cpuUsage?: number;
    memoryUsage?: number;
    instances?: number;
  } | null> {
    const targets = await this.store.getTargets();
    const target = targets.find(t => t.type === type);

    if (!target) return null;

    return {
      status: target.status,
      cpuUsage: target.cpuUsage,
      memoryUsage: target.memoryUsage,
      instances: target.instances,
    };
  }

  /**
   * Auto-switch environment based on health
   */
  async autoSwitchIfNeeded(): Promise<void> {
    const config = await this.store.getConfig();
    
    if (!config.autoSwitch) {
      return;  // Auto-switch disabled
    }

    const currentHealth = await this.getEnvironmentHealth(config.currentEnvironment);
    
    if (currentHealth?.status === 'degraded' || currentHealth?.status === 'inactive') {
      // Switch to fallback
      await this.switchEnvironment(config.fallbackEnvironment);
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let _environmentStore: EnvironmentStore | null = null;
let _environmentManager: EnvironmentManager | null = null;

export function getEnvironmentStore(): EnvironmentStore {
  if (!_environmentStore) {
    const redis = getRedisClient();
    if (redis) {
      // Lazy import to avoid circular deps at module load time
      const { RedisEnvironmentStore } = require('./redisStores') as typeof import('./redisStores');
      _environmentStore = new RedisEnvironmentStore(redis);
    } else {
      _environmentStore = new InMemoryEnvironmentStore();
    }
  }
  return _environmentStore;
}

export function getEnvironmentManager(): EnvironmentManager {
  if (!_environmentManager) {
    _environmentManager = new EnvironmentManager(getEnvironmentStore());
  }
  return _environmentManager;
}
