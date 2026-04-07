/**
 * SessionProcessor Visual Capture Adapter
 * 
 * Integrates visual evidence capture into the SessionProcessor flow.
 * This runs in gizzi-code and captures visual evidence before LLM calls.
 */

import type { VisualCaptureManager } from "../manager";
// Import Patch type from deterministic module
import type { Patch } from "./deterministic";
import {
  captureVisualEvidenceDeterministic,
  requiresVisualVerification,
  getFilesFromPatches,
  injectVisualEvidence,
} from "./deterministic";

/**
 * Configuration for SessionProcessor integration
 */
export interface SessionProcessorVisualConfig {
  /** Visual capture manager */
  manager: VisualCaptureManager;
  /** Auto-capture on UI-related changes */
  autoCapture: boolean;
  /** Wait for dev server */
  waitForDevServer: boolean;
  /** Server check timeout */
  serverTimeout: number;
}

/**
 * Context passed through SessionProcessor
 */
export interface SessionVisualContext {
  /** Visual evidence from capture */
  evidence?: string;
  /** Whether capture was attempted */
  attempted: boolean;
  /** Any errors during capture */
  errors: string[];
  /** HTML report path */
  reportPath?: string;
}

/**
 * Adapter that wraps SessionProcessor with visual capture
 * 
 * Usage in SessionProcessor:
 * ```typescript
 * const visualAdapter = new SessionProcessorVisualAdapter(config);
 * 
 * async process() {
 *   const visualContext = await visualAdapter.captureIfNeeded(patches);
 *   const messages = visualAdapter.enhanceMessages(baseMessages, visualContext);
 *   const response = await LLM.stream(messages);
 * }
 * ```
 */
export class SessionProcessorVisualAdapter {
  private config: SessionProcessorVisualConfig;
  private captureCache = new Map<string, SessionVisualContext>();

  constructor(config: SessionProcessorVisualConfig) {
    this.config = config;
  }

  /**
   * Determines if visual capture is needed based on patches
   */
  shouldCapture(patches: Patch[]): boolean {
    if (!this.config.autoCapture) {
      return false;
    }
    return requiresVisualVerification(patches);
  }

  /**
   * Captures visual evidence if needed
   */
  async captureIfNeeded(
    sessionId: string,
    patches: Patch[],
  ): Promise<SessionVisualContext> {
    // Check cache
    const cached = this.captureCache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Check if we should capture
    if (!this.shouldCapture(patches)) {
      const noCapture: SessionVisualContext = {
        attempted: false,
        errors: [],
      };
      this.captureCache.set(sessionId, noCapture);
      return noCapture;
    }

    // Perform capture
    try {
      const result = await captureVisualEvidenceDeterministic(
        this.config.manager,
        sessionId,
        {
          waitForServer: this.config.waitForDevServer,
          serverTimeout: this.config.serverTimeout,
          changedFiles: getFilesFromPatches(patches),
          injectIntoContext: true,
        },
      );

      const context: SessionVisualContext = {
        evidence: result.llmContext,
        attempted: true,
        errors: result.errors,
        reportPath: result.reportPath,
      };

      this.captureCache.set(sessionId, context);
      return context;
    } catch (error) {
      const failedContext: SessionVisualContext = {
        attempted: true,
        errors: [`Capture failed: ${error}`],
      };
      this.captureCache.set(sessionId, failedContext);
      return failedContext;
    }
  }

  /**
   * Enhances LLM messages with visual evidence
   */
  enhanceMessages(
    messages: Array<{ role: string; content: string }>,
    visualContext: SessionVisualContext,
  ): Array<{ role: string; content: string }> {
    if (!visualContext.evidence) {
      return messages;
    }
    return injectVisualEvidence(messages, visualContext.evidence);
  }

  /**
   * Gets or creates system prompt with visual evidence
   */
  getSystemPrompt(
    basePrompt: string,
    visualContext: SessionVisualContext,
  ): string {
    if (!visualContext.evidence) {
      return basePrompt;
    }

    return `${basePrompt}

## Visual Evidence

${visualContext.evidence}

Use the visual evidence above to verify UI changes. Check for:
- Console errors or warnings
- Coverage gaps in changed files
- UI rendering issues
- Visual regressions`;
  }

  /**
   * Clears cache for a session
   */
  clearCache(sessionId: string): void {
    this.captureCache.delete(sessionId);
  }

  /**
   * Clears all caches
   */
  clearAllCaches(): void {
    this.captureCache.clear();
  }
}

/**
 * Creates a SessionProcessor-compatible visual capture function
 * 
 * This is a simpler functional approach if you don't want the full adapter class.
 */
export function createSessionVisualCapture(
  manager: VisualCaptureManager,
  options: {
    autoCapture?: boolean;
    waitForDevServer?: boolean;
    serverTimeout?: number;
  } = {},
) {
  const {
    autoCapture = true,
    waitForDevServer = true,
    serverTimeout = 10000,
  } = options;

  return async (
    sessionId: string,
    patches: Patch[],
  ): Promise<SessionVisualContext> => {
    if (!autoCapture || !requiresVisualVerification(patches)) {
      return { attempted: false, errors: [] };
    }

    const result = await captureVisualEvidenceDeterministic(
      manager,
      sessionId,
      {
        waitForServer: waitForDevServer,
        serverTimeout,
        changedFiles: getFilesFromPatches(patches),
      },
    );

    return {
      evidence: result.llmContext,
      attempted: true,
      errors: result.errors,
      reportPath: result.reportPath,
    };
  };
}
