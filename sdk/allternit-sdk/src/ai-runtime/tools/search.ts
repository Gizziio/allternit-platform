import type { ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';
import { NativeWebTools, type WebToolOptions } from './web.js';
import { attachMcpServer, type McpServerAttachment } from './mcp.js';
import { TextEditorTool, type TextEditorOptions } from './text-editor.js';
import { BashTool, type BashToolOptions } from './bash.js';
import { CodeExecutionTool, type CodeExecutionOptions } from './code-execution.js';
import { MemoryTool, type MemoryToolOptions } from './memory.js';

export interface NativeToolBeltOptions extends WebToolOptions, TextEditorOptions, BashToolOptions, CodeExecutionOptions, MemoryToolOptions {}

/**
 * tool_search Tool Definition
 */
export const TOOL_SEARCH_DEFINITION: ToolDefinition = {
  name: 'tool_search',
  description: 'Search for available tools that are not yet active in this session. Returns a list of tool IDs and descriptions.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term (e.g., "browser", "database", "git")' }
    },
    required: ['query']
  }
};

/**
 * tool_activate Tool Definition
 */
export const TOOL_ACTIVATE_DEFINITION: ToolDefinition = {
  name: 'tool_activate',
  description: 'Activate (install) a deferred tool discovered via tool_search so it can be used in this session.',
  input_schema: {
    type: 'object',
    properties: {
      toolId: { type: 'string', description: 'The ID of the tool to activate' }
    },
    required: ['toolId']
  }
};

export class NativeToolBelt {
  constructor(private registry: ToolRegistry, options: NativeToolBeltOptions = {}) {
    // Register the search and activate tools themselves
    this.registry.registerTool({
      ...TOOL_SEARCH_DEFINITION,
      execute: async (args: { query: string }) => {
        const results = this.registry.search(args.query);
        return results.map(r => ({ id: r.id, name: r.name, description: r.description }));
      }
    });

    this.registry.registerTool({
      ...TOOL_ACTIVATE_DEFINITION,
      execute: async (args: { toolId: string }) => {
        this.registry.activateTool(args.toolId);
        return `Tool ${args.toolId} successfully activated and ready for use.`;
      }
    });

    for (const tool of new NativeWebTools(options).definitions()) {
      this.registry.registerTool(tool, { strict: true });
    }
    this.registry.registerTool(new TextEditorTool(options).definition(), { strict: true });
    this.registry.registerTool(new BashTool(options).definition(), { strict: true });
    this.registry.registerTool(new CodeExecutionTool(options).definition(), { strict: true });
    this.registry.registerTool(new MemoryTool(options).definition(), { strict: true });
  }

  public attachMcpServer(server: McpServerAttachment): Promise<string[]> {
    return attachMcpServer(this.registry, server);
  }

  public getRegistry() {
    return this.registry;
  }
}
