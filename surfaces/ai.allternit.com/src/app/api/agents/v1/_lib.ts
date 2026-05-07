import { prisma } from "@/lib/db";
import { getAuth } from "@/lib/server-auth";
import { resolvePlatformUserId } from "@/lib/server-user";
import { dbAgentToPlatformAgent, toRemoteAgentModel } from "@/lib/agents/remote-agent-api";
import { buildAgentProfile } from "@/lib/agents/agent-profile";
import type { AgentProfile } from "@allternit/sdk/ai-runtime";
import { splitOnArtifacts } from "@/lib/openui/artifact-parser";
import { ToolRegistry } from "@allternit/sdk/ai-runtime";
import {
  isSdkExecutionAvailable,
  invokeSdkCompletion,
  streamSdkCompletion,
  type SdkCompletionResult,
} from "@/lib/agents/sdk-agent-executor";

type GizziSessionInfo = {
  id: string;
  title?: string;
};

type PersistedAgentSession = {
  id: string;
  name?: string | null;
  metadata?: Record<string, unknown> | null;
};

type RemoteConversationRecord = {
  id: string;
  title: string | null;
  userId: string | null;
  gizziSessionId: string | null;
};

type RemoteConversationMessageRecord = {
  id: string;
  createdAt: Date;
  role: string;
  content: string;
  parentMessageId: string | null;
  metadata: string | null;
};

type StoredAgentProfile = NonNullable<
  Awaited<ReturnType<typeof getOwnedRemoteAgentModel>>
>["profile"];

type GizziMessage = {
  info: {
    id: string;
    role: string;
    time?: {
      created?: number;
      completed?: number;
    };
  };
  parts: Array<{
    type: string;
    text?: string;
  }>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTextContent(message: GizziMessage): string {
  return message.parts
    .filter((part) => part.type === "text" || part.type === "reasoning")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function buildConversationHistoryTranscript(
  messages: RemoteConversationMessageRecord[],
): string {
  if (messages.length === 0) {
    return "";
  }

  return [
    "Conversation history:",
    ...messages.map((message) => `${message.role}: ${message.content}`),
  ].join("\n");
}

function extractDeferredToolIdsFromMetadata(metadata?: Record<string, unknown> | null): string[] {
  const snapshot = metadata?.toolSnapshot;
  if (
    snapshot &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    Array.isArray((snapshot as { discoveredToolIds?: unknown }).discoveredToolIds)
  ) {
    return dedupeStrings(
      ((snapshot as { discoveredToolIds: unknown[] }).discoveredToolIds).filter(
        (value): value is string => typeof value === "string",
      ),
    );
  }

  const deferredToolIds = metadata?.deferredToolIds;
  if (!Array.isArray(deferredToolIds)) {
    return [];
  }

  return dedupeStrings(
    deferredToolIds.filter((value): value is string => typeof value === "string"),
  );
}

async function getPersistedAgentSession(
  sessionId: string,
): Promise<PersistedAgentSession | null> {
  const row = await prisma.agentSession.findUnique({ where: { id: sessionId } }).catch(() => null);
  if (!row) return null;
  let metadata: Record<string, unknown> = {};
  try { metadata = JSON.parse(row.metadata) as Record<string, unknown>; } catch { /* ignore */ }
  return { id: row.id, name: row.name, metadata };
}

async function ensureConversation(params: {
  conversationId: string;
  platformUserId: string;
  title?: string;
  sessionId?: string;
}): Promise<RemoteConversationRecord> {
  const conversation = await prisma.conversation.upsert({
    where: { id: params.conversationId },
    create: {
      id: params.conversationId,
      title: params.title ?? null,
      userId: params.platformUserId,
      gizziSessionId: params.sessionId ?? null,
    },
    update: {
      title: params.title ?? undefined,
      userId: params.platformUserId,
      ...(params.sessionId ? { gizziSessionId: params.sessionId } : {}),
    },
    select: {
      id: true,
      title: true,
      userId: true,
      gizziSessionId: true,
    },
  });

  return conversation;
}

async function listConversationMessages(
  conversationId: string,
): Promise<RemoteConversationMessageRecord[]> {
  return prisma.conversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      role: true,
      content: true,
      parentMessageId: true,
      metadata: true,
    },
  });
}

