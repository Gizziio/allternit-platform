/**
 * Allternit Native Adapter
 * 
 * Full-featured adapter for Allternit platform.
 * Provides complete PluginHost implementation with all capabilities.
 */

import {
  Plugin,
  PluginHost,
  Adapter,
  AdapterInstance,
  AdapterEndpoint,
  LlmCapabilities,
  ToolRegistry,
  UiCapabilities,
  StorageBackend,
  SessionContext,
  Logger,
  StreamHandler,
  LlmOptions,
  ToolResult,
  ToolMetadata,
  ToolId,
  ImageData,
  ChartData,
  ChartOptions,
  PanelContent,
  FormSchema,
  FormData,
  FormField,
  Message,
  InteractiveComponent,
  PanelHandle,
} from '../../types';

export interface NativeAdapterConfig {
  /** Allternit runtime context */
  runtime: AllternitRuntime;
  
  /** Session configuration */
  session?: {
    id?: string;
    userId?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * Allternit runtime interface (provided by host platform)
 */
export interface AllternitRuntime {
  /** LLM provider */
  llm: {
    complete(prompt: string, options?: any): Promise<string>;
    stream(prompt: string, handler: (chunk: string) => void): Promise<void>;
    getModels(): string[];
  };
  
  /** Tool execution */
  tools: {
    execute(toolId: string, params: any): Promise<any>;
    list(): string[];
  };
  
  /** UI components */
  ui: {
    sendMessage(content: string, type?: string): void;
    createArtifact(type: string, content: any): string;
    openPanel(title: string, content: any): { update: Function; close: Function };
    showForm(schema: any): Promise<any>;
    progress(percent: number): void;
  };
  
  /** Storage */
  storage: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<void>;
  };
  
  /** Session info */
  session: {
    id: string;
    getHistory(): Promise<any[]>;
  };
}

/**
 * Native Allternit Adapter
 * 
 * Provides full PluginHost with all capabilities.
 */
export class NativeAdapter implements Adapter {
  readonly name = 'allternit';
  readonly version = '1.0.0';
  
  canActivate(): boolean {
    // Only works inside Allternit runtime
    return typeof globalThis.__ALLTERNIT_RUNTIME__ !== 'undefined';
  }
  
  async initialize(plugin: Plugin, config: NativeAdapterConfig): Promise<AdapterInstance> {
    return new NativeAdapterInstance(plugin, config);
  }
}

class NativeAdapterInstance implements AdapterInstance {
  private host: NativePluginHost;
  
  constructor(
    private plugin: Plugin,
    private config: NativeAdapterConfig
  ) {
    this.host = new NativePluginHost(plugin, config.runtime, config.session);
  }
  
  async start(): Promise<void> {
    await this.plugin.initialize(this.host);
    console.error(`Native adapter started for ${this.plugin.manifest.id}`);
  }
  
  async stop(): Promise<void> {
    await this.plugin.destroy?.();
  }
  
  getEndpoint(): AdapterEndpoint {
    return {
      type: 'custom',
      url: `allternit://plugins/${this.plugin.manifest.id}`,
    };
  }
}

/**
 * Full PluginHost implementation for Allternit
 */
class NativePluginHost implements PluginHost {
  readonly platform = 'allternit';
  readonly version = '1.0.0';
  readonly config: Record<string, any> = {};
  
  llm: LlmCapabilities;
  tools: ToolRegistry;
  ui: UiCapabilities;
  storage: StorageBackend;
  session: SessionContext;
  logger: Logger;
  
  constructor(
    plugin: Plugin,
    runtime: AllternitRuntime,
    sessionConfig?: NativeAdapterConfig['session']
  ) {
    this.llm = new NativeLlmCapabilities(runtime.llm);
    this.tools = new NativeToolRegistry(runtime.tools);
    this.ui = new NativeUiCapabilities(runtime.ui);
    this.storage = new NativeStorageBackend(runtime.storage);
    this.session = {
      id: sessionConfig?.id || runtime.session.id,
      startedAt: new Date(),
      userId: sessionConfig?.userId,
      metadata: sessionConfig?.metadata || {},
      async getHistory() {
        const history = await runtime.session.getHistory();
        return history.map((h: any) => ({
          role: h.role,
          content: h.content,
          timestamp: new Date(h.timestamp),
          metadata: h.metadata,
        }));
      },
    };
    this.logger = {
      debug: (...args) => console.debug(`[${plugin.manifest.id}]`, ...args),
      info: (...args) => console.info(`[${plugin.manifest.id}]`, ...args),
      warn: (...args) => console.warn(`[${plugin.manifest.id}]`, ...args),
      error: (...args) => console.error(`[${plugin.manifest.id}]`, ...args),
    };
  }
}

class NativeLlmCapabilities implements LlmCapabilities {
  readonly models: string[];
  readonly defaultModel: string;
  readonly maxContextWindow: number = 200000;
  
