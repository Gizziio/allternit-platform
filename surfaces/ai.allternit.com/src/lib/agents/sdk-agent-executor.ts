/**
 * SDK Agent Executor
 *
 * Bridges the platform's agent records to the @allternit/sdk AllternitAgent/AgentRun
 * runtime. Used by agents/v1 to execute completions with native tool registry
 * instead of prompt-injected gizzi sessions.
 */

import {
  AllternitHarness,
  AllternitAgent,
  ToolRegistry,
  AgentRun,
  type HarnessConfig,
  type Message,
  type StreamRequest,
  type AgentProfile,
  type ToolDefinition,
  type ReplyRequest,
  type ReplyOutcome,
} from "@allternit/sdk/ai-runtime";
import type { Agent } from "./agent.types";
import { promises as fs } from "fs";
import path from "path";
import { MCPClient } from "@/lib/ai/mcp/mcp-client";
import { getMcpConnectorById } from "@/lib/db/mcp-queries";

// MCP tool cache to avoid re-fetching schemas on every request
const mcpToolCache = new Map<string, { tools: ToolDefinition[]; fetchedAt: number }>();
const MCP_CACHE_TTL_MS = 60_000; // 1 minute

// Agent instance cache — enables HITL resume within the same process
// Keyed by a stable hash of agent configuration
const agentCache = new Map<string, Promise<AllternitAgent>>();
const AGENT_CACHE_TTL_MS = 300_000; // 5 minutes
const agentCacheTimestamps = new Map<string, number>();

function getAgentCacheKey(agent: Agent, profile: AgentProfile, harnessConfig: HarnessConfig): string {
  const parts = [
    agent.id,
    agent.provider,
    profile.modelConfig.model,
    agent.capabilities.sort().join(","),
    (profile.toolPolicy.mcpServerIds ?? []).sort().join(","),
    harnessConfig.mode,
  ];
  return parts.join("::");
}

function getCachedAgent(key: string): Promise<AllternitAgent> | undefined {
  const ts = agentCacheTimestamps.get(key);
  if (!ts) return undefined;
  if (Date.now() - ts > AGENT_CACHE_TTL_MS) {
    agentCache.delete(key);
    agentCacheTimestamps.delete(key);
    return undefined;
  }
  return agentCache.get(key);
}

function setCachedAgent(key: string, promise: Promise<AllternitAgent>): void {
  agentCache.set(key, promise);
  agentCacheTimestamps.set(key, Date.now());
}

/**
 * Clear the agent instance cache. Useful for testing or when agent config changes.
 */
export function clearAgentCache(): void {
  agentCache.clear();
  agentCacheTimestamps.clear();
}

// Pending HITL runs — stores active runs awaiting human input
interface PendingRun {
  agent: AllternitAgent;
  run: AgentRun;
  sessionId: string;
  hitlRequest: ReplyRequest;
}

const pendingRuns = new Map<string, PendingRun>();

function getPendingRun(runId: string): PendingRun | undefined {
  return pendingRuns.get(runId);
}

function setPendingRun(runId: string, pending: PendingRun): void {
  pendingRuns.set(runId, pending);
}

function deletePendingRun(runId: string): void {
  pendingRuns.delete(runId);
}

function getCachedMcpTools(serverId: string): ToolDefinition[] | undefined {
  const entry = mcpToolCache.get(serverId);
  if (entry && Date.now() - entry.fetchedAt < MCP_CACHE_TTL_MS) {
    return entry.tools;
  }
  return undefined;
}

function setCachedMcpTools(serverId: string, tools: ToolDefinition[]): void {
  mcpToolCache.set(serverId, { tools, fetchedAt: Date.now() });
}

function buildHarnessConfig(provider: string, model: string): HarnessConfig | null {
  switch (provider.toLowerCase()) {
    case "anthropic": {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return null;
      return {
        mode: "byok",
        byok: { anthropic: { apiKey } },
      };
    }
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) return null;
      return {
        mode: "byok",
        byok: { openai: { apiKey } },
      };
    }
    case "google": {
      const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) return null;
      return {
        mode: "byok",
        byok: { google: { apiKey } },
      };
    }
    case "local": {
      const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
      return {
        mode: "local",
        local: { baseURL },
      };
    }
    default:
      return null;
  }
}

