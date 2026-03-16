/**
 * Hook System
 * 
 * Provides hook points for runtime integration.
 */

import type { A2RKernel, WihItem } from '@a2r/governor';
import type { HookRegistry, HookFunction, HookManager } from '../types.js';

/**
 * Hook manager implementation
 */
export class A2RHookManager implements HookManager {
  private registry: HookRegistry = {
    preSessionStart: [],
    postSessionStart: [],
    preToolUse: [],
    postToolUse: [],
    preFileAccess: [],
    postFileAccess: [],
  };

  /**
   * Register a hook function
   */
  register<K extends keyof HookRegistry>(
    hookPoint: K,
    fn: HookFunction
  ): void {
    this.registry[hookPoint].push(fn);
  }

  /**
   * Execute all hooks for a given point
   */
  async execute<K extends keyof HookRegistry>(
    hookPoint: K,
    context: unknown
  ): Promise<unknown[]> {
    const hooks = this.registry[hookPoint];
    const results: unknown[] = [];

    for (const hook of hooks) {
      try {
        const result = await hook(context);
        results.push(result);
      } catch (error) {
        console.error(`Hook error at ${hookPoint}:`, error);
        results.push(error);
      }
    }

    return results;
  }

  /**
   * Clear all hooks for a given point
   */
  clear<K extends keyof HookRegistry>(hookPoint: K): void {
    this.registry[hookPoint] = [];
  }

  /**
   * Clear all hooks
   */
  clearAll(): void {
    const keys = Object.keys(this.registry) as Array<keyof HookRegistry>;
    for (const key of keys) {
      this.registry[key] = [];
    }
  }

  /**
   * Get hook count for a given point
   */
  count<K extends keyof HookRegistry>(hookPoint: K): number {
    return this.registry[hookPoint].length;
  }
}

/**
 * Global hook manager instance
 */
export const globalHookManager = new A2RHookManager();

/**
 * Hook context types
 */
export interface PreSessionStartContext {
  kernel: A2RKernel;
  wihId?: string;
  workspaceRoot: string;
  options: Record<string, unknown>;
}

export interface PostSessionStartContext {
  kernel: A2RKernel;
  sessionId: string;
  wihId?: string;
  workspaceRoot: string;
  wihItem?: WihItem;
}

export interface PreToolUseContext {
  kernel: A2RKernel;
  sessionId: string;
  wihId?: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  workspaceRoot: string;
}

export interface PostToolUseContext {
  kernel: A2RKernel;
  sessionId: string;
  wihId?: string;
  agentId: string;
  toolName: string;
  toolParams: Record<string, unknown>;
  result: unknown;
  error?: Error;
  executionTime: number;
}

export interface PreFileAccessContext {
  kernel: A2RKernel;
  sessionId: string;
  wihId?: string;
  agentId: string;
  operation: string;
  path: string;
  resolvedPath?: string;
  workspaceRoot: string;
}

export interface PostFileAccessContext {
  kernel: A2RKernel;
  sessionId: string;
  wihId?: string;
  agentId: string;
  operation: string;
  path: string;
  result?: unknown;
  error?: Error;
}
