/**
 * MCP (Model Context Protocol) Types
 * 
 * Defines MCP message structures, tool definitions, and session management.
 */

/**
 * MCP Tool definition
 */
export interface MCPTool {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Input schema (JSON Schema) */
  inputSchema: Record<string, unknown>;
}

/**
 * MCP Tool call request
 */
export interface MCPToolCall {
  /** Tool name to call */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
  /** Call ID for correlation */
  callId: string;
}

/**
 * MCP Tool call result
 */
export interface MCPToolResult {
  /** Call ID */
  callId: string;
  /** Success status */
  success: boolean;
  /** Result data */
  result?: unknown;
  /** Error message if failed */
  error?: string;
}

/**
 * MCP Message structure
 */
export interface MCPMessage {
  /** Message ID */
  id: string;
  /** Message type */
  type: 'request' | 'response' | 'notification';
  /** Method (for requests) */
  method?: string;
  /** Parameters */
  params?: Record<string, unknown>;
  /** Result (for responses) */
  result?: unknown;
  /** Error (for error responses) */
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * MCP Session context
 */
export interface MCPSessionContext {
  /** Session ID */
  sessionId: string;
  /** Agent name */
  agentName: string;
  /** Agent role */
  agentRole: string;
  /** Sender identity (injected by proxy) */
  sender: {
    type: 'human' | 'agent';
    id: string;
    name: string;
  };
  /** Channel/room context */
  channel?: {
    id: string;
    name: string;
    type: 'room' | 'direct' | 'thread';
  };
  /** Correlation ID for tracing */
  correlationId?: string;
}

/**
 * MCP Proxy configuration
 */
export interface MCPProxyConfig {
  /** Agent name */
  agentName: string;
  /** Agent session ID */
  sessionId: string;
  /** Agent role */
  agentRole?: string;
  /** Default channel */
  defaultChannel?: {
    id: string;
    name: string;
  };
  /** Enable sender injection */
  injectSender: boolean;
  /** Enable channel context injection */
  injectChannel: boolean;
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Built-in MCP tools for chat communication
 */
export const BUILTIN_CHAT_TOOLS: MCPTool[] = [
  {
    name: 'chat_send',
    description: 'Send a message to a chat room or channel',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room or channel ID' },
        content: { type: 'string', description: 'Message content' },
        mentions: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of users/roles to mention',
        },
      },
      required: ['room_id', 'content'],
    },
  },
  {
    name: 'chat_read',
    description: 'Read messages from a chat room',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room ID' },
        since: { type: 'string', description: 'Read messages since timestamp' },
        limit: { type: 'number', description: 'Max messages to read' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'chat_join',
    description: 'Join a chat room',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room ID to join' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'chat_who',
    description: 'List participants in a room',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room ID' },
      },
      required: ['room_id'],
    },
  },
  {
    name: 'chat_channels',
    description: 'List available channels',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'chat_summary',
    description: 'Get or set channel summary',
    inputSchema: {
      type: 'object',
      properties: {
        room_id: { type: 'string', description: 'Room ID' },
        summary: { type: 'string', description: 'Summary text (for setting)' },
      },
      required: ['room_id'],
    },
  },
];

/**
 * Agent role definitions
 */
export interface AgentRole {
  /** Role name */
  name: 'builder' | 'validator' | 'reviewer' | 'planner' | 'security';
  /** Role description */
  description: string;
  /** Default tools available to this role */
  defaultTools: string[];
  /** Restricted tools for this role */
  restrictedTools: string[];
}

/**
 * Predefined agent roles
 */
export const AGENT_ROLES: Record<string, AgentRole> = {
  builder: {
    name: 'builder',
    description: 'Builds features and implements code',
    defaultTools: ['chat_send', 'chat_read', 'chat_join'],
    restrictedTools: ['chat_summary'],
  },
  validator: {
    name: 'validator',
    description: 'Validates and tests implementations',
    defaultTools: ['chat_send', 'chat_read', 'chat_join', 'chat_summary'],
    restrictedTools: [],
  },
  reviewer: {
    name: 'reviewer',
    description: 'Reviews code and provides feedback',
    defaultTools: ['chat_send', 'chat_read', 'chat_join', 'chat_summary'],
    restrictedTools: [],
  },
  planner: {
    name: 'planner',
    description: 'Plans tasks and manages DAGs',
    defaultTools: ['chat_send', 'chat_read', 'chat_join', 'chat_summary', 'chat_channels'],
    restrictedTools: [],
  },
  security: {
    name: 'security',
    description: 'Security auditing and compliance',
    defaultTools: ['chat_send', 'chat_read', 'chat_join', 'chat_summary', 'chat_who'],
    restrictedTools: [],
  },
};
