/**
 * Allternit Runtime Bridge
 * 
 * Runtime bridge for integrating Allternit Kernel with the runtime.
 * Provides adapters, wrappers, and hooks for seamless governance.
 * 
 * @example
 * ```typescript
 * import { AllternitKernelImpl } from '@allternit/governor';
 * import { 
 *   RuntimeBridge,
 *   wrapGatewayClient,
 *   createWrappedToolExecutor 
 * } from '@allternit/runtime';
 * 
 * const kernel = new AllternitKernelImpl(storage);
 * const bridge = new RuntimeBridge({ kernel });
 * 
 * // Wrap GatewayClient
 * const AllternitGatewayClient = wrapGatewayClient(GatewayClient, kernel);
 * ```
 */

// Re-export from kernel
export type {
  AllternitKernel,
  WihItem,
  Receipt,
  ToolContext,
  FileContext,
  RoutingResult,
  RoutingDecision,
} from '@allternit/governor';

// Types
export type {
  // Context types
  AdapterContext,
  RuntimeSessionContext,
  RuntimeToolContext,
  RuntimeToolResult,
  RuntimeToolPolicy,
  RuntimeFileContext,
  RuntimeFileResult,
  RuntimeGatewayOptions,
  
  // Result types
  SessionInitResult,
  ToolWrapperResult,
  FileWrapperResult,
  
  // Configuration
  RuntimeBridgeConfig,
  AuditLogEntry,
  
  // Hook types
  HookRegistry,
  HookFunction,
  HookManager,
  
  // Error types
  RuntimeBridgeError,
  SessionInitError,
  ToolExecutionError,
  FileAccessError,
} from './types.js';

// Adapters
export {
  // Session
  prepareSessionInit,
  cleanupSession,
  getSessionContext,
  getActiveSessions,
  createAllternitGatewayOptions,
  wrapGatewayClient,
  type AllternitGatewayOptions,
  type SessionAdapterOptions,
  
  // Plugin
  PluginAdapter,
  createWrappedPluginResolver,
  type Plugin,
  type PluginTool,
  type PluginAdapterOptions,
} from './adapters/index.js';

// Wrappers
export {
  // Tool
  wrapToolExecution,
  createWrappedToolExecutor,
  wrapToolSet,
  wrapToolPolicy,
  isHighRiskTool,
  HIGH_RISK_TOOLS,
  type ToolWrapperOptions,
  type ToolAuditLog,
  type WrappedToolResult,
  
  // File
  wrapFileOpen,
  wrapFileRead,
  wrapFileWrite,
  wrapFileDelete,
  createWrappedFileOperations,
  isProtectedPath,
  PROTECTED_PATH_PATTERNS,
  type FileWrapperOptions,
  type FileAuditLog,
  type WrappedFileResult,
  type FileOperation,
} from './wrappers/index.js';

// Hooks
export {
  AllternitHookManager,
  globalHookManager,
  type PreSessionStartContext,
  type PostSessionStartContext,
  type PreToolUseContext,
  type PostToolUseContext,
  type PreFileAccessContext,
  type PostFileAccessContext,
} from './hooks/index.js';

// ============================================================================
// Runtime Bridge Class
// ============================================================================

import type { AllternitKernel } from '@allternit/governor';
import type { RuntimeBridgeConfig, AuditLogEntry } from './types.js';
import { AllternitHookManager } from './hooks/index.js';
import { PluginAdapter } from './adapters/plugin-adapter.js';

/**
 * Main Runtime Bridge class
 * 
 * Provides unified interface for Allternit runtime integration
 */
export class RuntimeBridge {
  public readonly kernel: AllternitKernel;
  public readonly config: Required<RuntimeBridgeConfig>;
  public readonly hooks: AllternitHookManager;
  public readonly plugins: PluginAdapter;
  
  private auditLogs: AuditLogEntry[] = [];

  constructor(config: RuntimeBridgeConfig) {
    this.kernel = config.kernel;
    this.config = {
      enforceWih: true,
      defaultToolPolicy: { allow: [], deny: [] },
      fileAccessMode: 'standard',
      allowedWorkspaces: [],
      auditLogging: { enabled: true },
      ...config,
    };
    
    this.hooks = new AllternitHookManager();
    this.plugins = new PluginAdapter({
      kernel: this.kernel,
      requireWih: this.config.enforceWih,
    });

    // Setup audit logging if enabled
    if (this.config.auditLogging.enabled) {
      this.setupAuditLogging();
    }
  }

  /**
   * Get bridge version
   */
  get version(): string {
    return '1.0.0';
  }

