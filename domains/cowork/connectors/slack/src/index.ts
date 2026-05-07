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

class SlackClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = 'https://slack.com/api';
    this.token = process.env.SLACK_BOT_TOKEN ?? '';
  }

  private async call(method: string, params?: Record<string, any>): Promise<RequestResult> {
    const start = Date.now();
    const url = new URL(`${this.baseUrl}/${method}`);
    if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', 'User-Agent': 'Allternit-Connector/1.0.0' },
    });
    const durationMs = Date.now() - start;
    if (!res.ok) throw new Error(`Slack API error (${res.status}): ${await res.text()}`);
    const payload = await res.json() as any;
    if (!payload.ok) throw new Error(`Slack error: ${payload.error ?? 'unknown'}`);
    return { data: payload, meta: { durationMs, baseUrl: this.baseUrl }, nextCursor: payload.response_metadata?.next_cursor || undefined };
  }

  async health(): Promise<RequestResult> { return this.call('auth.test'); }
  async listChannels(limit = 100, cursor?: string): Promise<RequestResult> { return this.call('conversations.list', { limit, cursor, types: 'public_channel,private_channel' }); }
  async getChannel(channelId: string): Promise<RequestResult> { return this.call('conversations.info', { channel: channelId }); }
  async getMessages(channelId: string, limit = 20, cursor?: string): Promise<RequestResult> { return this.call('conversations.history', { channel: channelId, limit, cursor }); }
  async sendMessage(channelId: string, text: string, threadTs?: string): Promise<RequestResult> {
    const start = Date.now();
    const body: any = { channel: channelId, text };
    if (threadTs) body.thread_ts = threadTs;
    const res = await fetch(`${this.baseUrl}/chat.postMessage`, { method: 'POST', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', 'User-Agent': 'Allternit-Connector/1.0.0' }, body: JSON.stringify(body) });
    const durationMs = Date.now() - start;
    if (!res.ok) throw new Error(`Slack API error (${res.status}): ${await res.text()}`);
    const payload = await res.json() as any;
    if (!payload.ok) throw new Error(`Slack error: ${payload.error ?? 'unknown'}`);
    return { data: payload, meta: { durationMs, baseUrl: this.baseUrl } };
  }
  async listUsers(limit = 100, cursor?: string): Promise<RequestResult> { return this.call('users.list', { limit, cursor }); }
  async searchMessages(query: string, count = 10, cursor?: string): Promise<RequestResult> {
    const params: any = { query, count };
    if (cursor) params.cursor = cursor;
    return this.call('search.messages', params);
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

const PREFIX = 'slack';

const tools: MCPTool[] = [
  { name: `${PREFIX}.health`, description: 'Check Slack connector health and authentication', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: `${PREFIX}.list_channels`, description: 'List Slack channels', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max channels (default 100)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, additionalProperties: false } },
  { name: `${PREFIX}.get_channel`, description: 'Get a Slack channel by ID', inputSchema: { type: 'object', properties: { channel_id: { type: 'string', description: 'Channel ID' } }, required: ['channel_id'], additionalProperties: false } },
  { name: `${PREFIX}.get_messages`, description: 'Get messages from a channel', inputSchema: { type: 'object', properties: { channel_id: { type: 'string', description: 'Channel ID' }, limit: { type: 'number', description: 'Max messages (default 20)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, required: ['channel_id'], additionalProperties: false } },
  { name: `${PREFIX}.send_message`, description: 'Send a message to a channel', inputSchema: { type: 'object', properties: { channel_id: { type: 'string', description: 'Channel ID' }, text: { type: 'string', description: 'Message text' }, thread_ts: { type: 'string', description: 'Thread timestamp to reply to' } }, required: ['channel_id', 'text'], additionalProperties: false } },
  { name: `${PREFIX}.list_users`, description: 'List workspace users', inputSchema: { type: 'object', properties: { limit: { type: 'number', description: 'Max users (default 100)' }, cursor: { type: 'string', description: 'Pagination cursor' } }, additionalProperties: false } },
  { name: `${PREFIX}.search_messages`, description: 'Search messages across workspace', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' }, count: { type: 'number', description: 'Max results (default 10)' } }, required: ['query'], additionalProperties: false } },
];

const client = new SlackClient();

function envelope(r: RequestResult): any {
  return { ok: true, data: r.data, meta: { durationMs: r.meta.durationMs, vendorRequestId: r.meta.vendorRequestId, baseUrl: r.meta.baseUrl }, nextCursor: r.nextCursor, warnings: [] };
}

const handlers: Record<string, (args: Record<string, any>) => Promise<any>> = {
  [`${PREFIX}.health`]: async () => envelope(await client.health()),
  [`${PREFIX}.list_channels`]: async (a) => envelope(await client.listChannels(a.limit, a.cursor)),
  [`${PREFIX}.get_channel`]: async (a) => envelope(await client.getChannel(a.channel_id)),
  [`${PREFIX}.get_messages`]: async (a) => envelope(await client.getMessages(a.channel_id, a.limit, a.cursor)),
  [`${PREFIX}.send_message`]: async (a) => envelope(await client.sendMessage(a.channel_id, a.text, a.thread_ts)),
  [`${PREFIX}.list_users`]: async (a) => envelope(await client.listUsers(a.limit, a.cursor)),
  [`${PREFIX}.search_messages`]: async (a) => envelope(await client.searchMessages(a.query, a.count)),
};

const server = new StdioMCPServer(
  { getTools: () => tools, executeTool: async (name, args) => { const h = handlers[name]; if (!h) throw new Error(`Unknown tool: ${name}`); return h(args); } },
  { name: 'Slack Connector', version: '1.0.0', protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } } }
);
server.start();