function buildToolRegistry(agentId: string, profile: AgentProfile): ToolRegistry {
  const registry = new ToolRegistry();
  const deferredIds = profile.toolPolicy.deferredToolIds ?? [];
  const allowedIds = profile.toolPolicy.allowedMcpToolIds ?? [];
  const serverIds = profile.toolPolicy.mcpServerIds ?? [];

  for (let i = 0; i < deferredIds.length; i++) {
    const id = deferredIds[i];
    const isAllowed = allowedIds.includes(id);
    registry.registerDeferredTool({
      id,
      name: id,
      description: isAllowed
        ? "Deferred MCP tool available to this agent profile."
        : "Deferred tool declared on this agent profile.",
      input_schema: { type: "object", properties: {} },
      metadata: { agentId, serverId: serverIds[i] ?? serverIds[0] },
      tags: ["deferred", isAllowed ? "mcp" : "agent"],
    });
  }
  return registry;
}

function getAgentWorkspacePath(agentId: string): string {
  const base = process.env.AGENT_WORKSPACE_BASE ?? path.join(process.cwd(), "workspaces");
  return path.join(base, agentId);
}

function buildFilesystemTools(agentId: string): ToolDefinition[] {
  const workspacePath = getAgentWorkspacePath(agentId);

  function resolveFilePath(filePath: string): string {
    const resolved = path.resolve(workspacePath, filePath);
    // Security: prevent escaping workspace
    if (!resolved.startsWith(workspacePath)) {
      throw new Error(`Path escape detected: ${filePath}`);
    }
    return resolved;
  }

  return [
    {
      name: "read_file",
      description: "Read the contents of a file from the agent workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file (relative to workspace root)" },
          offset: { type: "number", description: "Line number to start reading from (0-indexed, optional)" },
          limit: { type: "number", description: "Maximum number of lines to read (optional, default 100)" },
        },
        required: ["path"],
      },
      execute: async (args: { path: string; offset?: number; limit?: number }) => {
        const filePath = resolveFilePath(args.path);
        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");
        const offset = args.offset ?? 0;
        const limit = args.limit ?? 100;
        const slice = lines.slice(offset, offset + limit);
        return slice.join("\n");
      },
    },
    {
      name: "write_file",
      description: "Create or overwrite a file in the agent workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Path to the file (relative to workspace root)" },
          content: { type: "string", description: "Content to write" },
        },
        required: ["path", "content"],
      },
      execute: async (args: { path: string; content: string }) => {
        const filePath = resolveFilePath(args.path);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content, "utf-8");
        return `File ${args.path} written (${args.content.length} bytes).`;
      },
    },
    {
      name: "list_directory",
      description: "List files and directories in the agent workspace.",
      input_schema: {
        type: "object",
        properties: {
          path: { type: "string", description: "Directory path (relative to workspace root, optional)" },
        },
        required: [],
      },
      execute: async (args: { path?: string }) => {
        const dirPath = resolveFilePath(args.path ?? ".");
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return entries.map((e) => `${e.isDirectory() ? "[DIR]" : "[FILE]"} ${e.name}`).join("\n");
      },
    },
  ];
}

export function isSdkExecutionAvailable(agent: Agent, profile: AgentProfile): boolean {
  const config = buildHarnessConfig(agent.provider, profile.modelConfig.model);
  return config !== null;
}

export type HitlPolicy = "auto" | "reject_destructive" | "pause";

export interface SdkCompletionOptions {
  sessionId: string;
  messages: Message[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  registry?: ToolRegistry;
  /**
   * How to handle Human-in-the-Loop (HITL) events emitted by the SDK.
   * - "auto": Auto-approve permissions, auto-deny questions (legacy bridge behaviour).
   * - "reject_destructive": Auto-approve non-destructive permissions, deny destructive ones.
   *   Questions are auto-denied. This is the default and recommended safe setting.
   * - "pause": Throw when HITL is encountered. Useful only in long-running processes
   *   that have an external event loop capable of resuming the run.
   */
  hitlPolicy?: HitlPolicy;
}

export interface HitlEvent {
  type: "permission" | "question";
  toolName?: string;
  payload: unknown;
  outcome: "auto_approved" | "auto_denied" | "paused";
  reason: string;
}

export interface PendingHitl {
  runId: string;
  type: "permission" | "question";
  payload: unknown;
}

export interface SdkCompletionResult {
  content: string;
  sessionId: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
    result?: string;
  }>;
  hitlEvents: HitlEvent[];
  /**
   * Set when HITL policy is "pause" and the run is awaiting human input.
   * The client must call the resume endpoint with the runId and outcome.
   */
  pendingHitl?: PendingHitl;
}

