import type { ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';

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
  constructor(private registry: ToolRegistry) {
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
  }

  public getRegistry() {
    return this.registry;
  }
}
