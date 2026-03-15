/**
 * Performance Optimization Implementation
 * 
 * Implements performance optimizations including caching mechanisms,
 * memory usage optimization, and resource pooling.
 */

import { ExecutionEngine } from './execution-engine.js';
import { ToolExecutor } from './tool-executor.js';
import { FileOperations } from './file-operations.js';

export interface CacheConfig {
  maxSize: number;
  ttlMs: number;
  enableCompression?: boolean;
}

export interface PerformanceMetric {
  executionTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  resourceUtilization: number;
  timestamp: number;
}

export interface ResourcePool<T> {
  acquire(): Promise<T>;
  release(resource: T): void;
  destroy(): Promise<void>;
}

export interface ResourcePoolConfig {
  name: string;
  factory: () => Promise<any>;
  destroyer: (resource: any) => void;
  validator?: (resource: any) => boolean;
  maxSize?: number;
}

export class PerformanceOptimizer {
  private cache: Map<string, { data: any; expiry: number; size: number }> = new Map();
  private metrics: PerformanceMetric[] = [];
  private maxMetricsHistory: number = 1000;
  private resourcePools: Map<string, any> = new Map();
  private executionEngine: ExecutionEngine;
  private toolExecutor: ToolExecutor;
  private fileOperations: FileOperations;
  private cacheConfig: { maxSize: number; ttlMs: number };

  constructor(
    executionEngine: ExecutionEngine,
    toolExecutor: ToolExecutor,
    fileOperations: FileOperations,
    cacheConfig: { maxSize: number; ttlMs: number } = { maxSize: 1000, ttlMs: 300000 } // 5 min TTL, 1000 items
  ) {
    this.executionEngine = executionEngine;
    this.toolExecutor = toolExecutor;
    this.fileOperations = fileOperations;
    this.cacheConfig = cacheConfig;
  }

  /**
   * Execute with caching for repeated operations
   */
  async executeWithCache<T>(
    key: string,
    operation: () => Promise<T>,
    cacheable: boolean = true
  ): Promise<T> {
    if (!cacheable) {
      return await operation();
    }

    // Check if result is in cache
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      // Update metrics for cache hit
      this.recordMetric({ 
        executionTime: 0, 
        memoryUsage: this.getMemoryUsage(), 
        cacheHitRate: this.calculateCacheHitRate(), 
        resourceUtilization: this.getResourceUtilization(),
        timestamp: Date.now()
      });
      return cached.data as T;
    }

    // Execute operation
    const startTime = Date.now();
    const result = await operation();
    const executionTime = Date.now() - startTime;

    // Store in cache if it fits within size limits
    if (this.cache.size < this.cacheConfig.maxSize) {
      this.cache.set(key, {
        data: result,
        expiry: Date.now() + this.cacheConfig.ttlMs,
        size: JSON.stringify(result).length
      });
    }

    // Update metrics
    this.recordMetric({
      executionTime,
      memoryUsage: this.getMemoryUsage(),
      cacheHitRate: this.calculateCacheHitRate(),
      resourceUtilization: this.getResourceUtilization(),
      timestamp: Date.now()
    });

