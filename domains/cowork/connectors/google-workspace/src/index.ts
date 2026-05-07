import * as readline from 'readline';

// ==================== MCP Types ====================

type JSONRPCId = string | number;

type JSONRPCRequest = {
  jsonrpc: '2.0';
  id: JSONRPCId;
  method: string;
  params?: Record<string, any>;
};

type JSONRPCNotification = {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, any>;
};

type JSONRPCResponse = {
  jsonrpc: '2.0';
  id: JSONRPCId;
  result?: any;
  error?: { code: number; message: string; data?: any };
};

type MCPToolProperty = {
  type: string;
  description?: string;
  enum?: string[];
  default?: any;
  items?: MCPToolProperty;
  properties?: Record<string, MCPToolProperty>;
  required?: string[];
};

type MCPTool = {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, MCPToolProperty>;
    required?: string[];
    additionalProperties?: boolean;
  };
};

type MCPServerInfo = {
  name: string;
  version: string;
  protocolVersion?: string;
  capabilities?: {
    tools?: { listChanged?: boolean };
  };
};

const PROTOCOL_VERSION = '2024-11-05';

const MCP_METHODS = {
  INITIALIZE: 'initialize',
  INITIALIZED: 'notifications/initialized',
  SHUTDOWN: 'shutdown',
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
} as const;

const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  SERVER_NOT_INITIALIZED: -32002,
} as const;

// ==================== Tool Provider ====================

type ToolProvider = {
  getTools(): MCPTool[];
  executeTool(name: string, args: Record<string, any>): Promise<any>;
};

// ==================== MCP Stdio Server ====================

class StdioMCPServer {
  private initialized = false;
  private rl: readline.Interface | null = null;

  constructor(
    private toolProvider: ToolProvider,
    private serverInfo: MCPServerInfo
  ) {}

  start(): void {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    this.rl.on('line', (line) => this.handleLine(line));
    this.rl.on('close', () => this.stop());

    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());
  }

  stop(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    process.exit(0);
  }

  private handleLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const message = JSON.parse(trimmed);
      this.handleMessage(message);
    } catch {
      this.sendError(0, MCP_ERROR_CODES.PARSE_ERROR, 'Parse error');
    }
  }

  private async handleMessage(message: any): Promise<void> {
    if ('id' in message && message.id !== null) {
      await this.handleRequest(message as JSONRPCRequest);
      return;
    }

    if ('method' in message) {
      await this.handleNotification(message as JSONRPCNotification);
    }
  }

  private async handleRequest(request: JSONRPCRequest): Promise<void> {
    const { id, method, params } = request;

    try {
      let result: any;

      switch (method) {
        case MCP_METHODS.INITIALIZE:
          result = this.handleInitialize(params);
          break;
        case MCP_METHODS.TOOLS_LIST:
          this.requireInitialized();
          result = this.handleToolsList();
          break;
        case MCP_METHODS.TOOLS_CALL:
          this.requireInitialized();
          result = await this.handleToolsCall(params);
          break;
        case MCP_METHODS.SHUTDOWN:
          result = this.handleShutdown();
          break;
        default:
          throw this.createError(MCP_ERROR_CODES.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }

      this.sendResult(id, result);
    } catch (error: any) {
      if (error.code !== undefined) {
        this.sendError(id, error.code, error.message, error.data);
      } else {
        this.sendError(id, MCP_ERROR_CODES.INTERNAL_ERROR, error?.message || 'Internal error');
      }
    }
  }

  private async handleNotification(notification: JSONRPCNotification): Promise<void> {
    const { method } = notification;
    if (method === MCP_METHODS.INITIALIZED) {
      this.initialized = true;
    }
  }

  private handleInitialize(_params: any): {
    protocolVersion: string;
    capabilities: MCPServerInfo['capabilities'];
    serverInfo: MCPServerInfo;
  } {
    if (this.initialized) {
      throw this.createError(MCP_ERROR_CODES.INVALID_REQUEST, 'Already initialized');
    }

    return {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: this.serverInfo.capabilities,
      serverInfo: this.serverInfo,
    };
  }

  private handleToolsList(): { tools: MCPTool[] } {
    return { tools: this.toolProvider.getTools() };
  }

  private async handleToolsCall(params: any): Promise<any> {
    const { name, arguments: args } = params || {};
    if (!name) {
      throw this.createError(MCP_ERROR_CODES.INVALID_PARAMS, 'Tool name is required');
    }

    try {
      const result = await this.toolProvider.executeTool(name, args || {});

      if (typeof result === 'string') {
        return { content: [{ type: 'text', text: result }] };
      }

      if (result && typeof result === 'object') {
        if (result.content && Array.isArray(result.content)) {
          return result;
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      }

      return { content: [{ type: 'text', text: String(result) }] };
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `Error: ${error?.message || 'Tool failed'}` }],
        isError: true,
      };
    }
  }

  private handleShutdown(): Record<string, never> {
    setImmediate(() => this.stop());
    return {};
  }

  private sendResult(id: JSONRPCId, result: any): void {
    const response: JSONRPCResponse = { jsonrpc: '2.0', id, result };
    this.sendMessage(response);
  }

  private sendError(id: JSONRPCId, code: number, message: string, data?: any): void {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    };
    this.sendMessage(response);
  }

  private sendMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    process.stdout.write(JSON.stringify(message) + '\n');
  }

  private requireInitialized(): void {
    if (!this.initialized) {
      throw this.createError(MCP_ERROR_CODES.SERVER_NOT_INITIALIZED, 'Server not initialized');
    }
  }

  private createError(code: number, message: string, data?: any): { code: number; message: string; data?: any } {
    return { code, message, data };
  }
}

