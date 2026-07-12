import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";

export type AgentDrawerSection = "workspace" | "tools" | "automation";

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
  onDismiss?: () => void;
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
