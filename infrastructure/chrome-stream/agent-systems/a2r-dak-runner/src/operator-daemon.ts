#!/usr/bin/env node
/**
 * DAK Runner - Direct Operator Mode
 *
 * Runs the DAK Runner in direct execution mode, receiving work items
 * from the Operator UI via HTTP/WebSocket instead of polling Rails.
 *
 * Usage:
 *   dak-operator                    # Start on default port 3010
 *   dak-operator --port 3011        # Custom port
 *   dak-operator --api-key secret   # Require API key
 *
 * Environment:
 *   A2R_OPERATOR_PORT      Port to listen on (default: 3010)
 *   A2R_OPERATOR_API_KEY   API key for authentication
 *   A2R_PROJECT_PATH       Project root (default: cwd)
 *   A2R_OUTPUT_DIR         Output directory (default: .a2r/runner)
 */

import { DirectOperatorAdapter, createDirectOperatorAdapter } from './adapters/direct-operator';
import { RalphLoop, createRalphLoop } from './loop/ralph';
import { ContextPackBuilder, createContextPackBuilder } from './context/builder';
import { WorkerManager, createWorkerManager } from './workers/manager';
import { PlanManager, createPlanManager } from './plan/manager';
import { OperatorWorkRequest, OperatorEvent } from './adapters/direct-operator';

interface OperatorConfig {
  port: number;
  host?: string;
  apiKey?: string;
  projectPath: string;
  outputDir: string;
}

function parseArgs(): OperatorConfig {
  const args = process.argv.slice(2);
  const config: OperatorConfig = {
    port: parseInt(process.env.A2R_OPERATOR_PORT || '3010', 10),
    host: process.env.A2R_OPERATOR_HOST || '127.0.0.1',
    apiKey: process.env.A2R_OPERATOR_API_KEY,
    projectPath: process.env.A2R_PROJECT_PATH || process.cwd(),
    outputDir: process.env.A2R_OUTPUT_DIR || '.a2r/runner',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        config.port = parseInt(args[++i], 10);
        break;
      case '--host':
        config.host = args[++i];
        break;
      case '--api-key':
        config.apiKey = args[++i];
        break;
      case '--project':
        config.projectPath = args[++i];
        break;
      case '--output':
        config.outputDir = args[++i];
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }

  return config;
}

function printUsage(): void {
  process.stdout.write(`
DAK Runner - Direct Operator Mode

Usage: dak-operator [options]

Options:
  --port <n>             Port to listen on (default: 3010)
  --host <host>          Host to bind to (default: 127.0.0.1)
  --api-key <key>        API key for authentication
  --project <path>       Project root path
  --output <path>        Output directory
  -h, --help             Show this help

Environment:
  A2R_OPERATOR_PORT      Port to listen on
  A2R_OPERATOR_HOST      Host to bind to
  A2R_OPERATOR_API_KEY   API key for authentication
  A2R_PROJECT_PATH       Project root
  A2R_OUTPUT_DIR         Output directory

Endpoints:
  POST /work/submit      Submit work item
  GET  /events/:id       SSE event stream
  GET  /health           Health check
  WS   /operator/ws      WebSocket events
`);
}

function log(level: string, msg: string, data?: Record<string, unknown>): void {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...data,
  };
  process.stdout.write(JSON.stringify(entry) + '\n');
}

