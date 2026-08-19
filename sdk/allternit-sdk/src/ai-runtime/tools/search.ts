import type { ToolDefinition } from './types.js';
import type { ToolRegistry } from './registry.js';
import { NativeWebTools, type WebToolOptions } from './web.js';
import {
  attachMcpServer,
  createMcpServerAttachment,
  loadMcpServerDirectory,
  type McpServerAttachment,
  type McpServerConfig,
} from './mcp.js';
import { TextEditorTool, type TextEditorOptions } from './text-editor.js';
import { BashTool, type BashRunner, type BashToolOptions } from './bash.js';
import { CodeExecutionTool, type CodeExecutionOptions, type CodeExecutionRunner } from './code-execution.js';
import { MemoryTool, type MemoryToolOptions } from './memory.js';
import { PdfTool, type PdfToolOptions } from './pdf.js';

export interface NativeToolBeltOptions extends WebToolOptions, TextEditorOptions, MemoryToolOptions, PdfToolOptions {
  bashRunner?: BashRunner;
  codeExecutionRunner?: CodeExecutionRunner;
  /** Override the default ~/.allternit/mcp-servers.json path. */
  mcpDirectoryPath?: string;
}

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
  /** Resolves once the initial ~/.allternit/mcp-servers.json directory load finishes. */
  public readonly mcpDirectoryLoaded: Promise<void>;

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
    this.registry.registerTool(new BashTool({ runner: options.bashRunner }).definition(), { strict: true });
    this.registry.registerTool(new CodeExecutionTool({ runner: options.codeExecutionRunner }).definition(), { strict: true });
    this.registry.registerTool(new MemoryTool(options).definition(), { strict: true });
    this.registry.registerTool(new PdfTool(options).definition(), { strict: true });

    this.mcpDirectoryLoaded = loadMcpServerDirectory(
      { attachMcpServer: (cfg) => this.attachMcpServer(cfg) },
      { path: options.mcpDirectoryPath, fetch: options.fetch },
    );
  }

  public attachMcpServer(server: McpServerAttachment): Promise<string[]>;
  public attachMcpServer(config: McpServerConfig): Promise<string[]>;
  public attachMcpServer(serverOrConfig: McpServerAttachment | McpServerConfig): Promise<string[]> {
    if ('listTools' in serverOrConfig) {
      return attachMcpServer(this.registry, serverOrConfig);
    }
    return attachMcpServer(this.registry, createMcpServerAttachment(serverOrConfig));
  }

  public getRegistry() {
    return this.registry;
  }
}