async function fetchMcpTools(serverIds: string[]): Promise<ToolDefinition[]> {
  const tools: ToolDefinition[] = [];
  for (const serverId of serverIds) {
    const cached = getCachedMcpTools(serverId);
    if (cached) {
      tools.push(...cached);
      continue;
    }

    try {
      const connector = await getMcpConnectorById(serverId);
      if (!connector || !connector.enabled) {
        console.warn(`[MCP] Connector ${serverId} not found or disabled`);
        continue;
      }

      const client = new MCPClient(connector.id, connector.name, {
        url: connector.url,
        type: (connector.type as "http" | "sse") ?? "http",
      });

      const connection = await client.attemptConnection();
      if (connection.status !== "connected") {
        console.warn(`[MCP] Could not connect to ${connector.name}: ${connection.status}${connection.error ? ` (${connection.error})` : ""}`);
        continue;
      }

      const definitions = await client.listTools();
      const mcpTools = definitions.tools ?? [];
      const serverTools: ToolDefinition[] = [];

      for (const mcpTool of mcpTools) {
        const toolName = mcpTool.name as string;
        serverTools.push({
          name: toolName,
          description: (mcpTool.description as string) ?? `${connector.name} tool`,
          input_schema: (mcpTool.inputSchema as ToolDefinition["input_schema"]) ?? { type: "object", properties: {} },
          metadata: { mcpServerId: serverId, mcpConnectorId: connector.id, category: "mcp" },
          execute: async (args: unknown) => {
            const result = await client.callTool(toolName, args as Record<string, unknown>, definitions);
            return JSON.stringify(result);
          },
        });
      }

      setCachedMcpTools(serverId, serverTools);
      tools.push(...serverTools);
      console.debug(`[MCP] Loaded ${mcpTools.length} tools from ${connector.name}`);
    } catch (error) {
      console.error(`[MCP] Failed to fetch tools from server ${serverId}:`, error);
    }
  }
  return tools;
}

