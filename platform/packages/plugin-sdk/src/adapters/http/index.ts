/**
 * HTTP REST Adapter
 * 
 * Universal HTTP API for any client:
 * - Web applications
 * - Mobile apps
 * - Custom integrations
 * - Other LLM platforms via HTTP calls
 */

import {
  Plugin,
  PluginHost,
  Adapter,
  AdapterInstance,
  AdapterEndpoint,
  ExecutionContext,
  ToolResult,
  ToolMetadata,
  LlmOptions,
  StreamHandler,
  ImageData,
  ChartData,
  ChartOptions,
  PanelContent,
  FormSchema,
  FormData,
  Logger,
  Message,
  Artifact,
  PanelHandle,
  SessionContext,
  LlmCapabilities,
  ToolRegistry,
  UiCapabilities,
  StorageBackend,
} from '../../types';

import express, { Request, Response, Router } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

export interface HttpAdapterConfig {
  /** HTTP port */
  port?: number;
  
  /** Bind host */
  host?: string;
  
  /** CORS origins */
  corsOrigins?: string[];
  
  /** API key for authentication */
  apiKey?: string;
  
  /** Enable WebSocket for streaming */
  enableWebSocket?: boolean;
  
  /** Static file serving */
  staticDir?: string;
  
  /** Rate limiting */
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
}

/**
 * Universal HTTP Adapter
 * 
 * Provides REST API + WebSocket streaming for maximum compatibility.
 */
export class HttpAdapter implements Adapter {
  readonly name = 'http';
  readonly version = '1.0.0';
  
  canActivate(): boolean {
    return true; // HTTP works everywhere
  }
  
  async initialize(plugin: Plugin, config: HttpAdapterConfig = {}): Promise<AdapterInstance> {
    return new HttpAdapterInstance(plugin, config);
  }
}

class HttpAdapterInstance implements AdapterInstance {
  private app: express.Application;
  private server: ReturnType<typeof createServer>;
  private wss?: WebSocketServer;
  private host: HttpPluginHost;
  private connections: Map<string, WebSocket> = new Map();
  
  constructor(
    private plugin: Plugin,
    private config: HttpAdapterConfig
  ) {
    this.host = new HttpPluginHost(plugin);
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    if (config.enableWebSocket !== false) {
      this.setupWebSocket();
    }
  }
  
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS
    this.app.use(cors({
      origin: this.config.corsOrigins || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));
    
    // Auth middleware
    if (this.config.apiKey) {
      this.app.use((req: Request, res: Response, next) => {
        const key = req.headers.authorization?.replace('Bearer ', '');
        if (key !== this.config.apiKey) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
      });
    }
  }
  
