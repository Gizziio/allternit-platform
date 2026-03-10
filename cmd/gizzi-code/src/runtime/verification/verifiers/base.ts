/**
 * Base Verifier
 * 
 * Abstract base class and interfaces for all verification implementations.
 */

import type { Plan } from "@/runtime/loop/planner";
import type { ExecutionReceipt } from "@/runtime/loop/executor";
import type { 
  VerificationStrategy, 
  VerificationContext,
  VerificationProgress,
  CodePatch,
} from "../types";

// ============================================================================
// Abstract Verifier Interface
// ============================================================================

/**
 * Base interface for all verifiers
 */
export interface IVerifier<TResult> {
  /** Unique identifier for this verifier instance */
  readonly id: string;
  
  /** Verifier type */
  readonly type: string;
  
  /** Verifier version */
  readonly version: string;
  
  /**
   * Verify a plan's execution
   * 
   * @param plan - The plan that was executed
   * @param receipts - Execution receipts from the plan
   * @param context - Additional verification context
   * @returns Verification result
   */
  verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationContext
  ): Promise<TResult>;
  
  /**
   * Get current progress (for long-running verifications)
   */
  getProgress?(): VerificationProgress | undefined;
  
  /**
   * Cancel an in-progress verification
   */
  cancel?(): Promise<void>;
  
  /**
   * Check if this verifier supports a given strategy
   */
  supportsStrategy(strategy: VerificationStrategy): boolean;
}

// ============================================================================
// Abstract Base Class
// ============================================================================

import { Log } from "@/shared/util/log";
import { EventEmitter } from "events";

export abstract class BaseVerifier<TResult> extends EventEmitter implements IVerifier<TResult> {
  protected log = Log.create({ service: "verification" });
  protected cancelled = false;
  protected progress?: VerificationProgress;
  
  abstract readonly type: string;
  abstract readonly version: string;
  
  constructor(public readonly id: string) {
    super();
  }
  
  /**
   * Main verification method - subclasses must implement
   */
  abstract verify(
    plan: Plan,
    receipts: ExecutionReceipt[],
    context?: VerificationContext
  ): Promise<TResult>;
  
  /**
   * Check if strategy is supported
   */
  abstract supportsStrategy(strategy: VerificationStrategy): boolean;
  
  /**
   * Get current progress
   */
  getProgress(): VerificationProgress | undefined {
    return this.progress;
  }
  
  /**
   * Cancel verification
   */
  async cancel(): Promise<void> {
    this.cancelled = true;
    this.emit("cancelled");
    this.log.info("Verification cancelled", { verifierId: this.id });
  }
  
  /**
   * Check if verification was cancelled
   */
  protected checkCancelled(): void {
    if (this.cancelled) {
      throw new VerificationCancelledError(this.id);
    }
  }
  
  /**
   * Update progress
   */
  protected updateProgress(update: Partial<VerificationProgress>): void {
    if (!this.progress) {
      this.progress = {
        id: this.id,
        status: "running",
        percentComplete: 0,
        currentPhase: "initializing",
        completedPhases: [],
        remainingPhases: [],
        errors: [],
        lastUpdated: new Date().toISOString(),
      };
    }
    
    this.progress = {
      ...this.progress,
      ...update,
      lastUpdated: new Date().toISOString(),
    };
    
    this.emit("progress", this.progress);
  }
  
  /**
   * Execute a phase and track progress
   */
  protected async executePhase<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.checkCancelled();
    
    this.updateProgress({
      currentPhase: name,
      currentOperation: {
        name,
        description: `Executing ${name}...`,
        startedAt: new Date().toISOString(),
      },
    });
    
    this.log.debug(`Starting phase: ${name}`, { verifierId: this.id });
    
    try {
      const result = await fn();
      
      this.updateProgress({
        completedPhases: [...(this.progress?.completedPhases || []), name],
      });
      
      this.log.debug(`Completed phase: ${name}`, { verifierId: this.id });
      
      return result;
    } catch (error) {
      this.updateProgress({
        errors: [
          ...(this.progress?.errors || []),
          {
            phase: name,
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        ],
      });
      throw error;
    }
  }
}