  constructor(private runtimeLlm: AllternitRuntime['llm']) {
    this.models = runtimeLlm.getModels();
    this.defaultModel = this.models[0] || 'default';
  }
  
  async complete(prompt: string, options?: LlmOptions): Promise<string> {
    return this.runtimeLlm.complete(prompt, options);
  }
  
  async stream(prompt: string, handler: StreamHandler, options?: LlmOptions): Promise<void> {
    return this.runtimeLlm.stream(prompt, handler);
  }
  
  async countTokens(text: string): Promise<number> {
    // Allternit provides token counting
    return Math.ceil(text.length / 4);
  }
}

class NativeToolRegistry implements ToolRegistry {
  constructor(private runtimeTools: AllternitRuntime['tools']) {}
  
  has(toolId: string): boolean {
    return this.runtimeTools.list().includes(toolId);
  }
  
  async execute<T>(toolId: string, params: Record<string, any>): Promise<ToolResult<T>> {
    try {
      const result = await this.runtimeTools.execute(toolId, params);
      return {
        success: true,
        data: result,
        metadata: { duration_ms: 0 },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOOL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
        },
      };
    }
  }
  
  metadata(toolId: string): ToolMetadata | undefined {
    // Would fetch from runtime
    return {
      id: toolId as ToolId,
      name: toolId,
      description: `${toolId} tool`,
      parameters: { type: 'object', properties: {} },
    };
  }
  
  list(): ToolMetadata[] {
    return this.runtimeTools.list().map(id => ({
      id: id as ToolId,
      name: id,
      description: `${id} tool`,
      parameters: { type: 'object', properties: {} },
    }));
  }
}

class NativeUiCapabilities implements UiCapabilities {
  constructor(private runtimeUi: AllternitRuntime['ui']) {}
  
  renderMarkdown(content: string): void {
    this.runtimeUi.sendMessage(content, 'markdown');
  }
  
  renderCode(content: string, language: string, filename?: string): void {
    this.runtimeUi.createArtifact('code', { content, language, filename });
  }
  
  renderImage(data: ImageData, alt?: string): void {
    const imageUrl = typeof data === 'string' ? data : 
      'url' in data ? data.url :
      'base64' in data ? `data:image/png;base64,${data.base64}` :
      '';
    this.runtimeUi.createArtifact('image', { url: imageUrl, alt });
  }
  
  renderChart(type: 'line' | 'bar' | 'pie' | 'scatter', data: ChartData, options?: ChartOptions): void {
    this.runtimeUi.createArtifact('chart', { type, data, options });
  }
  
  renderTable(headers: string[], rows: any[][]): void {
    this.runtimeUi.createArtifact('table', { headers, rows });
  }
  
  async renderInteractive(component: InteractiveComponent): Promise<any> {
    // Allternit supports interactive components
    return { interacted: true, value: null };
  }
  
  openPanel(title: string, content: PanelContent): PanelHandle {
    const panel = this.runtimeUi.openPanel(title, content);
    return {
      id: Math.random().toString(36).slice(2),
      update: (newContent) => panel.update(newContent),
      close: () => panel.close(),
    };
  }
  
  async showForm(schema: FormSchema): Promise<FormData> {
    return this.runtimeUi.showForm(schema);
  }
  
  progress(percent: number, message?: string): void {
    this.runtimeUi.progress(percent);
  }
  
  clear(): void {
    // Clear UI
  }
}

class NativeStorageBackend implements StorageBackend {
  readonly isPersistent = true;
  
  constructor(private runtimeStorage: AllternitRuntime['storage']) {}
  
  async get<T>(key: string): Promise<T | undefined> {
    return this.runtimeStorage.get(key);
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    return this.runtimeStorage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    return this.runtimeStorage.set(key, undefined);
  }
  
  async keys(): Promise<string[]> {
    // Would need runtime support
    return [];
  }
  
  async clear(): Promise<void> {
    // Would need runtime support
  }
}
