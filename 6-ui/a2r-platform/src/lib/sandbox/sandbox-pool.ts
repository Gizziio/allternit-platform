/**
 * Container Pool for Rapid Sandbox Startup
 * Keeps warm containers ready for instant code execution
 */

import Docker from "dockerode";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("sandbox-pool");
const docker = new Docker();

interface PooledContainer {
  container: Docker.Container;
  stream: NodeJS.ReadableStream;
  stdin: NodeJS.WritableStream;
  stdout: NodeJS.ReadableStream;
  inUse: boolean;
  createdAt: number;
}

interface PoolConfig {
  minSize: number;      // Minimum warm containers
  maxSize: number;      // Maximum containers (including in-use)
  idleTimeout: number;  // How long to keep idle containers (ms)
  image: string;
}

const DEFAULT_CONFIG: PoolConfig = {
  minSize: 2,           // Always keep 2 warm
  maxSize: 10,          // Max 10 total
  idleTimeout: 5 * 60 * 1000, // 5 minutes
  image: "python:3.11-slim",
};

class SandboxPool {
  private pool: PooledContainer[] = [];
  private config: PoolConfig;
  private maintenanceInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor(config: Partial<PoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the pool - pre-warm containers
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    log.info("Initializing sandbox pool...");
    
    // Ensure image is pulled
    await this.ensureImage();
    
    // Pre-warm minimum containers
    const warmPromises = [];
    for (let i = 0; i < this.config.minSize; i++) {
      warmPromises.push(this.createWarmContainer());
    }
    
    await Promise.all(warmPromises);
    
    // Start maintenance loop
    this.maintenanceInterval = setInterval(() => {
      this.maintainPool();
    }, 30000); // Every 30 seconds
    
    this.isInitialized = true;
    log.info(`Pool initialized with ${this.pool.length} warm containers`);
  }

  /**
   * Get a ready container from the pool (sub-100ms)
   */
  async acquire(): Promise<PooledContainer | null> {
    await this.initialize();
    
    // Find available container
    const available = this.pool.find(c => !c.inUse);
    
    if (available) {
      available.inUse = true;
      log.debug("Acquired container from pool (warm start)");
      
      // Replenish pool in background
      this.replenishPool();
      
      return available;
    }
    
    // Pool exhausted - create new container (cold start)
    if (this.pool.length < this.config.maxSize) {
      log.debug("Pool empty, creating new container (cold start)");
      const container = await this.createWarmContainer();
      if (container) {
        container.inUse = true;
        return container;
      }
    }
    
    log.warn("Pool at max capacity, request rejected");
    return null;
  }

  /**
   * Return container to pool for reuse
   */
  async release(poolContainer: PooledContainer): Promise<void> {
    if (!this.pool.includes(poolContainer)) {
      return;
    }
    
    try {
      // Reset container state by killing any running Python and restarting
      await poolContainer.container.kill({ signal: "SIGKILL" }).catch(() => {});
      await poolContainer.container.restart();
      
      // Re-initialize streams
      const stream = await poolContainer.container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      });
      
      poolContainer.stream = stream;
      poolContainer.inUse = false;
      
      log.debug("Container released back to pool");
    } catch (error) {
      log.warn({ error }, "Failed to reset container, removing from pool");
      this.removeContainer(poolContainer);
    }
  }

  /**
   * Create a warm container ready for code execution
   */
  private async createWarmContainer(): Promise<PooledContainer | null> {
    try {
      const container = await docker.createContainer({
        Image: this.config.image,
        Cmd: ["python", "-u", "-i"], // Interactive mode, unbuffered
        HostConfig: {
          Memory: 512 * 1024 * 1024,
          MemorySwap: 512 * 1024 * 1024,
          CpuQuota: 100000,
          NetworkMode: "none",
          AutoRemove: false,
        },
        OpenStdin: true,
        StdinOnce: false,
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
      });

      await container.start();

      // Attach streams
      const stream = await container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true,
      });

      const pooledContainer: PooledContainer = {
        container,
        stream,
        stdin: stream,
        stdout: stream,
        inUse: false,
        createdAt: Date.now(),
      };

      this.pool.push(pooledContainer);
      
      // Pre-import common libraries for even faster execution
      this.preloadLibraries(pooledContainer);
      
      return pooledContainer;
    } catch (error) {
      log.error({ error }, "Failed to create warm container");
      return null;
    }
  }

  /**
   * Pre-import common libraries in warm containers
   */
  private async preloadLibraries(poolContainer: PooledContainer): Promise<void> {
    const preloadScript = `
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np
import json
import sys
print("___PRELOADED___")
`;
    
    poolContainer.stdin.write(preloadScript);
  }

  /**
   * Replenish pool in background
   */
  private async replenishPool(): Promise<void> {
    const idleCount = this.pool.filter(c => !c.inUse).length;
    
    if (idleCount < this.config.minSize && this.pool.length < this.config.maxSize) {
      this.createWarmContainer();
    }
  }

  /**
   * Remove old/idle containers
   */
  private async maintainPool(): Promise<void> {
    const now = Date.now();
    const toRemove: PooledContainer[] = [];
    
    for (const container of this.pool) {
      if (!container.inUse) {
        const idleTime = now - container.createdAt;
        const idleCount = this.pool.filter(c => !c.inUse).length;
        
        // Remove if idle too long and we have more than minimum
        if (idleTime > this.config.idleTimeout && idleCount > this.config.minSize) {
          toRemove.push(container);
        }
      }
    }
    
    for (const container of toRemove) {
      await this.removeContainer(container);
    }
  }

  /**
   * Remove a container from pool and destroy it
   */
  private async removeContainer(poolContainer: PooledContainer): Promise<void> {
    const index = this.pool.indexOf(poolContainer);
    if (index > -1) {
      this.pool.splice(index, 1);
    }
    
    try {
      await poolContainer.container.stop({ t: 1 });
      await poolContainer.container.remove();
    } catch (error) {
      log.warn({ error }, "Error removing container");
    }
  }

  /**
   * Ensure Docker image is available
   */
  private async ensureImage(): Promise<void> {
    try {
      await docker.getImage(this.config.image).inspect();
    } catch {
      log.info(`Pulling Docker image: ${this.config.image}`);
      const stream = await docker.pull(this.config.image);
      
      return new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Get pool stats
   */
  getStats(): { total: number; idle: number; inUse: number } {
    return {
      total: this.pool.length,
      idle: this.pool.filter(c => !c.inUse).length,
      inUse: this.pool.filter(c => c.inUse).length,
    };
  }

  /**
   * Shutdown pool and cleanup
   */
  async shutdown(): Promise<void> {
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
    }
    
    log.info("Shutting down sandbox pool...");
    
    // Remove all containers
    await Promise.all(this.pool.map(c => this.removeContainer(c)));
    this.pool = [];
    this.isInitialized = false;
  }
}

// Singleton instance
export const sandboxPool = new SandboxPool();

// Cleanup on process exit
process.on("SIGINT", () => sandboxPool.shutdown());
process.on("SIGTERM", () => sandboxPool.shutdown());
