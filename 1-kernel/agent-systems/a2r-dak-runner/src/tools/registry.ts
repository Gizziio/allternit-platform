/**
 * Tool Registry
 * 
 * Manages tool definitions, schema validation, and MCP tool naming.
 * Supports regex matching for tool names and specifiers.
 */

import { Tool, ToolCall, ToolResult } from '../types';

export interface ToolHandler {
  (args: Record<string, unknown>): Promise<ToolResult>;
}

export interface ToolRegistration {
  tool: Tool;
  handler: ToolHandler;
}

export interface ToolMatcher {
  pattern: RegExp;
  toolName: string;
  specifier?: string;
}

export class ToolRegistry {
  private tools: Map<string, ToolRegistration> = new Map();
  private matchers: ToolMatcher[] = [];
  private mcpTools: Map<string, ToolRegistration> = new Map();

  constructor() {
    this.registerBaselineTools();
  }

  /**
   * Register a tool with the registry
   */
  register(tool: Tool, handler: ToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, { tool, handler });
  }

  /**
   * Register an MCP tool with the naming convention: mcp__<server>__<tool>
   */
  registerMcpTool(serverName: string, toolName: string, tool: Tool, handler: ToolHandler): void {
    const mcpName = `mcp__${serverName}__${toolName}`;
    this.mcpTools.set(mcpName, { tool: { ...tool, name: mcpName }, handler });
  }

  /**
   * Register a matcher for tools with specifiers
   * e.g., Read(./secrets/**) matches tool Read with specifier ./secrets/**
   */
  registerMatcher(pattern: RegExp, toolName: string, specifier?: string): void {
    this.matchers.push({ pattern, toolName, specifier });
  }

  /**
   * Get a tool by exact name
   */
  getTool(name: string): Tool | undefined {
    // Check exact match first
    const exact = this.tools.get(name);
    if (exact) return exact.tool;

    // Check MCP tools
    const mcp = this.mcpTools.get(name);
    if (mcp) return mcp.tool;

    return undefined;
  }

  /**
   * Get a tool handler by exact name
   */
  getHandler(name: string): ToolHandler | undefined {
    const exact = this.tools.get(name);
    if (exact) return exact.handler;

    const mcp = this.mcpTools.get(name);
    if (mcp) return mcp.handler;

    return undefined;
  }

  /**
   * Match a tool call against registered tools and matchers
   * Returns matched tool name and any extracted specifier
   */
  matchTool(callPattern: string): { toolName: string; specifier?: string } | null {
    // Try exact match first
    if (this.tools.has(callPattern) || this.mcpTools.has(callPattern)) {
      return { toolName: callPattern };
    }

    // Try matchers
    for (const matcher of this.matchers) {
      if (matcher.pattern.test(callPattern)) {
        return {
          toolName: matcher.toolName,
          specifier: matcher.specifier,
        };
      }
    }

    // Try parsing specifier format: Tool(specifier)
    const specifierMatch = callPattern.match(/^([^()]+)\((.+?)\)$/);
    if (specifierMatch) {
      const [, toolName, specifier] = specifierMatch;
      if (this.tools.has(toolName)) {
        return { toolName, specifier };
      }
    }

    return null;
  }

  /**
   * Validate tool call arguments against schema
   */
  validateArgs(toolName: string, args: Record<string, unknown>): { valid: boolean; errors: string[] } {
    const tool = this.getTool(toolName);
    if (!tool) {
      return { valid: false, errors: [`Tool ${toolName} not found`] };
    }

    const errors: string[] = [];
    const schema = tool.inputSchema as { properties?: Record<string, unknown>; required?: string[] };

    if (schema && schema.properties) {
      // Check required fields
      if (schema.required) {
        for (const required of schema.required) {
          if (!(required in args)) {
            errors.push(`Missing required argument: ${required}`);
          }
        }
      }

      // Check for unknown properties
      for (const key of Object.keys(args)) {
        if (!schema.properties[key]) {
          errors.push(`Unknown argument: ${key}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a tool call
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const match = this.matchTool(toolCall.tool);
    if (!match) {
      return {
        success: false,
        error: {
          message: `Tool ${toolCall.tool} not found in registry`,
          code: 'TOOL_NOT_FOUND',
        },
      };
    }

    // Validate arguments
    const validation = this.validateArgs(match.toolName, toolCall.args);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          message: `Validation failed: ${validation.errors.join(', ')}`,
          code: 'VALIDATION_ERROR',
        },
      };
    }

    // Get handler
    const handler = this.getHandler(match.toolName);
    if (!handler) {
      return {
        success: false,
        error: {
          message: `Handler not found for tool ${match.toolName}`,
          code: 'HANDLER_NOT_FOUND',
        },
      };
    }

    // Execute
    try {
      const result = await handler(toolCall.args);
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          code: 'EXECUTION_ERROR',
        },
      };
    }
  }

  /**
   * List all registered tools
   */
  listTools(): Tool[] {
    return [
      ...Array.from(this.tools.values()).map(r => r.tool),
      ...Array.from(this.mcpTools.values()).map(r => r.tool),
    ];
  }

  /**
   * Check if a tool is registered
   */
  hasTool(name: string): boolean {
    return this.tools.has(name) || this.mcpTools.has(name);
  }

  /**
   * Check if a tool is dangerous (requires extra gating)
   */
  isDangerous(name: string): boolean {
    const tool = this.getTool(name);
    return tool?.dangerous || false;
  }

  /**
   * Check if a tool modifies the filesystem
   */
  modifiesFilesystem(name: string): boolean {
    const tool = this.getTool(name);
    return tool?.modifiesFilesystem || false;
  }

  /**
   * Register the baseline Claude-parity tools
   */
  private registerBaselineTools(): void {
    // Read - Read file contents
    this.register({
      name: 'Read',
      description: 'Read the contents of a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          offset: { type: 'number', description: 'Line offset to start reading' },
          limit: { type: 'number', description: 'Number of lines to read' },
        },
        required: ['path'],
      },
      modifiesFilesystem: false,
    }, async (args) => {
      // Placeholder - actual implementation would use fs
      return { success: true, output: '' };
    });

    // Write - Write file contents
    this.register({
      name: 'Write',
      description: 'Write content to a file',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          content: { type: 'string', description: 'Content to write' },
        },
        required: ['path', 'content'],
      },
      modifiesFilesystem: true,
      dangerous: true,
    }, async (args) => {
      return { success: true, affectedPaths: [args.path as string] };
    });

    // Edit - Edit file contents
    this.register({
      name: 'Edit',
      description: 'Edit a file by replacing old string with new string',
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Path to the file' },
          oldString: { type: 'string', description: 'String to replace' },
          newString: { type: 'string', description: 'Replacement string' },
        },
        required: ['path', 'oldString', 'newString'],
      },
      modifiesFilesystem: true,
      dangerous: true,
    }, async (args) => {
      return { success: true, affectedPaths: [args.path as string] };
    });

    // Bash - Execute shell command
    this.register({
      name: 'Bash',
      description: 'Execute a bash command',
      inputSchema: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Command to execute' },
          timeout: { type: 'number', description: 'Timeout in seconds' },
          workingDir: { type: 'string', description: 'Working directory' },
        },
        required: ['command'],
      },
      modifiesFilesystem: true,
      dangerous: true,
    }, async (args) => {
      return { success: true, output: '' };
    });

    // Glob - Find files matching pattern
    this.register({
      name: 'Glob',
      description: 'Find files matching a glob pattern',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Glob pattern' },
          path: { type: 'string', description: 'Base path' },
        },
        required: ['pattern'],
      },
      modifiesFilesystem: false,
    }, async (args) => {
      return { success: true, output: [] };
    });

    // Grep - Search file contents
    this.register({
      name: 'Grep',
      description: 'Search for patterns in files',
      inputSchema: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Search pattern' },
          path: { type: 'string', description: 'Path to search' },
          outputMode: { type: 'string', enum: ['content', 'files_with_matches'] },
        },
        required: ['pattern', 'path'],
      },
      modifiesFilesystem: false,
    }, async (args) => {
      return { success: true, output: [] };
    });
  }
}

// Singleton instance
let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetToolRegistry(): void {
  globalRegistry = null;
}