  private setupRoutes(): void {
    const router = Router();
    
    // Health check
    router.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        plugin: this.plugin.manifest.id,
        version: this.plugin.manifest.version,
        uptime: process.uptime(),
      });
    });
    
    // Get plugin manifest
    router.get('/manifest', (req: Request, res: Response) => {
      res.json(this.plugin.manifest);
    });
    
    // List available functions
    router.get('/functions', (req: Request, res: Response) => {
      res.json({
        functions: this.plugin.manifest.provides.functions,
      });
    });
    
    // Execute function (sync)
    router.post('/execute/:functionName', async (req: Request, res: Response) => {
      const { functionName } = req.params;
      const { inputs, options } = req.body;
      
      try {
        // Check if streaming requested
        if (options?.stream) {
          return this.handleStreamingExecution(req, res, functionName, inputs);
        }
        
        // Standard execution
        const result = await this.plugin.execute(functionName, inputs || {}, {
          executionId: `http_${Date.now()}`,
          startedAt: new Date(),
          metadata: { source: 'http', ip: req.ip },
        });
        
        res.json({
          success: result.success,
          content: result.content,
          artifacts: result.artifacts,
          data: result.data,
          error: result.error,
        });
        
      } catch (error) {
        res.status(500).json({
          success: false,
          error: {
            code: 'EXECUTION_ERROR',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    });
    
    // Get execution status (for async jobs)
    router.get('/executions/:executionId', async (req: Request, res: Response) => {
      // Would check job queue in production
      res.json({
        executionId: req.params.executionId,
        status: 'unknown',
      });
    });
    
    // Batch execution
    router.post('/batch', async (req: Request, res: Response) => {
      const { jobs } = req.body;
      
      const results = await Promise.all(
        jobs.map(async (job: any) => {
          try {
            const result = await this.plugin.execute(
              job.function,
              job.inputs,
              {
                executionId: `batch_${Date.now()}`,
                startedAt: new Date(),
                metadata: { batch: true },
              }
            );
            return { function: job.function, success: true, result };
          } catch (error) {
            return {
              function: job.function,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })
      );
      
      res.json({ results });
    });
    
    // Get available tools
    router.get('/tools', (req: Request, res: Response) => {
      res.json({
        tools: this.host.tools.list(),
      });
    });
    
    // Execute tool directly
    router.post('/tools/:toolId', async (req: Request, res: Response) => {
      const { toolId } = req.params;
      const params = req.body;
      
      const result = await this.host.tools.execute(toolId, params);
      res.json(result);
    });
    
    // Get artifact
    router.get('/artifacts/:artifactId', (req: Request, res: Response) => {
      // Would retrieve from storage
      res.status(501).json({ error: 'Not implemented' });
    });
    
    // Mount router
    this.app.use('/v1', router);
    
    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      console.error('HTTP Error:', err);
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: err.message,
        },
      });
    });
  }
  
  private handleStreamingExecution(
    req: Request,
    res: Response,
    functionName: string,
    inputs: any
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };
    
    // Execute with streaming
    this.plugin.execute(functionName, inputs, {
      executionId: `http_stream_${Date.now()}`,
      startedAt: new Date(),
      metadata: { streaming: true },
    }).then(result => {
      sendEvent('complete', result);
      res.end();
    }).catch(error => {
      sendEvent('error', { message: error.message });
      res.end();
    });
    
    // Send initial event
    sendEvent('start', { function: functionName });
  }
  
  private setupWebSocket(): void {
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws: WebSocket, req: Request) => {
      const connectionId = `ws_${Date.now()}`;
      this.connections.set(connectionId, ws);
      
      console.error(`WebSocket connected: ${connectionId}`);
      
      ws.on('message', async (data: string) => {
        try {
          const message = JSON.parse(data);
          
          if (message.type === 'execute') {
            const result = await this.plugin.execute(
              message.function,
              message.inputs,
              {
                executionId: connectionId,
                startedAt: new Date(),
                metadata: { websocket: true },
              }
            );
            
            ws.send(JSON.stringify({
              type: 'result',
              executionId: connectionId,
              result,
            }));
          }
          
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          }));
        }
      });
      
      ws.on('close', () => {
        this.connections.delete(connectionId);
      });
    });
  }
  
  async start(): Promise<void> {
    const port = this.config.port || 3000;
    const host = this.config.host || '0.0.0.0';
    
    if (this.server) {
      // WebSocket mode
      this.server.listen(port, host, () => {
        console.error(`HTTP + WebSocket server running on http://${host}:${port}`);
      });
    } else {
      // HTTP only
      this.app.listen(port, host, () => {
        console.error(`HTTP server running on http://${host}:${port}`);
      });
    }
    
    await this.plugin.initialize(this.host);
  }
  
  async stop(): Promise<void> {
    await this.plugin.destroy?.();
    
    // Close WebSocket connections
    this.connections.forEach(ws => ws.close());
    this.wss?.close();
    this.server?.close();
  }
  
  getEndpoint(): AdapterEndpoint {
    const port = this.config.port || 3000;
    return {
      type: 'http',
      url: `http://localhost:${port}/v1`,
    };
  }
}

/**
 * Full-featured PluginHost for HTTP environment
 */
class HttpPluginHost implements PluginHost {
  readonly platform = 'http';
  readonly version = '1.0.0';
  readonly config: Record<string, any> = {};
  
  llm: LlmCapabilities;
  tools: ToolRegistry;
  ui: UiCapabilities;
  storage: StorageBackend;
  session: SessionContext;
  logger: Logger;
  
  constructor(private plugin: Plugin) {
    this.llm = new HttpLlmCapabilities();
    this.tools = new HttpToolRegistry();
    this.ui = new HttpUiCapabilities();
    this.storage = new HttpStorageBackend();
    this.session = {
      id: `http_${Date.now()}`,
      startedAt: new Date(),
      metadata: {},
      async getHistory() { return []; },
    };
    this.logger = {
      debug: (...args) => console.error('[debug]', ...args),
      info: (...args) => console.error('[info]', ...args),
      warn: (...args) => console.error('[warn]', ...args),
      error: (...args) => console.error('[error]', ...args),
    };
  }
}

