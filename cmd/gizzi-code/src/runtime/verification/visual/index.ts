/**
 * Visual Evidence Capture System
 * 
 * Comprehensive visual verification with automatic browser skill detection:
 * - browser-use (Python agent) → agent-browser (CDP) → Playwright fallback
 * 
 * Provides coverage maps, console logs, UI state, and visual diffs for LLM verification.
 */

// Core types
export type {
  VisualArtifact,
  VisualArtifactType,
} from "./types";

// Base types
export type {
  CaptureContext,
  CaptureOptions,
} from "./providers/base";

// Manager types
export type {
  VisualCaptureManagerOptions,
  CaptureResult,
} from "./manager";

// Manager
export { VisualCaptureManager } from "./manager";

// Providers
export { CoverageCaptureProvider } from "./providers/coverage";
export { ConsoleCaptureProvider } from "./providers/console";
export { UIStateCaptureProvider } from "./providers/ui-state";
export { VisualDiffCaptureProvider } from "./providers/visual-diff";
export { ErrorStateCaptureProvider } from "./providers/error-state";

// Browser adapter
export {
  BrowserAdapter,
  checkDevServer,
} from "./browser/adapter";
export type { 
  BrowserAdapterOptions,
  ScreenshotResult,
  RenderResult,
} from "./browser/adapter";

// Server integration (runs in gizzi-code server)
export {
  initializeVisualCapture,
  getVisualManager,
  getCachedVisualEvidence,
  visualCaptureMiddleware,
  executeHooks,
  registerHook,
  withVisualCapture,
} from "./integration/server-hooks";
export type { VisualCaptureHooksOptions } from "./integration/server-hooks";

// Deterministic integration (SessionProcessor path)
export {
  captureVisualEvidenceDeterministic,
  withDeterministicVisualCapture,
  injectVisualEvidence,
  requiresVisualVerification,
  getFilesFromPatches,
} from "./integration/deterministic";
export type {
  DeterministicCaptureOptions,
  DeterministicCaptureResult,
} from "./integration/deterministic";

// SessionProcessor adapter
export {
  SessionProcessorVisualAdapter,
  createSessionVisualCapture,
} from "./integration/session-processor-adapter";
export type {
  SessionProcessorVisualConfig,
  SessionVisualContext,
} from "./integration/session-processor-adapter";

// Utility
export { buildPromptContext, formatArtifactForLLM } from "./prompt";

/**
 * Quick start for visual capture integration:
 * 
 * 1. Initialize in server startup:
 *    const manager = new VisualCaptureManager();
 *    await initializeVisualCapture({ manager });
 * 
 * 2. For Turn/AgentLoop (already integrated):
 *    - Visual capture runs automatically via VerificationOrchestrator
 * 
 * 3. For SessionProcessor (ShellUI):
 *    - Use withVisualCapture() wrapper or captureVisualEvidenceDeterministic()
 *    - Or rely on server hooks via executeHooks()
 */
