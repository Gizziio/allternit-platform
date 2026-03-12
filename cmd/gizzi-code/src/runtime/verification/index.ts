/**
 * Visual Evidence Capture System
 * 
 * Comprehensive visual verification with automatic browser skill detection:
 * - browser-use (Python agent) → agent-browser (CDP) → Playwright fallback
 * 
 * Provides coverage maps, console logs, UI state, and visual diffs for LLM verification.
 * 
 * Includes A2R Autoland integration for governance-compliant pre-landing verification.
 */

// ============================================================================
// Core Types
// ============================================================================

export type {
  VisualArtifact,
  VisualArtifactType,
} from "./types";

// ============================================================================
// Manager & Core
// ============================================================================

export { VisualCaptureManager } from "./manager";
export type {
  VisualCaptureManagerOptions,
  CaptureResult,
} from "./manager";

// ============================================================================
// Base Types
// ============================================================================

export type {
  CaptureContext,
  CaptureOptions,
} from "./providers/base";

// ============================================================================
// Providers
// ============================================================================

export { CoverageCaptureProvider } from "./providers/coverage";
export { ConsoleCaptureProvider } from "./providers/console";
export { UIStateCaptureProvider } from "./providers/ui-state";
export { VisualDiffCaptureProvider } from "./providers/visual-diff";
export { ErrorStateCaptureProvider } from "./providers/error-state";

// ============================================================================
// Browser Adapter
// ============================================================================

export {
  BrowserAdapter,
  checkDevServer,
} from "./browser/adapter";
export type { 
  BrowserAdapterOptions,
  ScreenshotResult,
  RenderResult,
} from "./browser/adapter";

// ============================================================================
// Server Integration (runs in gizzi-code server)
// ============================================================================

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

// ============================================================================
// Deterministic Integration (SessionProcessor path)
// ============================================================================

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

// ============================================================================
// SessionProcessor Adapter
// ============================================================================

export {
  SessionProcessorVisualAdapter,
  createSessionVisualCapture,
  type SessionProcessorVisualConfig,
  type SessionVisualContext,
} from "./integration/session-processor-adapter";

// ============================================================================
// A2R Autoland Integration
// ============================================================================

export {
  // Configuration
  configureVisualAutoland,
  setVisualManagerForAutoland,
  getVisualAutolandConfig,
  
  // Initialization
  initializeVisualAutoland,
  
  // Core functions
  captureForWih,
  checkWihVisualStatus,
  getWihEvidence,
  formatEvidenceForDisplay,
  
  // Gate hooks
  preLandHook,
  postLandHook,
  onWihClosed,
  
  // Utilities
  cleanupVisualAutoland,
  getAdapterStatus,
  
  // Types
  type VisualAutolandConfig,
  type WihVisualEvidence,
} from "./integration/autoland-adapter";

// ============================================================================
// Verification Service (Unified)
// ============================================================================

export {
  VerificationService,
  initializeVerificationService,
  getVerificationService,
  stopVerificationService,
  EvidenceFileWriter,
  VerificationGrpcServer,
} from "./verification-service";

export type {
  VerificationServiceConfig,
  EvidenceFile,
  GrpcServerConfig,
} from "./verification-service";

// ============================================================================
// Utilities
// ============================================================================

export { buildPromptContext, formatArtifactForLLM } from "./prompt";

// ============================================================================
// Quick Start Guide
// ============================================================================

/**
 * ## Quick Start
 * 
 * ### 1. Basic Visual Capture
 * ```typescript
 * import { VisualCaptureManager } from "@/runtime/verification";
 * 
 * const manager = new VisualCaptureManager();
 * const result = await manager.capture({
 *   sessionId: "session-123",
 *   verificationId: "verify-456",
 * });
 * ```
 * 
 * ### 2. A2R Autoland Integration (File Mode - Development)
 * ```typescript
 * import { 
 *   setVisualManagerForAutoland,
 *   configureVisualAutoland,
 *   initializeVisualAutoland 
 * } from "@/runtime/verification";
 * 
 * const manager = new VisualCaptureManager();
 * setVisualManagerForAutoland(manager);
 * 
 * configureVisualAutoland({
 *   enabled: true,
 *   mode: "file",
 *   minConfidence: 0.7,
 * });
 * 
 * await initializeVisualAutoland();
 * ```
 * 
 * ### 3. A2R Autoland Integration (gRPC Mode - Production)
 * ```typescript
 * configureVisualAutoland({
 *   enabled: true,
 *   mode: "grpc",
 *   minConfidence: 0.8,
 * });
 * 
 * await initializeVisualAutoland();
 * // gRPC server starts automatically on port 50051
 * ```
 * 
 * ### 4. SessionProcessor Integration
 * ```typescript
 * import { SessionProcessorVisualAdapter } from "@/runtime/verification";
 * 
 * const adapter = new SessionProcessorVisualAdapter({
 *   manager,
 *   autoCapture: true,
 * });
 * 
 * const visualContext = await adapter.captureIfNeeded(sessionId, patches);
 * const messages = adapter.enhanceMessages(baseMessages, visualContext);
 * ```
 */