    return result;
  }

  /**
   * Create a resource pool for efficient resource management
   */
  createResourcePool<T>(
    name: string,
    factory: () => Promise<T>,
    destroyer: (resource: T) => void,
    validator: (resource: T) => boolean = () => true,
    maxSize: number = 10
  ): ResourcePool<T> {
    const pool: T[] = [];
    const pendingAcquires: Array<(resource: T) => void> = [];
    let poolSize = 0;

    const resourcePool: ResourcePool<T> = {
      async acquire(): Promise<T> {
        if (pool.length > 0) {
          const resource = pool.pop()!;
          if (validator(resource)) {
            poolSize--;
            return resource;
          } else {
            // Resource is invalid, destroy and try again
            destroyer(resource);
            poolSize--;
            return this.acquire();
          }
        } else if (poolSize < maxSize) {
          const resource = await factory();
          poolSize++;
          return resource;
        } else {
          // Pool exhausted, wait for resource to be released
          return new Promise((resolve) => {
            pendingAcquires.push(resolve);
          });
        }
      },

      release(resource: T): void {
        if (pool.length < maxSize && validator(resource)) {
          pool.push(resource);
        } else {
          destroyer(resource);
          poolSize--;
        }

        // If there are pending acquires, fulfill the next one
        if (pendingAcquires.length > 0 && pool.length > 0) {
          const resolve = pendingAcquires.shift()!;
          const resource = pool.pop()!;
          poolSize--;
          resolve(resource);
        }
      },

      async destroy(): Promise<void> {
        for (const resource of pool) {
          destroyer(resource);
        }
        pool.length = 0;
        poolSize = 0;
        
        // Resolve any pending acquires with new resources
        for (const resolve of pendingAcquires) {
          const resource = await factory();
          resolve(resource);
        }
        pendingAcquires.length = 0;
      }
    };

    this.resourcePools.set(name, resourcePool);
    return resourcePool;
  }

  /**
   * Get a resource pool by name
   */
  getResourcePool<T>(name: string): ResourcePool<T> | undefined {
    return this.resourcePools.get(name) as ResourcePool<T>;
  }

  /**
   * Optimize memory usage by cleaning up expired cache entries
   */
  optimizeMemory(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiry) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
    }
  }

  /**
   * Get current memory usage estimate
   */
  private getMemoryUsage(): number {
    let size = 0;
    for (const value of this.cache.values()) {
      size += value.size;
    }
    return size;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    if (this.metrics.length === 0) return 0;
    
    const recentMetrics = this.metrics.slice(-100); // Last 100 metrics
    const cacheHits = recentMetrics.filter(m => m.executionTime === 0).length;
    return cacheHits / recentMetrics.length;
  }

  /**
   * Get resource utilization
   */
  private getResourceUtilization(): number {
    // Simplified calculation - in a real implementation, this would track actual resource usage
    return Math.min(1, this.resourcePools.size / 10); // Assuming 10 as max theoretical pools
  }

  /**
   * Record performance metric
   */
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics to prevent memory bloat
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    avgExecutionTime: number;
    avgMemoryUsage: number;
    cacheHitRate: number;
    resourceUtilization: number;
    peakMemoryUsage: number;
    minExecutionTime: number;
    maxExecutionTime: number;
  } {
    if (this.metrics.length === 0) {
      return {
        avgExecutionTime: 0,
        avgMemoryUsage: 0,
        cacheHitRate: 0,
        resourceUtilization: 0,
        peakMemoryUsage: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0
      };
    }

    const executionTimes = this.metrics.map(m => m.executionTime).filter(time => time > 0);
    const memoryUsages = this.metrics.map(m => m.memoryUsage);
    const resourceUtilizations = this.metrics.map(m => m.resourceUtilization);

    const avgExecutionTime = executionTimes.length > 0 
      ? executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length 
      : 0;
    
    const avgMemoryUsage = memoryUsages.reduce((sum, usage) => sum + usage, 0) / memoryUsages.length;
    const cacheHitRate = this.calculateCacheHitRate();
    const avgResourceUtilization = resourceUtilizations.reduce((sum, util) => sum + util, 0) / resourceUtilizations.length;
    const peakMemoryUsage = Math.max(...memoryUsages);
    const minExecutionTime = executionTimes.length > 0 ? Math.min(...executionTimes) : 0;
    const maxExecutionTime = executionTimes.length > 0 ? Math.max(...executionTimes) : 0;

    return {
      avgExecutionTime,
      avgMemoryUsage,
      cacheHitRate,
      resourceUtilization: avgResourceUtilization,
      peakMemoryUsage,
      minExecutionTime,
      maxExecutionTime
    };
  }

  /**
   * Warm up cache with common operations
   */
  async warmupCache(operations: Array<{ key: string; operation: () => Promise<any> }>): Promise<void> {
    const promises = operations.map(op => this.executeWithCache(op.key, op.operation, true));
    await Promise.all(promises);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get cache keys
   */
  getCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Global performance optimizer instance
const globalPerformanceOptimizer = new PerformanceOptimizer(
  new ExecutionEngine(),
  new ToolExecutor(new ExecutionEngine()),
  new FileOperations(process.cwd())
);

export { globalPerformanceOptimizer };