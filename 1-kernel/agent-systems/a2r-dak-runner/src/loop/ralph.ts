/**
 * Ralph Loop
 * 
 * Bounded fix cycle orchestration:
 * 1. Spawn Builder worker
 * 2. Builder produces artifacts
 * 3. Spawn Validator worker
 * 4. Validator produces PASS/FAIL report
 * 5. If PASS: Node DONE
 * 6. If FAIL and fix cycles < max: retry with fixes
 * 7. If FAIL and fix cycles >= max: Escalate
 */

import { EventEmitter } from 'events';
import { WorkerManager, Worker, WorkerConfig, WorkerResult } from '../workers/manager';
import { PlanManager } from '../plan/manager';
import {
  RunId,
  WihId,
  DagId,
  NodeId,
  IterationId,
  ContextPack,
  PolicyBundleId,
  ReceiptId,
} from '../types';
import type { PolicyBundle } from '../policy/bundle-builder';

export interface RalphLoopConfig {
  maxFixCycles: number;
  enableParallelValidation: boolean;
}

export interface NodeExecutionRequest {
  dagId: DagId;
  nodeId: NodeId;
  wihId: WihId;
  runId: RunId;
  baseContextPack: ContextPack;
  basePolicyBundle: PolicyBundle;
  planFiles: {
    planPath: string;
    todoPath: string;
    progressPath: string;
    findingsPath: string;
  };
}

export interface RalphLoopResult {
  success: boolean;
  nodeId: NodeId;
  finalStatus: 'DONE' | 'FAILED' | 'BLOCKED';
  iterations: number;
  builderReceipts: ReceiptId[];
  validatorReceipt?: ReceiptId;
  escalationReason?: string;
}

export interface ValidatorReport {
  verdict: 'PASS' | 'FAIL';
  reasons: string[];
  requiredFixes?: string[];
  affectedFiles?: string[];
}

export class RalphLoop extends EventEmitter {
  private workerManager: WorkerManager;
  private planManager: PlanManager;
  private config: RalphLoopConfig;

  constructor(
    workerManager: WorkerManager,
    planManager: PlanManager,
    config: RalphLoopConfig = { maxFixCycles: 3, enableParallelValidation: false }
  ) {
    super();
    this.workerManager = workerManager;
    this.planManager = planManager;
    this.config = config;
  }

