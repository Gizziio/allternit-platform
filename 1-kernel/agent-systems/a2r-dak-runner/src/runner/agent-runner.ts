/**
 * Agent Runner (DAK)
 * 
 * Main orchestration class that ties together:
 * - Hook runtime for tool execution
 * - Policy bundle management
 * - Context pack compilation
 * - Worker management and Ralph loops
 * - Rails integration
 * - Observability
 */

import { HookRuntime, createHookRuntime } from '../hooks/runtime';
import { ToolRegistry, getToolRegistry } from '../tools/registry';
import { ToolEnforcement, createToolEnforcement } from '../tools/enforce';
import { PolicyEngine, createPolicyEngine } from '../policy_engine/engine';
import { PolicyBundleBuilder, createPolicyBundle } from '../policy/bundle-builder';
import { ContextPackBuilder, createContextPackBuilder } from '../context/builder';
import { PlanManager, createPlanManager } from '../plan/manager';
import { WorkerManager, createWorkerManager } from '../workers/manager';
import { RalphLoop, createRalphLoop } from '../loop/ralph';
import { RailsAdapter, createRailsAdapter } from '../adapters/rails_api';
import { ObservabilityLogger, createObservabilityLogger } from '../observability/events';
import {
  RunId,
  WihId,
  DagId,
  NodeId,
  Role,
  ExecutionMode,
  WorkRequest,
  ContextPack,
  PolicyBundle,
  ToolCall,
  ToolResult,
  ReceiptId,
  GateDecision,
  Lease,
} from '../types';

export interface AgentRunnerConfig {
  runId: RunId;
  projectPath: string;
  railsCliPath: string;
  outputDir: string;
}

export interface AgentRunnerContext {
  runId: RunId;
  wihId?: WihId;
  dagId?: DagId;
  nodeId?: NodeId;
  role?: Role;
  contextPack?: ContextPack;
  policyBundle?: PolicyBundle;
  lease?: Lease;
}

export class AgentRunner {
  private config: AgentRunnerConfig;
  private context: AgentRunnerContext;
  
  // Core components
  private toolRegistry: ToolRegistry;
  private policyEngine: PolicyEngine;
  private policyBundleBuilder: PolicyBundleBuilder;
  private contextPackBuilder: ContextPackBuilder;
  private planManager: PlanManager;
  private workerManager: WorkerManager;
  private railsAdapter: RailsAdapter;
  private observability: ObservabilityLogger;
  
  // Runtime
  private hookRuntime?: HookRuntime;
  private ralphLoop?: RalphLoop;

