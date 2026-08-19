import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { JsonSchema, ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';

export interface McpToolDescriptor {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
  input_schema?: JsonSchema;
}

export interface McpServerAttachment {
  serverId: string;
  namespace?: string;
  listTools(): Promise<McpToolDescriptor[]>;
  callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown>;
}

export interface McpStdioConfig {
  serverId: string;
  /** @default 'stdio' */
  transport?: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  namespace?: string;
  enabled?: boolean;
}

export interface McpHttpConfig {
  serverId: string;
  /** @default 'http' */
  transport?: 'http';
  url: string;
  headers?: Record<string, string>;
  namespace?: string;
  enabled?: boolean;
  /** Injectable fetch for tests or custom transports. */
  fetch?: typeof fetch;
}

export type McpServerConfig = McpStdioConfig | McpHttpConfig;

export interface McpDirectoryEntry extends Record<string, unknown> {
  type?: 'remote' | string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  url?: string;
  headers?: Record<string, string>;
  enabled?: boolean;
  namespace?: string;
}

export interface McpDirectoryOptions {
  /** Path to the directory file. Defaults to ~/.allternit/mcp-servers.json */
  path?: string;
  /** Fetch implementation used by HTTP transports. */
  fetch?: typeof fetch;
  /** Optional error handler instead of throwing. */
  onError?: (error: unknown) => void;
}

export interface McpDirectoryHost {
  attachMcpServer(config: McpServerConfig): Promise<string[]>;
}

const MCP_PROTOCOL_VERSION = '2025-03-26';
const SDK_NAME = '@allternit/sdk';
const SDK_VERSION = '1.2.10';

/** Discovers an MCP server's tools and registers model-facing proxies. */
export async function attachMcpServer(registry: ToolRegistry, server: McpServerAttachment): Promise<string[]> {
  const namespace = server.namespace ?? server.serverId;
  const descriptors = await server.listTools();
  const names: string[] = [];
  for (const descriptor of descriptors) {
    const schema = descriptor.inputSchema ?? descriptor.input_schema ?? { type: 'object', properties: {} };
    const tool: ToolDefinition = {
      name: descriptor.name,
      description: descriptor.description ?? `MCP tool ${descriptor.name}`,
      input_schema: {
        ...schema,
        type: 'object',
        properties: schema.properties ?? {},
      },
      metadata: { category: 'mcp', mcpServerId: server.serverId },
      execute: (args) => server.callTool(descriptor.name, args),
    };
    registry.registerTool(tool, { namespace, strict: true });
    names.push(`${namespace}.${descriptor.name}`);
  }
  return names;
}

export function createMcpServerAttachment(config: McpServerConfig): McpServerAttachment {
  if (config.transport === 'http' || ('url' in config && typeof config.url === 'string')) {
    return new HttpMcpServerAttachment(config as McpHttpConfig);
  }
  return new StdioMcpServerAttachment(config as McpStdioConfig);
}

class HttpMcpServerAttachment implements McpServerAttachment {
  serverId: string;
  namespace?: string;
  private url: string;
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;
  private initialized: Promise<void> | undefined;

  constructor(config: McpHttpConfig) {
    this.serverId = config.serverId;
    this.namespace = config.namespace;
    this.url = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    this.headers = config.headers ?? {};
    this.fetchImpl = config.fetch ?? fetch;
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    await this.ensureInitialized();
    const result = (await this.request('tools/list', {})) as { tools?: McpToolDescriptor[] };
    return result.tools ?? [];
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized();
    return this.request('tools/call', { name, arguments: arguments_ });
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.initialize();
    }
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: SDK_NAME, version: SDK_VERSION },
    });
    // Fire-and-forget initialized notification.
    this.notify('notifications/initialized').catch(() => {});
  }

  private async request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const id = crypto.randomUUID();
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`MCP HTTP request failed: ${response.status} ${response.statusText}`);
    }
    const json = (await response.json()) as { error?: { message?: string }; result?: unknown };
    if (json.error) {
      throw new Error(json.error.message ?? 'MCP request returned an error');
    }
    if (!Object.prototype.hasOwnProperty.call(json, 'result')) {
      throw new Error('MCP response missing result');
    }
    return json.result;
  }

  private async notify(method: string): Promise<void> {
    await this.fetchImpl(this.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...this.headers,
      },
      body: JSON.stringify({ jsonrpc: '2.0', method, params: {} }),
    });
  }
}

class StdioMcpServerAttachment implements McpServerAttachment {
  serverId: string;
  namespace?: string;
  private config: McpStdioConfig;
  private process: ChildProcess | undefined;
  private pending = new Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>();
  private buffer = '';
  private initialized: Promise<void> | undefined;
  private closed = false;