async function startOperator(config: OperatorConfig): Promise<void> {
  log('info', 'DAK Operator starting', {
    port: config.port,
    host: config.host,
    projectPath: config.projectPath,
  });

  // Create components
  const workerManager = createWorkerManager();
  const planManager = createPlanManager(`${config.outputDir}/plans`);
  const contextPackBuilder = createContextPackBuilder({ basePath: config.projectPath });
  
  const ralphLoop = createRalphLoop(workerManager, planManager, {
    maxFixCycles: 3,
    enableParallelValidation: false,
  });

  // Create direct operator adapter
  const operatorAdapter = createDirectOperatorAdapter({
    port: config.port,
    host: config.host,
    apiKey: config.apiKey,
    enableWebSocket: true,
  });

  // Wire work items to Ralph loop
  operatorAdapter.on('work:available', async (workItem: any) => {
    // Handle both QueuedWorkItem and OperatorWorkRequest formats
    const workRequest = workItem.request || workItem;
    
    log('info', 'Work item received', {
      requestId: workRequest.requestId,
      intent: workRequest.intent ? workRequest.intent.substring(0, 50) + '...' : 'unknown',
      mode: workRequest.mode,
    });

    try {
      // Emit planning event
      operatorAdapter.emitEvent({
        type: 'planning',
        requestId: workRequest.requestId,
        data: { status: 'analyzing' },
        timestamp: Date.now(),
      });

      // For plan_only mode, just generate and return the plan
      if (workRequest.mode === 'plan_only') {
        const plan = await generatePlan(workRequest, planManager, contextPackBuilder);
        
        operatorAdapter.emitEvent({
          type: 'plan_ready',
          requestId: workRequest.requestId,
          data: { plan },
          timestamp: Date.now(),
        });
        return;
      }

      // For plan_then_execute or execute_direct, execute the work
      if (workRequest.mode === 'plan_then_execute' || workRequest.mode === 'execute_direct') {
        // First generate plan
        const plan = await generatePlan(workRequest, planManager, contextPackBuilder);

        operatorAdapter.emitEvent({
          type: 'plan_ready',
          requestId: workRequest.requestId,
          data: { plan },
          timestamp: Date.now(),
        });

        // Wait for approval (client will call /work/approve or timeout)
        // For golden path, we auto-approve for demo
        await new Promise(resolve => setTimeout(resolve, 500));

        // Execute through the adapter's executeWork method
        // This is where actual Canvas operations happen
        log('info', 'Executing work', {
          requestId: workRequest.requestId,
          planId: plan.id,
        });

        // The adapter will handle execution and emit events
        // For now, emit executing event directly
        operatorAdapter.emitEvent({
          type: 'executing',
          requestId: workRequest.requestId,
          data: { planId: plan.id },
          timestamp: Date.now(),
        });

        // In full implementation, this would call adapter.executeWork()
        // For golden path demo, execution happens when /work/approve is called
      }
    } catch (error: any) {
      log('error', 'Work execution failed', { 
        requestId: workRequest.requestId,
        error: error.message,
      });

      operatorAdapter.emitEvent({
        type: 'error',
        requestId: workRequest.requestId,
        data: { error: error.message },
        timestamp: Date.now(),
      });
    }
  });

  // Start the adapter
  await operatorAdapter.start();

  // Worker health monitoring
  workerManager.startHealthMonitoring();
  workerManager.on('worker:unhealthy', (data) => {
    log('error', 'Worker unhealthy', data);
  });

  // Graceful shutdown
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;

    log('info', 'Shutdown requested', { signal });
    await operatorAdapter.stop();
    workerManager.stopHealthMonitoring();

    log('info', 'Operator shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('TERM'));

  log('info', 'DAK Operator ready', {
    endpoints: {
      submit: `http://${config.host}:${config.port}/work/submit`,
      events: `http://${config.host}:${config.port}/events/:requestId`,
      health: `http://${config.host}:${config.port}/health`,
      websocket: `ws://${config.host}:${config.port}/operator/ws`,
    },
  });
}

/**
 * Generate a plan from the work request
 */
async function generatePlan(
  workRequest: OperatorWorkRequest,
  planManager: PlanManager,
  contextPackBuilder: ContextPackBuilder
): Promise<any> {
  // This is a simplified plan generator
  // In production, this would call the Kernel's planning service
  
  // Defensive: ensure preferences exist with defaults
  const prefs = workRequest.preferences || {
    prefer_connector: true,
    allow_browser_automation: true,
    allow_desktop_fallback: false,
  };

  const steps = [
    {
      id: '1',
      title: 'Analyze context',
      description: `Inspect ${workRequest.context.target_type} target`,
      status: 'pending' as const,
      backend: prefs.prefer_connector ? 'connector' : 'browser_automation',
      risk: 'low' as const,
    },
    {
      id: '2',
      title: 'Execute action',
      description: workRequest.intent,
      status: 'pending' as const,
      backend: prefs.allow_browser_automation ? 'browser_automation' : 'connector',
      risk: 'medium' as const,
    },
    {
      id: '3',
      title: 'Verify result',
      description: 'Confirm action succeeded',
      status: 'pending' as const,
      backend: 'verification',
      risk: 'low' as const,
    },
  ];

  return {
    id: `plan_${workRequest.requestId}`,
    goal: workRequest.intent,
    steps,
    risk: 'medium' as const,
    backend: prefs.prefer_connector ? 'connector' : 'browser_automation',
  };
}

/**
 * Execute work through Ralph loop
 */
async function executeWork(
  workRequest: OperatorWorkRequest,
  plan: any,
  ralphLoop: RalphLoop,
  contextPackBuilder: ContextPackBuilder
): Promise<any> {
  // Simplified execution - in production this would use the full scheduler
  // and execute each step through the Ralph loop
  
  const results = [];
  
  for (const step of plan.steps) {
    // Emit step start
    // In full implementation, this would execute through Ralph loop
    
    // Simulate execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    results.push({
      stepId: step.id,
      status: 'completed',
      timestamp: Date.now(),
    });
  }

  return {
    planId: plan.id,
    results,
    status: 'success',
  };
}

// Entry point
const config = parseArgs();
startOperator(config).catch((error) => {
  log('fatal', 'Operator crashed', { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
