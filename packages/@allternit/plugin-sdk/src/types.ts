/**
 * Allternit Plugin SDK - Core Types
 * 
 * Universal type definitions for cross-platform plugin runtime.
 */

// ============================================================================
// PLUGIN MANIFEST
// ============================================================================

export interface PluginManifest {
  /** Unique plugin identifier (kebab-case) */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Semantic version */
  version: string;
  
  /** Plugin runtime specification version */
  runtime: 'allternit-plugin-v1';
  
  /** Brief description */
  description: string;
  
  /** Author/organization */
  author?: string;
  
  /** License identifier */
  license?: string;
  
  /** Repository URL */
  repository?: string;
  
  /** Keywords for discovery */
  keywords?: string[];
  
  /** Plugin category */
  category: 'create' | 'analyze' | 'build' | 'automate' | 'research' | 'custom';
  
  /** Required host capabilities */
  requires: HostRequirements;
  
  /** Functions/commands this plugin provides */
  provides: PluginFunctions;
  
  /** Available adapters for different platforms */
  adapters: AdapterConfig;
  
  /** Plugin configuration schema */
  config?: ConfigSchema;
  
  /** Default configuration values */
  defaults?: Record<string, any>;
}

export interface HostRequirements {
  /** LLM capabilities needed */
  llm?: {
    /** Minimum context window (e.g., "128k") */
    context_window?: string;
    
    /** Required capabilities */
    capabilities?: Array<'reasoning' | 'tool_use' | 'vision' | 'code_execution'>;
    
    /** Preferred model characteristics */
    preferred_models?: string[];
  };
  
  /** Required tool capabilities */
  tools?: Array<ToolId | ToolRequirement>;
  
  /** UI capabilities required */
  ui?: {
    /** Output renderers needed */
    renderers?: Array<'markdown' | 'code' | 'image' | 'chart' | 'table' | 'pdf' | 'interactive'>;
    
    /** Input forms supported */
    inputs?: Array<'text' | 'select' | 'multiselect' | 'file' | 'number' | 'boolean'>;
    
    /** Panel/sidebar support */
    panels?: boolean;
    
    /** Real-time streaming */
    streaming?: boolean;
  };
  
  /** Storage requirements */
  storage?: {
    /** Persistent storage needed */
    persistent?: boolean;
    
    /** Estimated storage per session (bytes) */
    estimated_size?: number;
  };
}

export interface ToolRequirement {
  tool: ToolId;
  required: boolean;
  fallback?: 'error' | 'simulate' | 'degrade';
}

export type ToolId = 
  | 'web_search'
  | 'web_browse'
  | 'code_execute'
  | 'file_read'
  | 'file_write'
  | 'terminal_run'
  | 'image_generate'
  | 'image_edit'
  | 'data_query'
  | 'browser_navigate'
  | 'browser_extract'
  | 'vector_search'
  | 'api_call'
  | string; // Extensible

export interface PluginFunctions {
  /** Primary function(s) this plugin exposes */
  functions: PluginFunction[];
  
  /** Event handlers (optional) */
  events?: PluginEvent[];
}

export interface PluginFunction {
  /** Function identifier */
  name: string;
  
  /** Human-readable description */
  description: string;
  
  /** Input parameters */
  parameters: ParameterSchema;
  
  /** Return value schema */
  returns: ReturnSchema;
  
  /** Execution mode */
  mode?: 'sync' | 'async' | 'streaming';
  
  /** Estimated execution time (seconds) */
  estimated_duration?: number;
  
  /** Whether this function modifies state */
  side_effects?: boolean;
}

export interface ParameterSchema {
  type: 'object';
  properties: Record<string, ParameterDef>;
  required?: string[];
}

export interface ParameterDef {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
  description: string;
  enum?: string[];
  default?: any;
  items?: ParameterDef; // For arrays
}

export interface ReturnSchema {
  type: 'object';
  properties: {
    content?: { type: 'string'; format?: 'markdown' | 'html' | 'text' };
    artifacts?: { type: 'array'; items: ArtifactSchema };
    data?: { type: 'object' };
  };
}

