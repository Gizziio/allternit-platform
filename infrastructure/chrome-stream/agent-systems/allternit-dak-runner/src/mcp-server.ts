#!/usr/bin/env node
/**
 * DAK Runner MCP Server
 *
 * Exposes DAK Runner operations as MCP tools for use by
 * Claude Code, Cursor, or any MCP-compatible client.
 *
 * Transport: stdio (JSON-RPC over stdin/stdout)
 *
 * Tools exposed:
 *   dak_discover_work  — List ready work items from Rails
 *   dak_execute_work   — Execute a specific work item
 *   dak_health         — Check Rails connectivity
 *   dak_worker_stats   — Get worker statistics
 *   dak_dag_status     — Get DAG execution status
 */

import { createInterface } from 'readline';
import { createAgentRunner, AgentRunnerConfig } from './runner/agent-runner';
import { createRailsUnifiedAdapter, RailsUnifiedAdapter, UnifiedRailsConfig } from './adapters/rails_unified';
import type { RunId, DagId, NodeId, WihId } from './types';

// ============================================================================
// MCP Protocol Types
// ============================================================================

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

const TOOLS: McpToolDefinition[] = [
  {
    name: 'dak_discover_work',
    description: 'Discover ready work items from the Rails control plane. Returns a list of work requests with their DAG, node, WIH IDs, roles, and priorities.',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: 'Filter by role (builder, validator, orchestrator)' },
        ready: { type: 'boolean', description: 'Only show ready items (default: true)' },
      },
    },
  },
  {
    name: 'dak_execute_work',
    description: 'Execute a specific work item through the Ralph loop. Claims a lease, builds policy bundle and context pack, runs builder/validator cycle.',
    inputSchema: {
      type: 'object',
      properties: {
        dagId: { type: 'string', description: 'DAG ID (e.g., dag_abc123)' },
        nodeId: { type: 'string', description: 'Node ID (e.g., n_task1)' },
        wihId: { type: 'string', description: 'Work Item Handle ID (e.g., wih_xyz)' },
        role: { type: 'string', enum: ['orchestrator', 'builder', 'validator'], description: 'Execution role' },
        executionMode: { type: 'string', enum: ['PLAN_ONLY', 'REQUIRE_APPROVAL', 'ACCEPT_EDITS'], description: 'Execution mode' },
      },
      required: ['dagId', 'nodeId', 'wihId'],
    },
  },
  {
    name: 'dak_health',
    description: 'Check Rails control plane connectivity and runner health status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dak_worker_stats',
    description: 'Get current worker statistics: total, active, completed, failed, terminated counts.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'dak_dag_status',
    description: 'Get status of a DAG execution including completed, failed, and blocked nodes.',
    inputSchema: {
      type: 'object',
      properties: {
        dagId: { type: 'string', description: 'DAG ID to check status for' },
      },
      required: ['dagId'],
    },
  },
];

// ============================================================================
// Server State
// ============================================================================

interface ServerConfig {
  railsCliPath: string;
  projectPath: string;
  outputDir: string;
  railsHttpUrl?: string;
  railsApiKey?: string;
}

function getServerConfig(): ServerConfig {
  return {
    railsCliPath: process.env.A2R_RAILS_CLI || 'a2r',
    projectPath: process.env.A2R_PROJECT_PATH || process.cwd(),
    outputDir: process.env.A2R_OUTPUT_DIR || '.a2r/runner',
    railsHttpUrl: process.env.A2R_RAILS_HTTP_URL,
    railsApiKey: process.env.A2R_RAILS_API_KEY,
  };
}

function createAdapter(config: ServerConfig): RailsUnifiedAdapter {
  const adapterConfig: UnifiedRailsConfig = {
    cliPath: config.railsCliPath,
    projectPath: config.projectPath,
    preferHttp: !!config.railsHttpUrl,
    fallbackToCli: true,
    ...(config.railsHttpUrl && {
      http: {
        baseURL: config.railsHttpUrl,
        apiKey: config.railsApiKey,
      },
    }),
  };
  return createRailsUnifiedAdapter(adapterConfig);
}

// ============================================================================
// Tool Handlers
// ============================================================================

