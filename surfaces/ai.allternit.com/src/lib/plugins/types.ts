/**
 * Mode Plugin Type Definitions
 * 
 * Standard interface for all Allternit mode plugins.
 */

// Plugin Capability Types
export type PluginCapability =
  // Research
  | 'web-search' | 'citation' | 'synthesis' | 'source-verification' | 'deep-research'
  // Data
  | 'csv-import' | 'excel-analysis' | 'chart-generation' | 'sql-query' | 'insights' | 'data-export'
  // Slides
  | 'ppt-generation' | 'template-selection' | 'speaker-notes' | 'export-pdf' | 'presentation-analytics'
  | 'presentation-generation' | 'slide-design' | 'pptx-export' | 'html-slides' | 'markdown-slides'
  // Code
  | 'code-generation' | 'live-preview' | 'multi-language' | 'package-install' | 'debugging' | 'testing'
  // Assets
  | 'file-upload' | 'ai-tagging' | 'semantic-search' | 'preview' | 'version-control'
  | 'icon-search' | 'icon-generation' | '3d-models' | 'vector-graphics' | 'asset-library'
  // Agents
  | 'parallel-agents' | 'agent-swarm' | 'task-delegation' | 'result-aggregation' | 'agent-creation'
  | 'multi-agent' | 'agent-coordination' | 'consensus-building' | 'parallel-processing' | 'specialized-agents'
  // Flow
  | 'visual-builder' | 'node-editor' | 'trigger-setup' | 'automation' | 'workflow-scheduling'
  | 'workflow-design' | 'workflow-execution' | 'conditional-logic' | 'tool-integration'
  // Website
  | 'dom-capture' | 'site-clone' | 'deploy' | 'responsive-preview'
  | 'website-generation' | 'landing-page' | 'responsive-design' | 'component-library' | 'deployment-prep' | 'seo-optimization'
  // Image
  | 'text-to-image' | 'image-variations' | 'style-transfer' | 'upscale' | 'inpainting' | 'outpainting'
  // Video
  | 'text-to-video' | 'image-to-video' | 'video-editing' | 'extend' | 'caption' | 'voiceover';

// Plugin Configuration
export interface PluginConfig {
  // For BYOK plugins (Video)
  apiKey?: string;
  provider?: string;
  
  // For local plugins
  localPath?: string;
  
  // Generic settings
  settings?: Record<string, unknown>;
}

// Plugin Input
export interface PluginInput {
  // User prompt/command
  prompt: string;
  
  // Context from conversation
  context?: {
    messages: Array<{ role: string; content: string }>;
    files?: Array<{ name: string; type: string; content: string }>;
  };
  
  // Files to process
  files?: File[];
  
  // Mode-specific options
  options?: Record<string, unknown>;
}

// Plugin Output
export interface PluginOutput {
  // Success status
  success: boolean;
  
  // Result content
  content?: string;
  
  // Generated artifacts (images, videos, files)
  artifacts?: Array<{
    type: 'image' | 'video' | 'file' | 'code' | 'chart' | 'slide';
    url: string;
    name: string;
    metadata?: Record<string, unknown>;
  }>;
  
  // UI components to render
  components?: Array<{
    type: string;
    props: Record<string, unknown>;
  }>;
  
  // Error info
  error?: {
    message: string;
    code: string;
    recoverable: boolean;
  };
  
  // Usage info
  usage?: {
    credits?: number;
    tokens?: number;
    duration?: number;
  };
}

// Plugin Event Types
export type PluginEventType = 
  | 'initialized'
  | 'started'
  | 'progress'
  | 'completed'
  | 'error'
  | 'destroyed';

export interface PluginEvent {
  type: PluginEventType;
  payload?: unknown;
  timestamp: number;
}

export type PluginEventHandler = (event: PluginEvent) => void;

// Main Plugin Interface
export interface ModePlugin {
  // Identity
  readonly id: string;
  readonly name: string;
  readonly version: string;
  
  // Capabilities
  readonly capabilities: PluginCapability[];
  
  // State
  isInitialized: boolean;
  isExecuting: boolean;
  
  // Configuration
  config: PluginConfig;
  
  // Event handling
  on(event: PluginEventType, handler: PluginEventHandler): void;
  off(event: PluginEventType, handler: PluginEventHandler): void;
  
  // Lifecycle
  initialize(config?: PluginConfig): Promise<void>;
  destroy(): Promise<void>;
  
  // Execution
  execute(input: PluginInput): Promise<PluginOutput>;
  cancel(): Promise<void>;
  
  // Capabilities check
  hasCapability(capability: PluginCapability): boolean;
  
  // Health check
  health(): Promise<{ healthy: boolean; message?: string }>;
}

// Plugin Factory
export type PluginFactory = () => ModePlugin;

// Plugin Registry Entry
export interface PluginRegistryEntry {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: string;
  factory: PluginFactory;
  capabilities: PluginCapability[];
  requiresConfig: boolean;
  configSchema?: Record<string, unknown>;
}

// Execution Context
export interface ExecutionContext {
  sessionId: string;
  userId: string;
  workspaceId?: string;
  abortSignal?: AbortSignal;
}