// ==================== Google API Helpers ====================

const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN || '';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN || '';

let cachedAccessToken = GOOGLE_ACCESS_TOKEN;
let tokenExpiry = 0;

async function refreshAccessToken(): Promise<string> {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    throw new Error('Missing Google OAuth credentials for token refresh');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: GOOGLE_REFRESH_TOKEN,
    }).toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in?: number };
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
  return cachedAccessToken;
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && (tokenExpiry === 0 || Date.now() < tokenExpiry)) {
    return cachedAccessToken;
  }
  return refreshAccessToken();
}

async function googleRequest(
  method: string,
  url: string,
  body?: unknown,
  params?: Record<string, string>,
): Promise<unknown> {
  const token = await getAccessToken();

  let fullUrl = url;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    fullUrl = `${url}?${qs}`;
  }

  const response = await fetch(fullUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google API ${response.status}: ${text}`);
  }

  // 204 No Content
  if (response.status === 204) {
    return { ok: true };
  }

  return response.json();
}

// ==================== Tool Definitions ====================

const tools: MCPTool[] = [
  // Health
  {
    name: 'google-workspace.health',
    description: 'Check Google Workspace connector health and authentication status',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },

  // ── Sheets ──────────────────────────────────────────────
  {
    name: 'google-workspace.sheets_create',
    description: 'Create a new Google Spreadsheet',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the new spreadsheet' },
        sheets: {
          type: 'array',
          description: 'Optional list of sheet names to create (defaults to one sheet named "Sheet1")',
          items: { type: 'string' },
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.sheets_get',
    description: 'Get spreadsheet metadata including sheet names, dimensions, and properties',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID from its URL' },
      },
      required: ['spreadsheetId'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.sheets_values_get',
    description: 'Read cell values from a spreadsheet range (e.g. "Sheet1!A1:D10")',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'A1 notation range, e.g. "Sheet1!A1:D10" or "A1:D10"' },
        majorDimension: {
          type: 'string',
          enum: ['ROWS', 'COLUMNS'],
          description: 'Whether values are arranged by rows or columns (default: ROWS)',
          default: 'ROWS',
        },
      },
      required: ['spreadsheetId', 'range'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.sheets_values_update',
    description: 'Write values to a spreadsheet range',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'A1 notation range to write into, e.g. "Sheet1!A1"' },
        values: {
          type: 'array',
          description: '2D array of values (rows of columns)',
          items: { type: 'array', items: { type: 'string' } },
        },
        valueInputOption: {
          type: 'string',
          enum: ['RAW', 'USER_ENTERED'],
          description: 'How input data should be interpreted (default: USER_ENTERED)',
          default: 'USER_ENTERED',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.sheets_values_append',
    description: 'Append rows to a spreadsheet after the last row with data',
    inputSchema: {
      type: 'object',
      properties: {
        spreadsheetId: { type: 'string', description: 'The spreadsheet ID' },
        range: { type: 'string', description: 'A1 notation range to search for existing data, e.g. "Sheet1!A1"' },
        values: {
          type: 'array',
          description: '2D array of rows to append',
          items: { type: 'array', items: { type: 'string' } },
        },
        valueInputOption: {
          type: 'string',
          enum: ['RAW', 'USER_ENTERED'],
          default: 'USER_ENTERED',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
      additionalProperties: false,
    },
  },

  // ── Docs ─────────────────────────────────────────────────
  {
    name: 'google-workspace.docs_create',
    description: 'Create a new Google Document',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the new document' },
        content: {
          type: 'string',
          description: 'Optional plain-text content to insert as the first paragraph',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.docs_get',
    description: 'Get a Google Document including its full content and structure',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID from its URL' },
      },
      required: ['documentId'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.docs_append_text',
    description: 'Append plain text to the end of a Google Document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'The document ID' },
        text: { type: 'string', description: 'Text to append (use \\n for new lines)' },
      },
      required: ['documentId', 'text'],
      additionalProperties: false,
    },
  },

  // ── Chat ─────────────────────────────────────────────────
  {
    name: 'google-workspace.chat_spaces_list',
    description: 'List Google Chat spaces (rooms and direct messages) the authenticated user belongs to',
    inputSchema: {
      type: 'object',
      properties: {
        pageSize: {
          type: 'number',
          description: 'Maximum number of spaces to return (default: 100)',
          default: 100,
        },
        filter: {
          type: 'string',
          description: 'Filter string, e.g. "spaceType = \"SPACE\"" to only return named spaces',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.chat_messages_list',
    description: 'List messages in a Google Chat space',
    inputSchema: {
      type: 'object',
      properties: {
        spaceName: {
          type: 'string',
          description: 'Space resource name, e.g. "spaces/AAAABBBBCCCC"',
        },
        pageSize: {
          type: 'number',
          description: 'Maximum number of messages to return (default: 25)',
          default: 25,
        },
        orderBy: {
          type: 'string',
          description: 'Sort order: "createTime ASC" or "createTime DESC" (default: createTime DESC)',
          default: 'createTime DESC',
        },
      },
      required: ['spaceName'],
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.chat_messages_create',
    description: 'Send a message to a Google Chat space',
    inputSchema: {
      type: 'object',
      properties: {
        spaceName: {
          type: 'string',
          description: 'Space resource name, e.g. "spaces/AAAABBBBCCCC"',
        },
        text: { type: 'string', description: 'Plain-text message content' },
        threadKey: {
          type: 'string',
          description: 'Optional thread key to reply in an existing thread',
        },
      },
      required: ['spaceName', 'text'],
      additionalProperties: false,
    },
  },

  // ── Drive (enhanced) ─────────────────────────────────────
  {
    name: 'google-workspace.drive_files_list',
    description: 'List or search files in Google Drive using Drive query syntax',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Drive query string, e.g. "name contains \'report\'" or "mimeType=\'application/vnd.google-apps.spreadsheet\'"',
        },
        pageSize: {
          type: 'number',
          description: 'Number of files to return (default: 20, max: 100)',
          default: 20,
        },
        orderBy: {
          type: 'string',
          description: 'Sort order, e.g. "modifiedTime desc" or "name"',
          default: 'modifiedTime desc',
        },
        fields: {
          type: 'string',
          description: 'Fields to include, e.g. "files(id,name,mimeType,modifiedTime,size)"',
          default: 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'google-workspace.drive_files_get',
    description: 'Get metadata for a specific Drive file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'The file ID' },
        fields: {
          type: 'string',
          description: 'Fields to return',
          default: 'id,name,mimeType,modifiedTime,size,webViewLink,parents',
        },
      },
      required: ['fileId'],
      additionalProperties: false,
    },
  },
];

// ==================== Tool Handlers ====================

const handlers: Record<string, (args: Record<string, any>) => Promise<any>> = {

  'google-workspace.health': async () => {
    const token = await getAccessToken();
    // Verify the token works by checking the Drive API
    const result = (await googleRequest('GET', 'https://www.googleapis.com/drive/v3/about', undefined, {
      fields: 'user',
    })) as any;

    return {
      ok: true,
      data: {
        status: 'ok',
        connector: 'google-workspace',
        user: result?.user?.emailAddress || 'unknown',
        tokenPresent: Boolean(token),
      },
    };
  },

  // ── Sheets ──────────────────────────────────────────────

  'google-workspace.sheets_create': async (args) => {
    const body: any = {
      properties: { title: args.title },
    };
    if (args.sheets && Array.isArray(args.sheets)) {
      body.sheets = args.sheets.map((name: string) => ({
        properties: { title: name },
      }));
    }
    const result = await googleRequest(
      'POST',
      'https://sheets.googleapis.com/v4/spreadsheets',
      body,
    );
    return { ok: true, data: result };
  },

  'google-workspace.sheets_get': async (args) => {
    const result = await googleRequest(
      'GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}`,
    );
    return { ok: true, data: result };
  },

  'google-workspace.sheets_values_get': async (args) => {
    const params: Record<string, string> = {
      majorDimension: args.majorDimension || 'ROWS',
    };
    const result = await googleRequest(
      'GET',
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}/values/${encodeURIComponent(args.range)}`,
      undefined,
      params,
    );
    return { ok: true, data: result };
  },

  'google-workspace.sheets_values_update': async (args) => {
    const params: Record<string, string> = {
      valueInputOption: args.valueInputOption || 'USER_ENTERED',
    };
    const result = await googleRequest(
      'PUT',
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}/values/${encodeURIComponent(args.range)}?${new URLSearchParams(params)}`,
      { range: args.range, majorDimension: 'ROWS', values: args.values },
    );
    return { ok: true, data: result };
  },

  'google-workspace.sheets_values_append': async (args) => {
    const params: Record<string, string> = {
      valueInputOption: args.valueInputOption || 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
    };
    const result = await googleRequest(
      'POST',
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(args.spreadsheetId)}/values/${encodeURIComponent(args.range)}:append?${new URLSearchParams(params)}`,
      { range: args.range, majorDimension: 'ROWS', values: args.values },
    );
    return { ok: true, data: result };
  },

  // ── Docs ─────────────────────────────────────────────────

  'google-workspace.docs_create': async (args) => {
    const doc = (await googleRequest(
      'POST',
      'https://docs.googleapis.com/v1/documents',
      { title: args.title },
    )) as any;

    if (args.content && doc.documentId) {
      // Append initial text via batchUpdate
      await googleRequest(
        'POST',
        `https://docs.googleapis.com/v1/documents/${encodeURIComponent(doc.documentId)}:batchUpdate`,
        {
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: args.content,
              },
            },
          ],
        },
      );
    }

    return { ok: true, data: doc };
  },

  'google-workspace.docs_get': async (args) => {
    const result = await googleRequest(
      'GET',
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(args.documentId)}`,
    );
    return { ok: true, data: result };
  },

  'google-workspace.docs_append_text': async (args) => {
    // Get the document to find the end index
    const doc = (await googleRequest(
      'GET',
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(args.documentId)}`,
    )) as any;

    const endIndex = doc?.body?.content?.at(-1)?.endIndex ?? 1;
    // Insert before the final newline that terminates the document
    const insertIndex = Math.max(1, endIndex - 1);

    const result = await googleRequest(
      'POST',
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(args.documentId)}:batchUpdate`,
      {
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: args.text,
            },
          },
        ],
      },
    );
    return { ok: true, data: result };
  },

  // ── Chat ─────────────────────────────────────────────────

  'google-workspace.chat_spaces_list': async (args) => {
    const params: Record<string, string> = {
      pageSize: String(args.pageSize || 100),
    };
    if (args.filter) params.filter = args.filter;

    const result = await googleRequest(
      'GET',
      'https://chat.googleapis.com/v1/spaces',
      undefined,
      params,
    );
    return { ok: true, data: result };
  },

  'google-workspace.chat_messages_list': async (args) => {
    const params: Record<string, string> = {
      pageSize: String(args.pageSize || 25),
      orderBy: args.orderBy || 'createTime DESC',
    };

    const result = await googleRequest(
      'GET',
      `https://chat.googleapis.com/v1/${args.spaceName}/messages`,
      undefined,
      params,
    );
    return { ok: true, data: result };
  },

  'google-workspace.chat_messages_create': async (args) => {
    const body: any = { text: args.text };
    const params: Record<string, string> = {};

    if (args.threadKey) {
      params.threadKey = args.threadKey;
    }

    const result = await googleRequest(
      'POST',
      `https://chat.googleapis.com/v1/${args.spaceName}/messages`,
      body,
      Object.keys(params).length ? params : undefined,
    );
    return { ok: true, data: result };
  },

  // ── Drive (enhanced) ─────────────────────────────────────

  'google-workspace.drive_files_list': async (args) => {
    const params: Record<string, string> = {
      pageSize: String(Math.min(args.pageSize || 20, 100)),
      fields: args.fields || 'files(id,name,mimeType,modifiedTime,size,webViewLink)',
      orderBy: args.orderBy || 'modifiedTime desc',
    };
    if (args.query) params.q = args.query;

    const result = await googleRequest(
      'GET',
      'https://www.googleapis.com/drive/v3/files',
      undefined,
      params,
    );
    return { ok: true, data: result };
  },

  'google-workspace.drive_files_get': async (args) => {
    const params: Record<string, string> = {
      fields: args.fields || 'id,name,mimeType,modifiedTime,size,webViewLink,parents',
    };

    const result = await googleRequest(
      'GET',
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(args.fileId)}`,
      undefined,
      params,
    );
    return { ok: true, data: result };
  },
};

// ==================== Server Bootstrap ====================

const toolProvider: ToolProvider = {
  getTools: () => tools,
  executeTool: async (name, args) => {
    const handler = handlers[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return handler(args);
  },
};

const serverInfo: MCPServerInfo = {
  name: 'Google Workspace',
  version: '0.1.0',
  protocolVersion: PROTOCOL_VERSION,
  capabilities: {
    tools: { listChanged: false },
  },
};

const server = new StdioMCPServer(toolProvider, serverInfo);
server.start();