async function createSdkAgent(
  harnessConfig: HarnessConfig,
  agent: Agent,
  profile: AgentProfile,
  registry?: ToolRegistry,
): Promise<AllternitAgent> {
  const cacheKey = getAgentCacheKey(agent, profile, harnessConfig);
  const cached = getCachedAgent(cacheKey);
  if (cached) {
    const sdkAgent = await cached;
    // Re-seed registry from session for this request
    const globalRegistry = (sdkAgent as unknown as Record<string, unknown>).globalToolRegistry as ToolRegistry;
    // Clear previous session-specific tools (keep capability tools)
    // Note: we don't have a clear() method, so we rely on fork() in run()
    // to isolate per-run state. We just re-apply session registry on top.
    if (registry) {
      const deferredTools = (registry as unknown as Record<string, unknown>).deferredTools as Map<string, unknown>;
      for (const [, deferred] of deferredTools) {
        globalRegistry.registerDeferredTool(deferred as Parameters<ToolRegistry["registerDeferredTool"]>[0]);
      }
      const snapshot = registry.snapshot();
      if (snapshot.activeToolNames.length > 0) {
        globalRegistry.rehydrate({ ...snapshot, deferredDefinitions: [] });
      }
    }
    return sdkAgent;
  }

  const harness = new AllternitHarness(harnessConfig);
  const capabilities: string[] = [];
  if (agent.capabilities.includes('computer-use') || profile.capabilities.computer_use) {
    capabilities.push('computer-use');
  }
  const sdkAgent = new AllternitAgent(harness, {
    persistencePath: process.env.SDK_RUNS_DB_PATH ?? './.allternit/sdk-runs.db',
    capabilities: capabilities.length > 0 ? capabilities : undefined,
    computerUseBaseUrl: process.env.ACU_GATEWAY_URL ?? 'http://127.0.0.1:8760',
  });

  // Seed registry from session registry (rehydrates active tools) or from profile
  const globalRegistry = (sdkAgent as unknown as Record<string, unknown>).globalToolRegistry as ToolRegistry;
  if (registry) {
    const deferredTools = (registry as unknown as Record<string, unknown>).deferredTools as Map<string, unknown>;
    for (const [, deferred] of deferredTools) {
      globalRegistry.registerDeferredTool(deferred as Parameters<ToolRegistry["registerDeferredTool"]>[0]);
    }
    const snapshot = registry.snapshot();
    if (snapshot.activeToolNames.length > 0) {
      globalRegistry.rehydrate({ ...snapshot, deferredDefinitions: [] });
    }
  } else {
    const deferredIds = profile.toolPolicy.deferredToolIds ?? [];
    const allowedIds = profile.toolPolicy.allowedMcpToolIds ?? [];
    const serverIds = profile.toolPolicy.mcpServerIds ?? [];

    for (let i = 0; i < deferredIds.length; i++) {
      const id = deferredIds[i];
      const isAllowed = allowedIds.includes(id);
      sdkAgent.registerDeferredTool({
        id,
        name: id,
        description: isAllowed
          ? "Deferred MCP tool available to this agent profile."
          : "Deferred tool declared on this agent profile.",
        input_schema: { type: "object", properties: {} },
        metadata: { agentId: agent.id, serverId: serverIds[i] ?? serverIds[0] },
        tags: ["deferred", isAllowed ? "mcp" : "agent"],
      });
    }
  }

  // Register filesystem tools for workspace access
  const fsTools = buildFilesystemTools(agent.id);
  for (const tool of fsTools) {
    globalRegistry.registerTool(tool);
  }

  // Fetch and register MCP tools with real schemas
  const mcpServerIds = profile.toolPolicy.mcpServerIds ?? [];
  if (mcpServerIds.length > 0) {
    const mcpTools = await fetchMcpTools(mcpServerIds);
    for (const tool of mcpTools) {
      globalRegistry.registerTool(tool);
    }
  }

  setCachedAgent(cacheKey, Promise.resolve(sdkAgent));
  return sdkAgent;
}

function isDestructiveTool(registry: ToolRegistry | undefined, toolName: string): boolean {
  if (!registry) return false;
  const tool = registry.getTool(toolName);
  return tool?.metadata?.isDestructive === true;
}

function handleHitlEvent(
  req: unknown,
  registry: ToolRegistry | undefined,
  policy: HitlPolicy,
  hitlEvents: HitlEvent[],
): { approved: boolean; response: unknown } | "pause" {
  const request = req as Record<string, unknown>;
  const type = request.type as string;

  if (type === "permission") {
    const toolName = (request.payload as any)?.title as string;
    const destructive = isDestructiveTool(registry, toolName);

    if (policy === "pause") {
      hitlEvents.push({
        type: "permission",
        toolName,
        payload: request.payload,
        outcome: "paused",
        reason: "HITL policy is 'pause' — awaiting external resolution",
      });
      return "pause";
    }

    if (policy === "reject_destructive" && destructive) {
      hitlEvents.push({
        type: "permission",
        toolName,
        payload: request.payload,
        outcome: "auto_denied",
        reason: `Auto-denied destructive tool: ${toolName}`,
      });
      return {
        approved: false,
        response: { type: "permission", approved: false, reason: `Destructive tool ${toolName} requires explicit human approval.` },
      };
    }

    hitlEvents.push({
      type: "permission",
      toolName,
      payload: request.payload,
      outcome: "auto_approved",
      reason: policy === "auto" ? "Auto-approved by platform executor" : "Non-destructive tool auto-approved",
    });
    return {
      approved: true,
      response: { type: "permission", approved: true, reason: "Auto-approved by platform executor" },
    };
  }

  if (type === "question") {
    const question = (request.payload as any)?.[0]?.question as string;

    if (policy === "pause") {
      hitlEvents.push({
        type: "question",
        payload: request.payload,
        outcome: "paused",
        reason: "HITL policy is 'pause' — awaiting external resolution",
      });
      return "pause";
    }

    hitlEvents.push({
      type: "question",
      payload: request.payload,
      outcome: "auto_denied",
      reason: "Human input not available in this execution context",
    });
    return {
      approved: false,
      response: {
        type: "question",
        answers: [
          {
            questionId: (request.payload as any)?.[0]?.id,
            answer: "Human input not available in this execution context.",
          },
        ],
      },
    };
  }

  // Unknown HITL type — deny to be safe
  hitlEvents.push({
    type: type as "permission" | "question",
    payload: request.payload,
    outcome: "auto_denied",
    reason: `Unknown HITL type: ${type}`,
  });
  return { approved: false, response: { type, approved: false, reason: "Unknown HITL request type" } };
}

