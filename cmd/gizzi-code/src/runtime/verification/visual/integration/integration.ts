/**
 * Visual Capture Integration Module
 * 
 * Provides server-side integration for automatic visual evidence capture.
 * This runs in gizzi-code (the runtime) regardless of client (ShellUI, CLI, etc.)
 */

export {
  initializeVisualCapture,
  getVisualManager,
  getCachedVisualEvidence,
  visualCaptureMiddleware,
  type VisualCaptureHooksOptions,
} from "./server-hooks";

// Deterministic integration (SessionProcessor path)
export {
  captureVisualEvidenceDeterministic,
  withDeterministicVisualCapture,
  injectVisualEvidence,
  requiresVisualVerification,
  getFilesFromPatches,
} from "./deterministic";
export type {
  DeterministicCaptureOptions,
  DeterministicCaptureResult,
} from "./deterministic";

export {
  SessionProcessorVisualAdapter,
  createSessionVisualCapture,
  type SessionProcessorVisualConfig,
  type SessionVisualContext,
} from "./session-processor-adapter";

// Allternit Autoland integration
export {
  configure as configureVisualAutoland,
  setVisualManager as setVisualManagerForAutoland,
  captureForWih,
  checkWihVisualStatus,
  getWihEvidence,
  formatEvidenceForDisplay,
  preLandHook,
  postLandHook,
  initialize as initializeVisualAutoland,
  cleanup as cleanupVisualAutoland,
  type VisualAutolandConfig,
  type WihVisualEvidence,
} from "./autoland-adapter";

// Re-export for convenience
export { VisualCaptureManager } from "../manager";
export { BrowserAdapter, checkDevServer } from "../browser/adapter";
