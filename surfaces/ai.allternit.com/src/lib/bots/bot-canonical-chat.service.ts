/**
 * Bot Canonical Chat Service
 *
 * Manages one persistent "Bot Chat" session per bot, following the Hermes
 * Bot Mode pattern. The session id is pinned in bot-roster store metadata and
 * marked with `botCanonicalFor` in session metadata so it can be hidden from
 * the global session list and recovered on reload.
 *
 * @module bot-canonical-chat.service
 */

import { useAgentStore } from '@/lib/agents/agent.store';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useBotRosterStore } from './bot-roster.store';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('BotCanonicalChat');

export interface OpenCanonicalChatOptions {
  botId: string;
  botName: string;
  /** Kickoff message sent when a new canonical chat is created. */
  kickoff?: string;
  /** If true, set the session active after opening. */
  setActive?: boolean;
}

/**
 * Imperatively open or create the canonical chat for a bot.
 *
 * Returns the session id. Safe to call from event handlers outside React.
 */
export async function openBotCanonicalChat(
  options: OpenCanonicalChatOptions,
): Promise<string> {
  const { botId, botName, kickoff = "Hey, tell me about yourself!", setActive = true } = options;

  const rosterState = useBotRosterStore.getState();
  const existingId = rosterState.canonicalChatIds[botId];

  // If we already have a pinned id, verify it still exists.
  if (existingId) {
    const sessionStore = useChatSessionStore.getState();
    const sessions = sessionStore.sessions ?? [];
    const existing = sessions.find((s) => s.id === existingId);

    if (existing) {
      if (setActive) {
        sessionStore.setActiveSession(existingId);
      }
      logger.info({ botId, sessionId: existingId }, 'Opened existing canonical bot chat');
      return existingId;
    }

    logger.warn({ botId, sessionId: existingId }, 'Canonical chat session missing; recreating');
  }

  // Create a new canonical chat session.
  const sessionStore = useChatSessionStore.getState();
  const sessionId = await sessionStore.createSession({
    name: 'Bot Chat',
    sessionMode: 'agent',
    agentId: botId,
    agentName: botName,
    metadata: {
      botCanonicalFor: botId,
      botName,
    },
  });

  // Pin it in the roster store.
  useBotRosterStore.getState().setCanonicalChatId(botId, sessionId);

  if (setActive) {
    sessionStore.setActiveSession(sessionId);
  }

  // Send kickoff message so the bot introduces itself.
  try {
    await sessionStore.sendMessage(sessionId, { text: kickoff });
  } catch (err) {
    logger.warn({ err, botId, sessionId }, 'Failed to send canonical chat kickoff');
  }

  logger.info({ botId, sessionId }, 'Created canonical bot chat');
  return sessionId;
}

/**
 * React hook that exposes the canonical chat id for a bot and an opener.
 */
export function useBotCanonicalChat(botId: string | null) {
  const canonicalChatIds = useBotRosterStore((state) => state.canonicalChatIds);
  const setCanonicalChatId = useBotRosterStore((state) => state.setCanonicalChatId);
  const sessionStore = useChatSessionStore();

  const sessionId = botId ? canonicalChatIds[botId] : null;
  const session = sessionId
    ? (sessionStore.sessions ?? []).find((s) => s.id === sessionId) ?? null
    : null;

  const open = async (botName: string, options?: Omit<OpenCanonicalChatOptions, 'botId' | 'botName'>) => {
    if (!botId) return null;
    return openBotCanonicalChat({ botId, botName, ...options });
  };

  const forget = () => {
    if (botId) setCanonicalChatId(botId, null);
  };

  return { sessionId, session, open, forget };
}

/**
 * Return all session ids that are canonical bot chats.
 */
export function getCanonicalBotChatSessionIds(): string[] {
  return Object.values(useBotRosterStore.getState().canonicalChatIds);
}

/**
 * Check whether a session is a canonical bot chat.
 */
export function isCanonicalBotChatSession(sessionId: string): boolean {
  return getCanonicalBotChatSessionIds().includes(sessionId);
}
