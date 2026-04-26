/**
 * Verification Configuration
 * 
 * Configuration management for the semi-formal verification system.
 */

import { z } from "zod/v4";
import * as fs from "fs/promises";
import * as path from "path";
import { Log } from "@/shared/util/log";

const log = Log.create({ service: "verification.config" });

// ============================================================================
// Configuration Schema
// ============================================================================

export const VerificationConfigSchema = z.object({
  /**
   * Default verification mode
   */
  defaultMode: z.enum(["semi-formal", "empirical", "both", "adaptive"])
    .default("adaptive"),
  
  /**
   * Storage configuration
   */
  storage: z.object({
    /** Storage backend */
    backend: z.enum(["file", "memory"]).default("file"),
    /** Path to storage directory (for file backend) */
    path: z.string().default("./.verification"),
    /** Maximum entries to keep */
    maxEntries: z.number().optional(),
  }),
  
  /**
   * Semi-formal verification settings
   */
  semiFormal: z.object({
    /** Model to use for reasoning */
    model: z.string().default("claude-sonnet-4"),
    /** Maximum trace depth */
    maxTraceDepth: z.number().default(10),
    /** Minimum confidence for "high" rating */
    highConfidenceThreshold: z.number().default(0.85),
    /** Minimum confidence for "medium" rating */
    mediumConfidenceThreshold: z.number().default(0.60),
    /** Whether to require counterexamples for rejections */
    requireCounterexample: z.boolean().default(true),
    /** Timeout for reasoning (ms) */
    timeout: z.number().default(60000),
  }),
  
  /**
   * Empirical verification settings
   */
  empirical: z.object({
    /** Test runner command */
    testRunner: z.string().default("npm test"),
    /** Timeout for test execution (ms) */
    timeout: z.number().default(300000),
    /** Whether to require test coverage */
    requireCoverage: z.boolean().default(false),
    /** Minimum coverage percentage */
    minCoverage: z.number().default(80),
  }),
  
  /**
   * Orchestrator settings
   */
  orchestrator: z.object({
    /** Whether to run methods in parallel */
    parallel: z.boolean().default(true),
    /** Whether to detect method disagreement */
    detectDisagreement: z.boolean().default(true),
    /** Confidence weights for scoring */
    confidenceWeights: z.object({
      conclusionConfidence: z.number().default(0.35),
      evidenceQuality: z.number().default(0.25),
      traceCompleteness: z.number().default(0.20),
      alternativeCheck: z.number().default(0.20),
    }),
  }),
  
  /**
   * API settings
   */
  api: z.object({
    /** Enable API endpoints */
    enabled: z.boolean().default(true),
    /** API route prefix */
    prefix: z.string().default("/verification"),
  }),
  
  /**
   * CLI settings
   */
  cli: z.object({
    /** Default output format */
    outputFormat: z.enum(["table", "json", "markdown"]).default("table"),
    /** Whether to include certificates in output */
    includeCertificates: z.boolean().default(false),
  }),
  
  /**
   * Visual capture settings
   */
  visualCapture: z.object({
    /** Enable visual evidence capture - defaults to true for automatic operation */
    enabled: z.boolean().default(true),
    /** Output directory for captures */
    outputDir: z.string().default("./.verification/visual"),
    /** Artifact types to capture */
    enabledTypes: z.array(
      z.enum(["ui-state", "visual-diff", "coverage-map", "performance-chart", "error-state", "console-output"])
    ).default(["ui-state", "coverage-map", "console-output"]),
    /** Viewport size for UI captures */
    viewport: z.object({
      width: z.number().default(1280),
      height: z.number().default(720),
    }),
    /** Include base64 image data in artifacts */
    includeBase64: z.boolean().default(false),
    /** Maximum image dimensions */
    maxImageDimensions: z.object({
      width: z.number().default(1920),
      height: z.number().default(1080),
    }),
    /** Screenshot quality (0-100) */
    quality: z.number().default(90),
  }),
  
  /**
   * Integration settings
   */
  integrations: z.object({
    /** GitHub Actions integration */
    githubActions: z.object({
      enabled: z.boolean().default(false),
      postComment: z.boolean().default(true),
      setStatus: z.boolean().default(true),
    }),
    
    /** GitLab CI integration */
    gitlabCI: z.object({
      enabled: z.boolean().default(false),
      postComment: z.boolean().default(true),
      setStatus: z.boolean().default(true),
    }),
    
    /** MCP server integration */
    mcp: z.object({
      enabled: z.boolean().default(false),
    }),
  }),
});