async function persistConversationMessage(params: {
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  parentMessageId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<RemoteConversationMessageRecord> {
  return prisma.conversationMessage.create({
    data: {
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      parentMessageId: params.parentMessageId ?? null,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
    select: {
      id: true,
      createdAt: true,
      role: true,
      content: true,
      parentMessageId: true,
      metadata: true,
    },
  });
}

async function getStoredResponse(
  responseId: string,
  platformUserId: string,
): Promise<{
  responseId: string;
  conversationId: string;
  outputText: string;
  artifacts: ReturnType<typeof extractArtifactsFromAgentOutput>["artifacts"];
  createdAt: number;
  model?: string;
  agentProfile?: StoredAgentProfile;
} | null> {
  const assistantMessage = await prisma.conversationMessage.findFirst({
    where: {
      role: "assistant",
      metadata: { contains: `"response_id":"${responseId}"` },
    },
    orderBy: { createdAt: "desc" },
    include: {
      conversation: {
        select: { id: true, userId: true },
      },
    },
  });

  if (!assistantMessage || assistantMessage.conversation.userId !== platformUserId) {
    return null;
  }

  const metadata = parseJsonObject(assistantMessage.metadata);
  const parsed = extractArtifactsFromAgentOutput(assistantMessage.content);
  const modelId =
    typeof metadata?.model === "string" ? metadata.model : undefined;
  const model = modelId
    ? await getOwnedRemoteAgentModel(modelId, platformUserId)
    : null;

  return {
    responseId,
    conversationId: assistantMessage.conversation.id,
    outputText: parsed.text || assistantMessage.content,
    artifacts: parsed.artifacts,
    createdAt: Math.floor(assistantMessage.createdAt.getTime() / 1000),
    model: modelId,
    agentProfile: model?.profile,
  };
}

async function ensurePersistedAgentSession(params: {
  sessionId: string;
  agentId: string;
  agentName: string;
  runtimeModel: string;
  deferredToolIds?: string[];
}): Promise<PersistedAgentSession> {
  const existing = await getPersistedAgentSession(params.sessionId);
  if (existing) {
    return existing;
  }

  const metadata = {
    allternit_runtime_session_id: params.sessionId,
    allternit_deferred_tool_ids: dedupeStrings(params.deferredToolIds ?? []),
    allternit_deferred_tools_updated_at: new Date().toISOString(),
    toolSnapshot: {
      activeToolNames: dedupeStrings(params.deferredToolIds ?? []),
      discoveredToolIds: dedupeStrings(params.deferredToolIds ?? []),
      sessionPolicies: {},
    },
  };
  const row = await prisma.agentSession.create({
    data: {
      id: params.sessionId,
      name: `${params.agentName} remote session`,
      agentId: params.agentId,
      agentName: params.agentName,
      runtimeModel: params.runtimeModel,
      metadata: JSON.stringify(metadata),
    },
  });
  return { id: row.id, name: row.name, metadata };
}

async function getActivatedDeferredToolIds(sessionId: string): Promise<string[]> {
  const session = await getPersistedAgentSession(sessionId);
  return extractDeferredToolIdsFromMetadata(session?.metadata);
}

async function persistActivatedDeferredToolIds(params: {
  sessionId: string;
  agentId: string;
  agentName: string;
  runtimeModel: string;
  deferredToolIds: string[];
}): Promise<string[]> {
  const existing = await ensurePersistedAgentSession(params);
  const merged = dedupeStrings([
    ...extractDeferredToolIdsFromMetadata(existing.metadata),
    ...params.deferredToolIds,
  ]);

  const newMetadata = {
    deferredToolIds: merged,
    deferredToolsUpdatedAt: new Date().toISOString(),
    runtimeSessionId: params.sessionId,
    toolSnapshot: {
      activeToolNames: merged,
      discoveredToolIds: merged,
      sessionPolicies: {},
    },
  };
  await prisma.agentSession.update({
    where: { id: params.sessionId },
    data: { metadata: JSON.stringify(newMetadata) },
  });

  return merged;
}

async function resolveRemoteConversationContext(params: {
  conversationId?: string;
  requestedSessionId?: string;
  platformUserId: string;
  agentId: string;
  agentName: string;
  runtimeModel: string;
  title?: string;
}): Promise<{
  conversationId: string;
  sessionId?: string;
  historyTranscript: string;
}> {
  if (!params.conversationId && !params.requestedSessionId) {
    return {
      conversationId: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionId: params.requestedSessionId,
      historyTranscript: "",
    };
  }

  const conversationId = params.conversationId ?? params.requestedSessionId!;
  const conversation = await ensureConversation({
    conversationId,
    platformUserId: params.platformUserId,
    title: params.title,
    sessionId: params.requestedSessionId,
  });
  const sessionId = params.requestedSessionId ?? conversation.gizziSessionId ?? undefined;
  const messages = await listConversationMessages(conversation.id);

  if (sessionId && conversation.gizziSessionId !== sessionId) {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { gizziSessionId: sessionId },
    }).catch(() => undefined);
  }

  return {
    conversationId: conversation.id,
    sessionId,
    historyTranscript: buildConversationHistoryTranscript(messages),
  };
}

export async function requirePlatformUserId(): Promise<string> {
  const { userId } = await getAuth();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return resolvePlatformUserId(userId);
}

export async function getOwnedRemoteAgentModel(agentId: string, platformUserId: string) {
  const record = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId: platformUserId,
    },
  });

  if (!record) {
    return null;
  }

  return toRemoteAgentModel(record);
}

