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
 * A pinned session id is usable unless it was deactivated (backend
 * `active: false`) or explicitly archived in metadata.
 */
function isUsableCanonicalSession(session: { isActive?: boolean; metadata?: Record<string, unknown> }): boolean {
  if (session.isActive === false) return false;
  if (session.metadata?.archived === true) return false;
  return true;
}

/**
 * Resolve the canonical chat session for a bot (Hermes get_compression_tip
 * pattern): the pinned id wins while it still exists and is usable; if the
 * pinned session was compacted/forked (its id is gone) the pin re-points to
 * the newest session still marked `botCanonicalFor` this bot (root→tip); if
 * none exists, the caller recreates the canonical chat.
 */
function resolveCanonicalChatSession(
  botId: string,
  pinnedId: string | null | undefined,
): { sessionId: string; rePinned: boolean } | null {
  const sessions = useChatSessionStore.getState().sessions ?? [];

  if (pinnedId) {
    const pinned = sessions.find((s) => s.id === pinnedId);
    if (pinned && isUsableCanonicalSession(pinned)) {
      return { sessionId: pinned.id, rePinned: false };
    }
  }

  const candidate = sessions
    .filter((s) => s.metadata?.botCanonicalFor === botId && isUsableCanonicalSession(s))
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0];

  if (candidate) {
    return { sessionId: candidate.id, rePinned: true };
  }

  return null;
}

/**
 * Imperatively open or create the canonical chat for a bot.
 *
 * Returns the session id. Safe to call from event handlers outside React.
 */
export async function openBotCanonicalChat(
  options: OpenCanonicalChatOptions,
): Promise<string> {
  const { botId, botName, kickoff, setActive = true } = options;

  const rosterState = useBotRosterStore.getState();
  const resolved = resolveCanonicalChatSession(botId, rosterState.canonicalChatIds[botId]);

  // If we have a usable session (pinned or re-pointed root→tip), open it.
  if (resolved) {
    const sessionStore = useChatSessionStore.getState();
    if (resolved.rePinned) {
      // The pinned id no longer exists (compaction/fork) — re-point the pin.
      useBotRosterStore.getState().setCanonicalChatId(botId, resolved.sessionId);
      logger.info({ botId, sessionId: resolved.sessionId }, 'Re-pointed canonical chat pin (root→tip)');
    }
    if (setActive) {
      sessionStore.setActiveSession(resolved.sessionId);
    }
    logger.info({ botId, sessionId: resolved.sessionId }, 'Opened existing canonical bot chat');
    return resolved.sessionId;
  }

  const existingId = rosterState.canonicalChatIds[botId];
  if (existingId) {
    logger.warn({ botId, sessionId: existingId }, 'Canonical chat session missing or archived; recreating');
  }

  // Create a new canonical chat session.
  const sessionStore = useChatSessionStore.getState();
  const sessionId = await sessionStore.createSession({
    name: 'Bot Chat',
    sessionMode: 'agent',
    agentId: botId,
    agentName: botName,
    metadata: {
      isBot: true,
      botCanonicalFor: botId,
      agentId: botId,
      botName,
    },
  });

  // Pin it in the roster store.
  useBotRosterStore.getState().setCanonicalChatId(botId, sessionId);

  if (setActive) {
    sessionStore.setActiveSession(sessionId);
  }

  const intro = kickoff ?? 'Hey, tell me about yourself!';
  if (intro.trim()) {
    try {
      await sessionStore.sendMessage(sessionId, { text: intro });
    } catch (err) {
      logger.warn({ err, botId, sessionId }, 'Failed to send canonical chat kickoff');
    }
  }

  logger.info({ botId, sessionId }, 'Created canonical bot chat');
  return sessionId;
}

/** Open the canonical 1:1 bot chat view (not Cowork). */
export function openBotChatView(sessionId: string, botId: string, originView = 'chat'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('allternit:open-view', {
      detail: {
        viewType: 'bot-chat-session',
        context: { sessionId, botId, originView },
      },
    }),
  );
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
  // Root→tip fallback: if the pinned id was compacted/forked, surface the
  // newest session still marked canonical for this bot.
  const resolvedSession =
    session ??
    (botId
      ? (sessionStore.sessions ?? [])
          .filter((s) => s.metadata?.botCanonicalFor === botId)
          .sort(
            (a, b) =>
              new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime(),
          )[0] ??
        null
      : null);

  const open = async (botName: string, options?: Omit<OpenCanonicalChatOptions, 'botId' | 'botName'>) => {
    if (!botId) return null;
    return openBotCanonicalChat({ botId, botName, ...options });
  };

  const forget = () => {
    if (botId) setCanonicalChatId(botId, null);
  };

  return { sessionId: resolvedSession?.id ?? sessionId, session: resolvedSession, open, forget };
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
