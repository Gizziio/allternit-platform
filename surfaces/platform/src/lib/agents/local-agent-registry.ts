import type { Agent, CreateAgentInput } from "./agent.types";

const STORAGE_KEY = "allternit.local-agent-registry.v1";

interface OpenClawBinding {
  source: string | null;
  agentId: string | null;
  agentDir: string | null;
  workspacePath: string | null;
}

function normalizePath(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().replace(/\/+$/, "")
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLocalShellHost(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "localhost"
  );
}

function readRegistry(): Agent[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => coerceAgent(entry))
      .filter((entry): entry is Agent => Boolean(entry));
  } catch {
    return [];
  }
}

function writeRegistry(agents: Agent[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

function coerceAgent(value: unknown): Agent | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.model !== "string" ||
    typeof value.provider !== "string"
  ) {
    return null;
  }

  const now = new Date().toISOString();

  return {
    id: value.id,
    name: value.name,
    description:
      typeof value.description === "string" ? value.description : "",
    type:
      value.type === "orchestrator" ||
      value.type === "sub-agent" ||
      value.type === "worker"
        ? value.type
        : "worker",
    parentAgentId:
      typeof value.parentAgentId === "string" ? value.parentAgentId : undefined,
    model: value.model,
    provider:
      value.provider === "openai" ||
      value.provider === "anthropic" ||
      value.provider === "local" ||
      value.provider === "custom"
        ? value.provider
        : "custom",
    capabilities: Array.isArray(value.capabilities)
      ? value.capabilities.map(String)
      : [],
    systemPrompt:
      typeof value.systemPrompt === "string" ? value.systemPrompt : undefined,
    tools: Array.isArray(value.tools) ? value.tools.map(String) : [],
    maxIterations:
      typeof value.maxIterations === "number" ? value.maxIterations : 10,
    temperature:
      typeof value.temperature === "number" ? value.temperature : 0.7,
    voice: isRecord(value.voice) ? (value.voice as unknown as Agent["voice"]) : undefined,
    config: isRecord(value.config) ? value.config : {},
    status:
      value.status === "running" ||
      value.status === "paused" ||
      value.status === "error" ||
      value.status === "idle"
        ? value.status
        : "idle",
    createdAt:
      typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt:
      typeof value.updatedAt === "string" ? value.updatedAt : now,
    lastRunAt:
      typeof value.lastRunAt === "string" ? value.lastRunAt : undefined,
  };
}

function getOpenClawBinding(agent: Pick<Agent, "config">): OpenClawBinding {
  const config = isRecord(agent.config) ? agent.config : {};
  const source = typeof config.source === "string" ? config.source : null;
  const openclaw = isRecord(config.openclaw) ? config.openclaw : null;

  return {
    source,
    agentId:
      openclaw && typeof openclaw.agentId === "string"
        ? openclaw.agentId.trim() || null
        : null,
    agentDir: openclaw ? normalizePath(openclaw.agentDir) : null,
    workspacePath: openclaw ? normalizePath(openclaw.workspacePath) : null,
  };
}

function isSameOpenClawBinding(left: Agent, right: Agent): boolean {
  const leftBinding = getOpenClawBinding(left);
  const rightBinding = getOpenClawBinding(right);

  if (leftBinding.source !== "openclaw" || rightBinding.source !== "openclaw") {
    return false;
  }

  if (leftBinding.agentId && rightBinding.agentId) {
    return leftBinding.agentId === rightBinding.agentId;
  }

  if (leftBinding.agentDir && rightBinding.agentDir) {
    return leftBinding.agentDir === rightBinding.agentDir;
  }

  if (leftBinding.workspacePath && rightBinding.workspacePath) {
    return leftBinding.workspacePath === rightBinding.workspacePath;
  }

  return false;
}

function localAgentId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-agent-${crypto.randomUUID()}`;
  }

  return `local-agent-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function toAgent(input: CreateAgentInput): Agent {
  const now = new Date().toISOString();

  return {
    id: localAgentId(),
    name: input.name,
    description: input.description,
    type: input.type || "worker",
    parentAgentId: input.parentAgentId,
    model: input.model,
    provider: input.provider,
    capabilities: input.capabilities || [],
    systemPrompt: input.systemPrompt,
    tools: input.tools || [],
    maxIterations: input.maxIterations ?? 10,
    temperature: input.temperature ?? 0.7,
    voice: input.voice,
    config: {
      ...(isRecord(input.config) ? input.config : {}),
      localRegistry: {
        fallback: true,
        importedAt: now,
      },
    },
    status: "idle",
    createdAt: now,
    updatedAt: now,
    lastRunAt: undefined,
  };
}

export function shouldUseLocalAgentRegistryFallback(error: unknown): boolean {
  if (!isLocalShellHost()) {
    return false;
  }

  const statusCode =
    isRecord(error) && typeof error.statusCode === "number"
      ? error.statusCode
      : null;
  const code =
    isRecord(error) && typeof error.code === "string"
      ? error.code
      : null;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (statusCode !== null && statusCode >= 500) {
    return true;
  }

  if (code === "NETWORK_ERROR") {
    return true;
  }

  return /network|failed to fetch|fetch error|unable to reach api/i.test(message);
}

export function listLocalAgents(): Agent[] {
  return readRegistry();
}

export function getLocalAgent(agentId: string): Agent | null {
  return readRegistry().find((agent) => agent.id === agentId) || null;
}

export function createLocalAgent(input: CreateAgentInput): Agent {
  const agents = readRegistry();
  const created = toAgent(input);
  writeRegistry([created, ...agents]);
  return created;
}

export function updateLocalAgent(
  agentId: string,
  updates: Partial<CreateAgentInput>,
): Agent {
  const agents = readRegistry();
  const current = agents.find((agent) => agent.id === agentId);

  if (!current) {
    throw new Error("Agent not found");
  }

  const updated: Agent = {
    ...current,
    name: updates.name ?? current.name,
    description: updates.description ?? current.description,
    type: updates.type ?? current.type,
    parentAgentId:
      updates.parentAgentId !== undefined
        ? updates.parentAgentId
        : current.parentAgentId,
    model: updates.model ?? current.model,
    provider: updates.provider ?? current.provider,
    capabilities: updates.capabilities ?? current.capabilities,
    systemPrompt:
      updates.systemPrompt !== undefined
        ? updates.systemPrompt
        : current.systemPrompt,
    tools: updates.tools ?? current.tools,
    maxIterations: updates.maxIterations ?? current.maxIterations,
    temperature: updates.temperature ?? current.temperature,
    voice: updates.voice !== undefined ? updates.voice : current.voice,
    config:
      updates.config !== undefined
        ? {
            ...current.config,
            ...(isRecord(updates.config) ? updates.config : {}),
          }
        : current.config,
    updatedAt: new Date().toISOString(),
  };

  writeRegistry(agents.map((agent) => (agent.id === agentId ? updated : agent)));
  return updated;
}

export function deleteLocalAgent(agentId: string): void {
  const agents = readRegistry();
  writeRegistry(agents.filter((agent) => agent.id !== agentId));
}

export function mergeAgentCatalog(
  remoteAgents: Agent[],
  localAgents: Agent[] = readRegistry(),
): Agent[] {
  if (localAgents.length === 0) {
    return remoteAgents;
  }

  const merged = [...remoteAgents];

  for (const localAgent of localAgents) {
    const duplicate = remoteAgents.some(
      (remoteAgent) =>
        remoteAgent.id === localAgent.id ||
        isSameOpenClawBinding(remoteAgent, localAgent),
    );

    if (!duplicate) {
      merged.push(localAgent);
    }
  }

  return merged;
}