export async function listOwnedRemoteAgentModels(platformUserId: string) {
  const records = await prisma.agent.findMany({
    where: { userId: platformUserId },
    orderBy: { createdAt: "desc" },
  });

  return records.map(toRemoteAgentModel);
}

export function extractArtifactsFromAgentOutput(content: string) {
  const segments = splitOnArtifacts(content);
  const artifacts = segments
    .filter((segment): segment is Extract<typeof segments[number], { kind: "artifact" }> => segment.kind === "artifact")
    .map((segment) => ({
      id: segment.artifact.identifier,
      mimeType: segment.artifact.type as
        | "text/html"
        | "application/vnd.react"
        | "application/vnd.mermaid"
        | "image/svg+xml",
      title: segment.artifact.title,
      content: segment.artifact.content,
    }));

  const text = segments
    .filter((segment): segment is Extract<typeof segments[number], { kind: "text" }> => segment.kind === "text")
    .map((segment) => segment.content.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  return { artifacts, text };
}

export async function listAgentDeferredTools(
  agentId: string,
  platformUserId: string,
) {
  const model = await getOwnedRemoteAgentModel(agentId, platformUserId);
  if (!model) {
    return null;
  }

  const registry = buildAgentToolRegistry(
    agentId,
    model.profile.toolPolicy.deferredToolIds,
    model.profile.toolPolicy.allowedMcpToolIds,
    model.profile.toolPolicy.mcpServerIds,
  );

  const deferred = registry.search("");
  const tools = deferred.map((tool) => ({
    id: tool.id,
    label: tool.name,
    serverId: (tool.metadata as Record<string, string> | undefined)?.serverId,
    description: tool.description,
  }));

  return {
    object: "list" as const,
    data: tools,
    model: agentId,
  };
}

export async function searchAgentDeferredTools(
  agentId: string,
  query: string,
  platformUserId: string,
) {
  const model = await getOwnedRemoteAgentModel(agentId, platformUserId);
  if (!model) {
    return null;
  }

  const registry = buildAgentToolRegistry(
    agentId,
    model.profile.toolPolicy.deferredToolIds,
    model.profile.toolPolicy.allowedMcpToolIds,
    model.profile.toolPolicy.mcpServerIds,
  );

  const results = registry.search(query.trim());

  return {
    object: "list" as const,
    data: results.map((tool) => ({
      id: tool.id,
      label: tool.name,
      serverId: (tool.metadata as Record<string, string> | undefined)?.serverId,
      description: tool.description,
    })),
    model: agentId,
  };
}

export async function activateDeferredToolsForSession(
  agentId: string,
  sessionId: string,
  toolIds: string[],
  platformUserId: string,
) {
  const record = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId: platformUserId,
    },
  });

  if (!record) {
    return null;
  }

  const registry = await getSessionToolRegistry(sessionId, agentId, platformUserId);
  const deferred = registry.search("");
  const allowed = new Set(deferred.map((tool) => tool.id));
  const activated = toolIds.filter((id) => allowed.has(id));

  for (const id of activated) {
    registry.activateTool(id);
  }

  await persistToolRegistrySnapshot(sessionId, registry);

  return {
    sessionId,
    model: agentId,
    activatedToolIds: registry.getActiveTools().map((t) => t.name),
  };
}

/**
 * Build a ToolRegistry from agent profile deferred tools.
 */
function buildAgentToolRegistry(
  agentId: string,
  deferredToolIds: string[],
  allowedMcpToolIds: string[],
  mcpServerIds: string[],
): ToolRegistry {
  const registry = new ToolRegistry();
  for (let i = 0; i < deferredToolIds.length; i++) {
    const id = deferredToolIds[i];
    const isAllowed = allowedMcpToolIds.includes(id);
    registry.registerDeferredTool({
      id,
      name: id,
      description: isAllowed
        ? "Deferred MCP tool available to this agent profile."
        : "Deferred tool declared on this agent profile.",
      input_schema: { type: "object", properties: {} },
      metadata: { agentId, serverId: mcpServerIds[i] ?? mcpServerIds[0] },
      tags: ["deferred", isAllowed ? "mcp" : "agent"],
    });
  }
  return registry;
}