export type VerificationConfig = z.infer<typeof VerificationConfigSchema>;

// ============================================================================
// Global Config
// ============================================================================

let globalConfig: VerificationConfig | null = null;

/**
 * Load configuration from file or environment
 */
export async function loadConfig(
  configPath?: string
): Promise<VerificationConfig> {
  // Try config file
  const paths = configPath
    ? [configPath]
    : [
        process.env.VERIFICATION_CONFIG,
        "./verification.config.json",
        "./.verification/config.json",
        "./config/verification.json",
      ].filter(Boolean) as string[];
  
  for (const p of paths) {
    try {
      const fullPath = path.resolve(p);
      const content = await fs.readFile(fullPath, "utf-8");
      const parsed = JSON.parse(content);
      const config = VerificationConfigSchema.parse(parsed);
      
      log.info("Loaded configuration from file", { path: fullPath });
      globalConfig = config;
      return config;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        log.warn("Failed to load config file", { path: p, error });
      }
    }
  }
  
  // Use environment variables
  const envConfig = loadFromEnvironment();
  if (envConfig) {
    log.info("Loaded configuration from environment");
    globalConfig = envConfig;
    return envConfig;
  }
  
  // Default config
  log.info("Using default configuration");
  globalConfig = VerificationConfigSchema.parse({});
  return globalConfig;
}

/**
 * Load configuration from environment variables
 */
function loadFromEnvironment(): VerificationConfig | null {
  const env = process.env;
  
  if (!env.VERIFICATION_MODE && !env.VERIFICATION_STORAGE_BACKEND) {
    return null;
  }
  
  const config: Partial<VerificationConfig> = {};
  
  // Mode
  if (env.VERIFICATION_MODE) {
    config.defaultMode = env.VERIFICATION_MODE as any;
  }
  
  // Storage
  if (env.VERIFICATION_STORAGE_BACKEND || env.VERIFICATION_STORAGE_PATH) {
    config.storage = {
      backend: env.VERIFICATION_STORAGE_BACKEND as any || "file",
      path: env.VERIFICATION_STORAGE_PATH || "./.verification",
      maxEntries: env.VERIFICATION_MAX_ENTRIES 
        ? parseInt(env.VERIFICATION_MAX_ENTRIES, 10) 
        : undefined,
    };
  }
  
  // Semi-formal
  if (env.VERIFICATION_MODEL || env.VERIFICATION_TIMEOUT) {
    config.semiFormal = {
      model: env.VERIFICATION_MODEL || "claude-sonnet-4",
      maxTraceDepth: env.VERIFICATION_MAX_TRACE_DEPTH 
        ? parseInt(env.VERIFICATION_MAX_TRACE_DEPTH, 10) 
        : 10,
      highConfidenceThreshold: env.VERIFICATION_HIGH_CONFIDENCE 
        ? parseFloat(env.VERIFICATION_HIGH_CONFIDENCE) 
        : 0.85,
      mediumConfidenceThreshold: env.VERIFICATION_MEDIUM_CONFIDENCE 
        ? parseFloat(env.VERIFICATION_MEDIUM_CONFIDENCE) 
        : 0.60,
      requireCounterexample: env.VERIFICATION_REQUIRE_COUNTEREXAMPLE !== "false",
      timeout: env.VERIFICATION_TIMEOUT 
        ? parseInt(env.VERIFICATION_TIMEOUT, 10) 
        : 60000,
    };
  }
  
  // Empirical
  if (env.VERIFICATION_TEST_RUNNER) {
    config.empirical = {
      testRunner: env.VERIFICATION_TEST_RUNNER,
      timeout: env.VERIFICATION_TEST_TIMEOUT 
        ? parseInt(env.VERIFICATION_TEST_TIMEOUT, 10) 
        : 300000,
      requireCoverage: env.VERIFICATION_REQUIRE_COVERAGE === "true",
      minCoverage: env.VERIFICATION_MIN_COVERAGE 
        ? parseFloat(env.VERIFICATION_MIN_COVERAGE) 
        : 80,
    };
  }
  
  return VerificationConfigSchema.parse(config);
}

