import * as readline from 'readline';

type JSONRPCId = string | number;
type JSONRPCRequest = { jsonrpc: '2.0'; id: JSONRPCId; method: string; params?: Record<string, any> };
type JSONRPCNotification = { jsonrpc: '2.0'; method: string; params?: Record<string, any> };
type JSONRPCResponse = { jsonrpc: '2.0'; id: JSONRPCId; result?: any; error?: { code: number; message: string; data?: any } };
type MCPToolProperty = { type: string; description?: string; enum?: string[]; default?: any; items?: MCPToolProperty; properties?: Record<string, MCPToolProperty>; required?: string[] };
type MCPTool = { name: string; description?: string; inputSchema: { type: 'object'; properties?: Record<string, MCPToolProperty>; required?: string[]; additionalProperties?: boolean } };
type MCPServerInfo = { name: string; version: string; protocolVersion?: string; capabilities?: { tools?: { listChanged?: boolean } } };

const PROTOCOL_VERSION = '2024-11-05';
const MCP_METHODS = { INITIALIZE: 'initialize', INITIALIZED: 'notifications/initialized', SHUTDOWN: 'shutdown', TOOLS_LIST: 'tools/list', TOOLS_CALL: 'tools/call' } as const;
const MCP_ERROR_CODES = { PARSE_ERROR: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL_ERROR: -32603, SERVER_NOT_INITIALIZED: -32002 } as const;

type RequestMeta = { durationMs: number; vendorRequestId?: string; baseUrl: string };
type RequestResult = { data: any; meta: RequestMeta; nextCursor?: string };

class NotionClient {
  private baseUrl = 'https://api.notion.com/v1';
  private token: string;
  private notionVersion = '2022-06-28';

