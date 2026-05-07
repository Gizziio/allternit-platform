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

class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token: string;

  constructor() { this.token = process.env.GITHUB_TOKEN ?? ''; }

  private headers(): HeadersInit {
    return { Authorization: `Bearer ${this.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Allternit-Connector/1.0.0' };
  }

  private async get(path: string, query?: Record<string, any>): Promise<RequestResult> {
    const start = Date.now();
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) Object.entries(query).forEach(([k, v]) => v != null && url.searchParams.set(k, String(v)));
    const res = await fetch(url.toString(), { headers: this.headers() });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    const link = res.headers.get('link') ?? '';
    const nextCursor = link.includes('rel="next"') ? link.match(/<([^>]+)>;\s*rel="next"/)?.[1] : undefined;
    return { data, meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl }, nextCursor };
  }

  private async post(path: string, body: any): Promise<RequestResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'POST', headers: { ...this.headers() as any, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
    return { data: await res.json(), meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl } };
  }

  private async patch(path: string, body: any): Promise<RequestResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}${path}`, { method: 'PATCH', headers: { ...this.headers() as any, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const durationMs = Date.now() - start;
    const vendorRequestId = res.headers.get('x-request-id') ?? undefined;
    if (!res.ok) throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
    return { data: await res.json(), meta: { durationMs, vendorRequestId, baseUrl: this.baseUrl } };
  }

  async health(): Promise<RequestResult> { return this.get('/user'); }
  async listRepos(org?: string, limit = 30, page = 1): Promise<RequestResult> {
    const path = org ? `/orgs/${org}/repos` : '/user/repos';
    return this.get(path, { per_page: limit, page, sort: 'updated' });
  }
  async getRepo(owner: string, repo: string): Promise<RequestResult> { return this.get(`/repos/${owner}/${repo}`); }
  async searchIssues(query: string, limit = 10, page = 1): Promise<RequestResult> { return this.get('/search/issues', { q: query, per_page: limit, page }); }
  async getIssue(owner: string, repo: string, number: number): Promise<RequestResult> { return this.get(`/repos/${owner}/${repo}/issues/${number}`); }
  async createIssue(owner: string, repo: string, title: string, body?: string, labels?: string[]): Promise<RequestResult> { return this.post(`/repos/${owner}/${repo}/issues`, { title, body, labels }); }
  async updateIssue(owner: string, repo: string, number: number, updates: Record<string, any>): Promise<RequestResult> { return this.patch(`/repos/${owner}/${repo}/issues/${number}`, updates); }
  async listPullRequests(owner: string, repo: string, state = 'open', limit = 10): Promise<RequestResult> { return this.get(`/repos/${owner}/${repo}/pulls`, { state, per_page: limit }); }
  async getPullRequest(owner: string, repo: string, number: number): Promise<RequestResult> { return this.get(`/repos/${owner}/${repo}/pulls/${number}`); }
  async listWorkflowRuns(owner: string, repo: string, limit = 10): Promise<RequestResult> { return this.get(`/repos/${owner}/${repo}/actions/runs`, { per_page: limit }); }
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

const PREFIX = 'github';

const tools: MCPTool[] = [
  { name: `${PREFIX}.health`, description: 'Check GitHub connector authentication', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: `${PREFIX}.list_repos`, description: 'List repositories for a user or org', inputSchema: { type: 'object', properties: { org: { type: 'string', description: 'Organization login (omit for authenticated user)' }, limit: { type: 'number', description: 'Max repos (default 30)' }, page: { type: 'number', description: 'Page number' } }, additionalProperties: false } },
  { name: `${PREFIX}.get_repo`, description: 'Get a repository', inputSchema: { type: 'object', properties: { owner: { type: 'string', description: 'Owner login' }, repo: { type: 'string', description: 'Repository name' } }, required: ['owner', 'repo'], additionalProperties: false } },
  { name: `${PREFIX}.search_issues`, description: 'Search issues and pull requests', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'GitHub search query' }, limit: { type: 'number', description: 'Max results (default 10)' }, page: { type: 'number', description: 'Page number' } }, required: ['query'], additionalProperties: false } },
  { name: `${PREFIX}.get_issue`, description: 'Get an issue by number', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, number: { type: 'number', description: 'Issue number' } }, required: ['owner', 'repo', 'number'], additionalProperties: false } },
  { name: `${PREFIX}.create_issue`, description: 'Create an issue', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' }, labels: { type: 'array', items: { type: 'string' }, description: 'Label names' } }, required: ['owner', 'repo', 'title'], additionalProperties: false } },
  { name: `${PREFIX}.update_issue`, description: 'Update an issue', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, number: { type: 'number' }, title: { type: 'string' }, body: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed'] } }, required: ['owner', 'repo', 'number'], additionalProperties: false } },
  { name: `${PREFIX}.list_pull_requests`, description: 'List pull requests', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' }, limit: { type: 'number', description: 'Max results (default 10)' } }, required: ['owner', 'repo'], additionalProperties: false } },
  { name: `${PREFIX}.get_pull_request`, description: 'Get a pull request', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, number: { type: 'number' } }, required: ['owner', 'repo', 'number'], additionalProperties: false } },
  { name: `${PREFIX}.list_workflow_runs`, description: 'List recent Actions workflow runs', inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' }, limit: { type: 'number', description: 'Max results (default 10)' } }, required: ['owner', 'repo'], additionalProperties: false } },
];

const client = new GitHubClient();

function envelope(r: RequestResult): any {
  return { ok: true, data: r.data, meta: { durationMs: r.meta.durationMs, vendorRequestId: r.meta.vendorRequestId, baseUrl: r.meta.baseUrl }, nextCursor: r.nextCursor, warnings: [] };
}

const handlers: Record<string, (args: Record<string, any>) => Promise<any>> = {
  [`${PREFIX}.health`]: async () => envelope(await client.health()),
  [`${PREFIX}.list_repos`]: async (a) => envelope(await client.listRepos(a.org, a.limit, a.page)),
  [`${PREFIX}.get_repo`]: async (a) => envelope(await client.getRepo(a.owner, a.repo)),
  [`${PREFIX}.search_issues`]: async (a) => envelope(await client.searchIssues(a.query, a.limit, a.page)),
  [`${PREFIX}.get_issue`]: async (a) => envelope(await client.getIssue(a.owner, a.repo, a.number)),
  [`${PREFIX}.create_issue`]: async (a) => envelope(await client.createIssue(a.owner, a.repo, a.title, a.body, a.labels)),
  [`${PREFIX}.update_issue`]: async (a) => envelope(await client.updateIssue(a.owner, a.repo, a.number, { title: a.title, body: a.body, state: a.state })),
  [`${PREFIX}.list_pull_requests`]: async (a) => envelope(await client.listPullRequests(a.owner, a.repo, a.state, a.limit)),
  [`${PREFIX}.get_pull_request`]: async (a) => envelope(await client.getPullRequest(a.owner, a.repo, a.number)),
  [`${PREFIX}.list_workflow_runs`]: async (a) => envelope(await client.listWorkflowRuns(a.owner, a.repo, a.limit)),
};

const server = new StdioMCPServer(
  { getTools: () => tools, executeTool: async (name, args) => { const h = handlers[name]; if (!h) throw new Error(`Unknown tool: ${name}`); return h(args); } },
  { name: 'GitHub Connector', version: '1.0.0', protocolVersion: PROTOCOL_VERSION, capabilities: { tools: { listChanged: false } } }
);
server.start();
