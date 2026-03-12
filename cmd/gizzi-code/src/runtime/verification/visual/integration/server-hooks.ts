/**
 * Visual Capture Server Hooks
 * 
 * Server-side integration that captures visual evidence for ALL execution paths:
 * - SessionProcessor → LLM.stream() (ShellUI path)
 * - AgentLoop → Turn → VerificationOrchestrator
 * - Any custom server routes or handlers
 * 
 * This ensures visual capture works regardless of which entry point is used.
 */

import type { VisualCaptureManager } from "../manager";
import type { VisualArtifact } from "../types";

interface ServerContext {
  sessionId: string;
  changedFiles?: string[];
  [key: string]: unknown;
}

type HookHandler = (context: ServerContext) => Promise<void> | void;

interface Hooks {
  onSessionStart?: HookHandler[];
  onBeforeLLM?: HookHandler[];
  onAfterLLM?: HookHandler[];
  onBeforeVerify?: HookHandler[];
  onAfterVerify?: HookHandler[];
  onSessionEnd?: HookHandler[];
}

// Global hook registry
const globalHooks: Hooks = {
  onSessionStart: [],
  onBeforeLLM: [],
  onAfterLLM: [],
  onBeforeVerify: [],
  onAfterVerify: [],
  onSessionEnd: [],
};

// Global visual manager instance
let globalVisualManager: VisualCaptureManager | undefined;

// Cached visual evidence per session
const visualEvidenceCache = new Map<string, VisualSessionEvidence>();

interface VisualSessionEvidence {
  sessionId: string;
  startArtifacts?: VisualArtifact[];
  llmArtifacts?: VisualArtifact[];
  verifyArtifacts?: VisualArtifact[];
  timestamp: number;
}

export interface VisualCaptureHooksOptions {
  /** Visual capture manager instance */
  manager: VisualCaptureManager;
  /** Whether to enable server-side hooks */
  enabled?: boolean;
  /** Wait for dev server before capturing */
  waitForDevServer?: boolean;
  /** Dev server check timeout */
  serverTimeout?: number;
}

/**
 * Initialize visual capture hooks for the server
 * Call this once during server initialization
 */
export async function initializeVisualCapture(
  options: VisualCaptureHooksOptions,
): Promise<void> {
  const { manager, enabled = true } = options;

  if (!enabled) {
    console.log("[VisualCapture] Server hooks disabled");
    return;
  }

  globalVisualManager = manager;

  // Register visual capture hooks
  registerHook("onBeforeVerify", async (context) => {
    await captureBeforeVerify(context, options);
  });

  registerHook("onSessionEnd", async (context) => {
    await cleanupSession(context);
  });

  console.log("[VisualCapture] Server hooks initialized");
}

/**
 * Register a hook handler
 */
export function registerHook(
  event: keyof Hooks,
  handler: HookHandler,
): void {
  if (!globalHooks[event]) {
    globalHooks[event] = [];
  }
  globalHooks[event]!.push(handler);
}

/**
 * Execute all handlers for a hook event
 */
export async function executeHooks(
  event: keyof Hooks,
  context: ServerContext,
): Promise<void> {
  const handlers = globalHooks[event];
  if (!handlers || handlers.length === 0) {
    return;
  }

  for (const handler of handlers) {
    try {
      await handler(context);
    } catch (error) {
      console.error(`[VisualCapture] Hook ${event} failed:`, error);
    }
  }
}

/**
 * Get the global visual manager
 */
export function getVisualManager(): VisualCaptureManager | undefined {
  return globalVisualManager;
}

/**
 * Get cached visual evidence for a session
 */
export function getCachedVisualEvidence(
  sessionId: string,
): VisualSessionEvidence | undefined {
  return visualEvidenceCache.get(sessionId);
}

/**
 * Capture visual evidence before verification
 */
async function captureBeforeVerify(
  context: ServerContext,
  options: VisualCaptureHooksOptions,
): Promise<void> {
  if (!globalVisualManager) return;

  try {
    const { checkDevServer } = await import("../browser/adapter");
    const devServer = await checkDevServer(3000);

    if (!devServer) {
      console.log("[VisualCapture] Dev server not available, skipping capture");
      return;
    }

    const { captureVisualEvidenceDeterministic } = await import("./deterministic");
    const result = await captureVisualEvidenceDeterministic(
      globalVisualManager,
      context.sessionId,
      {
        waitForServer: false, // Already checked
        changedFiles: context.changedFiles,
        injectIntoContext: true,
      },
    );

    if (result.success) {
      // Cache the evidence
      const existing = visualEvidenceCache.get(context.sessionId);
      visualEvidenceCache.set(context.sessionId, {
        sessionId: context.sessionId,
        ...existing,
        verifyArtifacts: result.artifacts,
        timestamp: Date.now(),
      });

      console.log(
        `[VisualCapture] Captured ${result.artifacts.length} artifacts for ${context.sessionId}`,
      );
    }
  } catch (error) {
    console.error("[VisualCapture] Capture failed:", error);
  }
}

/**
 * Cleanup session data
 */
async function cleanupSession(context: ServerContext): Promise<void> {
  visualEvidenceCache.delete(context.sessionId);
}

/**
 * Express/Fastify middleware factory for visual capture
 * Usage:
 *   app.use(visualCaptureMiddleware({ manager }));
 */
export function visualCaptureMiddleware(
  options: VisualCaptureHooksOptions,
): (req: unknown, res: unknown, next: () => void) => void {
  return (req, res, next) => {
    // Attach visual capture to request context
    (req as Record<string, unknown>).visualCapture = {
      manager: options.manager,
      getEvidence: (sessionId: string) => getCachedVisualEvidence(sessionId),
    };
    next();
  };
}

/**
 * Helper to wrap any async operation with visual capture
 */
export async function withVisualCapture<T>(
  sessionId: string,
  operation: () => Promise<T>,
  options: { changedFiles?: string[] } = {},
): Promise<T> {
  const context: ServerContext = {
    sessionId,
    changedFiles: options.changedFiles,
  };

  // Execute before hooks
  await executeHooks("onBeforeVerify", context);

  try {
    const result = await operation();

    // Execute after hooks
    await executeHooks("onAfterVerify", context);

    return result;
  } finally {
    // Cleanup
    await executeHooks("onSessionEnd", context);
  }
}
