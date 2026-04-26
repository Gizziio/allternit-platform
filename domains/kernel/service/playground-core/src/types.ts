/**
 * Playground Core Types
 *
 * Type definitions for Allternit Playground System.
 */

// ============================================================================
// Core Types
// ============================================================================

export interface Playground {
  id: string;
  title: string;
  templateType: PlaygroundTemplateType;
  status: PlaygroundStatus;
  createdAt: string;
  updatedAt: string;
  inputs: PlaygroundInputs;
  outputs?: PlaygroundOutputs;
  events: PlaygroundEvent[];
}

export type PlaygroundTemplateType =
  | 'diff-review'
  | 'codebase-architecture'
  | 'site-structure-audit'
  | 'component-variation'
  | 'copy-review'
  | 'rive-playground';

export type PlaygroundStatus =
  | 'draft'
  | 'active'
  | 'completed'
  | 'archived';

// ============================================================================
// Inputs
// ============================================================================

export interface PlaygroundInputs {
  context?: ContextBundle;
  templateConfig?: Record<string, unknown>;
  toolIntegrations?: string[];
}

export interface ContextBundle {
  files?: ContextFile[];
  diffs?: ContextDiff[];
  sitemap?: SitemapNode[];
  componentProps?: Record<string, unknown>;
  copyVariants?: CopyVariant[];
  graphs?: GraphData;
}

export interface ContextFile {
  path: string;
  content: string;
  language?: string;
}

export interface ContextDiff {
  oldPath?: string;
  newPath: string;
  oldContent?: string;
  newContent: string;
  hunks?: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface SitemapNode {
  url: string;
  depth: number;
  parent?: string;
  children?: string[];
}

export interface CopyVariant {
  id: string;
  baseline: string;
  variants: string[];
  constraints?: CopyConstraint[];
}

export interface CopyConstraint {
  type: 'length' | 'tone' | 'keywords';
  value: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string;
  type?: string;
}

// ============================================================================
// Outputs
// ============================================================================

export interface PlaygroundOutputs {
  prompt?: PromptOutput;
  patch?: PatchOutput;
  receipts?: Receipt[];
}

export interface PromptOutput {
  text: string;
  metadata: {
    templateType: string;
    generatedAt: string;
    inputHash: string;
  };
}

export interface PatchOutput {
  patches: FilePatch[];
  metadata: {
    generatedAt: string;
    inputHash: string;
    deterministic: boolean;
  };
}

export interface FilePatch {
  path: string;
  oldContent?: string;
  newContent: string;
  diff?: string;
}

export interface Receipt {
  id: string;
  playgroundId: string;
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ============================================================================
// Events
// ============================================================================

export interface PlaygroundEvent {
  id: string;
  playgroundId: string;
  type: PlaygroundEventType;
  timestamp: string;
  data?: Record<string, unknown>;
}

export type PlaygroundEventType =
  | 'PLAYGROUND_OPENED'
  | 'CONTROL_CHANGED'
  | 'COMMENT_ADDED'
  | 'APPROVAL_GIVEN'
  | 'SUBMIT_OUTPUT'
  | 'AGENT_APPLIED_PATCH';

// ============================================================================
// Control Types
// ============================================================================

export interface PlaygroundControl {
  id: string;
  type: ControlType;
  label: string;
  value: unknown;
  options?: ControlOption[];
}

export type ControlType =
  | 'toggle'
  | 'select'
  | 'input'
  | 'slider'
  | 'multiselect';

export interface ControlOption {
  value: unknown;
  label: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreatePlaygroundRequest {
  title: string;
  templateType: PlaygroundTemplateType;
  inputs?: PlaygroundInputs;
}

export interface UpdatePlaygroundRequest {
  title?: string;
  inputs?: PlaygroundInputs;
  outputs?: PlaygroundOutputs;
}

export interface PlaygroundListResponse {
  playgrounds: Playground[];
  total: number;
}

export interface PlaygroundEventRequest {
  type: PlaygroundEventType;
  data?: Record<string, unknown>;
}
