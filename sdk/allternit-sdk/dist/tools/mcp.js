import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const MCP_PROTOCOL_VERSION = '2025-03-26';
const SDK_NAME = '@allternit/sdk';
const SDK_VERSION = '1.2.10';
/** Discovers an MCP server's tools and registers model-facing proxies. */
export async function attachMcpServer(registry, server) {
    const namespace = server.namespace ?? server.serverId;
    const descriptors = await server.listTools();
    const names = [];
    for (const descriptor of descriptors) {
        const schema = descriptor.inputSchema ?? descriptor.input_schema ?? { type: 'object', properties: {} };
        const tool = {
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
export function createMcpServerAttachment(config) {
    if (config.transport === 'http' || ('url' in config && typeof config.url === 'string')) {
        return new HttpMcpServerAttachment(config);
    }
    return new StdioMcpServerAttachment(config);
}
class HttpMcpServerAttachment {
    serverId;
    namespace;
    url;
    headers;
    fetchImpl;
    initialized;
    constructor(config) {
        this.serverId = config.serverId;
        this.namespace = config.namespace;
        this.url = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
        this.headers = config.headers ?? {};
        this.fetchImpl = config.fetch ?? fetch;
    }
    async listTools() {
        await this.ensureInitialized();
        const result = (await this.request('tools/list', {}));
        return result.tools ?? [];
    }
    async callTool(name, arguments_) {
        await this.ensureInitialized();
        return this.request('tools/call', { name, arguments: arguments_ });
    }
    ensureInitialized() {
        if (!this.initialized) {
            this.initialized = this.initialize();
        }
        return this.initialized;
    }
    async initialize() {
        await this.request('initialize', {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: SDK_NAME, version: SDK_VERSION },
        });
        // Fire-and-forget initialized notification.
        this.notify('notifications/initialized').catch(() => { });
    }
    async request(method, params) {
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
        const json = (await response.json());
        if (json.error) {
            throw new Error(json.error.message ?? 'MCP request returned an error');
        }
        if (!Object.prototype.hasOwnProperty.call(json, 'result')) {
            throw new Error('MCP response missing result');
        }
        return json.result;
    }
    async notify(method) {
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
class StdioMcpServerAttachment {
    serverId;
    namespace;
    config;
    process;
    pending = new Map();
    buffer = '';
    initialized;
    closed = false;
    constructor(config) {
        this.serverId = config.serverId;
        this.namespace = config.namespace;
        this.config = config;
    }
    async listTools() {
        await this.ensureInitialized();
        const result = (await this.request('tools/list', {}));
        return result.tools ?? [];
    }
    async callTool(name, arguments_) {
        await this.ensureInitialized();
        return this.request('tools/call', { name, arguments: arguments_ });
    }
    ensureInitialized() {
        if (!this.initialized) {
            this.initialized = this.initialize();
        }
        return this.initialized;
    }
    async initialize() {
        const proc = spawn(this.config.command, this.config.args ?? [], {
            env: { ...process.env, ...(this.config.env ?? {}) },
            cwd: this.config.cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.process = proc;
        proc.stdout.on('data', (chunk) => this.onData(chunk.toString('utf8')));
        proc.stderr.on('data', (chunk) => {
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
        this.notify('notifications/initialized').catch(() => { });
    }
    lastStderr = '';
    onData(chunk) {
        this.buffer += chunk;
        let newline;
        while ((newline = this.buffer.indexOf('\n')) >= 0) {
            const line = this.buffer.slice(0, newline).trim();
            this.buffer = this.buffer.slice(newline + 1);
            if (!line)
                continue;
            try {
                const message = JSON.parse(line);
                if (message.id && this.pending.has(message.id)) {
                    const { resolve, reject } = this.pending.get(message.id);
                    this.pending.delete(message.id);
                    if (message.error) {
                        reject(new Error(message.error.message ?? 'MCP stdio request error'));
                    }
                    else {
                        resolve(message.result);
                    }
                }
            }
            catch {
                // Ignore non-JSON lines.
            }
        }
    }
    rejectAll(err) {
        for (const { reject } of this.pending.values()) {
            reject(err);
        }
        this.pending.clear();
    }
    request(method, params) {
        if (this.closed) {
            return Promise.reject(new Error('MCP stdio connection is closed'));
        }
        return new Promise((resolve, reject) => {
            const id = crypto.randomUUID();
            this.pending.set(id, { resolve, reject });
            const line = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
            this.process.stdin.write(line, (err) => {
                if (err) {
                    this.pending.delete(id);
                    reject(err);
                }
            });
        });
    }
    notify(method) {
        const line = JSON.stringify({ jsonrpc: '2.0', method, params: {} }) + '\n';
        return new Promise((resolve, reject) => {
            if (!this.process || this.closed) {
                resolve();
                return;
            }
            this.process.stdin.write(line, (err) => (err ? reject(err) : resolve()));
        });
    }
}
export function defaultMcpServerDirectoryPath() {
    return join(homedir(), '.allternit', 'mcp-servers.json');
}
/** Load ~/.allternit/mcp-servers.json and attach enabled servers. */
export async function loadMcpServerDirectory(host, options = {}) {
    const path = options.path ?? defaultMcpServerDirectoryPath();
    let raw;
    try {
        raw = readFileSync(path, 'utf8');
    }
    catch (err) {
        if (err.code === 'ENOENT') {
            return;
        }
        if (options.onError) {
            options.onError(err);
            return;
        }
        throw err;
    }
    let document;
    try {
        document = JSON.parse(raw);
    }
    catch (err) {
        if (options.onError) {
            options.onError(err);
            return;
        }
        throw err;
    }
    const entries = document.mcpServers ?? document;
    const configs = [];
    for (const [key, value] of Object.entries(entries)) {
        if (!value || typeof value !== 'object')
            continue;
        if (value.enabled === false)
            continue;
        const serverId = typeof value.serverId === 'string' ? value.serverId : key;
        const namespace = typeof value.namespace === 'string' ? value.namespace : serverId;
        const isRemote = value.type === 'remote' || typeof value.url === 'string';
        if (isRemote) {
            configs.push({
                serverId,
                transport: 'http',
                url: value.url,
                headers: value.headers,
                namespace,
                enabled: true,
                fetch: options.fetch,
            });
        }
        else if (typeof value.command === 'string') {
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
        if (options.onError)
            options.onError(err);
        else
            throw err;
    })));
}