  /**
   * Execute a node through the Ralph loop
   */
  async executeNode(request: NodeExecutionRequest): Promise<RalphLoopResult> {
    const { dagId, nodeId, wihId, runId, baseContextPack, basePolicyBundle, planFiles } = request;

    let iteration = 0;
    let builderReceipts: ReceiptId[] = [];
    let validatorReceipt: ReceiptId | undefined;
    let lastValidatorReport: ValidatorReport | undefined;

    this.emit('node:started', { dagId, nodeId, wihId, runId });

    while (iteration < this.config.maxFixCycles) {
      iteration++;
      const iterationId: IterationId = `it_${iteration}`;

      this.emit('iteration:started', { dagId, nodeId, iterationId, cycle: iteration });
      await this.planManager.logProgress(
        planFiles.progressPath,
        `Starting iteration ${iteration}`,
        iterationId
      );

      // Phase 1: Builder
      const builderResult = await this.runBuilder(
        dagId,
        nodeId,
        wihId,
        runId,
        iterationId,
        baseContextPack,
        basePolicyBundle,
        lastValidatorReport?.requiredFixes,
        planFiles
      );

      if (!builderResult.success) {
        this.emit('builder:failed', { dagId, nodeId, iterationId, error: builderResult.error });
        await this.planManager.logProgress(
          planFiles.progressPath,
          `Builder failed: ${builderResult.error}`,
          iterationId
        );
        
        // Check if we should retry or escalate
        if (iteration >= this.config.maxFixCycles) {
          return {
            success: false,
            nodeId,
            finalStatus: 'FAILED',
            iterations: iteration,
            builderReceipts,
            escalationReason: `Builder failed after ${iteration} attempts: ${builderResult.error}`,
          };
        }
        continue;
      }

      builderReceipts.push(...(builderResult.receiptIds || []) as ReceiptId[]);
      this.emit('builder:completed', { dagId, nodeId, iterationId, artifacts: builderResult.artifacts });

      // Phase 2: Validator (only if builder succeeded)
      const validatorResult = await this.runValidator(
        dagId,
        nodeId,
        wihId,
        runId,
        iterationId,
        baseContextPack,
        basePolicyBundle,
        builderResult.artifacts || [],
        planFiles
      );

      if (!validatorResult.success) {
        this.emit('validator:error', { dagId, nodeId, iterationId, error: validatorResult.error });
        await this.planManager.logProgress(
          planFiles.progressPath,
          `Validator error: ${validatorResult.error}`,
          iterationId
        );
        
        if (iteration >= this.config.maxFixCycles) {
          return {
            success: false,
            nodeId,
            finalStatus: 'FAILED',
            iterations: iteration,
            builderReceipts,
            escalationReason: `Validator error after ${iteration} attempts: ${validatorResult.error}`,
          };
        }
        continue;
      }

      validatorReceipt = validatorResult.receiptIds?.[0] as ReceiptId | undefined;
      lastValidatorReport = validatorResult.report as ValidatorReport;

      this.emit('validator:completed', { 
        dagId, 
        nodeId, 
        iterationId, 
        verdict: lastValidatorReport.verdict 
      });

      // Check validator verdict
      if (lastValidatorReport.verdict === 'PASS') {
        this.emit('node:completed', { dagId, nodeId, iterations: iteration });
        await this.planManager.logProgress(
          planFiles.progressPath,
          `Node completed after ${iteration} iteration(s) - Validator PASS`,
          iterationId
        );

        return {
          success: true,
          nodeId,
          finalStatus: 'DONE',
          iterations: iteration,
          builderReceipts,
          validatorReceipt,
        };
      }

      // Validator FAIL - log and continue to next iteration
      this.emit('validator:failed', { 
        dagId, 
        nodeId, 
        iterationId, 
        reasons: lastValidatorReport.reasons,
        requiredFixes: lastValidatorReport.requiredFixes 
      });

      await this.planManager.logProgress(
        planFiles.progressPath,
        `Validator FAIL: ${lastValidatorReport.reasons.join('; ')}`,
        iterationId
      );

      await this.planManager.recordFinding(planFiles.findingsPath, {
        category: 'issue',
        description: `Iteration ${iteration} failed validation: ${lastValidatorReport.reasons.join(', ')}`,
        relatedFiles: lastValidatorReport.affectedFiles,
      });

      // Check if we've exceeded max fix cycles
      if (iteration >= this.config.maxFixCycles) {
        this.emit('node:escalated', { 
          dagId, 
          nodeId, 
          reason: `Max fix cycles (${this.config.maxFixCycles}) exceeded` 
        });

        return {
          success: false,
          nodeId,
          finalStatus: 'BLOCKED',
          iterations: iteration,
          builderReceipts,
          validatorReceipt,
          escalationReason: `Max fix cycles (${this.config.maxFixCycles}) exceeded. Required fixes: ${lastValidatorReport.requiredFixes?.join(', ')}`,
        };
      }

      // Log that we're retrying
      await this.planManager.logProgress(
        planFiles.progressPath,
        `Retrying with fixes: ${lastValidatorReport.requiredFixes?.join(', ')}`,
        iterationId
      );
    }

    // Should not reach here, but just in case
    return {
      success: false,
      nodeId,
      finalStatus: 'FAILED',
      iterations: iteration,
      builderReceipts,
      validatorReceipt,
      escalationReason: 'Unexpected loop termination',
    };
  }