function buildStreamRequest(
  agent: Agent,
  profile: AgentProfile,
  options: SdkCompletionOptions,
): StreamRequest {
  const messages: Message[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }, ...options.messages]
    : options.messages;

  return {
    provider: agent.provider,
    model: profile.modelConfig.model,
    messages,
    temperature: options.temperature ?? agent.temperature ?? undefined,
    maxTokens: options.maxTokens,
  };
}

/**
 * Non-streaming completion via SDK AgentRun.
 */
export async function invokeSdkCompletion(
  agent: Agent,
  profile: AgentProfile,
  options: SdkCompletionOptions,
): Promise<SdkCompletionResult | null> {
  const harnessConfig = buildHarnessConfig(agent.provider, profile.modelConfig.model);
  if (!harnessConfig) return null;

  const sdkAgent = await createSdkAgent(harnessConfig, agent, profile, options.registry);
  const request = buildStreamRequest(agent, profile, options);
  const run = sdkAgent.run(request);

  return new Promise((resolve, reject) => {
    const toolCalls: SdkCompletionResult["toolCalls"] = [];
    const hitlEvents: HitlEvent[] = [];
    let finalContent = "";

    run.on("text", (text: string) => {
      finalContent += text;
    });

    run.on("tool_call", (chunk: unknown) => {
      const c = chunk as Record<string, unknown>;
      toolCalls.push({
        id: (c.id as string) ?? (c.callId as string) ?? `call_${Date.now()}`,
        name: c.name as string,
        input: (c.arguments as unknown) ?? (c.input as unknown) ?? {},
      });
    });

    run.on("reply_requested", (req: unknown) => {
      const request = req as Record<string, unknown>;
      const submit = request.submit as (outcome: any) => Promise<void>;
      const policy = options.hitlPolicy ?? "reject_destructive";

      const outcome = handleHitlEvent(req, options.registry, policy, hitlEvents);
      if (outcome === "pause") {
        // Store pending run for external resumption via resumeSdkRun()
        setPendingRun(run.id, {
          agent: sdkAgent,
          run,
          sessionId: options.sessionId,
          hitlRequest: req as ReplyRequest,
        });
        resolve({
          content: finalContent,
          sessionId: options.sessionId,
          toolCalls,
          hitlEvents,
          pendingHitl: {
            runId: run.id,
            type: request.type as "permission" | "question",
            payload: request.payload,
          },
        });
        return;
      }
      console.warn(`[SDK HITL] ${outcome.approved ? "Approved" : "Denied"} ${request.type as string}`);
      submit(outcome.response);
    });

    run.on("completed", () => {
      resolve({ content: finalContent, sessionId: options.sessionId, toolCalls, hitlEvents });
    });

    run.on("error", (err: unknown) => {
      reject(err);
    });
  });
}

/**
 * Resume a paused SDK run after HITL input has been provided.
 * Requires the original agent to still be cached in the same process.
 */
