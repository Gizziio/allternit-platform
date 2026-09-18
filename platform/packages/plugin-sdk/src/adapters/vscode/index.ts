/**
 * VS Code Extension Adapter
 * 
 * For GitHub Copilot, Cody, Continue.dev, and any VS Code extension:
 * - Register as VS Code command
 * - Show results in webview panels
 * - Integrate with Copilot chat
 */

import {
  Plugin, PluginHost, Adapter, AdapterInstance, AdapterEndpoint,
  LlmCapabilities, ToolRegistry, UiCapabilities, StorageBackend,
  SessionContext, Logger, ExecutionContext, ExecutionResult,
  StreamHandler, LlmOptions, ToolResult, ToolMetadata, ToolId,
  ImageData, ChartData, ChartOptions, PanelContent, FormSchema,
  FormData, PanelHandle
} from '../../types';

// VS Code types (would be imported from 'vscode' in real implementation)
interface VSCode {
  commands: {
    registerCommand(command: string, callback: (...args: any[]) => any): any;
  };
  window: {
    createWebviewPanel(title: string, viewType: string, showOptions: any): WebviewPanel;
    showInformationMessage(message: string): void;
    showErrorMessage(message: string): void;
  };
  workspace: {
    getConfiguration(section: string): any;
    openTextDocument(content: string): Promise<any>;
  };
}

interface WebviewPanel {
  webview: {
    html: string;
    postMessage(message: any): void;
  };
  reveal(): void;
  dispose(): void;
}

export interface VSCodeAdapterConfig {
  /** VS Code extension context */
  vscode: VSCode;
  
  /** Extension context for storage */
  context: {
    globalState: StorageBackend;
    workspaceState: StorageBackend;
    subscriptions: any[];
  };
  
  /** Show in Copilot chat */
  copilotIntegration?: boolean;
  
  /** Command prefix */
  commandPrefix?: string;
}

/**
 * VS Code Extension Adapter
 * 
 * Integrates with Copilot, Cody, and any VS Code AI extension.
 */
export class VSCodeAdapter implements Adapter {
  readonly name = 'vscode';
  readonly version = '1.0.0';
  
  canActivate(): boolean {
    // Check if running in VS Code extension context
    return typeof globalThis.acquireVsCodeApi === 'function' || 
           process.env.VSCODE_CWD !== undefined;
  }
  
  async initialize(plugin: Plugin, config: VSCodeAdapterConfig): Promise<AdapterInstance> {
    return new VSCodeAdapterInstance(plugin, config);
  }
}

class VSCodeAdapterInstance implements AdapterInstance {
  private host: VSCodePluginHost;
  private disposables: any[] = [];
  
  constructor(
    private plugin: Plugin,
    private config: VSCodeAdapterConfig
  ) {
    this.host = new VSCodePluginHost(plugin, config);
  }
  
  async start(): Promise<void> {
    await this.plugin.initialize(this.host);
    
    const prefix = this.config.commandPrefix || 'allternit';
    const vscode = this.config.vscode;
    
    // Register commands for each function
    for (const fn of this.plugin.manifest.provides.functions) {
      const commandId = `${prefix}.${this.plugin.manifest.id}.${fn.name}`;
      
      const disposable = vscode.commands.registerCommand(commandId, async (...args) => {
        // Parse arguments
        const params = args[0] || {};
        
        try {
          vscode.window.showInformationMessage(`Running ${this.plugin.manifest.name}...`);
          
          const result = await this.plugin.execute(fn.name, params, {
            executionId: `vscode_${Date.now()}`,
            startedAt: new Date(),
            metadata: { source: 'vscode' },
          });
          
          if (result.success) {
            vscode.window.showInformationMessage(`${this.plugin.manifest.name} complete!`);
            this.showResult(result);
          } else {
            vscode.window.showErrorMessage(result.error?.message || 'Execution failed');
          }
          
        } catch (error) {
          vscode.window.showErrorMessage(String(error));
        }
      });
      
      this.disposables.push(disposable);
      this.config.context.subscriptions.push(disposable);
    }
    
    // Register Copilot chat participant if enabled
    if (this.config.copilotIntegration) {
      this.registerCopilotParticipant();
    }
    
    console.error(`VS Code extension loaded: ${this.plugin.manifest.id}`);
  }
  
  private registerCopilotParticipant(): void {
    // Would integrate with Copilot Chat API
    // https://code.visualstudio.com/api/extension-guides/chat
    console.error('Copilot integration would be registered here');
  }
  
  private showResult(result: ExecutionResult): void {
    const panel = this.config.vscode.window.createWebviewPanel(
      'allternit-result',
      `${this.plugin.manifest.name} Result`,
      { viewColumn: 2, preserveFocus: false }
    );
    
    panel.webview.html = this.generateWebviewHtml(result);
  }
  
  private generateWebviewHtml(result: ExecutionResult): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: var(--vscode-font-family); padding: 20px; }
          pre { background: var(--vscode-editor-background); padding: 10px; }
          .artifact { margin: 10px 0; padding: 10px; border: 1px solid var(--vscode-panel-border); }
        </style>
      </head>
      <body>
        <h1>${this.plugin.manifest.name}</h1>
        <div class="content">
          ${result.content ? `<pre>${this.escapeHtml(result.content)}</pre>` : ''}
        </div>
        ${result.artifacts?.map(a => `
          <div class="artifact">
            <strong>${a.type}:</strong> ${a.filename || 'unnamed'}
          </div>
        `).join('') || ''}
      </body>
      </html>
    `;
  }
  
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  
  async stop(): Promise<void> {
    this.disposables.forEach(d => d.dispose?.());
    await this.plugin.destroy?.();
  }
  
  getEndpoint(): AdapterEndpoint {
    return {
      type: 'custom',
      url: `vscode://allternit.plugins/${this.plugin.manifest.id}`,
    };
  }
}

