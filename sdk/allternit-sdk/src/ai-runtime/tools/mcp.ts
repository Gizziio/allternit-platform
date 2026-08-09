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
