/**
 * Session Adapter
 * 
 * Adapts GatewayClient to inject A2R Kernel WIH governance
 * at session initialization time.
 * 
 * Integration Point: upstream/src/gateway/client.ts:GatewayClient constructor
 */

import type {
  A2RKernel,
  WihItem,
  // RoutingDeniedError,
} from '@a2r/governor';
import {
  type AdapterContext,
  type SessionInitResult,
  type RuntimeGatewayOptions,
  SessionInitError,
  RuntimeBridgeError,
} from '../types.js';

/**
 * Session adapter options
 */
export interface SessionAdapterOptions {
  kernel: A2RKernel;
  
  /**
   * Require WIH for session creation
   * @default true
   */
  requireWih?: boolean;
  
  /**
   * Default phase for auto-created WIH items
   * @default '3'
   */
  defaultPhase?: string;
  
  /**
   * Auto-create WIH if not provided (for dev/testing)
   * @default false
   */
  autoCreateWih?: boolean;
}

/**
 * Extended Gateway options with A2R context
 */
export interface A2RGatewayOptions extends RuntimeGatewayOptions {
  /**
   * A2R Kernel instance (required)
   */
  a2rKernel: A2RKernel;
  
  /**
   * Active WIH item ID (required if enforceWih is true)
   */
  wihId?: string;
  
  /**
   * Workspace root for this session
   * @default process.cwd()
   */
  workspaceRoot?: string;
  
  /**
   * Enforce WIH requirement
   * @default true
   */
  enforceWih?: boolean;
}

/**
 * Session context maintained by the adapter
 */
interface SessionContext {
  sessionId: string;
  wihId: string;
  workspaceRoot: string;
  kernel: A2RKernel;
  wihItem: WihItem;
}

// Map to track active sessions
const activeSessions = new Map<string, SessionContext>();

/**
 * Validate and prepare session initialization
 * 
 * This function is called before GatewayClient constructor to:
 * 1. Validate WIH exists and is in correct state
 * 2. Check WIH dependencies are resolved
 * 3. Update WIH status to in_progress
 * 4. Register session with kernel
 */
