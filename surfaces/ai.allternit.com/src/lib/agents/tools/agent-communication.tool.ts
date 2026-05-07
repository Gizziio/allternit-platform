/**
 * Agent Communication Tool - Native Implementation
 * 
 * This tool allows agents to communicate with each other directly through
 * the allternit kernel, without external dependencies.
 * 
 * Features:
 * - Send messages to other agents by role or name
 * - Read messages from shared channels
 * - @mention routing
 * - Loop guard protection
 * - Receipt logging for audit trail
 * 
 * @module agent-communication-tool
 */

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { v4 as uuidv4 } from "uuid";

// ============================================================================
// Types
// ============================================================================

export type MessageType = "direct" | "channel" | "broadcast";

export interface AgentMessage {
  id: string;
  from: {
    agentId: string;
    agentName: string;
    agentRole: string;
  };
  to: {
    agentId?: string;
    agentName?: string;
    agentRole?: string;
    channel?: string;
  };
  content: string;
  type: MessageType;
  timestamp: string;
  correlationId?: string;
  inReplyTo?: string;
  mentions?: string[];
  read: boolean;
  readAt?: string;
}

export interface CommunicationChannel {
  id: string;
  name: string;
  description?: string;
  members: string[]; // agent IDs
  createdAt: string;
  createdBy: string;
}

export interface AgentCommunicationState {
  // Messages
  sentMessages: AgentMessage[];
  receivedMessages: AgentMessage[];
  pendingMessages: AgentMessage[];
  
  // Channels
  channels: CommunicationChannel[];
  joinedChannels: string[]; // channel IDs
  
  // Agent identity
  currentAgent: {
    id: string;
    name: string;
    role: string;
  } | null;
  
  // Loop guard
  hopCounter: Map<string, number>; // correlationId -> count
}

export interface AgentCommunicationActions {
  // Send messages
  sendMessage: (config: {
    content: string;
    to?: { agentName?: string; agentRole?: string; channel?: string };
    type?: MessageType;
    correlationId?: string;
    inReplyTo?: string;
  }) => Promise<AgentMessage>;
  
  // Read messages
  readMessages: (filter: {
    channel?: string;
    fromAgent?: string;
    unreadOnly?: boolean;
    limit?: number;
  }) => AgentMessage[];
  
  // Channel management
  createChannel: (config: {
    name: string;
    description?: string;
    members?: string[];
  }) => CommunicationChannel;
  
  joinChannel: (channelId: string) => void;
  leaveChannel: (channelId: string) => void;
  
  // Agent identity
  setAgentIdentity: (identity: { id: string; name: string; role: string }) => void;
  
  // Loop guard
  incrementHopCount: (correlationId: string) => number;
  resetHopCount: (correlationId: string) => void;
  getHopCount: (correlationId: string) => number;
  
  // Query
  getMessages: () => AgentMessage[];
  getChannels: () => CommunicationChannel[];
  hasUnreadMessages: (channel?: string) => boolean;
}

// ============================================================================
// Constants
// ============================================================================

const MAX_HOP_COUNT = 4; // Maximum agent-to-agent hops before escalation
const MESSAGE_RETENTION = 1000; // Max messages to keep in memory

// ============================================================================
// Store Implementation
// ============================================================================