// ============================================================================
// Verification Context Builder
// ============================================================================

import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

export interface ContextBuildOptions {
  /** Root directory of the project */
  projectRoot: string;
  
  /** Files modified */
  modifiedFiles?: string[];
  
  /** Test patterns to look for */
  testPatterns?: string[];
  
  /** Description of changes */
  description?: string;
  
  /** Whether to include file contents */
  includeContents?: boolean;
  
  /** Max file size to include */
  maxFileSize?: number;
  
  /** File patterns to exclude */
  excludePatterns?: string[];
}

export class VerificationContextBuilder {
  private log = Log.create({ service: "verification.context-builder" });
  
  /**
   * Build verification context from project state
   */
  async build(options: ContextBuildOptions): Promise<VerificationContext> {
    this.log.info("Building verification context", {
      projectRoot: options.projectRoot,
      modifiedFiles: options.modifiedFiles?.length || 0,
    });
    
    const context: VerificationContext = {
      description: options.description,
      repository: {
        path: options.projectRoot,
      },
    };
    
    // Find modified files if not provided
    if (!options.modifiedFiles) {
      options.modifiedFiles = await this.findModifiedFiles(options.projectRoot);
    }
    
    // Build patch information
    if (options.modifiedFiles.length > 0) {
      context.patches = await this.buildPatches(
        options.projectRoot,
        options.modifiedFiles,
        options.includeContents,
        options.maxFileSize
      );
    }
    
    // Find relevant test files
    if (options.testPatterns) {
      context.testFiles = await this.findTestFiles(
        options.projectRoot,
        options.testPatterns,
        options.excludePatterns
      );
    }
    
    this.log.info("Context built", {
      patches: context.patches?.length || 0,
      testFiles: context.testFiles?.length || 0,
    });
    
    return context;
  }
  
  /**
   * Find modified files using git
   */
  private async findModifiedFiles(projectRoot: string): Promise<string[]> {
    try {
      const { execSync } = await import("child_process");
      const output = execSync("git diff --name-only HEAD", {
        cwd: projectRoot,
        encoding: "utf-8",
      });
      return output.trim().split("\n").filter(f => f.length > 0);
    } catch {
      this.log.warn("Failed to get modified files from git");
      return [];
    }
  }
  
  /**
   * Build patch objects for modified files
   */
  private async buildPatches(
    projectRoot: string,
    files: string[],
    includeContents?: boolean,
    maxFileSize: number = 1024 * 1024 // 1MB
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];
    
    for (const file of files) {
      try {
        const filePath = path.join(projectRoot, file);
        
        // Get file stats
        const stats = await fs.stat(filePath);
        if (stats.size > maxFileSize) {
          this.log.warn("File too large, skipping content", { file, size: stats.size });
          continue;
        }
        
        // Get diff from git
        const { execSync } = await import("child_process");
        const diff = execSync(`git diff HEAD -- "${file}"`, {
          cwd: projectRoot,
          encoding: "utf-8",
        });
        
        const patch: CodePatch = {
          id: `patch_${file.replace(/[^a-zA-Z0-9]/g, "_")}`,
          path: file,
          description: `Changes to ${file}`,
          diff,
          state: "modified",
        };
        
        // Include contents if requested
        if (includeContents) {
          try {
            patch.modifiedContent = await fs.readFile(filePath, "utf-8");
            
            // Get original content from git
            const original = execSync(`git show HEAD:"${file}"`, {
              cwd: projectRoot,
              encoding: "utf-8",
            });
            patch.originalContent = original;
          } catch (e) {
            this.log.warn("Failed to get file contents", { file, error: e });
          }
        }
        
        patches.push(patch);
      } catch (error) {
        this.log.error("Failed to build patch for file", { file, error });
      }
    }
    
