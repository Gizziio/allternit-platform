/**
 * MCP Proxy
 * 
 * Per-instance MCP proxy that injects sender identity transparently.
 * Reverse engineered from agentchattr pattern, implemented for a2rchitech.
 */

import type {
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  MCPMessage,
  MCPSessionContext,
  MCPProxyConfig,
} from './mcp-types.js';
import { BUILTIN_CHAT_TOOLS, AGENT_ROLES } from './mcp-types.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * MCP Proxy Class
 * 
 * Intercepts MCP tool calls and injects sender identity context.
 */
export class MCPProxy {
  private config: MCPProxyConfig;
  private context: MCPSessionContext;
  private tools: Map<string, MCPTool>;
  private pendingCalls: Map<string, (result: MCPToolResult) => void>;

  constructor(config: MCPProxyConfig) {
    this.config = config;
    
    // Build session context
    this.context = {
      sessionId: config.sessionId,
      agentName: config.agentName,
      agentRole: config.agentRole || 'builder',
      sender: {
        type: 'agent',
        id: config.sessionId,
        name: config.agentName,
      },
      channel: config.defaultChannel,
      correlationId: uuidv4(),
    };

    // Register built-in tools
    this.tools = new Map();
    for (const tool of BUILTIN_CHAT_TOOLS) {
      this.tools.set(tool.name, tool);
    }

    // Add role-specific tools
    if (config.agentRole) {
      const role = AGENT_ROLES[config.agentRole];
      if (role) {
        for (const toolName of role.defaultTools) {
          const tool = this.tools.get(toolName);
          if (tool) {
            // Tool already registered
          }
        }
      }
    }

    this.pendingCalls = new Map();
  }

  /**
   * Forward a tool call with injected context
   */
  async forward(toolCall: MCPToolCall): Promise<MCPToolResult> {
    // Inject sender identity
    const enrichedCall = this.injectContext(toolCall);

    // Log for debugging
    if (this.config.logLevel === 'debug') {
      console.log(`[MCPProxy] Forwarding tool call: ${enrichedCall.name}`);
      console.log(`  Arguments: ${JSON.stringify(enrichedCall.arguments)}`);
    }

    // In production, this would send to the actual MCP server
    // For now, we simulate the response
    const result = await this.executeTool(enrichedCall);

    return result;
  }

  /**
   * Inject context into tool call
   */
  private injectContext(toolCall: MCPToolCall): MCPToolCall {
    const enriched: MCPToolCall = {
      ...toolCall,
      arguments: {
        ...toolCall.arguments,
      },
    };

    // Inject sender identity
    if (this.config.injectSender) {
      enriched.arguments._sender = this.context.sender;
      enriched.arguments._agentName = this.context.agentName;
      enriched.arguments._agentRole = this.context.agentRole;
    }

    // Inject channel context
    if (this.config.injectChannel && this.context.channel) {
      enriched.arguments._channelId = this.context.channel.id;
      enriched.arguments._channelName = this.context.channel.name;
    }

    // Inject correlation ID for tracing
    enriched.arguments._correlationId = this.context.correlationId;

    return enriched;
  }

  /**
   * Execute tool (simulated - in production would call actual MCP server)
   */
  private async executeTool(toolCall: MCPToolCall): Promise<MCPToolResult> {
    try {
      // Validate tool exists
      const tool = this.tools.get(toolCall.name);
      if (!tool) {
        return {
          callId: toolCall.callId,
          success: false,
          error: `Unknown tool: ${toolCall.name}`,
        };
      }

      // Validate arguments against schema
      const validationError = this.validateArguments(
        toolCall.arguments,
        tool.inputSchema
      );

      if (validationError) {
        return {
          callId: toolCall.callId,
          success: false,
          error: validationError,
        };
      }

      // In production, this would actually execute the tool
      // For now, return success with mock result
      return {
        callId: toolCall.callId,
        success: true,
        result: {
          status: 'executed',
          tool: toolCall.name,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        callId: toolCall.callId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Validate arguments against JSON schema
   */
  private validateArguments(
    args: Record<string, unknown>,
    schema: Record<string, unknown>
  ): string | null {
    // Simple validation - check required fields
    const required = (schema as any).required as string[] || [];
    
    for (const field of required) {
      if (args[field] === undefined) {
        return `Missing required argument: ${field}`;
      }
    }

    return null;
  }

  /**
   * Register a custom tool
   */
  registerTool(tool: MCPTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Unregister a tool
   */
  unregisterTool(toolName: string): void {
    this.tools.delete(toolName);
  }

  /**
   * Get available tools
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Update session context
   */
  updateContext(updates: Partial<MCPSessionContext>): void {
    this.context = { ...this.context, ...updates };
  }

  /**
   * Set channel context
   */
  setChannel(channelId: string, channelName: string): void {
    this.context.channel = {
      id: channelId,
      name: channelName,
      type: 'room',
    };
  }

  /**
   * Get current context
   */
  getContext(): MCPSessionContext {
    return { ...this.context };
  }

  /**
   * Create a new correlation ID for tracing
   */
  newCorrelationId(): string {
    this.context.correlationId = uuidv4();
    return this.context.correlationId;
  }
}

/**
 * Create MCP proxy for an agent
 */
export function createMCPProxy(config: MCPProxyConfig): MCPProxy {
  return new MCPProxy({
    injectSender: config.injectSender ?? true,
    injectChannel: config.injectChannel ?? true,
    logLevel: config.logLevel ?? 'info',
    ...config,
  });
}

/**
 * Create MCP proxy with role-based defaults
 */
export function createRoleBasedProxy(
  agentName: string,
  sessionId: string,
  role: 'builder' | 'validator' | 'reviewer' | 'planner' | 'security'
): MCPProxy {
  const roleConfig = AGENT_ROLES[role];
  
  return createMCPProxy({
    agentName,
    sessionId,
    agentRole: role,
    defaultChannel: undefined,
    injectSender: true,
    injectChannel: true,
    logLevel: 'info',
  });
}
