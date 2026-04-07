/**
 * CI/CD Integration for Verification
 * 
 * Provides GitHub Actions and GitLab CI integration for running verification
 * as part of continuous integration pipelines.
 */

import { Log } from "@/shared/util/log";
import { VerificationOrchestrator } from "./verifiers";
import type { OrchestratedVerificationResult } from "./types";
import * as fs from "fs/promises";
import * as path from "path";

const log = Log.create({ service: "verification.ci-cd" });

// ============================================================================
// GitHub Actions Integration
// ============================================================================

export interface GitHubActionsConfig {
  /** GitHub token for API access */
  token: string;
  /** Repository owner/name */
  repository: string;
  /** PR number (if running on PR) */
  prNumber?: number;
  /** Commit SHA */
  commitSha: string;
  /** Whether to post results as PR comment */
  postComment: boolean;
  /** Whether to set commit status */
  setStatus: boolean;
  /** Minimum confidence required */
  minConfidence: "high" | "medium" | "low";
}

export class GitHubActionsIntegration {
  private log = Log.create({ service: "verification.ci-cd.github" });
  
  constructor(private config: GitHubActionsConfig) {}
  
  /**
   * Run verification and post results
   */
  async runVerification(
    verifyFn: () => Promise<OrchestratedVerificationResult>
  ): Promise<{
    passed: boolean;
    result: OrchestratedVerificationResult;
    commentUrl?: string;
  }> {
    this.log.info("Running GitHub Actions verification", {
      repository: this.config.repository,
      commit: this.config.commitSha,
    });
    
    try {
      const result = await verifyFn();
      
      let commentUrl: string | undefined;
      
      if (this.config.setStatus) {
        await this.setCommitStatus(result);
      }
      
      if (this.config.postComment && this.config.prNumber) {
        commentUrl = await this.postPRComment(result);
      }
      
      await this.uploadArtifact(result);
      
      return {
        passed: result.passed,
        result,
        commentUrl,
      };
    } catch (error) {
      this.log.error("GitHub Actions verification failed", { error });
      
      if (this.config.setStatus) {
        await this.setErrorStatus(error as Error);
      }
      
      throw error;
    }
  }
  
  private async setCommitStatus(result: OrchestratedVerificationResult): Promise<void> {
    const { token, repository, commitSha } = this.config;
    
    const status = result.passed ? "success" : "failure";
    const description = result.passed
      ? `Verification passed (${result.confidence} confidence)`
      : `Verification failed: ${result.reason.slice(0, 100)}`;
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/statuses/${commitSha}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            state: status,
            context: "verification/semi-formal",
            description,
          }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      
      this.log.debug("Commit status set", { status, commitSha });
    } catch (error) {
      this.log.error("Failed to set commit status", { error });
    }
  }
  
  private async postPRComment(result: OrchestratedVerificationResult): Promise<string | undefined> {
    const { token, repository, prNumber } = this.config;
    
    if (!prNumber) return undefined;
    
    const body = this.formatPRComment(result);
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({ body }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.log.debug("PR comment posted", { url: data.html_url });
      
      return data.html_url;
    } catch (error) {
      this.log.error("Failed to post PR comment", { error });
      return undefined;
    }
  }
  
  private async uploadArtifact(result: OrchestratedVerificationResult): Promise<void> {
    try {
      const outputDir = process.env.GITHUB_WORKSPACE || ".";
      const reportPath = path.join(outputDir, "verification-report.json");
      
      await fs.writeFile(
        reportPath,
        JSON.stringify(result, null, 2),
        "utf-8"
      );
      
      this.log.debug("Artifact saved", { path: reportPath });
    } catch (error) {
      this.log.error("Failed to save artifact", { error });
    }
  }
  
  private formatPRComment(result: OrchestratedVerificationResult): string {
    const lines: string[] = [];
    
    lines.push("## 🔍 Semi-Formal Verification Result");
    lines.push("");
    
    if (result.passed) {
      lines.push("✅ **Verification PASSED**");
    } else {
      lines.push("❌ **Verification FAILED**");
    }
    
    lines.push("");
    lines.push(`**Confidence:** ${result.confidence}`);
    lines.push(`**Methods Used:** ${result.methodsUsed.join(", ")}`);
    lines.push(`**Consensus:** ${result.consensus ? "Yes" : "No"}`);
    lines.push("");
    
    lines.push("### Summary");
    lines.push(result.reason);
    lines.push("");
    
    if (result.certificate) {
      lines.push("### Certificate Details");
      lines.push(`- Premises: ${result.certificate.premises.length}`);
      lines.push(`- Execution Traces: ${result.certificate.executionTraces.length}`);
      lines.push(`- Conclusion: ${result.certificate.conclusion.answer}`);
      lines.push("");
    }
    
    lines.push("---");
    lines.push("*Powered by allternit Semi-Formal Verification*");
    
    return lines.join("\n");
  }
  
  private async setErrorStatus(error: Error): Promise<void> {
    const { token, repository, commitSha } = this.config;
    
    try {
      await fetch(
        `https://api.github.com/repos/${repository}/statuses/${commitSha}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/vnd.github.v3+json",
          },
          body: JSON.stringify({
            state: "error",
            context: "verification/semi-formal",
            description: `Error: ${error.message.slice(0, 100)}`,
          }),
        }
      );
    } catch {
      // Ignore errors in error handling
    }
  }
}

// ============================================================================
// Environment Detection
// ============================================================================

export interface DetectedEnvironment {
  /** CI provider */
  ci: "github" | "gitlab" | "jenkins" | "circleci" | "none";
  /** Whether in CI environment */
  isCI: boolean;
}

export function detectCIEnvironment(): DetectedEnvironment {
  const env = process.env;
  
  if (env.GITHUB_ACTIONS === "true") {
    return { ci: "github", isCI: true };
  }
  
  if (env.GITLAB_CI === "true") {
    return { ci: "gitlab", isCI: true };
  }
  
  if (env.JENKINS_URL) {
    return { ci: "jenkins", isCI: true };
  }
  
  if (env.CIRCLECI === "true") {
    return { ci: "circleci", isCI: true };
  }
  
  return { ci: "none", isCI: false };
}

// ============================================================================
// Convenience Functions
// ============================================================================

export async function runInGitHubActions(
  verifyFn: () => Promise<OrchestratedVerificationResult>
): Promise<{ passed: boolean; result: OrchestratedVerificationResult }> {
  const integration = new GitHubActionsIntegration({
    token: process.env.GITHUB_TOKEN || "",
    repository: process.env.GITHUB_REPOSITORY || "",
    commitSha: process.env.GITHUB_SHA || "",
    prNumber: process.env.GITHUB_PR_NUMBER 
      ? parseInt(process.env.GITHUB_PR_NUMBER, 10)
      : undefined,
    postComment: true,
    setStatus: true,
    minConfidence: "medium",
  });
  
  return integration.runVerification(verifyFn);
}
