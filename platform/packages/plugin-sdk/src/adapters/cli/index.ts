/**
 * CLI Adapter
 * 
 * Universal command-line interface for any LLM tool:
 * - OpenAI Codex
 * - Aider
 * - Continue.dev
 * - Any terminal-based workflow
 */

import {
  Plugin, PluginHost, Adapter, AdapterInstance, AdapterEndpoint,
  ExecutionContext, ExecutionResult, LlmCapabilities, ToolRegistry,
  UiCapabilities, StorageBackend, SessionContext, Logger,
  StreamHandler, LlmOptions, ToolResult, ToolMetadata, ToolId,
  ImageData, ChartData, ChartOptions, PanelContent, FormSchema,
  FormData, Message, PanelHandle
} from '../../types';

export interface CliAdapterConfig {
  inputMode?: 'args' | 'stdin' | 'interactive';
  format?: 'text' | 'json' | 'markdown' | 'html';
  llmProvider?: 'openai' | 'anthropic' | 'ollama' | 'local';
  apiKey?: string;
  baseUrl?: string;
  stream?: boolean;
  output?: string;
  quiet?: boolean;
}

export class CliAdapter implements Adapter {
  readonly name = 'cli';
  readonly version = '1.0.0';
  
  canActivate(): boolean {
    return true;
  }
  
  async initialize(plugin: Plugin, config: CliAdapterConfig = {}): Promise<AdapterInstance> {
    return new CliAdapterInstance(plugin, config);
  }
}

class CliAdapterInstance implements AdapterInstance {
  private host: CliPluginHost;
  
  constructor(private plugin: Plugin, private config: CliAdapterConfig) {
    this.host = new CliPluginHost(plugin, config);
  }
  
  async start(): Promise<void> {
    await this.plugin.initialize(this.host);
    const args = this.parseArgs();
    await this.runOnce(args);
  }
  
  private parseArgs(): Record<string, any> {
    const args: Record<string, any> = {};
    const argv = process.argv.slice(2);
    
    for (let i = 0; i < argv.length; i++) {
      if (argv[i].startsWith('--')) {
        const key = argv[i].slice(2);
        const value = argv[i + 1];
        if (value && !value.startsWith('--')) {
          try { args[key] = JSON.parse(value); } catch { args[key] = value; }
          i++;
        } else {
          args[key] = true;
        }
      }
    }
    return args;
  }
  
  private async runOnce(args: Record<string, any>): Promise<void> {
    try {
      const result = await this.plugin.execute('execute', args, {
        executionId: `cli_${Date.now()}`,
        startedAt: new Date(),
        metadata: { source: 'cli' },
      });
      
      if (result.success) {
        console.log(result.content || JSON.stringify(result.data));
      } else {
        console.error('Error:', result.error?.message);
        process.exit(1);
      }
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }
  
  async stop(): Promise<void> {
    await this.plugin.destroy?.();
  }
  
  getEndpoint(): AdapterEndpoint {
    return {
      type: 'custom',
      command: ['npx', '@allternit/plugin-sdk', 'run', this.plugin.manifest.id],
    };
  }
}

class CliPluginHost implements PluginHost {
  readonly platform = 'cli';
  readonly version = '1.0.0';
  readonly config: Record<string, any> = {};
  llm: LlmCapabilities;
  tools: ToolRegistry;
  ui: UiCapabilities;
  storage: StorageBackend;
  session: SessionContext;
  logger: Logger;
  
  constructor(plugin: Plugin, config: CliAdapterConfig) {
    this.llm = new CliLlmCapabilities(config);
    this.tools = new CliToolRegistry();
    this.ui = new CliUiCapabilities();
    this.storage = new CliStorageBackend();
    this.session = { id: `cli_${Date.now()}`, startedAt: new Date(), metadata: {}, async getHistory() { return []; } };
    this.logger = { debug: () => {}, info: console.error, warn: console.error, error: console.error };
  }
}

class CliLlmCapabilities implements LlmCapabilities {
  readonly models = ['gpt-4', 'claude-3'];
  readonly defaultModel = 'gpt-4';
  readonly maxContextWindow = 128000;
  
  constructor(private config: CliAdapterConfig) {}
  
  async complete(prompt: string): Promise<string> {
    // Call external API based on config
    console.error(`[LLM] ${prompt.slice(0, 50)}...`);
    return `[LLM response for: ${prompt.slice(0, 30)}...]`;
  }
  
  async stream(prompt: string, handler: StreamHandler): Promise<void> {
    handler(await this.complete(prompt));
  }
  
  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

class CliToolRegistry implements ToolRegistry {
  has(toolId: string): boolean { return false; }
  async execute<T>(toolId: string): Promise<ToolResult<T>> {
    return { success: false, error: { code: 'NOT_IMPLEMENTED', message: 'CLI tools not available', retryable: false } };
  }
  metadata(toolId: string): ToolMetadata | undefined { return undefined; }
  list(): ToolMetadata[] { return []; }
}

class CliUiCapabilities implements UiCapabilities {
  renderMarkdown(content: string): void { console.log(content); }
  renderCode(content: string, language: string): void { console.log(`\`\`\`${language}\n${content}\n\`\`\``); }
  renderImage(): void { console.error('[Image not supported in CLI]'); }
  renderChart(): void {}
  renderTable(headers: string[], rows: any[][]): void {
    console.log(headers.join(' | '));
    rows.forEach(r => console.log(r.join(' | ')));
  }
  async renderInteractive(): Promise<any> { return null; }
  openPanel(): PanelHandle { return { id: 'cli', update: () => {}, close: () => {} }; }
  async showForm(): Promise<FormData> { return {}; }
  progress(percent: number): void { console.error(`${percent}%`); }
  clear(): void { console.clear(); }
}

class CliStorageBackend implements StorageBackend {
  private storage = new Map<string, any>();
  readonly isPersistent = false;
  async get<T>(key: string): Promise<T | undefined> { return this.storage.get(key); }
  async set<T>(key: string, value: T): Promise<void> { this.storage.set(key, value); }
  async delete(key: string): Promise<void> { this.storage.delete(key); }
  async keys(): Promise<string[]> { return Array.from(this.storage.keys()); }
  async clear(): Promise<void> { this.storage.clear(); }
}