  constructor() { this.token = process.env.NOTION_API_KEY ?? ''; }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}`, 'Notion-Version': this.notionVersion, 'Content-Type': 'application/json', 'User-Agent': 'Allternit-Connector/1.0.0' };
  }

  private async get(path: string): Promise<RequestResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, { headers: this.headers() });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`Notion API error (${res.status}): ${await res.text()}`);
    const data = await res.json() as any;
    return { data, meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl }, nextCursor: data.next_cursor ?? undefined };
  }

  private async post(path: string, body: any): Promise<RequestResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`Notion API error (${res.status}): ${await res.text()}`);
    const data = await res.json() as any;
    return { data, meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl }, nextCursor: data.next_cursor ?? undefined };
  }

  private async patch(path: string, body: any): Promise<RequestResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'PATCH', headers: this.headers(), body: JSON.stringify(body) });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`Notion API error (${res.status}): ${await res.text()}`);
    return { data: await res.json(), meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl } };
  }

  async health(): Promise<RequestResult> { return this.get('/users/me'); }

  async searchPages(query: string, limit = 10, startCursor?: string): Promise<RequestResult> {
    const body: any = { query, filter: { value: 'page', property: 'object' }, page_size: limit };
    if (startCursor) body.start_cursor = startCursor;
    return this.post('/search', body);
  }

  async searchDatabases(query: string, limit = 10, startCursor?: string): Promise<RequestResult> {
    const body: any = { query, filter: { value: 'database', property: 'object' }, page_size: limit };
    if (startCursor) body.start_cursor = startCursor;
    return this.post('/search', body);
  }

  async getPage(pageId: string): Promise<RequestResult> { return this.get(`/pages/${pageId}`); }

  async getPageContent(blockId: string, limit = 50, startCursor?: string): Promise<RequestResult> {
    const params = new URLSearchParams({ page_size: String(limit) });
    if (startCursor) params.set('start_cursor', startCursor);
    return this.get(`/blocks/${blockId}/children?${params}`);
  }

  async queryDatabase(databaseId: string, filter?: Record<string, any>, sorts?: any[], limit = 10, startCursor?: string): Promise<RequestResult> {
    const body: any = { page_size: limit };
    if (filter) body.filter = filter;
    if (sorts) body.sorts = sorts;
    if (startCursor) body.start_cursor = startCursor;
    return this.post(`/databases/${databaseId}/query`, body);
  }

  async createPage(parentId: string, parentType: 'page' | 'database', title: string, properties?: Record<string, any>): Promise<RequestResult> {
    const parent = parentType === 'database' ? { database_id: parentId } : { page_id: parentId };
    const props = properties ?? { title: { title: [{ text: { content: title } }] } };
    return this.post('/pages', { parent, properties: props });
  }

  async updatePage(pageId: string, properties: Record<string, any>): Promise<RequestResult> {
    return this.patch(`/pages/${pageId}`, { properties });
  }

  async appendBlocks(blockId: string, children: any[]): Promise<RequestResult> {
    return this.patch(`/blocks/${blockId}/children`, { children });
  }
}

type ToolProvider = { getTools(): MCPTool[]; executeTool(name: string, args: Record<string, any>): Promise<any> };

class StdioMCPServer {
  private initialized = false;
  private rl: readline.Interface | null = null;
  constructor(private toolProvider: ToolProvider, private serverInfo: MCPServerInfo) {}

  start(): void {
    this.rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });
    this.rl.on('line', (line) => this.handleLine(line));
    this.rl.on('close', () => this.stop());
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop(): void { if (this.rl) { this.rl.close(); this.rl = null; } process.exit(0); }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    try { this.handleMessage(JSON.parse(trimmed)); } catch { this.sendError(0, MCP_ERROR_CODES.PARSE_ERROR, 'Parse error'); }
  }

  private async handleMessage(message: any): Promise<void> {
    if ('id' in message && message.id !== null) { await this.handleRequest(message as JSONRPCRequest); return; }
    if ('method' in message) await this.handleNotification(message as JSONRPCNotification);
  }

  private async handleRequest(req: JSONRPCRequest): Promise<void> {
    const { id, method, params } = req;
    try {
      let result: any;
      switch (method) {
        case MCP_METHODS.INITIALIZE: result = this.handleInitialize(params); break;
        case MCP_METHODS.TOOLS_LIST: this.requireInitialized(); result = { tools: this.toolProvider.getTools() }; break;
        case MCP_METHODS.TOOLS_CALL: this.requireInitialized(); result = await this.handleToolsCall(params); break;
        case MCP_METHODS.SHUTDOWN: setImmediate(() => this.stop()); result = {}; break;
        default: throw this.err(MCP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
      this.send({ jsonrpc: '2.0', id, result });
    } catch (e: any) {
      if (e.code !== undefined) this.sendError(id, e.code, e.message, e.data);
      else this.sendError(id, MCP_ERROR_CODES.INTERNAL_ERROR, e?.message ?? 'Internal error');
    }
  }

  private async handleNotification(n: JSONRPCNotification): Promise<void> { if (n.method === MCP_METHODS.INITIALIZED) this.initialized = true; }

  private handleInitialize(_p: any): any {
    if (this.initialized) throw this.err(MCP_ERROR_CODES.INVALID_REQUEST, 'Already initialized');
    return { protocolVersion: PROTOCOL_VERSION, capabilities: this.serverInfo.capabilities, serverInfo: this.serverInfo };
  }

  private async handleToolsCall(params: any): Promise<any> {
    const { name, arguments: args } = params ?? {};
    if (!name) throw this.err(MCP_ERROR_CODES.INVALID_PARAMS, 'Tool name is required');
    try {
      const result = await this.toolProvider.executeTool(name, args ?? {});
      if (typeof result === 'string') return { content: [{ type: 'text', text: result }] };
      if (result?.content && Array.isArray(result.content)) return result;
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e: any) {
      return { content: [{ type: 'text', text: `Error: ${e?.message ?? 'Tool failed'}` }], isError: true };
    }
  }

  private send(msg: any): void { process.stdout.write(JSON.stringify(msg) + '\n'); }
  private sendError(id: JSONRPCId, code: number, message: string, data?: any): void { this.send({ jsonrpc: '2.0', id, error: { code, message, data } }); }
  private requireInitialized(): void { if (!this.initialized) throw this.err(MCP_ERROR_CODES.SERVER_NOT_INITIALIZED, 'Server not initialized'); }
  private err(code: number, message: string, data?: any) { return { code, message, data }; }
}

const PREFIX = 'notion';

const tools: MCPTool[] = [
  { name: `${PREFIX}.health`, description: 'Check Notion connector authentication', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: `${PREFIX}.search_pages`, description: 'Search Notion pages', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, limit: { type: 'number', description: 'Max results (default 10)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, required: ['query'], additionalProperties: false } },
  { name: `${PREFIX}.search_databases`, description: 'Search Notion databases', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, limit: { type: 'number', description: 'Max results (default 10)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, required: ['query'], additionalProperties: false } },
  { name: `${PREFIX}.get_page`, description: 'Get a Notion page by ID', inputSchema: { type: 'object', properties: { page_id: { type: 'string', description: 'Page ID' } }, required: ['page_id'], additionalProperties: false } },
  { name: `${PREFIX}.get_page_content`, description: 'Get page block content', inputSchema: { type: 'object', properties: { block_id: { type: 'string', description: 'Block or page ID' }, limit: { type: 'number', description: 'Max blocks (default 50)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, required: ['block_id'], additionalProperties: false } },
  { name: `${PREFIX}.query_database`, description: 'Query a Notion database', inputSchema: { type: 'object', properties: { database_id: { type: 'string', description: 'Database ID' }, filter: { type: 'object', description: 'Notion filter object' }, limit: { type: 'number', description: 'Max results (default 10)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, required: ['database_id'], additionalProperties: false } },
  { name: `${PREFIX}.create_page`, description: 'Create a page in a parent page or database', inputSchema: { type: 'object', properties: { parent_id: { type: 'string', description: 'Parent page or database ID' }, parent_type: { type: 'string', enum: ['page', 'database'], description: 'Type of parent' }, title: { type: 'string', description: 'Page title' }, properties: { type: 'object', description: 'Page properties (for database pages)' } }, required: ['parent_id', 'parent_type', 'title'], additionalProperties: false } },
  { name: `${PREFIX}.update_page`, description: 'Update page properties', inputSchema: { type: 'object', properties: { page_id: { type: 'string', description: 'Page ID' }, properties: { type: 'object', description: 'Properties to update' } }, required: ['page_id', 'properties'], additionalProperties: false } },
  { name: `${PREFIX}.append_blocks`, description: 'Append blocks to a page', inputSchema: { type: 'object', properties: { block_id: { type: 'string', description: 'Page or block ID' }, children: { type: 'array', description: 'Notion block objects to append', items: { type: 'object' } } }, required: ['block_id', 'children'], additionalProperties: false } },
];

const client = new NotionClient();

function envelope(r: RequestResult): any {
  return { ok: true, data: r.data, meta: { durationMs: r.meta.durationMs, vendorRequestId: r.meta.vendorRequestId, baseUrl: r.meta.baseUrl }, nextCursor: r.nextCursor, warnings: [] };
}

const handlers: Record<string, (args: Record<string, any>) => Promise<any>> = {
  [`${PREFIX}.health`]: async () => envelope(await client.health()),
  [`${PREFIX}.search_pages`]: async (a) => envelope(await client.searchPages(a.query, a.limit, a.cursor)),
  [`${PREFIX}.search_databases`]: async (a) => envelope(await client.searchDatabases(a.query, a.limit, a.cursor)),
  [`${PREFIX}.get_page`]: async (a) => envelope(await client.getPage(a.page_id)),
  [`${PREFIX}.get_page_content`]: async (a) => envelope(await client.getPageContent(a.block_id, a.limit, a.cursor)),
  [`${PREFIX}.query_database`]: async (a) => envelope(await client.queryDatabase(a.database_id, a.filter, a.sorts, a.limit, a.cursor)),
  [`${PREFIX}.create_page`]: async (a) => envelope(await client.createPage(a.parent_id, a.parent_type, a.title, a.properties)),
  [`${PREFIX}.update_page`]: async (a) => envelope(await client.updatePage(a.page_id, a.properties)),
  [`${PREFIX}.append_blocks`]: async (a) => envelope(await client.appendBlocks(a.block_id, a.children)),
};

const server = new StdioMCPServer(
  { getTools: () => tools, executeTool: async (name, args) => { const h = handlers[name]; if (!h) throw new Error(`Unknown tool: ${name}`); return h(args); } },
  { name: 'Notion Connector', version: '1.0.0', protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } } }
);
server.start();