/**
 * Build or restore a session's ToolRegistry from persisted metadata.
 */
async function getSessionToolRegistry(
  sessionId: string,
  agentId: string,
  platformUserId: string,
): Promise<ToolRegistry> {
  const model = await getOwnedRemoteAgentModel(agentId, platformUserId);
  const deferredIds = model?.profile.toolPolicy.deferredToolIds ?? [];
  const allowedIds = model?.profile.toolPolicy.allowedMcpToolIds ?? [];
  const serverIds = model?.profile.toolPolicy.mcpServerIds ?? [];

  const registry = buildAgentToolRegistry(agentId, deferredIds, allowedIds, serverIds);

  const session = await getPersistedAgentSession(sessionId);
  const snapshot = session?.metadata?.toolSnapshot;
  if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    try {
      registry.rehydrate(snapshot as { activeToolNames: string[]; discoveredToolIds: string[]; sessionPolicies: Record<string, 'allow' | 'require_approval' | 'deny'> });
    } catch {
      // Ignore invalid snapshots
    }
  }

  return registry;
}

/**
 * Persist a registry snapshot back to the session metadata.
 */
async function persistToolRegistrySnapshot(sessionId: string, registry: ToolRegistry): Promise<void> {
  const snapshot = registry.snapshot();
  const metadata = {
    toolSnapshot: snapshot,
    deferredToolIds: Array.from(snapshot.activeToolNames ?? []),
    deferredToolsUpdatedAt: new Date().toISOString(),
  };
  await prisma.agentSession.updateMany({
    where: { id: sessionId },
    data: { metadata: JSON.stringify(metadata) },
  }).catch(() => { /* session may not exist yet — ignore */ });
}

/**
 * Non-streaming completion via SDK AgentRun.
 */