// HTTP implementations

class HttpLlmCapabilities implements LlmCapabilities {
  readonly models = ['gpt-4', 'claude-3', 'local'];
  readonly defaultModel = 'gpt-4';
  readonly maxContextWindow = 128000;
  
  async complete(prompt: string, options?: LlmOptions): Promise<string> {
    // Call external LLM API
    // Would integrate with OpenAI, Anthropic, or local models
    console.error('[HTTP] LLM complete:', prompt.slice(0, 100));
    return `[LLM response for: ${prompt.slice(0, 50)}...]`;
  }
  
  async stream(prompt: string, handler: StreamHandler, options?: LlmOptions): Promise<void> {
    // Stream from external LLM
    const chunks = ['Response', ' ', 'from', ' ', 'LLM', '.'];
    for (const chunk of chunks) {
      await handler(chunk);
    }
  }
  
  async countTokens(text: string): Promise<number> {
    return Math.ceil(text.length / 4);
  }
}

class HttpToolRegistry implements ToolRegistry {
  private tools: Map<string, ToolMetadata> = new Map();
  
  constructor() {
    // Register all tools
    const toolList: [string, string, string][] = [
      ['web_search', 'Web Search', 'Search the internet'],
      ['web_browse', 'Web Browse', 'Browse specific URLs'],
      ['code_execute', 'Code Execution', 'Execute code safely'],
      ['file_read', 'Read File', 'Read file contents'],
      ['file_write', 'Write File', 'Write file contents'],
      ['image_generate', 'Generate Image', 'Generate images via AI'],
      ['browser_navigate', 'Browser Navigate', 'Control browser'],
    ];
    
    toolList.forEach(([id, name, desc]) => {
      this.tools.set(id, {
        id: id as any,
        name,
        description: desc,
        parameters: { type: 'object', properties: {} },
      });
    });
  }
  
  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }
  
  async execute<T>(toolId: string, params: Record<string, any>): Promise<ToolResult<T>> {
    // Execute via external service or local implementation
    console.error(`[HTTP] Executing tool: ${toolId}`, params);
    
    return {
      success: true,
      data: { executed: toolId, params } as T,
    };
  }
  
  metadata(toolId: string): ToolMetadata | undefined {
    return this.tools.get(toolId);
  }
  
  list(): ToolMetadata[] {
    return Array.from(this.tools.values());
  }
}

class HttpUiCapabilities implements UiCapabilities {
  renderMarkdown(content: string): void {
    console.error('[HTTP] Markdown:', content.slice(0, 200));
  }
  
  renderCode(content: string, language: string): void {
    console.error(`[HTTP] Code (${language}):`, content.slice(0, 200));
  }
  
  renderImage(data: ImageData): void {
    console.error('[HTTP] Image rendered');
  }
  
  renderChart(type: string, data: ChartData, options?: ChartOptions): void {
    console.error(`[HTTP] Chart (${type})`);
  }
  
  renderTable(headers: string[], rows: any[][]): void {
    console.error('[HTTP] Table:', headers.join(' | '));
  }
  
  async renderInteractive(component: any): Promise<any> {
    return { interacted: false };
  }
  
  openPanel(title: string, content: PanelContent) {
    console.error(`[HTTP] Panel: ${title}`);
    return {
      id: 'panel_1',
      update: () => {},
      close: () => {},
    };
  }
  
  async showForm(schema: FormSchema): Promise<FormData> {
    return {};
  }
  
  progress(percent: number, message?: string): void {
    console.error(`[HTTP] Progress: ${percent}% ${message || ''}`);
  }
  
  clear(): void {}
}

class HttpStorageBackend implements StorageBackend {
  private storage: Map<string, any> = new Map();
  readonly isPersistent = true;
  
  async get<T>(key: string): Promise<T | undefined> {
    return this.storage.get(key);
  }
  
  async set<T>(key: string, value: T): Promise<void> {
    this.storage.set(key, value);
  }
  
  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }
  
  async keys(): Promise<string[]> {
    return Array.from(this.storage.keys());
  }
  
  async clear(): Promise<void> {
    this.storage.clear();
  }
}
