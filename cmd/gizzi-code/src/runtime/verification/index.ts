/**
 * Semi-Formal Verification Module
 * 
 * Implementation of Meta's "Agentic Code Reasoning" paper (arXiv:2603.01896).
 * Provides execution-free verification using structured certificate templates.
 * 
 * Key Features:
 * - Certificate-based verification forcing explicit reasoning
 * - Patch equivalence checking without test execution
 * - Hybrid empirical + semi-formal verification modes
 * - Storage, querying, and accuracy tracking
 * - CI/CD integration (GitHub Actions, GitLab CI)
 * - MCP tools for agent integration
 */

// ============================================================================
// Types & Schemas
// ============================================================================

export * from "./types";
export * from "./schemas/certificate";
export * from "./schemas/verification";

// ============================================================================
// Verifiers
// ============================================================================

export {
  SemiFormalVerifier,
  type SemiFormalVerificationOptions,
} from "./verifiers/semi-formal";

export {
  EmpiricalVerifier,
  type EmpiricalVerificationOptions,
} from "./verifiers/empirical";

export {
  VerificationOrchestrator,
  type VerificationMode,
  type OrchestratorConfig,
  type OrchestratedVerificationResult,
} from "./verifiers/orchestrator";

// ============================================================================
// Storage
// ============================================================================

export {
  VerificationStore,
  storeVerification,
  getVerification,
  queryVerifications,
  confirmVerification,
  getStatistics,
  type StorageConfig,
  type VerificationFilters,
  type StoredVerification,
  type VerificationStatistics,
} from "./storage/store";

// ============================================================================
// Prompts
// ============================================================================

export {
  PromptTemplateManager,
  type TemplateType,
  type PromptTemplate,
  type VerificationPrompt,
} from "./prompts/template-manager";

export {
  GENERAL_VERIFICATION_PROMPT,
  PATCH_EQUIVALENCE_PROMPT,
  FAULT_LOCALIZATION_PROMPT,
  CODE_QA_PROMPT,
} from "./prompts/templates";

// ============================================================================
// Utilities
// ============================================================================

export {
  formatCertificate,
  formatVerificationResult,
  calculateConfidence,
  type FormatOptions,
} from "./utils/formatting";

export {
  exportCertificate,
  exportVerificationReport,
  type ExportOptions,
  type ExportFormat,
} from "./utils/export";

// ============================================================================
// Configuration
// ============================================================================

export {
  loadConfig,
  getConfig,
  setConfig,
  resetConfig,
  createDevConfig,
  createProdConfig,
  createCIConfig,
  detectEnvironment,
  VerificationConfigSchema,
  type VerificationConfig,
  type DetectedEnvironment,
} from "./config";

// ============================================================================
// API Routes
// ============================================================================

export {
  createVerificationRoutes,
  type VerificationRouteConfig,
} from "./api/routes";

// ============================================================================
// CLI Commands
// ============================================================================

export {
  runVerificationCommand,
  queryHistoryCommand,
  showCertificateCommand,
  generateReportCommand,
  setupCLI,
  type CLIConfig,
} from "./cli/commands";

// ============================================================================
// Runtime Integration
// ============================================================================

export {
  VerificationStep,
  injectVerificationSteps,
  wrapExecutorForVerification,
  wrapAgentLoopWithVerification,
  wrapOrchestratorStep,
  type VerificationStepConfig,
  type VerificationWrapperConfig,
} from "./integration/runtime";

export {
  VerificationTaskBuilder,
  VerificationTaskValidator,
  createVerificationWrappedTask,
  type VerificationWrappedTask,
  type VerificationWrappedTaskConfig,
} from "./integration/builder-validator";

// ============================================================================
// CI/CD Integration
// ============================================================================

export {
  GitHubActionsIntegration,
  GitLabCIIntegration,
  createCIIntegration,
  type GitHubActionsConfig,
  type GitLabCIConfig,
  type GenericCIConfig,
} from "./integration/ci-cd";

// ============================================================================
// MCP Tools
// ============================================================================

export {
  VerifyMcpTool,
  ComparePatchesMcpTool,
  GetCertificateMcpTool,
  QueryHistoryMcpTool,
  ConfirmVerificationMcpTool,
  allMcpTools,
  registerMcpTools,
} from "./mcp/tools";

// ============================================================================
// Media Capture
// ============================================================================

export {
  MediaCaptureManager,
  MediaReviewWorkflow,
  captureVerificationMedia,
  runCompleteWorkflow,
  type MediaCaptureOptions,
  type CapturedMedia,
  type ScreenshotInfo,
  type VideoInfo,
  type GifInfo,
  type ReviewDecision,
  type ReviewPhase,
  type WorkflowState,
  type WorkflowCallback,
  type CaptureDuringVerificationOptions,
  type CompleteWorkflowResult,
} from "./media";

// ============================================================================
// Visual Evidence
// ============================================================================

export {
  VisualCaptureManager,
  VisualCaptureProvider,
  ConsoleCaptureProvider,
  CoverageCaptureProvider,
  UIStateCaptureProvider,
  VisualDiffCaptureProvider,
  ErrorStateCaptureProvider,
  artifactToLLMContext,
  summarizeArtifacts,
  PlaywrightBrowser,
  checkDevServer,
  type VisualArtifact,
  type VisualArtifactType,
  type VisualAnnotation,
  type CaptureResult as VisualCaptureResult,
  type CaptureContext as VisualCaptureContext,
  type CaptureOptions as VisualCaptureOptions,
  type UIStateArtifact,
  type CoverageMapArtifact,
  type ConsoleOutputArtifact,
  type VisualDiffArtifact,
  type ErrorStateArtifact,
  type RenderResult as VisualRenderResult,
  type ComputedStyleResult,
  type ConsoleLogEntry,
} from "./visual";

// ============================================================================
// Quick Start Helpers
// ============================================================================

import { VerificationOrchestrator } from "./verifiers/orchestrator";
import { loadConfig, getConfig } from "./config";
import { Log } from "@/shared/util/log";

const log = Log.create({ service: "verification" });

/**
 * Initialize the verification module
 */
export async function initialize(configPath?: string): Promise<void> {
  log.info("Initializing semi-formal verification module");
  
  // Load configuration
  await loadConfig(configPath);
  
  const config = getConfig();
  
  log.info("Verification module initialized", {
    mode: config.defaultMode,
    storage: config.storage.backend,
  });
}

/**
 * Quick verify function for simple use cases
 */
export async function quickVerify(
  description: string,
  options?: {
    mode?: "semi-formal" | "empirical" | "both" | "adaptive";
    patches?: Array<{ path: string; description: string; diff?: string }>;
    expectedBehavior?: string;
  }
): Promise<{
  passed: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
}> {
  const orchestrator = new VerificationOrchestrator(`quick_${Date.now()}`, {
    mode: options?.mode || "adaptive",
  });
  
  const context = {
    description,
    patches: options?.patches?.map((p, i) => ({
      id: `patch_${i}`,
      path: p.path,
      description: p.description,
      diff: p.diff || "",
      state: "modified" as const,
    })),
    expectedBehavior: options?.expectedBehavior,
  };
  
  const plan = { steps: [] };
  const receipts = [];
  
  const result = await orchestrator.verify(
    plan as any,
    receipts as any,
    context,
    { mode: options?.mode || "adaptive" }
  );
  
  return {
    passed: result.passed,
    confidence: result.confidence,
    reason: result.reason,
  };
}

/**
 * Module version
 */
export const VERSION = "1.0.0";