export const useAgentCommunicationStore = create<AgentCommunicationState & AgentCommunicationActions>()(
  immer((set, get) => ({
    // State
    sentMessages: [],
    receivedMessages: [],
    pendingMessages: [],
    channels: [],
    joinedChannels: [],
    currentAgent: null,
    hopCounter: new Map(),
    
    // -------------------------------------------------------------------------
    // Message Operations
    // -------------------------------------------------------------------------
    
    sendMessage: async (config) => {
      const state = get();
      
      if (!state.currentAgent) {
        throw new Error("Agent identity not set. Call setAgentIdentity first.");
      }
      
      // Check loop guard
      if (config.correlationId) {
        const hopCount = state.hopCounter.get(config.correlationId) || 0;
        if (hopCount >= MAX_HOP_COUNT) {
          throw new Error(
            `Maximum agent communication hops exceeded (${hopCount}/${MAX_HOP_COUNT}). Escalating to human.`
          );
        }
      }
      
      const message: AgentMessage = {
        id: `msg_${uuidv4()}`,
        from: {
          agentId: state.currentAgent.id,
          agentName: state.currentAgent.name,
          agentRole: state.currentAgent.role,
        },
        to: {
          agentId: config.to?.agentName,
          agentName: config.to?.agentName,
          agentRole: config.to?.agentRole,
          channel: config.to?.channel,
        },
        content: config.content,
        type: config.type || "direct",
        timestamp: new Date().toISOString(),
        correlationId: config.correlationId,
        inReplyTo: config.inReplyTo,
        mentions: extractMentions(config.content),
        read: false,
      };
      
      // Add to sent messages
      set((state) => {
        state.sentMessages.push(message);
        
        // If sending to a channel, also add to received for self
        if (message.to.channel) {
          state.receivedMessages.push({ ...message, read: true });
        }
        
        // Trim old messages
        if (state.sentMessages.length > MESSAGE_RETENTION) {
          state.sentMessages = state.sentMessages.slice(-MESSAGE_RETENTION);
        }
        if (state.receivedMessages.length > MESSAGE_RETENTION) {
          state.receivedMessages = state.receivedMessages.slice(-MESSAGE_RETENTION);
        }
      });
      
      // Increment hop counter
      if (config.correlationId) {
        get().incrementHopCount(config.correlationId);
      }
      
      // In production, would broadcast via WebSocket or event bus
      console.log("[AgentCommunication] Message sent:", message);
      
      return message;
    },
    
    readMessages: (filter) => {
      const state = get();
      let messages = [...state.receivedMessages];
      
      // Filter by channel
      if (filter.channel) {
        messages = messages.filter(m => m.to.channel === filter.channel);
      }
      
      // Filter by sender
      if (filter.fromAgent) {
        messages = messages.filter(m => m.from.agentId === filter.fromAgent);
      }
      
      // Filter unread only
      if (filter.unreadOnly) {
        messages = messages.filter(m => !m.read);
      }
      
      // Apply limit
      if (filter.limit) {
        messages = messages.slice(-filter.limit);
      }
      
      // Mark as read
      set((state) => {
        for (const message of messages) {
          const existing = state.receivedMessages.find(m => m.id === message.id);
          if (existing) {
            existing.read = true;
            existing.readAt = new Date().toISOString();
          }
        }
      });
      
      return messages;
    },
    
    // -------------------------------------------------------------------------
    // Channel Operations
    // -------------------------------------------------------------------------
    
    createChannel: (config) => {
      const state = get();
      
      if (!state.currentAgent) {
        throw new Error("Agent identity not set");
      }
      
      const channel: CommunicationChannel = {
        id: `channel_${uuidv4()}`,
        name: config.name,
        description: config.description,
        members: config.members || [state.currentAgent.id],
        createdAt: new Date().toISOString(),
        createdBy: state.currentAgent.id,
      };
      
      set((state) => {
        state.channels.push(channel);
        state.joinedChannels.push(channel.id);
      });
      
      return channel;
    },
    
    joinChannel: (channelId) => {
      const state = get();
      
      if (!state.currentAgent) {
        throw new Error("Agent identity not set");
      }
      
      const channel = state.channels.find(c => c.id === channelId);
      if (!channel) {
        throw new Error(`Channel ${channelId} not found`);
      }
      
      set((state) => {
        if (!state.joinedChannels.includes(channelId)) {
          state.joinedChannels.push(channelId);
        }
        if (!channel.members.includes(state.currentAgent!.id)) {
          channel.members.push(state.currentAgent!.id);
        }
      });
    },
    
    leaveChannel: (channelId) => {
      set((state) => {
        state.joinedChannels = state.joinedChannels.filter(id => id !== channelId);
        
        const channel = state.channels.find(c => c.id === channelId);
        const currentAgentId = state.currentAgent?.id;
        if (channel && currentAgentId) {
          channel.members = channel.members.filter(id => id !== currentAgentId);
        }
      });
    },
    
    // -------------------------------------------------------------------------
    // Agent Identity
    // -------------------------------------------------------------------------
    
    setAgentIdentity: (identity) => {
      set((state) => {
        state.currentAgent = identity;
      });
    },
    
    // -------------------------------------------------------------------------
    // Loop Guard
    // -------------------------------------------------------------------------
    
    incrementHopCount: (correlationId) => {
      let count = 0;
      
      set((state) => {
        count = (state.hopCounter.get(correlationId) || 0) + 1;
        state.hopCounter.set(correlationId, count);
      });
      
      return count;
    },
    
    resetHopCount: (correlationId) => {
      set((state) => {
        state.hopCounter.delete(correlationId);
      });
    },
    
    getHopCount: (correlationId) => {
      return get().hopCounter.get(correlationId) || 0;
    },
    
    // -------------------------------------------------------------------------
    // Query Methods
    // -------------------------------------------------------------------------
    
    getMessages: () => {
      return [...get().receivedMessages, ...get().sentMessages].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    
    getChannels: () => {
      return [...get().channels];
    },
    
    hasUnreadMessages: (channel) => {
      const state = get();
      return state.receivedMessages.some(m => !m.read && (!channel || m.to.channel === channel));
    },
  }))
);

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract @mentions from text
 */
function extractMentions(text: string): string[] {
  const mentionRegex = /\B@([A-Za-z][A-Za-z0-9_-]*)/g;
  const matches = text.match(mentionRegex);
  return matches ? matches.map(m => m.slice(1)) : [];
}

/**
 * Check if message is for current agent
 */
export function isMessageForAgent(
  message: AgentMessage,
  agentId: string,
  agentRole: string
): boolean {
  return (
    message.to.agentId === agentId ||
    message.to.agentRole === agentRole ||
    Boolean(message.to.channel && message.to.channel === "broadcast")
  );
}

/**
 * Format message for display
 */
export function formatMessageForDisplay(message: AgentMessage): string {
  const prefix = message.type === "direct" ? "DM" : `#${message.to.channel || "unknown"}`;
  return `[${prefix}] ${message.from.agentName}: ${message.content}`;
}

// ============================================================================
// Tool Definition (for MCP registration)
// ============================================================================

export const AGENT_COMMUNICATION_TOOL_DEFINITION = {
  name: "agent_communicate",
  description: `Communicate with other AI agents in the system.

Use this tool when you need to:
- Ask another agent for help or information
- Coordinate work with other agents
- Share findings or updates
- Request review or validation

Examples:
- "Send a message to @validator to review my code"
- "Ask @builder to implement the authentication feature"
- "Post an update to the #development channel"

The tool supports:
- Direct messages to specific agents
- Channel-based communication
- @mention routing
- Message threading (via correlationId)

Loop Guard: Messages are limited to 4 hops to prevent infinite chains.`,
  parameters: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["send", "read", "create_channel", "join_channel"],
        description: "The action to perform",
      },
      content: {
        type: "string",
        description: "Message content (for send action)",
      },
      to: {
        type: "object",
        description: "Recipient information",
        properties: {
          agentName: { type: "string", description: "Specific agent name" },
          agentRole: { type: "string", description: "Agent role (builder, validator, etc.)" },
          channel: { type: "string", description: "Channel name for broadcast" },
        },
      },
      channel: {
        type: "string",
        description: "Channel name (for read/join actions)",
      },
      correlationId: {
        type: "string",
        description: "Thread/correlation ID for message threading",
      },
      limit: {
        type: "number",
        description: "Max messages to read",
        default: 50,
      },
    },
    required: ["action"],
  },
} as const;

export default useAgentCommunicationStore;