    return patches;
  }
  
  /**
   * Find test files matching patterns
   */
  private async findTestFiles(
    projectRoot: string,
    patterns: string[],
    excludePatterns?: string[]
  ): Promise<string[]> {
    const testFiles: string[] = [];
    
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: projectRoot,
          absolute: false,
          ignore: excludePatterns,
        });
        testFiles.push(...files);
      } catch (error) {
        this.log.error("Failed to find test files", { pattern, error });
      }
    }
    
    return [...new Set(testFiles)]; // Remove duplicates
  }
  
  /**
   * Infer test files related to modified files
   */
  async inferRelatedTests(
    projectRoot: string,
    modifiedFiles: string[],
    testPatterns: string[]
  ): Promise<string[]> {
    const allTests = await this.findTestFiles(projectRoot, testPatterns);
    const related: string[] = [];
    
    for (const testFile of allTests) {
      const testContent = await fs.readFile(
        path.join(projectRoot, testFile),
        "utf-8"
      ).catch(() => "");
      
      // Check if test references any modified files
      for (const modified of modifiedFiles) {
        const baseName = path.basename(modified, path.extname(modified));
        if (testContent.includes(baseName)) {
          related.push(testFile);
          break;
        }
      }
    }
    
    return [...new Set(related)];
  }
}

// ============================================================================
// Evidence Collection System
// ============================================================================

import type { Evidence, SourceLocation } from "../types";

export interface EvidenceCollectorOptions {
  /** Max evidence items to collect */
  maxItems?: number;
  
  /** Whether to include code snippets */
  includeSnippets?: boolean;
  
  /** Max snippet length */
  maxSnippetLength?: number;
}

export class EvidenceCollector {
  private evidence: Evidence[] = [];
  private log = Log.create({ service: "verification.evidence" });
  
  constructor(private options: EvidenceCollectorOptions = {}) {
    this.options = {
      maxItems: 100,
      includeSnippets: true,
      maxSnippetLength: 500,
      ...options,
    };
  }
  
  /**
   * Collect evidence from a file location
   */
  async collectFromLocation(
    description: string,
    location: SourceLocation,
    projectRoot: string,
    method: Evidence["verificationMethod"] = "file_read"
  ): Promise<Evidence | null> {
    try {
      let content: string | undefined;
      let snippet: string | undefined;
      
      if (this.options.includeSnippets) {
        const filePath = path.join(projectRoot, location.file);
        const fileContent = await fs.readFile(filePath, "utf-8");
        const lines = fileContent.split("\n");
        
        // Extract snippet around the location
        const startLine = Math.max(0, location.line - 3);
        const endLine = Math.min(lines.length, location.line + 3);
        snippet = lines.slice(startLine, endLine).join("\n");
        
        if (this.options.maxSnippetLength && snippet.length > this.options.maxSnippetLength) {
          snippet = snippet.substring(0, this.options.maxSnippetLength) + "...";
        }
        
        // Set location snippet
        location.snippet = snippet;
      }
      
      const evidence: Evidence = {
        description,
        sourceLocations: [location],
        verificationMethod: method,
        content,
        timestamp: new Date().toISOString(),
      };
      
      this.evidence.push(evidence);
      
      // Trim if over max
      if (this.evidence.length > (this.options.maxItems || 100)) {
        this.evidence = this.evidence.slice(-(this.options.maxItems || 100));
      }
      
      return evidence;
    } catch (error) {
      this.log.error("Failed to collect evidence", { location, error });
      return null;
    }
  }
  
  /**
   * Collect evidence from code search
   */
  async collectFromSearch(
    description: string,
    query: string,
    locations: SourceLocation[],
    searchResults: string
  ): Evidence {
    const evidence: Evidence = {
      description,
      sourceLocations: locations,
      verificationMethod: "code_search",
      content: searchResults,
      timestamp: new Date().toISOString(),
    };
    
    this.evidence.push(evidence);
    return evidence;
  }
  
