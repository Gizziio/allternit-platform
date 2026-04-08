/**
 * Agentation Types
 */

export type AgentRole = 
  | 'UI_ARCHITECT'
  | 'UI_IMPLEMENTER'
  | 'UI_TESTER'
  | 'UI_REVIEWER';

/**
 * Default configuration for Agentation
 */
export const DEFAULT_CONFIG = {
  hotkey: 'a',
  storageKey: 'agentation_annotations',
} as const;

/**
 * Element information captured in an annotation
 */
export interface AnnotationElement {
  tagName: string;
  id?: string;
  className?: string;
  selectors: string[];
  xpath: string;
  text?: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Annotation record
 */
export interface Annotation {
  id: string;
  element: AnnotationElement;
  notes: string;
  screenshot?: string;
  createdAt: number;
}

/**
 * Viewport information for A2R execution header
 */
export interface AllternitViewport {
  width: number;
  height: number;
  device?: string;
}

/**
 * A2R Execution Header for DAG-ready work items
 */
export interface AllternitExecutionHeader {
  uiSurface: string;
  storyId?: string;
  storyName?: string;
  componentPath?: string;
  renderer: string;
  viewport: AllternitViewport;
  acceptance: string;
  wihId?: string;
  dagNodeId?: string;
}

/**
 * Annotation output for clipboard
 */
export interface AnnotationOutput {
  notes: string;
  selectors: string[];
  context: string;
  screenshot?: string;
}

/**
 * A2R-formatted annotation output
 */
export interface AllternitAnnotationOutput extends AnnotationOutput {
  header: AllternitExecutionHeader;
  formattedForAgent: string;
}

export interface AgentationConfig {
  enabled: boolean;
  role: AgentRole;
  contextPack?: string;
  wihId?: string;
  allowedTools: string[];
  scopePaths: string[];
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    toolCalls?: ToolCall[];
    files?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface AgentationContextValue {
  config: AgentationConfig;
  messages: AgentMessage[];
  isProcessing: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  updateConfig: (config: Partial<AgentationConfig>) => void;
}

export interface DagNode {
  id: string;
  type: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  dependencies: string[];
}

export interface DagOutput {
  nodes: DagNode[];
  edges: Array<{ from: string; to: string }>;
  metadata: {
    createdAt: string;
    role: AgentRole;
    contextPackId?: string;
  };
}