export interface ArtifactSchema {
  type: 'image' | 'code' | 'document' | 'data' | 'chart';
  format: string;
  filename?: string;
}

export interface PluginEvent {
  name: string;
  description: string;
  payload: Record<string, any>;
}

export interface AdapterConfig {
  /** MCP (Model Context Protocol) adapter */
  mcp?: string;
  
  /** HTTP REST adapter */
  http?: string;
  
  /** Allternit native adapter */
  allternit?: string;
  
  /** Custom adapters */
  [key: string]: string | undefined;
}

export interface ConfigSchema {
  type: 'object';
  properties: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'select';
    description: string;
    options?: string[];
    default?: any;
    secret?: boolean; // For API keys
  }>;
}

// ============================================================================
// RUNTIME INTERFACE
// ============================================================================

/**
 * Universal interface that any host platform must implement.
 * This is the contract between plugins and their execution environment.
 */
export interface PluginHost {
  /** Platform identifier */
  readonly platform: string;
  
  /** Platform version */
  readonly version: string;
  
  /** LLM capabilities */
  readonly llm: LlmCapabilities;
  
  /** Tool registry */
  readonly tools: ToolRegistry;
  
  /** UI capabilities */
  readonly ui: UiCapabilities;
  
  /** Storage backend */
  readonly storage: StorageBackend;
  
  /** Session context */
  readonly session: SessionContext;
  
  /** Plugin configuration */
  readonly config: Record<string, any>;
  
  /** Logging */
  readonly logger: Logger;
}

export interface LlmCapabilities {
  /** Complete a prompt (blocking) */
  complete(prompt: string, options?: LlmOptions): Promise<string>;
  
  /** Stream completion (real-time) */
  stream(prompt: string, handler: StreamHandler, options?: LlmOptions): Promise<void>;
  
  /** Get token count estimate */
  countTokens(text: string): Promise<number>;
  
  /** Available models */
  readonly models: string[];
  
  /** Default model */
  readonly defaultModel: string;
  
  /** Maximum context window */
  readonly maxContextWindow: number;
}

export interface LlmOptions {
  /** Model to use */
  model?: string;
  
  /** Temperature (0-2) */
  temperature?: number;
  
  /** Max tokens to generate */
  maxTokens?: number;
  
  /** Stop sequences */
  stop?: string[];
  
  /** System prompt */
  system?: string;
  
  /** Tools to make available */
  tools?: string[];
}

export type StreamHandler = (chunk: string) => void | Promise<void>;

export interface ToolRegistry {
  /** Check if tool is available */
  has(toolId: ToolId): boolean;
  
  /** Execute a tool */
  execute<T = any>(toolId: ToolId, params: Record<string, any>): Promise<ToolResult<T>>;
  
  /** Get tool metadata */
  metadata(toolId: ToolId): ToolMetadata | undefined;
  
  /** List available tools */
  list(): ToolMetadata[];
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: ToolError;
  metadata?: {
    duration_ms: number;
    tokens_used?: number;
  };
}

export interface ToolError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
}

export interface ToolMetadata {
  id: ToolId;
  name: string;
  description: string;
  parameters: ParameterSchema;
}

export interface UiCapabilities {
  /** Render markdown content */
  renderMarkdown(content: string): void;
  
  /** Render code block with syntax highlighting */
  renderCode(content: string, language: string, filename?: string): void;
  
  /** Render image */
  renderImage(data: ImageData | string, alt?: string): void;
  
  /** Render chart/graph */
  renderChart(type: 'line' | 'bar' | 'pie' | 'scatter', data: ChartData, options?: ChartOptions): void;
  
  /** Render table */
  renderTable(headers: string[], rows: any[][]): void;
  
  /** Render interactive component */
  renderInteractive(component: InteractiveComponent): Promise<any>;
  
  /** Open side panel */
  openPanel(title: string, content: PanelContent): PanelHandle;
  
  /** Show form and collect input */
  showForm(schema: FormSchema): Promise<FormData>;
  
  /** Send progress update */
  progress(percent: number, message?: string): void;
  