export async function prepareSessionInit(
  options: A2RGatewayOptions
): Promise<SessionInitResult> {
  const {
    a2rKernel: kernel,
    wihId,
    enforceWih = true,
    workspaceRoot = process.cwd(),
    instanceId,
  } = options;

  // Generate session ID if not provided
  const sessionId = instanceId ?? generateSessionId();

  // Check WIH requirement
  if (enforceWih && !wihId) {
    throw new SessionInitError(
      'WIH ID required but not provided. All sessions must have an active work item.',
      { sessionId, enforceWih }
    );
  }

  // If WIH provided, validate it
  let wihItem: WihItem | null = null;
  if (wihId) {
    wihItem = await kernel.getWih(wihId);
    
    if (!wihItem) {
      throw new SessionInitError(
        `WIH item ${wihId} not found`,
        { sessionId, wihId }
      );
    }

    // Check status
    if (wihItem.status === 'blocked') {
      throw new SessionInitError(
        `WIH ${wihId} is blocked by: ${wihItem.blockedBy.join(', ')}`,
        { sessionId, wihId, blockedBy: wihItem.blockedBy }
      );
    }

    if (wihItem.status === 'complete') {
      throw new SessionInitError(
        `WIH ${wihId} is already complete`,
        { sessionId, wihId, status: wihItem.status }
      );
    }

    if (wihItem.status === 'cancelled') {
      throw new SessionInitError(
        `WIH ${wihId} was cancelled`,
        { sessionId, wihId, status: wihItem.status }
      );
    }

    // Check dependencies
    for (const depId of wihItem.blockedBy) {
      const dep = await kernel.getWih(depId);
      if (!dep || dep.status !== 'complete') {
        throw new SessionInitError(
          `Dependency ${depId} is not complete (status: ${dep?.status ?? 'not found'})`,
          { sessionId, wihId, dependency: depId }
        );
      }
    }

    // Update WIH status to in_progress if not already
    if (wihItem.status !== 'in_progress') {
      await kernel.updateWih(wihId, {
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  // Register session context
  const context: SessionContext = {
    sessionId,
    wihId: wihId ?? 'UNTRACKED',
    workspaceRoot,
    kernel,
    wihItem: wihItem!,
  };

  activeSessions.set(sessionId, context);

  return {
    success: true,
    sessionId,
    wihId: wihId ?? 'UNTRACKED',
    context: {
      id: sessionId,
      agentId: options.clientName ?? 'unknown',
      kernel: kernel,
    }
  };
}

/**
 * Clean up session on close
 * 
 * Called when GatewayClient connection closes
 */
export async function cleanupSession(
  sessionId: string, _reason?: string,
  // _reason?: string
): Promise<void> {
  const context = activeSessions.get(sessionId);
  if (!context) {
    return;
  }

  // Update WIH status based on completion
  if (context.wihId !== 'UNTRACKED') {
    // Could update status to 'review' if session completed normally
    // or keep 'in_progress' if disconnected unexpectedly
    await context.kernel.updateWih(context.wihId, {
      updatedAt: new Date().toISOString(),
    });
  }

  activeSessions.delete(sessionId);
}

/**
 * Get session context by ID
 */
export function getSessionContext(sessionId: string): SessionContext | null {
  return activeSessions.get(sessionId) ?? null;
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): SessionContext[] {
  return Array.from(activeSessions.values());
}

/**
 * Create A2R-aware GatewayClient options
 * 
 * Wraps the original gateway options with A2R session management
 */
export function createA2RGatewayOptions(
  baseOptions: RuntimeGatewayOptions,
  a2rOptions: Omit<A2RGatewayOptions, keyof RuntimeGatewayOptions>
): A2RGatewayOptions {
  return {
    ...baseOptions,
    ...a2rOptions,
    a2rKernel: a2rOptions.a2rKernel,
    onClose: (code, reason) => {
      // Cleanup session on close
      const sessionId = baseOptions.instanceId ?? 'unknown';
      cleanupSession(sessionId, reason).catch(console.error);
      
      // Call original handler
      baseOptions.onClose?.(code, reason);
    },
  };
}

/**
 * Wrap GatewayClient constructor
 * 
 * Usage:
 * ```typescript
 * import { wrapGatewayClient } from '@a2r/runtime';
 * 
 * const A2RGatewayClient = wrapGatewayClient(GatewayClient, kernel);
 * const client = new A2RGatewayClient({
 *   wihId: 'P3-T0300',
 *   workspaceRoot: '/my/project',
 *   // ... other options
 * });
 * ```
 */
export function wrapGatewayClient<
  T extends new (opts: RuntimeGatewayOptions) => unknown
>(
  GatewayClientClass: T,
  kernel: A2RKernel
): new (opts: A2RGatewayOptions) => InstanceType<T> & { a2rContext: AdapterContext } {
  return class A2RGatewayClient extends (GatewayClientClass as any) {
    public readonly a2rContext: AdapterContext;
    private sessionInitResult: SessionInitResult | null = null;

    constructor(opts: A2RGatewayOptions) {
      // Prepare session before calling parent constructor
      const initResult = prepareSessionInit(opts).then(result => {
        opts.instanceId = result.sessionId;
        return result;
      });

      super(opts);

      // Store initialization promise
      this.sessionInitResult = initResult as unknown as SessionInitResult;

      // Create A2R context
      this.a2rContext = {
        kernel,
        wihId: opts.wihId,
        sessionId: opts.instanceId ?? generateSessionId(),
        agentId: opts.clientName ?? 'unknown',
        workspaceRoot: opts.workspaceRoot ?? process.cwd(),
      };
    }

    /**
     * Wait for session initialization to complete
     */
    async a2rReady(): Promise<SessionInitResult> {
      if (!this.sessionInitResult) {
        throw new RuntimeBridgeError(
          'Session not initialized',
          'SESSION_NOT_INITIALIZED'
        );
      }
      return this.sessionInitResult;
    }
  } as any;
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sess-${timestamp}-${random}`;
}

/**
 * Export for testing
 */
export function _clearActiveSessions(): void {
  activeSessions.clear();
}