  /**
   * Get all collected evidence
   */
  getEvidence(): Evidence[] {
    return [...this.evidence];
  }
  
  /**
   * Clear collected evidence
   */
  clear(): void {
    this.evidence = [];
  }
  
  /**
   * Get evidence count
   */
  get count(): number {
    return this.evidence.length;
  }
}

// ============================================================================
// Error Classes
// ============================================================================

export class VerificationError extends Error {
  constructor(
    message: string,
    public readonly verifierId: string,
    public readonly phase?: string
  ) {
    super(message);
    this.name = "VerificationError";
  }
}

export class VerificationCancelledError extends VerificationError {
  constructor(verifierId: string) {
    super("Verification was cancelled", verifierId);
    this.name = "VerificationCancelledError";
  }
}

export class VerificationTimeoutError extends VerificationError {
  constructor(
    verifierId: string,
    public readonly timeoutMs: number,
    public readonly phase: string
  ) {
    super(`Verification timed out after ${timeoutMs}ms in phase ${phase}`, verifierId, phase);
    this.name = "VerificationTimeoutError";
  }
}

export class VerificationStrategyError extends VerificationError {
  constructor(
    message: string,
    verifierId: string,
    public readonly strategy: VerificationStrategy
  ) {
    super(message, verifierId);
    this.name = "VerificationStrategyError";
  }
}

// ============================================================================
// Hooks System
// ============================================================================

export interface VerificationHooks {
  /** Called before verification starts */
  onStart?(context: { verifierId: string; plan: Plan }): Promise<void> | void;
  
  /** Called when a phase completes */
  onPhaseComplete?(context: {
    verifierId: string;
    phase: string;
    durationMs: number;
  }): Promise<void> | void;
  
  /** Called when evidence is collected */
  onEvidenceCollected?(context: {
    verifierId: string;
    evidence: Evidence;
  }): Promise<void> | void;
  
  /** Called when verification completes */
  onComplete?(context: {
    verifierId: string;
    result: unknown;
    durationMs: number;
  }): Promise<void> | void;
  
  /** Called when verification fails */
  onError?(context: {
    verifierId: string;
    error: Error;
    phase?: string;
  }): Promise<void> | void;
}

export class VerificationHookManager {
  private hooks: VerificationHooks[] = [];
  
  register(hooks: VerificationHooks): void {
    this.hooks.push(hooks);
  }
  
  unregister(hooks: VerificationHooks): void {
    const index = this.hooks.indexOf(hooks);
    if (index > -1) {
      this.hooks.splice(index, 1);
    }
  }
  
  async triggerStart(context: { verifierId: string; plan: Plan }): Promise<void> {
    for (const hooks of this.hooks) {
      if (hooks.onStart) {
        await hooks.onStart(context);
      }
    }
  }
  
  async triggerPhaseComplete(context: {
    verifierId: string;
    phase: string;
    durationMs: number;
  }): Promise<void> {
    for (const hooks of this.hooks) {
      if (hooks.onPhaseComplete) {
        await hooks.onPhaseComplete(context);
      }
    }
  }
  
  async triggerEvidenceCollected(context: {
    verifierId: string;
    evidence: Evidence;
  }): Promise<void> {
    for (const hooks of this.hooks) {
      if (hooks.onEvidenceCollected) {
        await hooks.onEvidenceCollected(context);
      }
    }
  }
  
  async triggerComplete(context: {
    verifierId: string;
    result: unknown;
    durationMs: number;
  }): Promise<void> {
    for (const hooks of this.hooks) {
      if (hooks.onComplete) {
        await hooks.onComplete(context);
      }
    }
  }
  
  async triggerError(context: {
    verifierId: string;
    error: Error;
    phase?: string;
  }): Promise<void> {
    for (const hooks of this.hooks) {
      if (hooks.onError) {
        await hooks.onError(context);
      }
    }
  }
}

// Global hook manager
export const globalVerificationHooks = new VerificationHookManager();