  /** Clear output */
  clear(): void;
}

export type ImageData = 
  | { url: string }
  | { base64: string; mimeType: string }
  | { buffer: Uint8Array; mimeType: string };

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    color?: string;
  }>;
}

export interface ChartOptions {
  title?: string;
  xAxis?: string;
  yAxis?: string;
  stacked?: boolean;
}

export interface InteractiveComponent {
  type: 'button' | 'input' | 'select' | 'slider' | 'file';
  id: string;
  label?: string;
  props?: Record<string, any>;
}

export interface PanelHandle {
  id: string;
  update(content: PanelContent): void;
  close(): void;
}

export type PanelContent = 
  | { type: 'markdown'; content: string }
  | { type: 'code'; content: string; language: string }
  | { type: 'html'; content: string }
  | { type: 'component'; name: string; props: Record<string, any> };

export interface FormSchema {
  title?: string;
  description?: string;
  fields: FormField[];
}

export interface FormField {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'file' | 'boolean';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: Array<{ label: string; value: any }>;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface FormData {
  [fieldName: string]: any;
}

export interface StorageBackend {
  /** Get value by key */
  get<T = any>(key: string): Promise<T | undefined>;
  
  /** Set value */
  set<T = any>(key: string, value: T): Promise<void>;
  
  /** Delete key */
  delete(key: string): Promise<void>;
  
  /** List all keys */
  keys(): Promise<string[]>;
  
  /** Clear all data */
  clear(): Promise<void>;
  
  /** Check if persistent */
  readonly isPersistent: boolean;
}

export interface SessionContext {
  /** Unique session ID */
  id: string;
  
  /** Session start time */
  startedAt: Date;
  
  /** User identifier */
  userId?: string;
  
  /** Session metadata */
  metadata: Record<string, any>;
  
  /** Get conversation history */
  getHistory(): Promise<Message[]>;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// ============================================================================
// PLUGIN RUNTIME
// ============================================================================

export interface Plugin {
  /** Plugin manifest */
  readonly manifest: PluginManifest;
  
  /** Initialize plugin with host */
  initialize(host: PluginHost): Promise<void>;
  
  /** Execute a function */
  execute(functionName: string, params: Record<string, any>, context: ExecutionContext): Promise<ExecutionResult>;
  
  /** Handle events */
  onEvent?(event: string, payload: any): void;
  
  /** Cleanup on unload */
  destroy?(): Promise<void>;
}

export interface ExecutionContext {
  /** Unique execution ID */
  executionId: string;
  
  /** Start time */
  startedAt: Date;
  
  /** Parent execution (if nested) */
  parentExecutionId?: string;
  
  /** Execution metadata */
  metadata: Record<string, any>;
}

export interface ExecutionResult {
  success: boolean;
  content?: string;
  artifacts?: Artifact[];
  data?: any;
  error?: ExecutionError;
}

export interface Artifact {
  id: string;
  type: 'image' | 'code' | 'document' | 'data' | 'chart' | 'file';
  format: string;
  filename?: string;
  content: string | Uint8Array;
  metadata?: Record<string, any>;
}

export interface ExecutionError {
  code: string;
  message: string;
  details?: any;
  retryable: boolean;
  retryAfter?: number;
}

// ============================================================================
// ADAPTER INTERFACES
// ============================================================================

export interface Adapter {
  readonly name: string;
  readonly version: string;
  
  /** Check if this adapter can run in current environment */
  canActivate(): boolean;
  
  /** Initialize adapter with plugin */
  initialize(plugin: Plugin, config?: Record<string, any>): Promise<AdapterInstance>;
}

export interface AdapterInstance {
  /** Start serving the plugin */
  start(): Promise<void>;
  
  /** Stop serving */
  stop(): Promise<void>;
  
  /** Get connection info for clients */
  getEndpoint(): AdapterEndpoint;
}

export interface AdapterEndpoint {
  type: 'stdio' | 'http' | 'websocket' | 'custom';
  url?: string;
  command?: string[];
  env?: Record<string, string>;
}
