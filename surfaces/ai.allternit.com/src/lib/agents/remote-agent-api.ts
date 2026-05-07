import type { Agent as PrismaAgentRecord } from "@/generated/prisma";
import type { Agent } from "./agent.types";
import { buildAgentProfile } from "./agent-profile";

function parseJsonObject(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch (error) {
    console.warn("[remote-agent-api] Failed to parse JSON object", error);
  }

  return {};
}

function parseJsonArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch (error) {
    console.warn("[remote-agent-api] Failed to parse JSON array", error);
  }

  return [];
}

export function dbAgentToPlatformAgent(record: PrismaAgentRecord): Agent {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    type: record.type as Agent["type"],
    parentAgentId: record.parentAgentId ?? undefined,
    model: record.model,
    provider: record.provider as Agent["provider"],
    capabilities: parseJsonArray(record.capabilities),
    systemPrompt: record.systemPrompt ?? undefined,
    tools: parseJsonArray(record.tools),
    maxIterations: record.maxIterations,
    temperature: record.temperature,
    config: parseJsonObject(record.config),
    status: record.status as Agent["status"],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lastRunAt: record.lastRunAt?.toISOString(),
    workspaceId: record.workspaceId ?? undefined,
    ownerId: record.userId,
    profile: undefined,
  };
}

export function toRemoteAgentModel(record: PrismaAgentRecord) {
  const agent = dbAgentToPlatformAgent(record);
  const profile = buildAgentProfile(agent);

  return {
    id: record.id,
    object: "model" as const,
    created: Math.floor(record.createdAt.getTime() / 1000),
    owned_by: "allternit",
    profile,
  };
}
