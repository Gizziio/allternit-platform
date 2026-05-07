import type { Agent } from "./agent.types";
import type {
  AgentProfile,
  AgentProfileCapability,
} from "@allternit/sdk/ai-runtime";

type AgentProfileConfigShape = {
  profile?: Partial<AgentProfile>;
  mcpServerIds?: string[];
  allowedMcpToolIds?: string[];
  deferredToolIds?: string[];
  maxContextTokens?: number;
  maxOutputTokens?: number;
  maxSteps?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function readBooleanMap(
  value: unknown,
): Partial<Record<AgentProfileCapability, boolean>> {
  if (!isRecord(value)) {
    return {};
  }

  const output: Partial<Record<AgentProfileCapability, boolean>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "boolean") {
      output[key as AgentProfileCapability] = entry;
    }
  }
  return output;
}

function extractProfileConfig(agent: Agent): AgentProfileConfigShape {
  if (!isRecord(agent.config)) {
    return {};
  }

  return agent.config as AgentProfileConfigShape;
}

function deriveCapabilities(agent: Agent) {
  const existing = extractProfileConfig(agent).profile?.capabilities;
  if (existing) {
    return readBooleanMap(existing);
  }

  const flags: Partial<Record<AgentProfileCapability, boolean>> = {};
  for (const capability of agent.capabilities) {
    switch (capability) {
      case "execute_code":
      case "file_search":
      case "context":
      case "mcp_tools":
      case "deferred_tools":
      case "artifacts":
      case "actions":
      case "chain":
      case "web_search":
        flags[capability] = true;
        break;
      case "computer-use":
        flags["computer_use"] = true;
        break;
      case "filesystem":
        flags["filesystem"] = true;
        break;
      default:
        break;
    }
  }
  return flags;
}

export function buildAgentProfile(agent: Agent): AgentProfile {
  const config = extractProfileConfig(agent);
  const profile = config.profile;

  return {
    agentId: agent.id,
    version: profile?.version ?? "1",
    avatarUrl: profile?.avatarUrl,
    instructions: profile?.instructions ?? agent.systemPrompt,
    modelConfig: {
      provider: profile?.modelConfig?.provider ?? agent.provider,
      model: profile?.modelConfig?.model ?? agent.model,
      temperature: profile?.modelConfig?.temperature ?? agent.temperature,
      maxContextTokens:
        profile?.modelConfig?.maxContextTokens ?? config.maxContextTokens,
      maxOutputTokens:
        profile?.modelConfig?.maxOutputTokens ?? config.maxOutputTokens,
      maxSteps: profile?.modelConfig?.maxSteps ?? config.maxSteps ?? agent.maxIterations,
    },
    capabilities: deriveCapabilities(agent),
    toolPolicy: {
      builtInToolIds:
        profile?.toolPolicy?.builtInToolIds?.length
          ? profile.toolPolicy.builtInToolIds
          : agent.tools,
      mcpServerIds:
        profile?.toolPolicy?.mcpServerIds?.length
          ? profile.toolPolicy.mcpServerIds
          : readStringArray(config.mcpServerIds),
      allowedMcpToolIds:
        profile?.toolPolicy?.allowedMcpToolIds?.length
          ? profile.toolPolicy.allowedMcpToolIds
          : readStringArray(config.allowedMcpToolIds),
      deferredToolIds:
        profile?.toolPolicy?.deferredToolIds?.length
          ? profile.toolPolicy.deferredToolIds
          : readStringArray(config.deferredToolIds),
    },
    files: profile?.files,
    artifactPolicy: profile?.artifactPolicy,
  };
}

export function attachAgentProfile(agent: Agent): Agent {
  return {
    ...agent,
    profile: buildAgentProfile(agent),
  };
}
