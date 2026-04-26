/**
 * Per-Repository Policy Configuration
 * 
 * Allows different projects to have different visual verification policies.
 * Policies are read from .allternit/policy.yaml in each repository.
 */

import * as fs from "fs/promises";
import * as path from "path";
import { Log } from "@/shared/util/log";

const log = Log.create({ service: "verification.repo-policy" });

// ============================================================================
// Types
// ============================================================================

export interface RepoPolicy {
  enabled: boolean;
  minConfidence: number;
  requiredTypes: string[];
  providerType: "file" | "grpc" | "auto";
  timeoutSeconds: number;
  retryPolicy: {
    maxAttempts: number;
    initialDelayMs: number;
  };
  artifacts: {
    uiState: boolean;
    coverageMap: boolean;
    consoleOutput: boolean;
    visualDiff: boolean;
    errorState: boolean;
  };
  triggerPatterns: string[];
  excludePatterns: string[];
  branchOverrides?: Record<string, Partial<RepoPolicy>>;
}

// ============================================================================
// Default Policy
// ============================================================================

export const DEFAULT_REPO_POLICY: RepoPolicy = {
  enabled: true,
  minConfidence: 0.7,
  requiredTypes: ["console-output", "coverage-map"],
  providerType: "auto",
  timeoutSeconds: 60,
  retryPolicy: {
    maxAttempts: 3,
    initialDelayMs: 1000,
  },
  artifacts: {
    uiState: true,
    coverageMap: true,
    consoleOutput: true,
    visualDiff: false,
    errorState: true,
  },
  triggerPatterns: [
    "src/**/*.{tsx,jsx,vue,svelte}",
    "src/**/*.{css,scss}",
    "**/*.html",
  ],
  excludePatterns: [
    "**/*.test.{ts,tsx}",
    "**/*.spec.{ts,tsx}",
    "**/node_modules/**",
  ],
};

// ============================================================================
// Policy Loader
// ============================================================================

export class RepoPolicyLoader {
  private cache = new Map<string, { policy: RepoPolicy; timestamp: number }>();
  private cacheTTL = 60000;

  async loadPolicy(repoPath: string, branch?: string): Promise<RepoPolicy> {
    const cacheKey = `${repoPath}:${branch || "default"}`;
    
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.policy;
    }

    const policyPath = path.join(repoPath, ".allternit", "policy.json");
    
    try {
      const content = await fs.readFile(policyPath, "utf-8");
      const filePolicy = JSON.parse(content) as Partial<RepoPolicy>;
      
      let policy = this.mergeWithDefaults(filePolicy);
      
      if (branch && policy.branchOverrides?.[branch]) {
        policy = { ...policy, ...policy.branchOverrides[branch] };
      }
      
      this.cache.set(cacheKey, { policy, timestamp: Date.now() });
      
      log.info("[RepoPolicy] Loaded", { repoPath, branch, minConfidence: policy.minConfidence });
      return policy;
      
    } catch (error) {
      log.debug("[RepoPolicy] Using defaults", { repoPath });
      return DEFAULT_REPO_POLICY;
    }
  }

  async shouldTriggerVerification(
    repoPath: string,
    changedFiles: string[]
  ): Promise<boolean> {
    const policy = await this.loadPolicy(repoPath);
    if (!policy.enabled) return false;

    for (const file of changedFiles) {
      const excluded = policy.excludePatterns.some(p => this.matchGlob(file, p));
      if (excluded) continue;

      const triggered = policy.triggerPatterns.some(p => this.matchGlob(file, p));
      if (triggered) return true;
    }

    return false;
  }

  private mergeWithDefaults(filePolicy: Partial<RepoPolicy>): RepoPolicy {
    return {
      enabled: filePolicy.enabled ?? DEFAULT_REPO_POLICY.enabled,
      minConfidence: filePolicy.minConfidence ?? DEFAULT_REPO_POLICY.minConfidence,
      requiredTypes: filePolicy.requiredTypes ?? DEFAULT_REPO_POLICY.requiredTypes,
      providerType: filePolicy.providerType ?? DEFAULT_REPO_POLICY.providerType,
      timeoutSeconds: filePolicy.timeoutSeconds ?? DEFAULT_REPO_POLICY.timeoutSeconds,
      retryPolicy: { ...DEFAULT_REPO_POLICY.retryPolicy, ...filePolicy.retryPolicy },
      artifacts: { ...DEFAULT_REPO_POLICY.artifacts, ...filePolicy.artifacts },
      triggerPatterns: filePolicy.triggerPatterns ?? DEFAULT_REPO_POLICY.triggerPatterns,
      excludePatterns: filePolicy.excludePatterns ?? DEFAULT_REPO_POLICY.excludePatterns,
      branchOverrides: filePolicy.branchOverrides,
    };
  }

  private matchGlob(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      "^" + pattern
        .replace(/\*\*/g, "<<<GS>>>")
        .replace(/\*/g, "[^/]*")
        .replace(/<<<GS>>>/g, ".*")
        .replace(/\./g, "\\.") + "$"
    );
    return regex.test(filePath);
  }
}

export function getRepoPolicyLoader(): RepoPolicyLoader {
  return new RepoPolicyLoader();
}