class VSCodePluginHost implements PluginHost {
  readonly platform = 'vscode';
  readonly version = '1.0.0';
  readonly config: Record<string, any> = {};
  llm: LlmCapabilities;
  tools: ToolRegistry;
  ui: VSCodeUiCapabilities;
  storage: StorageBackend;
  session: SessionContext;
  logger: Logger;
  
  constructor(plugin: Plugin, config: VSCodeAdapterConfig) {
    this.llm = new VSCodeLlmCapabilities(config);
    this.tools = new VSCodeToolRegistry(config);
    this.ui = new VSCodeUiCapabilities(config);
    this.storage = config.context.globalState;
    this.session = {
      id: `vscode_${Date.now()}`,
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

class VSCodeLlmCapabilities implements LlmCapabilities {
  readonly models = ['copilot', 'vscode-lm'];
  readonly defaultModel = 'copilot';
  readonly maxContextWindow = 128000;
  
  constructor(private config: VSCodeAdapterConfig) {}
  
  async complete(prompt: string, options?: LlmOptions): Promise<string> {
    // Use VS Code's Language Model API (Copilot)
    // https://code.visualstudio.com/api/extension-guides/language-model
    console.error('[VS Code LLM]', prompt.slice(0, 100));
    return `[Copilot would process: ${prompt.slice(0, 50)}...]`;
  }
  
  async stream(prompt: string, handler: StreamHandler): Promise<void> {
    const response = await this.complete(prompt);
    handler(response);
  }
  
  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

class VSCodeToolRegistry implements ToolRegistry {
  constructor(private config: VSCodeAdapterConfig) {}
  
  has(toolId: string): boolean {
    // VS Code has terminal, file system, etc.
    return ['terminal_run', 'file_read', 'file_write'].includes(toolId);
  }
  
  async execute<T>(toolId: string, params: Record<string, any>): Promise<ToolResult<T>> {
    // Use VS Code APIs
    switch (toolId) {
      case 'file_read':
        // Use workspace.fs
        return { success: true, data: {} as T };
      case 'terminal_run':
        // Use window.createTerminal
        return { success: true, data: {} as T };
      default:
        return { success: false, error: { code: 'NOT_FOUND', message: 'Tool not found', retryable: false } };
    }
  }
  
  metadata(toolId: string): ToolMetadata | undefined {
    if (!this.has(toolId)) return undefined;
    return {
      id: toolId as ToolId,
      name: toolId,
      description: `${toolId} via VS Code`,
      parameters: { type: 'object', properties: {} },
    };
  }
  
  list(): ToolMetadata[] {
    return ['terminal_run', 'file_read', 'file_write']
      .map(id => this.metadata(id)!)
      .filter(Boolean);
  }
}

class VSCodeUiCapabilities implements UiCapabilities {
  private panels: Map<string, WebviewPanel> = new Map();
  
  constructor(private config: VSCodeAdapterConfig) {}
  
  renderMarkdown(content: string): void {
    this.config.vscode.window.showInformationMessage(content.slice(0, 100));
  }
  
  renderCode(content: string, language: string, filename?: string): void {
    // Open in editor
    this.config.vscode.workspace.openTextDocument(content);
  }
  
  renderImage(data: ImageData): void {
    // Show in webview
    console.error('[Image would show in webview]');
  }
  
  renderChart(type: string, data: ChartData): void {
    // Render in webview with Chart.js
    console.error('[Chart would render in webview]');
  }
  
  renderTable(headers: string[], rows: any[][]): void {
    // Show as markdown table
    const table = [
      '| ' + headers.join(' | ') + ' |',
      '| ' + headers.map(() => '---').join(' | ') + ' |',
      ...rows.map(row => '| ' + row.join(' | ') + ' |'),
    ].join('\n');
    console.log(table);
  }
  
  async renderInteractive(component: any): Promise<any> {
    // Use webview with forms
    return null;
  }
  
  openPanel(title: string, content: PanelContent): PanelHandle {
    const panel = this.config.vscode.window.createWebviewPanel(
      'allternit-panel',
      title,
      { viewColumn: 2 }
    );
    
    const id = `panel_${Date.now()}`;
    this.panels.set(id, panel);
    
    // Set initial content
    if (content.type === 'markdown') {
      panel.webview.html = `<pre>${content.content}</pre>`;
    }
    
    return {
      id,
      update: (newContent) => {
        if (newContent.type === 'markdown') {
          panel.webview.html = `<pre>${newContent.content}</pre>`;
        }
      },
      close: () => panel.dispose(),
    };
  }
  
  async showForm(schema: FormSchema): Promise<FormData> {
    // Show input boxes sequentially
    const result: FormData = {};
    for (const field of schema.fields) {
      // Would use window.showInputBox
      result[field.name] = '';
    }
    return result;
  }
  
  progress(percent: number, message?: string): void {
    // Use window.withProgress
    console.error(`Progress: ${percent}% ${message || ''}`);
  }
  
  clear(): void {
    // Close all panels
    this.panels.forEach(p => p.dispose());
    this.panels.clear();
  }
}