  constructor(config: AgentRunnerConfig) {
    this.config = config;
    this.context = { runId: config.runId };
    
    // Initialize components
    this.toolRegistry = getToolRegistry();
    this.policyEngine = createPolicyEngine();
    this.policyBundleBuilder = new PolicyBundleBuilder();
    this.contextPackBuilder = createContextPackBuilder(config.projectPath);
    this.planManager = createPlanManager(`${config.outputDir}/plans`);
    this.workerManager = createWorkerManager();
    this.railsAdapter = createRailsAdapter({
      cliPath: config.railsCliPath,
      projectPath: config.projectPath,
    });
    this.observability = createObservabilityLogger({
      outputDir: `${config.outputDir}/observability`,
      runId: config.runId,
      enableConsole: true,
    });

    // Setup worker event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize the runner
   */
  async initialize(): Promise<void> {
    await this.policyBundleBuilder.initialize();
    
    // Create plan files for this run
    await this.planManager.initialize(this.config.runId);
  }

  /**
   * Discover available work from Rails
   */
  async discoverWork(): Promise<WorkRequest[]> {
    return this.railsAdapter.discoverWork();
  }

  /**
   * Claim and execute a work item
   */
  async executeWork(request: WorkRequest): Promise<{
    success: boolean;
    receipts: ReceiptId[];
    error?: string;
  }> {
    try {
      // Update context
      this.context.wihId = request.wihId;
      this.context.dagId = request.dagId;
      this.context.nodeId = request.nodeId;
      this.context.role = request.role;

      // Step 1: Claim work via lease
      const claim = await this.railsAdapter.claimWork(
        request.dagId,
        request.nodeId,
        request.wihId,
        `runner:${this.config.runId}`,
        request.leaseScope.allowedPaths,
        900
      );

      if (!claim.success || !claim.lease) {
        throw new Error(`Failed to claim work: ${claim.error}`);
      }

      this.context.lease = claim.lease;

      // Step 2: Build policy bundle
      const policyBundle = this.policyBundleBuilder.buildBundle(
        request.role,
        request.executionMode,
        this.config.runId
      );
      this.context.policyBundle = policyBundle;

      // Step 3: Build context pack
      const contextPack = await this.contextPackBuilder.buildMinimal(
        request.wihId,
        request.dagId,
        request.nodeId,
        policyBundle.bundle_id
      );
      this.context.contextPack = contextPack;

      // Step 4: Initialize hook runtime
      this.hookRuntime = createHookRuntime(
        {
          runId: this.config.runId,
          wihId: request.wihId,
          dagId: request.dagId,
          nodeId: request.nodeId,
          role: request.role,
          contextPackId: contextPack.contextPackId,
          policyBundleId: policyBundle.bundle_id,
        },
        this.createGateChecker(),
        this.createToolExecutor(),
        this.createReceiptEmitter()
      );

      // Step 5: Start session
      await this.hookRuntime.start('startup');

      // Step 6: Execute based on role
      let result: { success: boolean; receipts: ReceiptId[] };

      switch (request.role) {
        case 'orchestrator':
          result = await this.executeAsOrchestrator(request);
          break;
        case 'builder':
          result = await this.executeAsBuilder(request);
          break;
        case 'validator':
          result = await this.executeAsValidator(request);
          break;
        default:
          throw new Error(`Unsupported role: ${request.role}`);
      }

      // Step 7: End session
      await this.hookRuntime.end(result.success ? 'completed' : 'failed');

      // Step 8: Finalize observability
      await this.observability.finalize(result.success ? 'completed' : 'failed');

      // Step 9: Release lease
      await this.railsAdapter.releaseLease(claim.lease.leaseId);

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Try to end session gracefully
      if (this.hookRuntime?.active) {
        await this.hookRuntime.end('error');
      }

      await this.observability.finalize('failed');

      return {
        success: false,
        receipts: [],
        error: errorMsg,
      };
    }
  }

  /**
   * Execute as orchestrator (spawns builder/validator)
   */
  private async executeAsOrchestrator(request: WorkRequest): Promise<{
    success: boolean;
    receipts: ReceiptId[];
  }> {
    // Initialize Ralph loop
    this.ralphLoop = createRalphLoop(
      this.workerManager,
      this.planManager,
      { maxFixCycles: 3, enableParallelValidation: false }
    );

    // Create plan files
    const planFiles = await this.planManager.initialize(this.config.runId);

    // Execute node through Ralph loop
    const result = await this.ralphLoop.executeNode({
      dagId: request.dagId,
      nodeId: request.nodeId,
      wihId: request.wihId,
      runId: this.config.runId,
      baseContextPack: this.context.contextPack!,
      basePolicyBundle: this.context.policyBundle!,
      planFiles,
    });

    // Request WIH close if successful
    if (result.success && result.validatorReceipt) {
      await this.railsAdapter.requestWihClose(
        request.wihId,
        'DONE',
        [...result.builderReceipts, result.validatorReceipt]
      );
    }

    return {
      success: result.success,
      receipts: result.validatorReceipt 
        ? [...result.builderReceipts, result.validatorReceipt]
        : result.builderReceipts,
    };
  }

  /**
   * Execute as builder (single worker)
   */
  private async executeAsBuilder(request: WorkRequest): Promise<{
    success: boolean;
    receipts: ReceiptId[];
  }> {
    // Builder work is handled by Ralph loop orchestration
    // This would be direct execution if not using Ralph
    throw new Error('Builder execution should be called through Ralph loop');
  }

  /**
   * Execute as validator (single worker)
   */
  private async executeAsValidator(request: WorkRequest): Promise<{
    success: boolean;
    receipts: ReceiptId[];
  }> {
    // Validator work is handled by Ralph loop orchestration
    throw new Error('Validator execution should be called through Ralph loop');
  }

  /**
   * Get current context
   */
  getContext(): AgentRunnerContext {
    return { ...this.context };
  }

  /**
   * Get worker statistics
   */
  getWorkerStats() {
    return this.workerManager.getStats();
  }

  // Private helpers

  private createGateChecker() {
    const enforcement = createToolEnforcement(this.toolRegistry, this.policyEngine);
    
    return {
      check: async (toolCall: ToolCall) => {
        const result = await enforcement.enforce(toolCall, {
          runId: this.config.runId,
          wihId: this.context.wihId!,
          role: this.context.role!,
          policyConstraints: this.context.policyBundle!.constraints,
          leasePaths: this.context.lease?.scope.paths,
        });

        // Log gate decision
        await this.observability.logGateDecision(
          toolCall.correlationId,
          toolCall.tool,
          result.decision,
          result.reason
        );

        return {
          decision: result.decision,
          transformedArgs: result.transformedArgs,
          reason: result.reason,
        };
      },

      commit: async (toolCall: ToolCall, result: ToolResult, receiptId: ReceiptId) => {
        // Gate commit through Rails
        await this.railsAdapter.gateCommit(
          `check_${toolCall.correlationId}`,
          toolCall,
          result,
          receiptId
        );
      },

      fail: async (toolCall: ToolCall, error: ToolResult['error'], receiptId: ReceiptId) => {
        // Gate fail through Rails
        await this.railsAdapter.gateFail(
          `check_${toolCall.correlationId}`,
          toolCall,
          error,
          receiptId
        );
      },
    };
  }

  private createToolExecutor() {
    return {
      execute: async (toolCall: ToolCall) => {
        return this.toolRegistry.execute(toolCall);
      },
    };
  }

  private createReceiptEmitter() {
    return {
      emitReceipt: async (kind: string, payload: unknown) => {
        // Write to Rails
        const receiptId = await this.railsAdapter.writeReceipt({
          kind: kind as any,
          runId: this.config.runId,
          dagId: this.context.dagId!,
          nodeId: this.context.nodeId!,
          wihId: this.context.wihId!,
          provenance: {
            agentId: `runner:${this.config.runId}`,
            role: this.context.role!,
            iterationId: 'it_0',
          },
          inputs: {
            contextPackId: this.context.contextPack!.contextPackId,
            policyBundleId: this.context.policyBundle!.bundle_id,
          },
          payload,
          createdAt: new Date().toISOString(),
          correlationId: `corr_${Date.now()}`,
        });

        return receiptId || `rcpt_local_${Date.now()}`;
      },
    };
  }

  private setupEventForwarding() {
    // Forward worker events to observability
    this.workerManager.on('worker:spawned', (data) => {
      this.observability.logWorkerEvent('spawned', data.workerId, data.role);
    });

    this.workerManager.on('worker:completed', (data) => {
      this.observability.logWorkerEvent('completed', data.workerId, data.role);
    });

    this.workerManager.on('worker:terminated', (data) => {
      this.observability.logWorkerEvent('terminated', data.workerId, data.role, { reason: data.reason });
    });
  }
}

// Factory function
export function createAgentRunner(config: AgentRunnerConfig): AgentRunner {
  return new AgentRunner(config);
}
