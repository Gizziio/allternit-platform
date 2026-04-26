/**
 * LangChain Adapter
 * 
 * Integrate Allternit plugins as LangChain Tools:
 * - Use plugins in LangChain chains
 * - Combine with other LangChain tools
 * - Agent compatibility
 */

import {
  Plugin, PluginHost, Adapter, AdapterInstance, AdapterEndpoint,
  LlmCapabilities, ToolRegistry, UiCapabilities, StorageBackend,
  SessionContext, Logger, ExecutionContext, ExecutionResult,
  StreamHandler, LlmOptions, ToolResult, ToolMetadata, ToolId,
  ImageData, ChartData, ChartOptions, PanelContent, FormSchema,
  FormData, PanelHandle
} from '../../types';

export interface LangChainAdapterConfig {
  /** LangChain callbacks */
  callbacks?: any[];
  
  /** Metadata for tracing */
  metadata?: Record<string, any>;
  
  /** Tags for the tool */
  tags?: string[];
  
  /** Verbose mode */
  verbose?: boolean;
}

/**
 * LangChain Tool wrapper for Allternit plugins
 * 
 * Usage:
 *   import { AllternitTool } from '@allternit/plugin-sdk/adapters/langchain';
 *   
 *   const tool = new AllternitTool(marketResearchPlugin);
 *   const result = await tool.call({ industry: 'AI' });
 */
export class AllternitTool {
  name: string;
  description: string;
  
  private plugin: Plugin;
  private host: LangChainPluginHost;
  private config: LangChainAdapterConfig;
  
  constructor(plugin: Plugin, config: LangChainAdapterConfig = {}) {
    this.plugin = plugin;
    this.config = config;
    this.name = plugin.manifest.id;
    this.description = this.generateDescription();
    this.host = new LangChainPluginHost(plugin);
  }
  
  async initialize(): Promise<void> {
    await this.plugin.initialize(this.host);
  }
  
  async call(input: any): Promise<string> {
    const result = await this.plugin.execute('execute', input, {
      executionId: `langchain_${Date.now()}`,
      startedAt: new Date(),
      metadata: { source: 'langchain', callbacks: this.config.callbacks },
    });
    
    if (!result.success) {
      throw new Error(result.error?.message || 'Plugin execution failed');
    }
    
    // Return content or JSON stringified data
    return result.content || JSON.stringify(result.data);
  }
  
  private generateDescription(): string {
    const m = this.plugin.manifest;
    const fn = m.provides.functions[0];
    
    return `
${m.description}

Input Schema:
${JSON.stringify(fn.parameters, null, 2)}

Use this tool to ${fn.description.toLowerCase()}.
`.trim();
  }
}

/**
 * LangChain Adapter
 * 
 * Creates LangChain-compatible tools from Allternit plugins.
 */
export class LangChainAdapter implements Adapter {
  readonly name = 'langchain';
  readonly version = '1.0.0';
  
  canActivate(): boolean {
    // Works if LangChain is available
    try {
      require('langchain/tools');
      return true;
    } catch {
      return false;
    }
  }
  
  async initialize(plugin: Plugin, config: LangChainAdapterConfig = {}): Promise<AdapterInstance> {
    return new LangChainAdapterInstance(plugin, config);
  }
}

class LangChainAdapterInstance implements AdapterInstance {
  tool: AllternitTool;
  
  constructor(plugin: Plugin, config: LangChainAdapterConfig) {
    this.tool = new AllternitTool(plugin, config);
  }
  
  async start(): Promise<void> {
    await this.tool.initialize();
  }
  
  async stop(): Promise<void> {
    await this.tool['plugin'].destroy?.();
  }
  
  getEndpoint(): AdapterEndpoint {
    return {
      type: 'custom',
      url: `langchain://allternit/${this.tool.name}`,
    };
  }
}

class LangChainPluginHost implements PluginHost {
  readonly platform = 'langchain';
  readonly version = '1.0.0';
  readonly config: Record<string, any> = {};
  llm: LlmCapabilities;
  tools: ToolRegistry;
  ui: LangChainUiCapabilities;
  storage: StorageBackend;
  session: SessionContext;
  logger: Logger;
  
  constructor(plugin: Plugin) {
    this.llm = new LangChainLlmCapabilities();
    this.tools = new LangChainToolRegistry();
    this.ui = new LangChainUiCapabilities();
    this.storage = new LangChainStorageBackend();
    this.session = {
      id: `langchain_${Date.now()}`,
      startedAt: new Date(),
      metadata: {},
      async getHistory() { return []; },
    };
    this.logger = {
      debug: (...args) => console.debug(`[${plugin.manifest.id}]`, ...args),
      info: (...args) => console.info(`[${plugin.manifest.id}]`, ...args),
      warn: (...args) => console.warn(`[${plugin.manifest.id}]`, ...args),
      error: (...args) => console.error(`[${plugin.manifest.id}]`, ...args),
    };
  }
}

class LangChainLlmCapabilities implements LlmCapabilities {
  readonly models = ['langchain-default'];
  readonly defaultModel = 'langchain-default';
  readonly maxContextWindow = 128000;
  
  async complete(prompt: string): Promise<string> {
    // LangChain handles LLM - plugin just provides prompts
    console.error('[LangChain LLM]', prompt.slice(0, 100));
    return prompt;
  }
  
  async stream(prompt: string, handler: StreamHandler): Promise<void> {
    handler(await this.complete(prompt));
  }
  
  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

class LangChainToolRegistry implements ToolRegistry {
  has(toolId: string): boolean { return false; }
  async execute<T>(toolId: string): Promise<ToolResult<T>> {
    return { success: false, error: { code: 'NOT_AVAILABLE', message: 'Tools via LangChain', retryable: false } };
  }
  metadata(toolId: string): ToolMetadata | undefined { return undefined; }
  list(): ToolMetadata[] { return []; }
}

class LangChainUiCapabilities implements UiCapabilities {
  renderMarkdown(content: string): void { console.log(content); }
  renderCode(content: string, language: string): void { console.log(`\`\`\`${language}\n${content}\n\`\`\``); }
  renderImage(): void {}
  renderChart(): void {}
  renderTable(headers: string[], rows: any[][]): void {
    console.log(headers.join(' | '));
    rows.forEach(r => console.log(r.join(' | ')));
  }
  async renderInteractive(): Promise<any> { return null; }
  openPanel(): PanelHandle { return { id: 'lc', update: () => {}, close: () => {} }; }
  async showForm(): Promise<FormData> { return {}; }
  progress(percent: number): void { console.error(`${percent}%`); }
  clear(): void {}
}

class LangChainStorageBackend implements StorageBackend {
  private storage = new Map<string, any>();
  readonly isPersistent = false;
  async get<T>(key: string): Promise<T | undefined> { return this.storage.get(key); }
  async set<T>(key: string, value: T): Promise<void> { this.storage.set(key, value); }
  async delete(key: string): Promise<void> { this.storage.delete(key); }
  async keys(): Promise<string[]> { return Array.from(this.storage.keys()); }
  async clear(): Promise<void> { this.storage.clear(); }
}
