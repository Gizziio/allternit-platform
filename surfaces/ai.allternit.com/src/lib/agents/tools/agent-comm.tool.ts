/**
 * Agent Communication Tool (Runtime Native)
 *
 * Allows a bot/agent to send mail to another agent/bot through the CommRails
 * backend. This is the runtime-facing tool definition; UI/hook code should
 * continue using `useAgentCommunicationStore` from `agent-communication.tool.ts`.
 *
 * @module agent-comm-tool
 */

import { useCommRailsMailStore } from '@/lib/bots/comrails-mail.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { createModuleLogger } from '@/lib/logger';
import type { ToolDefinition } from './index';

const logger = createModuleLogger('AgentCommTool');

export const AGENT_COMMUNICATION_TOOL_DEFINITION: ToolDefinition = {
  name: 'agent_communicate',
  description: `Send a message to another agent or bot in the system via the shared CommRails mail backend.

Use this tool when you need to:
- Ask another bot for help or information
- Hand off a task to a more appropriate bot
- Share findings, updates, or checkpoints with another agent
- Coordinate work with other bots in a swarm or group

Parameters:
- action: "send" is the primary action
- to_agent_id: the target agent/bot id (required for send)
- subject: short subject line
- body: the message content; include @BotName mentions if relevant
- priority: low | normal | high | urgent (default normal)
- requires_ack: true if you need the recipient to acknowledge (default false)

Examples:
- Send a handoff: action=send, to_agent_id=builder-bot, subject="Implement auth", body="Please implement the login flow described in ..."
- Ask for review: action=send, to_agent_id=validator-bot, subject="Review my code", body="@validator-bot can you review the changes in ..."`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['send'],
        description: 'The action to perform. Only "send" is supported at runtime.',
      },
      to_agent_id: {
        type: 'string',
        description: 'The target agent/bot id to send the message to',
      },
      subject: {
        type: 'string',
        description: 'Short subject line for the mail thread',
      },
      body: {
        type: 'string',
        description: 'The message body. Use @BotName mentions when relevant.',
      },
      priority: {
        type: 'string',
        enum: ['low', 'normal', 'high', 'urgent'],
        description: 'Message priority',
        default: 'normal',
      },
      requires_ack: {
        type: 'boolean',
        description: 'Whether the recipient must acknowledge the message',
        default: false,
      },
      correlation_id: {
        type: 'string',
        description: 'Optional thread/correlation id for grouping related messages',
      },
    },
    required: ['action', 'to_agent_id', 'subject', 'body'],
  },
};

/**
 * Resolve the sending agent id from a chat session id.
 *
 * Bot/agent sessions created by `useStartBotSession` store `agentId` in
 * `session.metadata.agentId`. Regular sessions may not have one; in that case
 * the tool returns an error so the runtime does not send anonymous mail.
 */
function resolveSenderAgentId(sessionId: string): string | undefined {
  const session = useChatSessionStore.getState().sessions.find((s) => s.id === sessionId);
  return typeof session?.metadata?.agentId === 'string' ? session.metadata.agentId : undefined;
}

export async function executeAgentCommunicationTool(
  sessionId: string,
  _toolCallId: string,
  parameters: Record<string, unknown>,
): Promise<{ result: unknown; error?: string }> {
  const action = String(parameters.action || 'send');
  if (action !== 'send') {
    return { result: null, error: `Unsupported agent_communicate action: ${action}` };
  }

  const toAgentId = String(parameters.to_agent_id || '');
  const subject = String(parameters.subject || '');
  const body = String(parameters.body || '');
  const priority = ['low', 'normal', 'high', 'urgent'].includes(String(parameters.priority))
    ? (String(parameters.priority) as 'low' | 'normal' | 'high' | 'urgent')
    : 'normal';
  const requiresAck = parameters.requires_ack === true;
  const correlationId = parameters.correlation_id ? String(parameters.correlation_id) : undefined;

  if (!toAgentId.trim()) {
    return { result: null, error: 'Missing required parameter: to_agent_id' };
  }
  if (!subject.trim()) {
    return { result: null, error: 'Missing required parameter: subject' };
  }
  if (!body.trim()) {
    return { result: null, error: 'Missing required parameter: body' };
  }

  const fromAgentId = resolveSenderAgentId(sessionId);
  if (!fromAgentId) {
    return {
      result: null,
      error: 'Cannot send agent communication: no agent id associated with the current session',
    };
  }

  if (fromAgentId === toAgentId) {
    return { result: null, error: 'Cannot send agent communication to yourself' };
  }

  try {
    const mailStore = useCommRailsMailStore.getState();
    const result = await mailStore.sendMail(fromAgentId, {
      toAgentId,
      subject: correlationId ? `[${correlationId}] ${subject}` : subject,
      body,
      priority,
      requiresAck,
    });

    if (!result.sent) {
      return { result: null, error: 'Failed to send agent communication' };
    }

    logger.info({ from: fromAgentId, to: toAgentId, subject }, 'Agent communication sent');
    return {
      result: {
        sent: true,
        messageId: result.messageId,
        fromAgentId,
        toAgentId,
        subject,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent communication failed';
    logger.error({ from: fromAgentId, to: toAgentId, err }, message);
    return { result: null, error: message };
  }
}