export async function invokeAgentTextCompletion(
  agentId: string,
  prompt: string,
  platformUserId: string,
  options?: {
    sessionId?: string;
    conversationId?: string;
    parentMessageId?: string;
    responseId?: string;
  },
) {
  const record = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId: platformUserId,
    },
  });

  if (!record) {
    return null;
  }

  const agent = dbAgentToPlatformAgent(record);
  const profile = buildAgentProfile(agent);
  const conversationContext = await resolveRemoteConversationContext({
    conversationId: options?.conversationId,
    requestedSessionId: options?.sessionId,
    platformUserId,
    agentId: record.id,
    agentName: record.name,
    runtimeModel: profile.modelConfig.model,
    title: record.name,
  });

  const sessionId = conversationContext.sessionId ?? `sdk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await ensureConversation({
    conversationId: conversationContext.conversationId,
    platformUserId,
    title: record.name,
    sessionId,
  });

  await persistConversationMessage({
    conversationId: conversationContext.conversationId,
    role: "user",
    content: prompt,
    parentMessageId: options?.parentMessageId ?? null,
    metadata: {
      model: record.id,
      session_id: sessionId,
    },
  });

  // ── SDK-native execution path (cuts over from gizzi when provider is supported)
  if (isSdkExecutionAvailable(agent, profile)) {
    const historyMessages = await listConversationMessages(conversationContext.conversationId);
    const sdkMessages = historyMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const registry = await getSessionToolRegistry(sessionId, agentId, platformUserId);

    const result = await invokeSdkCompletion(agent, profile, {
      sessionId,
      messages: sdkMessages,
      systemPrompt: profile.instructions || undefined,
      temperature: profile.modelConfig.temperature ?? agent.temperature ?? undefined,
      registry,
    });

    if (!result) {
      throw new Error("SDK completion failed and no fallback available.");
    }

    const assistantMessage = await persistConversationMessage({
      conversationId: conversationContext.conversationId,
      role: "assistant",
      content: result.content,
      parentMessageId: options?.parentMessageId ?? null,
      metadata: {
        model: record.id,
        session_id: sessionId,
        response_id: options?.responseId ?? null,
        ...(result.toolCalls.length > 0 ? { tool_calls: result.toolCalls } : {}),
        ...(result.hitlEvents.length > 0 ? { hitl_events: result.hitlEvents } : {}),
      },
    });

    return {
      sessionId,
      conversationId: conversationContext.conversationId,
      agent,
      profile,
      content: result.content,
      parentMessageId: assistantMessage.id,
      hitlEvents: result.hitlEvents,
      toolCalls: result.toolCalls,
      pendingHitl: result.pendingHitl,
    };
  }

  // Fallback if SDK execution is not available (though it should be for supported providers)
  throw new Error(`SDK execution not available for provider ${agent.provider}`);
}

export async function streamAgentTextCompletion(
  agentId: string,
  prompt: string,
  platformUserId: string,
  options?: {
    sessionId?: string;
    conversationId?: string;
    parentMessageId?: string;
    responseId?: string;
  },
): Promise<{
  stream: ReadableStream<Uint8Array>;
  sessionId: string;
  conversationId: string;
  profile: AgentProfile;
  result: Promise<{ hitlEvents: import("@/lib/agents/sdk-agent-executor").HitlEvent[]; toolCalls: any[]; pendingHitl?: import("@/lib/agents/sdk-agent-executor").PendingHitl }>;
} | null> {
  const record = await prisma.agent.findFirst({
    where: {
      id: agentId,
      userId: platformUserId,
    },
  });

  if (!record) {
    return null;
  }

  const agent = dbAgentToPlatformAgent(record);
  const profile = buildAgentProfile(agent);
  const conversationContext = await resolveRemoteConversationContext({
    conversationId: options?.conversationId,
    requestedSessionId: options?.sessionId,
    platformUserId,
    agentId: record.id,
    agentName: record.name,
    runtimeModel: profile.modelConfig.model,
    title: record.name,
  });

  const sessionId = conversationContext.sessionId ?? `sdk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await ensureConversation({
    conversationId: conversationContext.conversationId,
    platformUserId,
    title: record.name,
    sessionId,
  });

  await persistConversationMessage({
    conversationId: conversationContext.conversationId,
    role: "user",
    content: prompt,
    parentMessageId: options?.parentMessageId ?? null,
    metadata: {
      model: record.id,
      session_id: sessionId,
    },
  });

  // ── SDK-native execution path
  if (isSdkExecutionAvailable(agent, profile)) {
    const historyMessages = await listConversationMessages(conversationContext.conversationId);
    const sdkMessages = historyMessages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    }));

    const registry = await getSessionToolRegistry(sessionId, agentId, platformUserId);

    let resolveResult: (value: { hitlEvents: import("@/lib/agents/sdk-agent-executor").HitlEvent[]; toolCalls: any[]; pendingHitl?: import("@/lib/agents/sdk-agent-executor").PendingHitl }) => void;
    const resultPromise = new Promise<{ hitlEvents: import("@/lib/agents/sdk-agent-executor").HitlEvent[]; toolCalls: any[]; pendingHitl?: import("@/lib/agents/sdk-agent-executor").PendingHitl }>((res) => {
      resolveResult = res;
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let fullContent = "";
        let toolCalls: any[] = [];
        let hitlEvents: any[] = [];

        try {
          const sdkStream = streamSdkCompletion(agent, profile, {
            sessionId,
            messages: sdkMessages,
            systemPrompt: profile.instructions || undefined,
            temperature: profile.modelConfig.temperature ?? agent.temperature ?? undefined,
            registry,
          });

          if (!sdkStream) {
            resolveResult!({ hitlEvents: [], toolCalls: [], pendingHitl: undefined });
            controller.close();
            return;
          }

          const reader = sdkStream.stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
            fullContent += decoder.decode(value);
          }

          // Await final result for tool call and HITL metadata
          const result = await sdkStream.result;
          toolCalls = result.toolCalls;
          hitlEvents = result.hitlEvents;
          resolveResult!({ hitlEvents, toolCalls, pendingHitl: result.pendingHitl });
        } catch (error) {
          console.error("SDK stream error:", error);
          resolveResult!({ hitlEvents: [], toolCalls: [], pendingHitl: undefined });
        }

        await persistConversationMessage({
          conversationId: conversationContext.conversationId,
          role: "assistant",
          content: fullContent,
          parentMessageId: options?.parentMessageId ?? null,
          metadata: {
            model: record.id,
            session_id: sessionId,
            response_id: options?.responseId ?? null,
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
            ...(hitlEvents.length > 0 ? { hitl_events: hitlEvents } : {}),
          },
        }).catch(() => undefined);

        controller.close();
      },
    });

    return {
      stream,
      sessionId,
      conversationId: conversationContext.conversationId,
      profile,
      result: resultPromise,
    };
  }

  // Fallback if SDK execution is not available
  throw new Error(`SDK streaming not available for provider ${agent.provider}`);
}

export async function getStoredRemoteAgentResponse(
  responseId: string,
  platformUserId: string,
) {
  return getStoredResponse(responseId, platformUserId);
}
