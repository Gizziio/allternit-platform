import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

export type AgentSessionSurface = AgentModeSurface;
export type AgentSessionMode = "regular" | "agent";

export interface AgentSessionFeatures {
  workspace?: boolean;
  tools?: boolean;
  automation?: boolean;
}

export interface AgentSessionDescriptor {
  originSurface?: AgentSessionSurface;
  sessionMode?: AgentSessionMode;
  agentId?: string;
  agentName?: string;
  projectId?: string;
  workspaceScope?: string;
  runtimeModel?: string;
  agentFeatures?: AgentSessionFeatures;
}

const METADATA_KEYS = {
  originSurface: "allternit_origin_surface",
  sessionMode: "allternit_session_mode",
  agentId: "allternit_agent_id",
  agentName: "allternit_agent_name",
  projectId: "allternit_project_id",
  workspaceScope: "allternit_workspace_scope",
  runtimeModel: "allternit_runtime_model",
  agentFeatures: "allternit_agent_features",
} as const;

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readSurface(value: unknown): AgentSessionSurface | undefined {
  if (
    value === "chat" ||
    value === "cowork" ||
    value === "code" ||
    value === "browser" ||
    value === "design"
  ) {
    return value;
  }

  return undefined;
}

function readMode(value: unknown): AgentSessionMode | undefined {
  return value === "regular" || value === "agent" ? value : undefined;
}

function readFeatures(value: unknown): AgentSessionFeatures | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const next: AgentSessionFeatures = {};

  if (typeof record.workspace === "boolean") {
    next.workspace = record.workspace;
  }

  if (typeof record.tools === "boolean") {
    next.tools = record.tools;
  }

  if (typeof record.automation === "boolean") {
    next.automation = record.automation;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function getAgentSessionDescriptor(
  metadata?: Record<string, unknown> | null,
): AgentSessionDescriptor {
  if (!metadata) {
    return {};
  }

  return {
    originSurface: readSurface(metadata[METADATA_KEYS.originSurface]),
    sessionMode: readMode(metadata[METADATA_KEYS.sessionMode]),
    agentId: readString(metadata[METADATA_KEYS.agentId]),
    agentName: readString(metadata[METADATA_KEYS.agentName]),
    projectId: readString(metadata[METADATA_KEYS.projectId]),
    workspaceScope: readString(metadata[METADATA_KEYS.workspaceScope]),
    runtimeModel: readString(metadata[METADATA_KEYS.runtimeModel]),
    agentFeatures: readFeatures(metadata[METADATA_KEYS.agentFeatures]),
  };
}

export function buildAgentSessionMetadata({
  metadata,
  ...descriptor
}: AgentSessionDescriptor & {
  metadata?: Record<string, unknown>;
}): Record<string, unknown> | undefined {
  const next: Record<string, unknown> = { ...(metadata ?? {}) };

  if (descriptor.originSurface) {
    next[METADATA_KEYS.originSurface] = descriptor.originSurface;
  }

  if (descriptor.sessionMode) {
    next[METADATA_KEYS.sessionMode] = descriptor.sessionMode;
  }

  if (descriptor.agentId) {
    next[METADATA_KEYS.agentId] = descriptor.agentId;
  }

  if (descriptor.agentName) {
    next[METADATA_KEYS.agentName] = descriptor.agentName;
  }

  if (descriptor.projectId) {
    next[METADATA_KEYS.projectId] = descriptor.projectId;
  }

  if (descriptor.workspaceScope) {
    next[METADATA_KEYS.workspaceScope] = descriptor.workspaceScope;
  }

  if (descriptor.runtimeModel) {
    next[METADATA_KEYS.runtimeModel] = descriptor.runtimeModel;
  }

  if (descriptor.agentFeatures) {
    next[METADATA_KEYS.agentFeatures] = descriptor.agentFeatures;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

export function formatAgentSessionSurfaceLabel(
  surface?: AgentSessionSurface,
): string | undefined {
  switch (surface) {
    case "chat":
      return "Chat";
    case "cowork":
      return "Cowork";
    case "code":
      return "Code";
    case "browser":
      return "Browser";
    case "design":
      return "Studio";
    default:
      return undefined;
  }
}

export function formatAgentSessionMetaLabel(
  metadata?: Record<string, unknown> | null,
): string | undefined {
  const descriptor = getAgentSessionDescriptor(metadata);
  const surfaceLabel = formatAgentSessionSurfaceLabel(descriptor.originSurface);

  if (descriptor.sessionMode === "agent" && surfaceLabel) {
    return `${surfaceLabel} agent`;
  }

  return surfaceLabel;
}
