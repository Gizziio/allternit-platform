import { api } from "@/integration/api-client";

import type { Agent, CreateAgentInput } from "./agent.types";

export interface OpenClawDiscoveryFiles {
  models: boolean;
  auth_profiles: boolean;
  sessions_store: boolean;
}

export interface OpenClawDiscoveredAgent {
  agent_id: string;
  display_name: string;
  agent_dir: string;
  workspace_path?: string | null;
  session_count: number;
  auth_providers: string[];
  models: string[];
  primary_model?: string | null;
  primary_provider?: string | null;
  files: OpenClawDiscoveryFiles;
  registered_agent_id?: string | null;
}

export interface OpenClawDiscoveryResponse {
  agents: OpenClawDiscoveredAgent[];
  total: number;
  unregistered: number;
  state_dir?: string;
  workspace_path?: string | null;
  gateway_port?: number | null;
}

interface OpenClawBinding {
  agentId: string | null;
  agentDir: string | null;
  workspacePath: string | null;
}

function normalizePath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().replace(/\/+$/, "")
    : null;
}

function getOpenClawBinding(
  agent?: Pick<Agent, "config"> | null,
): OpenClawBinding {
  const config = agent?.config as Record<string, unknown> | undefined;
  const source = typeof config?.source === "string" ? config.source : null;
  const openclaw = config?.openclaw as Record<string, unknown> | undefined;

  if (source !== "openclaw" || !openclaw) {
    return {
      agentId: null,
      agentDir: null,
      workspacePath: null,
    };
  }

  return {
    agentId:
      typeof openclaw.agentId === "string" && openclaw.agentId.trim().length > 0
        ? openclaw.agentId.trim()
        : null,
    agentDir: normalizePath(openclaw.agentDir),
    workspacePath: normalizePath(openclaw.workspacePath),
  };
}

function mapProvider(providerId?: string | null): CreateAgentInput["provider"] {
  const normalized = String(providerId || "").trim().toLowerCase();

  if (normalized.startsWith("openai")) {
    return "openai";
  }

  if (normalized.startsWith("anthropic") || normalized.includes("claude")) {
    return "anthropic";
  }

  if (normalized === "local") {
    return "local";
  }

  return "custom";
}

export async function discoverOpenClawAgents(): Promise<OpenClawDiscoveryResponse> {
  const isShellDev =
    typeof window !== "undefined" && window.location.port === "5177";

  if (isShellDev) {
    const devResponse = await fetch("/api/dev/openclaw/agents/discovery", {
      headers: {
        Accept: "application/json",
      },
    });

    if (devResponse.ok) {
      return devResponse.json() as Promise<OpenClawDiscoveryResponse>;
    }
  }

  try {
    return (await api.discoverOpenClawAgents()) as unknown as OpenClawDiscoveryResponse;
  } catch (error) {
    if (!isShellDev) {
      throw error;
    }

    const fallbackResponse = await fetch("/api/dev/openclaw/agents/discovery", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!fallbackResponse.ok) {
      throw error;
    }

    return fallbackResponse.json() as Promise<OpenClawDiscoveryResponse>;
  }
}

export function buildOpenClawImportInput(
  discovered: OpenClawDiscoveredAgent,
): CreateAgentInput {
  const primaryModel = discovered.primary_model || discovered.models[0] || "openclaw/default";
  const upstreamProvider = discovered.primary_provider || primaryModel.split("/")[0] || "openclaw";
  const fallbackModels = discovered.models.filter((model) => model !== primaryModel);

  return {
    name: discovered.display_name,
    description: discovered.workspace_path
      ? `Imported from OpenClaw agent "${discovered.agent_id}" with workspace linked at ${discovered.workspace_path}.`
      : `Imported from OpenClaw agent "${discovered.agent_id}".`,
    type: "worker",
    model: primaryModel,
    provider: mapProvider(upstreamProvider),
    capabilities: [
      "chat",
      "workspace",
      ...(discovered.files.sessions_store ? ["history"] : []),
      ...(discovered.auth_providers.length > 0 ? ["connected"] : []),
    ],
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    config: {
      source: "openclaw",
      fallbackModels,
      openclaw: {
        agentId: discovered.agent_id,
        agentDir: discovered.agent_dir,
        workspacePath: discovered.workspace_path || null,
        authProviders: discovered.auth_providers,
        modelIds: discovered.models,
      },
    },
  };
}

export function getOpenClawWorkspacePathFromAgent(
  agent?: Pick<Agent, "config"> | null,
): string | null {
  return getOpenClawBinding(agent).workspacePath;
}

export function getRegisteredOpenClawAgentId(
  candidate: OpenClawDiscoveredAgent,
  agents: Array<Pick<Agent, "id" | "config">>,
): string | null {
  const candidateAgentDir = normalizePath(candidate.agent_dir);
  const candidateWorkspacePath = normalizePath(candidate.workspace_path);

  for (const agent of agents) {
    const binding = getOpenClawBinding(agent);

    if (!binding.agentId && !binding.agentDir && !binding.workspacePath) {
      continue;
    }

    if (binding.agentId && binding.agentId === candidate.agent_id) {
      return agent.id;
    }

    if (binding.agentDir && candidateAgentDir && binding.agentDir === candidateAgentDir) {
      return agent.id;
    }

    if (
      binding.workspacePath &&
      candidateWorkspacePath &&
      binding.workspacePath === candidateWorkspacePath
    ) {
      return agent.id;
    }
  }

  return null;
}

export function resolveOpenClawRegistration(
  candidates: OpenClawDiscoveredAgent[],
  agents: Array<Pick<Agent, "id" | "config">>,
): OpenClawDiscoveredAgent[] {
  return candidates.map((candidate) => ({
    ...candidate,
    registered_agent_id:
      candidate.registered_agent_id || getRegisteredOpenClawAgentId(candidate, agents),
  }));
}
