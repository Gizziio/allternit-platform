import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import type { Agent } from "@/lib/agents/agent.types";

export type AgentDrawerSection = "workspace" | "tools" | "automation" | "runtime";

export interface ResolvedEnvEntry {
  key: string;
  value: string;
  source: 'harness' | 'secret' | 'connector' | 'runtime';
}

export interface AgentContextStripProps {
  surface: AgentModeSurface;
  sessionName: string;
  sessionDescription?: string;
  agentName?: string;
  harnessMode?: string;
  statusLabel: string;
  messageCount: number;
  workspaceScope?: string;
  canvasCount?: number;
  tags?: string[];
  toolsEnabled?: boolean;
  automationEnabled?: boolean;
  runtimeEnv?: Record<string, string>;
  runtimeEnvEntries?: ResolvedEnvEntry[];
  connectorBindings?: Array<{ provider?: string; label?: string; capabilities?: string[]; autonomous?: boolean }>;
  secretRefs?: Array<{ name?: string; key?: string; required?: boolean; description?: string }>;
  missingRuntimeKeys?: string[];
  botId?: string;
  vmOperator?: Agent['vmOperator'];
  vmSandbox?: { id: string; provider: string; status: string; vncUrl?: string };
  /** Optional override for the strip accent color (e.g. the bot's own accent). */
  accentColor?: string;
  onDismiss?: () => void;
  onEditRuntime?: () => void;
}

export interface SurfacePalette {
  accent: string;
  glow: string;
  soft: string;
  border: string;
}

export interface FileNode {
  name: string;
  type: "file" | "directory";
  children?: FileNode[];
  size?: number;
  modified?: Date;
}

export interface DisplayJob {
  id: string;
  name: string;
  schedule: string;
  lastRun?: Date;
  nextRun?: Date;
  status: "active" | "paused" | "failed";
  description?: string;
  runCount: number;
  lastError?: string;
}