async function handleToolCall(
  name: string,
  args: Record<string, unknown>,
  config: ServerConfig,
): Promise<unknown> {
  const adapter = createAdapter(config);

  switch (name) {
    case 'dak_discover_work': {
      const work = await adapter.discoverWork();
      return {
        count: work.length,
        items: work.map(w => ({
          dagId: w.dagId,
          nodeId: w.nodeId,
          wihId: w.wihId,
          role: w.role,
          priority: w.priority,
          executionMode: w.executionMode,
          depsSatisfied: w.depsSatisfied,
        })),
      };
    }

    case 'dak_execute_work': {
      const runId: RunId = `run_${Date.now()}`;
      const runnerConfig: AgentRunnerConfig = {
        runId,
        projectPath: config.projectPath,
        railsCliPath: config.railsCliPath,
        outputDir: config.outputDir,
      };

      const runner = createAgentRunner(runnerConfig);
      await runner.initialize();

      // Build a WorkRequest from the provided args
      const workRequest = {
        requestId: `req_${Date.now()}`,
        dagId: (args.dagId as string) as DagId,
        nodeId: (args.nodeId as string) as NodeId,
        wihId: (args.wihId as string) as WihId,
        role: ((args.role as string) || 'orchestrator') as any,
        executionMode: ((args.executionMode as string) || 'ACCEPT_EDITS') as any,
        priority: 0,
        depsSatisfied: true,
        requiredGates: [],
        requiredEvidence: [],
        leaseRequired: true,
        leaseScope: { allowedPaths: ['.'], allowedTools: [] },
        createdAt: new Date().toISOString(),
        correlationId: `corr_${Date.now()}` as any,
      };

      const result = await runner.executeWork(workRequest);
      return {
        success: result.success,
        receipts: result.receipts,
        error: result.error,
        runId,
      };
    }

    case 'dak_health': {
      const health = await adapter.healthCheck();
      return {
        rails: health.status,
        mode: adapter.getMode(),
        version: health.version,
        timestamp: health.timestamp,
      };
    }

    case 'dak_worker_stats': {
      const runId: RunId = `run_${Date.now()}`;
      const runner = createAgentRunner({
        runId,
        projectPath: config.projectPath,
        railsCliPath: config.railsCliPath,
        outputDir: config.outputDir,
      });
      return runner.getWorkerStats();
    }

    case 'dak_dag_status': {
      // Query ledger events for the DAG
      if (adapter.isHttpAvailable()) {
        const events = await (adapter as any).httpAdapter?.queryLedger({
          dagId: args.dagId as string,
          limit: 50,
        });
        return { dagId: args.dagId, events: events || [] };
      }
      return { dagId: args.dagId, status: 'Query requires HTTP adapter' };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ============================================================================
// JSON-RPC Handler
// ============================================================================

async function handleRequest(request: JsonRpcRequest, config: ServerConfig): Promise<JsonRpcResponse> {
  const { id, method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: 'dak-runner',
            version: '0.1.0',
          },
        },
      };

    case 'initialized':
      return { jsonrpc: '2.0', id, result: {} };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS },
      };

    case 'tools/call': {
      const toolName = (params as any)?.name as string;
      const toolArgs = ((params as any)?.arguments || {}) as Record<string, unknown>;

      try {
        const result = await handleToolCall(toolName, toolArgs, config);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      } catch (error) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            isError: true,
          },
        };
      }
    }

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// ============================================================================
// Stdio Transport
// ============================================================================

function startStdioServer(): void {
  const config = getServerConfig();

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  let buffer = '';

  process.stdin.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();

    // Process complete messages (Content-Length framing or newline-delimited)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('Content-Length:') || trimmed === '') {
        continue;
      }

      try {
        const request = JSON.parse(trimmed) as JsonRpcRequest;

        // Handle notifications (no id) silently
        if (request.id === undefined || request.id === null) {
          handleRequest({ ...request, id: 0 }, config).catch(() => {});
          continue;
        }

        handleRequest(request, config)
          .then((response) => {
            const json = JSON.stringify(response);
            process.stdout.write(json + '\n');
          })
          .catch((error) => {
            const errorResponse: JsonRpcResponse = {
              jsonrpc: '2.0',
              id: request.id,
              error: {
                code: -32603,
                message: error instanceof Error ? error.message : String(error),
              },
            };
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
          });
      } catch {
        // Skip non-JSON lines
      }
    }
  });

  process.stdin.on('end', () => {
    process.exit(0);
  });
}

// ============================================================================
// Entry Point
// ============================================================================

startStdioServer();
