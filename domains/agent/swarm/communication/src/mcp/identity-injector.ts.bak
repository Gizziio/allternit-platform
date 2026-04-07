/**
 * Identity Injector
 * 
 * Injects sender identity into MCP tool calls and messages.
 */

import type { MCPSessionContext } from './mcp-types.js';

/**
 * Identity to inject
 */
export interface SenderIdentity {
  /** Sender type */
  type: 'human' | 'agent' | 'system';
  /** Sender ID */
  id: string;
  /** Sender name */
  name: string;
  /** Sender role (for agents) */
  role?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Inject identity into arguments object
 */
export function injectIdentity(
  args: Record<string, unknown>,
  identity: SenderIdentity,
  context?: Partial<MCPSessionContext>
): Record<string, unknown> {
  return {
    ...args,
    _sender: identity,
    _senderId: identity.id,
    _senderName: identity.name,
    _senderType: identity.type,
    ...(identity.role && { _senderRole: identity.role }),
    ...(context?.correlationId && { _correlationId: context.correlationId }),
    ...(context?.channel && {
      _channelId: context.channel.id,
      _channelName: context.channel.name,
    }),
    ...(context?.sessionId && { _sessionId: context.sessionId }),
    ...(identity.metadata && { _metadata: identity.metadata }),
  };
}

/**
 * Extract identity from arguments object
 */
export function extractIdentity(
  args: Record<string, unknown>
): SenderIdentity | null {
  const sender = args._sender as Record<string, unknown> | undefined;
  
  if (!sender) {
    return null;
  }

  return {
    type: (sender.type as 'human' | 'agent' | 'system') || 'human',
    id: (sender.id as string) || 'unknown',
    name: (sender.name as string) || 'Unknown',
    role: sender.role as string | undefined,
    metadata: sender.metadata as Record<string, unknown> | undefined,
  };
}

/**
 * Create human sender identity
 */
export function createHumanIdentity(userId: string, userName: string): SenderIdentity {
  return {
    type: 'human',
    id: userId,
    name: userName,
  };
}

/**
 * Create agent sender identity
 */
export function createAgentIdentity(
  agentId: string,
  agentName: string,
  agentRole: string
): SenderIdentity {
  return {
    type: 'agent',
    id: agentId,
    name: agentName,
    role: agentRole,
  };
}

/**
 * Create system sender identity
 */
export function createSystemIdentity(
  systemId: string,
  systemName: string,
  metadata?: Record<string, unknown>
): SenderIdentity {
  return {
    type: 'system',
    id: systemId,
    name: systemName,
    metadata,
  };
}

/**
 * Strip injected identity from arguments (for clean output)
 */
export function stripIdentity(args: Record<string, unknown>): Record<string, unknown> {
  const stripped = { ...args };
  
  delete stripped._sender;
  delete stripped._senderId;
  delete stripped._senderName;
  delete stripped._senderType;
  delete stripped._senderRole;
  delete stripped._correlationId;
  delete stripped._channelId;
  delete stripped._channelName;
  delete stripped._sessionId;
  delete stripped._metadata;
  
  return stripped;
}

/**
 * Check if arguments contain injected identity
 */
export function hasInjectedIdentity(args: Record<string, unknown>): boolean {
  return '_sender' in args || '_senderId' in args;
}
