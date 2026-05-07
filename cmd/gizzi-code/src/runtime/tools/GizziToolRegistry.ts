import { ToolRegistry } from '@allternit/sdk';
import type { ToolDefinition, DeferredToolDefinition } from '@allternit/sdk';
import { Tool, Tools } from '../tools/Tool.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * GizziToolRegistry - Bridges legacy Gizzi tools to the new SDK registry.
 */
export class GizziToolRegistry extends ToolRegistry {
  private static instance: GizziToolRegistry;
  private legacyToolsMap: Map<string, Tool> = new Map();

  public static getInstance(): GizziToolRegistry {
    if (!GizziToolRegistry.instance) {
      GizziToolRegistry.instance = new GizziToolRegistry();
    }
    return GizziToolRegistry.instance;
  }

  /**
   * Register a legacy tool and its SDK definition.
   */
  public registerLegacyTool(tool: Tool) {
    this.legacyToolsMap.set(tool.name, tool);
    
    const definition: ToolDefinition = {
      name: tool.name,
      description: tool.searchHint || `Gizzi tool: ${tool.name}`,
      input_schema: zodToJsonSchema(tool.inputSchema) as any,
      metadata: {
        category: (tool as any).mcpInfo ? 'mcp' : 'builtin',
        isDestructive: tool.isDestructive?.({}) ?? false,
      }
    };

    if (tool.shouldDefer) {
      this.registerDeferredTool({
        ...definition,
        id: `legacy-${tool.name}`,
        tags: [definition.metadata?.category || 'legacy']
      } as DeferredToolDefinition);
    } else {
      this.registerTool(definition);
    }
  }

  public getLegacyTool(name: string): Tool | undefined {
    return this.legacyToolsMap.get(name);
  }

  public getAllLegacyTools(): Tool[] {
    return Array.from(this.legacyToolsMap.values());
  }

  /**
   * Returns legacy tools that are currently active in the registry.
   */
  public getActiveLegacyTools(): Tool[] {
    const activeNames = this.getActiveTools().map(t => t.name);
    return activeNames
      .map(name => this.legacyToolsMap.get(name))
      .filter((t): t is Tool => !!t);
  }
}