  constructor(config: McpStdioConfig) {
    this.serverId = config.serverId;
    this.namespace = config.namespace;
    this.config = config;
  }

  async listTools(): Promise<McpToolDescriptor[]> {
    await this.ensureInitialized();
    const result = (await this.request('tools/list', {})) as { tools?: McpToolDescriptor[] };
    return result.tools ?? [];
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    await this.ensureInitialized();
    return this.request('tools/call', { name, arguments: arguments_ });
  }

  private ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      this.initialized = this.initialize();
    }
    return this.initialized;
  }

  private async initialize(): Promise<void> {
    const proc = spawn(this.config.command, this.config.args ?? [], {
      env: { ...process.env, ...(this.config.env ?? {}) },
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process = proc;

    proc.stdout!.on('data', (chunk: Buffer) => this.onData(chunk.toString('utf8')));
    proc.stderr!.on('data', (chunk: Buffer) => {
      // Stderr is diagnostic only; surface it if the process dies.
      this.lastStderr = chunk.toString('utf8');
    });
    proc.on('error', (err) => this.rejectAll(err));
    proc.on('exit', (code) => {
      this.closed = true;
      this.rejectAll(new Error(`MCP stdio process exited${code !== null ? ` with code ${code}` : ''}`));
    });

    await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: SDK_NAME, version: SDK_VERSION },
    });
    this.notify('notifications/initialized').catch(() => {});
  }

  private lastStderr = '';

  private onData(chunk: string): void {
    this.buffer += chunk;
    let newline: number;
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line) as { id?: string; error?: { message?: string }; result?: unknown };
        if (message.id && this.pending.has(message.id)) {
          const { resolve, reject } = this.pending.get(message.id)!;
          this.pending.delete(message.id);
          if (message.error) {
            reject(new Error(message.error.message ?? 'MCP stdio request error'));
          } else {
            resolve(message.result);
          }
        }
      } catch {
        // Ignore non-JSON lines.
      }
    }
  }

  private rejectAll(err: Error): void {
    for (const { reject } of this.pending.values()) {
      reject(err);
    }
    this.pending.clear();
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (this.closed) {
      return Promise.reject(new Error('MCP stdio connection is closed'));
    }
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pending.set(id, { resolve, reject });
      const line = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      this.process!.stdin!.write(line, (err) => {
        if (err) {
          this.pending.delete(id);
          reject(err);
        }
      });
    });
  }

  private notify(method: string): Promise<void> {
    const line = JSON.stringify({ jsonrpc: '2.0', method, params: {} }) + '\n';
    return new Promise((resolve, reject) => {
      if (!this.process || this.closed) {
        resolve();
        return;
      }
      this.process.stdin!.write(line, (err) => (err ? reject(err) : resolve()));
    });
  }
}

export function defaultMcpServerDirectoryPath(): string {
  return join(homedir(), '.allternit', 'mcp-servers.json');
}

/** Load ~/.allternit/mcp-servers.json and attach enabled servers. */
export async function loadMcpServerDirectory(host: McpDirectoryHost, options: McpDirectoryOptions = {}): Promise<void> {
  const path = options.path ?? defaultMcpServerDirectoryPath();
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return;
    }
    if (options.onError) {
      options.onError(err);
      return;
    }
    throw err;
  }

  let document: { mcpServers?: Record<string, McpDirectoryEntry> } & Record<string, McpDirectoryEntry>;
  try {
    document = JSON.parse(raw) as typeof document;
  } catch (err) {
    if (options.onError) {
      options.onError(err);
      return;
    }
    throw err;
  }

  const entries = document.mcpServers ?? document;
  const configs: McpServerConfig[] = [];
  for (const [key, value] of Object.entries(entries)) {
    if (!value || typeof value !== 'object') continue;
    if (value.enabled === false) continue;
    const serverId = typeof value.serverId === 'string' ? value.serverId : key;
    const namespace = typeof value.namespace === 'string' ? value.namespace : serverId;
    const isRemote = value.type === 'remote' || typeof value.url === 'string';
    if (isRemote) {
      configs.push({
        serverId,
        transport: 'http',
        url: value.url as string,
        headers: value.headers,
        namespace,
        enabled: true,
        fetch: options.fetch,
      });
    } else if (typeof value.command === 'string') {
      configs.push({
        serverId,
        transport: 'stdio',
        command: value.command,
        args: value.args,
        env: value.env,
        cwd: value.cwd,
        namespace,
        enabled: true,
      });
    }
  }

  await Promise.all(configs.map((cfg) => host.attachMcpServer(cfg).catch((err) => {
    if (options.onError) options.onError(err);
    else throw err;
  })));
}