  /**
   * Run builder worker
   */
  private async runBuilder(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    runId: RunId,
    iterationId: IterationId,
    contextPack: ContextPack,
    policyBundle: PolicyBundle,
    requiredFixes?: string[],
    planFiles?: { findingsPath: string }
  ): Promise<WorkerResult> {
    // Create builder-specific policy bundle
    const builderPolicy: PolicyBundle = {
      ...policyBundle,
      role: 'builder',
      constraints: {
        ...policyBundle.constraints,
        require_validator: true,
      },
    };

    const builderConfig: WorkerConfig = {
      role: 'builder',
      contextPack,
      policyBundleId: builderPolicy.bundle_id as PolicyBundleId,
      policyBundle: builderPolicy,
      timeboxSeconds: 1800, // 30 min timebox
    };

    const worker = await this.workerManager.spawnWorker(
      dagId,
      nodeId,
      wihId,
      runId,
      iterationId,
      builderConfig
    );

    // In real implementation, this would execute the builder
    // For now, simulate success
    const result: WorkerResult = {
      success: true,
      artifacts: ['src/new_feature.ts', 'tests/new_feature.test.ts'],
      receiptIds: [`rcpt_builder_${Date.now()}`],
      report: {
        filesCreated: 2,
        testsAdded: 1,
        requiredFixes: requiredFixes ? `Addressing: ${requiredFixes.join(', ')}` : 'Initial build',
      },
    };

    await this.workerManager.completeWorker(worker.id, result);
    return result;
  }

  /**
   * Run validator worker
   */
  private async runValidator(
    dagId: DagId,
    nodeId: NodeId,
    wihId: WihId,
    runId: RunId,
    iterationId: IterationId,
    contextPack: ContextPack,
    policyBundle: PolicyBundle,
    artifacts: string[],
    planFiles?: { findingsPath: string }
  ): Promise<WorkerResult> {
    // Create validator-specific policy bundle (read-only)
    const validatorPolicy: PolicyBundle = {
      ...policyBundle,
      role: 'validator',
      constraints: {
        ...policyBundle.constraints,
        allowed_tools: ['Read', 'Glob', 'Grep', 'Search', 'Test'], // No Write/Edit
        write_scope: {
          ...policyBundle.constraints.write_scope,
          allowed_globs: [], // Read-only
        },
      },
    };

    const validatorConfig: WorkerConfig = {
      role: 'validator',
      contextPack,
      policyBundleId: validatorPolicy.bundle_id as PolicyBundleId,
      policyBundle: validatorPolicy,
      parentWihId: wihId, // Validator is child of builder context
      timeboxSeconds: 600, // 10 min timebox
    };

    const worker = await this.workerManager.spawnWorker(
      dagId,
      nodeId,
      wihId,
      runId,
      iterationId,
      validatorConfig
    );

    // In real implementation, this would run validation
    // Simulate PASS for odd iterations, FAIL for even (to test loop)
    const shouldPass = Math.random() > 0.5; // Random for demo

    const report: ValidatorReport = shouldPass
      ? {
          verdict: 'PASS',
          reasons: ['All tests pass', 'Code quality acceptable'],
          affectedFiles: artifacts,
        }
      : {
          verdict: 'FAIL',
          reasons: ['Test failures detected', 'Code style issues'],
          requiredFixes: ['Fix failing tests', 'Address lint errors'],
          affectedFiles: artifacts,
        };

    const result: WorkerResult = {
      success: true,
      artifacts: [],
      receiptIds: [`rcpt_validator_${Date.now()}`],
      report,
    };

    await this.workerManager.completeWorker(worker.id, result);
    return result;
  }
}

// Factory function
export function createRalphLoop(
  workerManager: WorkerManager,
  planManager: PlanManager,
  config?: RalphLoopConfig
): RalphLoop {
  return new RalphLoop(workerManager, planManager, config);
}