  /**
   * Get kernel version
   */
  get kernelVersion(): string {
    return this.kernel.version;
  }

  /**
   * Check if bridge is ready
   */
  get isReady(): boolean {
    return !!this.kernel;
  }

  /**
   * Get audit logs
   */
  getAuditLogs(): AuditLogEntry[] {
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Export audit logs to file
   */
  async exportAuditLogs(filePath: string): Promise<void> {
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      const { writeFile } = await import('node:fs/promises');
      const data = JSON.stringify(this.auditLogs, null, 2);
      await writeFile(filePath, data, 'utf-8');
    } else {
      console.warn('[Allternit Runtime] exportAuditLogs is not supported in this environment.');
    }
  }

  /**
   * Setup audit logging
   */
  private setupAuditLogging(): void {
    const { destination, filePath, callback } = this.config.auditLogging;

    const handleLog = (entry: AuditLogEntry): void => {
      this.auditLogs.push(entry);

      // Console output
      if (destination === 'console' || !destination) {
        console.log(`[Allternit Audit] ${entry.operation}: ${entry.decision}`);
      }

      // File output
      if (destination === 'file' && filePath) {
        // Async append - don't block
        import('node:fs/promises').then(({ appendFile }) => {
          const line = JSON.stringify(entry) + '\n';
          appendFile(filePath, line).catch(console.error);
        });
      }

      // Callback
      callback?.(entry);
    };

    // Register hooks for audit logging
    this.hooks.register('postToolUse', async (_context) => {
      // This is handled by the wrapper, not here
    });

    // Store handleLog for wrappers to use
    (this as any)._auditHandler = handleLog;
  }

  /**
   * Get the audit handler for wrappers
   * @internal
   */
  _getAuditHandler(): ((entry: AuditLogEntry) => void) | undefined {
    return (this as any)._auditHandler;
  }

  /**
   * Get bridge status
   */
  getStatus(): {
    version: string;
    kernelVersion: string;
    ready: boolean;
    enforceWih: boolean;
    fileAccessMode: string;
    activePlugins: number;
    totalAuditLogs: number;
    registeredHooks: Record<string, number>;
  } {
    return {
      version: this.version,
      kernelVersion: this.kernelVersion,
      ready: this.isReady,
      enforceWih: this.config.enforceWih,
      fileAccessMode: this.config.fileAccessMode,
      activePlugins: this.plugins.getAllPlugins().length,
      totalAuditLogs: this.auditLogs.length,
      registeredHooks: {
        preSessionStart: this.hooks.count('preSessionStart'),
        postSessionStart: this.hooks.count('postSessionStart'),
        preToolUse: this.hooks.count('preToolUse'),
        postToolUse: this.hooks.count('postToolUse'),
        preFileAccess: this.hooks.count('preFileAccess'),
        postFileAccess: this.hooks.count('postFileAccess'),
      },
    };
  }

  /**
   * Dispose of the bridge
   */
  async dispose(): Promise<void> {
    await this.plugins.clear();
    this.hooks.clearAll();
    this.auditLogs = [];
  }
}

/**
 * Create a runtime bridge instance
 */
export function createRuntimeBridge(
  config: RuntimeBridgeConfig
): RuntimeBridge {
  return new RuntimeBridge(config);
}

/**
 * Check if running in Allternit-governed environment
 */
export function isAllternitGoverned(): boolean {
  return process.env.Allternit_GOVERNED === 'true' ||
         !!process.env.Allternit_WIH_ID;
}

/**
 * Get current WIH ID from environment
 */
export function getCurrentWihId(): string | undefined {
  return process.env.Allternit_WIH_ID;
}

/**
 * Set current WIH ID in environment
 */
export function setCurrentWihId(wihId: string): void {
  process.env.Allternit_WIH_ID = wihId;
  process.env.Allternit_GOVERNED = 'true';
}

/**
 * Clear current WIH ID from environment
 */
export function clearCurrentWihId(): void {
  delete process.env.Allternit_WIH_ID;
  delete process.env.Allternit_GOVERNED;
}

export * from "./client.js";

// First-party Allternit implementations
export { RuntimeBridge as AllternitRuntimeBridge } from './runtime-bridge.js';
export { GatewayAdapter as AllternitGatewayAdapter } from './gateway-adapter.js';
export { ToolAdapters as AllternitToolAdapters } from './tool-adapters.js';

export { AnthropicPlugin } from './adapters/anthropic-plugin.js';
export { OpenAIPlugin } from './adapters/openai-plugin.js';