/**
 * Get the current configuration
 */
export function getConfig(): VerificationConfig {
  if (!globalConfig) {
    throw new Error(
      "Configuration not loaded. Call loadConfig() first."
    );
  }
  return globalConfig;
}

/**
 * Set configuration (for testing)
 */
export function setConfig(config: VerificationConfig): void {
  globalConfig = config;
}

/**
 * Reset configuration
 */
export function resetConfig(): void {
  globalConfig = null;
}

// ============================================================================
// Environment Detection
// ============================================================================

export interface DetectedEnvironment {
  /** CI provider */
  ci: "github" | "gitlab" | "jenkins" | "circleci" | "none";
  /** Whether in CI environment */
  isCI: boolean;
  /** Default values for this environment */
  defaults: Partial<VerificationConfig>;
}

/**
 * Detect CI environment
 */
export function detectEnvironment(): DetectedEnvironment {
  const env = process.env;
  
  // GitHub Actions
  if (env.GITHUB_ACTIONS === "true") {
    return {
      ci: "github",
      isCI: true,
      defaults: {
        storage: { backend: "file", path: "./.verification" },
        integrations: {
          githubActions: {
            enabled: true,
            postComment: true,
            setStatus: true,
          },
          gitlabCI: {
            enabled: false,
            postComment: true,
            setStatus: true,
          },
          mcp: {
            enabled: false,
          },
        },
      },
    };
  }
  
  // GitLab CI
  if (env.GITLAB_CI === "true") {
    return {
      ci: "gitlab",
      isCI: true,
      defaults: {
        storage: { backend: "file", path: "./.verification" },
        integrations: {
          githubActions: {
            enabled: false,
            postComment: true,
            setStatus: true,
          },
          gitlabCI: {
            enabled: true,
            postComment: true,
            setStatus: true,
          },
          mcp: {
            enabled: false,
          },
        },
      },
    };
  }
  
  // Jenkins
  if (env.JENKINS_URL) {
    return {
      ci: "jenkins",
      isCI: true,
      defaults: {
        storage: { backend: "file", path: "./.verification" },
      },
    };
  }
  
  // CircleCI
  if (env.CIRCLECI === "true") {
    return {
      ci: "circleci",
      isCI: true,
      defaults: {
        storage: { backend: "file", path: "./.verification" },
      },
    };
  }
  
  // Not CI
  return {
    ci: "none",
    isCI: false,
    defaults: {},
  };
}

// ============================================================================
// Config Creation Helpers
// ============================================================================

/**
 * Create development configuration
 */
export function createDevConfig(): VerificationConfig {
  return VerificationConfigSchema.parse({
    defaultMode: "both",
    storage: { backend: "file", path: "./.verification" },
    semiFormal: {
      model: "claude-sonnet-4",
      maxTraceDepth: 10,
      timeout: 60000,
    },
    empirical: {
      timeout: 300000,
    },
    api: { enabled: true, prefix: "/verification" },
    cli: { outputFormat: "table" },
  });
}

/**
 * Create production configuration
 */
export function createProdConfig(): VerificationConfig {
  return VerificationConfigSchema.parse({
    defaultMode: "adaptive",
    storage: { backend: "file", path: "/var/lib/allternit/verification" },
    semiFormal: {
      model: "claude-opus-4",
      maxTraceDepth: 15,
      highConfidenceThreshold: 0.90,
      requireCounterexample: true,
      timeout: 120000,
    },
    empirical: {
      timeout: 600000,
      requireCoverage: true,
      minCoverage: 80,
    },
    orchestrator: {
      parallel: true,
      detectDisagreement: true,
    },
    api: { enabled: true, prefix: "/verification" },
    cli: { outputFormat: "json" },
  });
}

/**
 * Create CI configuration
 */
export function createCIConfig(): VerificationConfig {
  const env = detectEnvironment();
  const baseConfig = createProdConfig();
  
  return VerificationConfigSchema.parse({
    ...baseConfig,
    ...env.defaults,
    storage: { backend: "memory" }, // Don't persist in CI
  });
}
