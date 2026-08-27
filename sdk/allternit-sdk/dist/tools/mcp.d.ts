import type { JsonSchema } from './types.js';
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
/** Discovers an MCP server's tools and registers model-facing proxies. */
export declare function attachMcpServer(registry: ToolRegistry, server: McpServerAttachment): Promise<string[]>;
export declare function createMcpServerAttachment(config: McpServerConfig): McpServerAttachment;
export declare function defaultMcpServerDirectoryPath(): string;
/** Load ~/.allternit/mcp-servers.json and attach enabled servers. */
export declare function loadMcpServerDirectory(host: McpDirectoryHost, options?: McpDirectoryOptions): Promise<void>;