export async function resumeSdkRun(
  runId: string,
  outcome: ReplyOutcome,
): Promise<SdkCompletionResult> {
  const pending = getPendingRun(runId);
  if (!pending) {
    throw new Error(`No pending HITL run found for ${runId}. The run may have already been resumed or the agent cache was cleared.`);
  }

  deletePendingRun(runId);
  const { agent, run, sessionId } = pending;

  return new Promise((resolve, reject) => {
    let finalContent = "";
    const toolCalls: SdkCompletionResult["toolCalls"] = [];
    const hitlEvents: HitlEvent[] = [];

    run.on("text", (text: string) => {
      finalContent += text;
    });

    run.on("tool_call", (chunk: unknown) => {
      const c = chunk as Record<string, unknown>;
      toolCalls.push({
        id: (c.id as string) ?? (c.callId as string) ?? `call_${Date.now()}`,
        name: c.name as string,
        input: (c.arguments as unknown) ?? (c.input as unknown) ?? {},
      });
    });

    run.on("reply_requested", (req: unknown) => {
      const request = req as Record<string, unknown>;
      const submit = request.submit as (outcome: any) => Promise<void>;
      const outcome2 = handleHitlEvent(req, undefined, "reject_destructive", hitlEvents);
      if (outcome2 === "pause") {
        // Re-pause with nested HITL
        setPendingRun(run.id, {
          agent,
          run,
          sessionId,
          hitlRequest: req as ReplyRequest,
        });
        resolve({
          content: finalContent,
          sessionId,
          toolCalls,
          hitlEvents,
          pendingHitl: {
            runId: run.id,
            type: request.type as "permission" | "question",
            payload: request.payload,
          },
        });
        return;
      }
      submit(outcome2.response);
    });

    run.on("completed", () => {
      resolve({ content: finalContent, sessionId, toolCalls, hitlEvents });
    });

    run.on("error", (err: unknown) => {
      reject(err);
    });

    agent.submitReply(runId, outcome).catch(reject);
  });
}

/**
 * Streaming completion via SDK AgentRun.
 * Returns a ReadableStream of UTF-8 text deltas plus a promise for the final result.
 */
export function streamSdkCompletion(
  agent: Agent,
  profile: AgentProfile,
  options: SdkCompletionOptions,
): { stream: ReadableStream<Uint8Array>; result: Promise<SdkCompletionResult> } | null {
  const harnessConfig = buildHarnessConfig(agent.provider, profile.modelConfig.model);
  if (!harnessConfig) return null;

  let resolveResult: (r: SdkCompletionResult) => void;
  let rejectResult: (e: unknown) => void;
  const resultPromise = new Promise<SdkCompletionResult>((res, rej) => {
    resolveResult = res;
    rejectResult = rej;
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const sdkAgent = await createSdkAgent(harnessConfig, agent, profile, options.registry);
        const request = buildStreamRequest(agent, profile, options);
        const run = sdkAgent.run(request);

        const toolCalls: SdkCompletionResult["toolCalls"] = [];
        const hitlEvents: HitlEvent[] = [];
        let finalContent = "";

        run.on("text", (text: string) => {
          finalContent += text;
          controller.enqueue(encoder.encode(text));
        });

        run.on("tool_call", (chunk: unknown) => {
          const c = chunk as Record<string, unknown>;
          toolCalls.push({
            id: (c.id as string) ?? (c.callId as string) ?? `call_${Date.now()}`,
            name: c.name as string,
            input: (c.arguments as unknown) ?? (c.input as unknown) ?? {},
          });
        });

        run.on("reply_requested", (req: unknown) => {
          const request = req as Record<string, unknown>;
          const submit = request.submit as (outcome: any) => Promise<void>;
          const policy = options.hitlPolicy ?? "reject_destructive";

          const outcome = handleHitlEvent(req, options.registry, policy, hitlEvents);
          if (outcome === "pause") {
            // Store pending run for external resumption
            setPendingRun(run.id, {
              agent: sdkAgent,
              run,
              sessionId: options.sessionId,
              hitlRequest: req as ReplyRequest,
            });
            resolveResult({
              content: finalContent,
              sessionId: options.sessionId,
              toolCalls,
              hitlEvents,
              pendingHitl: {
                runId: run.id,
                type: request.type as "permission" | "question",
                payload: request.payload,
              },
            });
            controller.close();
            return;
          }
          console.warn(`[SDK HITL] ${outcome.approved ? "Approved" : "Denied"} ${request.type as string}`);
          submit(outcome.response);
        });

        run.on("completed", () => {
          resolveResult({ content: finalContent, sessionId: options.sessionId, toolCalls, hitlEvents });
          controller.close();
        });

        run.on("error", (err: unknown) => {
          rejectResult(err);
          controller.error(err);
        });
      } catch (err) {
        rejectResult(err);
        controller.error(err);
      }
    },
  });

  return { stream, result: resultPromise };
}
