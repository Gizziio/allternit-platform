/**
 * Bot Activity Toasts
 *
 * Opt-in (default OFF) toast notifications for bot canonical-chat activity
 * (spec Phase 2). Pref persisted at `allternit:bot-activity-toasts`.
 * Archived/hidden bots never toast — they accumulate unread silently; the
 * lifecycle decision lives in `isToastableBot` (a selector) so no component
 * sprinkles inline checks.
 *
 * @module bot-activity-toasts
 */

import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import { useAgentsWithSwarms } from '@/lib/agents';
import type { Agent } from '@/lib/agents/agent.types';
import { isBot } from '@/lib/bots/bot-profile';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { useBotRosterStore } from './bot-roster.store';
import { useBotActivityWatermarkStore } from './bot-activity-watermark';
import { openBotCanonicalChat, openBotChatView } from './bot-canonical-chat.service';
import type { ModeSessionMessage } from '@/lib/agents/mode-session-store';

export const BOT_ACTIVITY_TOASTS_PREF_KEY = 'allternit:bot-activity-toasts';
export const BOT_ACTIVITY_TOASTS_CHANGED_EVENT = 'allternit:bot-activity-toasts-changed';
export const TOAST_PREVIEW_CAP = 140;
export const TOAST_DURATION_MS = 4_000;
export const TOAST_STACK_MAX = 3;

export type BotActivityToastsPref = 'off' | 'on';

// Fallback when localStorage is unavailable (private mode, opaque origins):
// the pref still works for the session, it just does not persist.
let memoryPref: BotActivityToastsPref = 'off';

export function getBotActivityToastsPref(): BotActivityToastsPref {
  try {
    const stored = globalThis.localStorage?.getItem(BOT_ACTIVITY_TOASTS_PREF_KEY);
    if (stored === 'on' || stored === 'off') return stored;
    return memoryPref;
  } catch {
    return memoryPref;
  }
}

export function setBotActivityToastsPref(pref: BotActivityToastsPref): void {
  memoryPref = pref;
  try {
    globalThis.localStorage?.setItem(BOT_ACTIVITY_TOASTS_PREF_KEY, pref);
  } catch {
    // localStorage unavailable — memory fallback keeps the pref for the session.
  }
  globalThis.dispatchEvent?.(new CustomEvent(BOT_ACTIVITY_TOASTS_CHANGED_EVENT));
}

/**
 * Lifecycle selector: archived / deprecated / hidden bots never toast.
 * Mirrors the attention visibility rule in agent.store.
 */
export function isToastableBot(agent: Agent | undefined): boolean {
  if (!agent) return false;
  if (agent.botProfile?.hidden === true) return false;
  const lifecycle = agent.botProfile?.lifecycle;
  return lifecycle !== 'archived' && lifecycle !== 'deprecated';
}

/**
 * Bot-authorship detection for the last canonical-chat message.
 * Returns true/false when message metadata carries a bot marker, or null
 * when authorship is not determinable (caller falls back to the generic
 * toast form per spec).
 */
export function detectBotDmMessage(message: ModeSessionMessage | undefined): boolean | null {
  const metadata = message?.metadata as Record<string, unknown> | undefined;
  if (!metadata) return null;
  const markers = ['botId', 'fromBotId', 'botName', 'botAuthor'] as const;
  for (const key of markers) {
    if (key in metadata) return typeof metadata[key] === 'string' && metadata[key] !== '';
  }
  return null;
}

export function clipPreview(text: string, cap: number = TOAST_PREVIEW_CAP): string {
  const clipped = text.replace(/\s+/g, ' ').trim();
  return clipped.length <= cap ? clipped : `${clipped.slice(0, cap - 1)}…`;
}

/**
 * Mount once in the shell (next to the routine timer). Watches every bot's
 * canonical-chat activity and toasts on new watermark-events when the pref
 * is on. Toasts stack at most 3; each lives ~4s and is dismissible.
 */
export function useBotActivityToasts(): void {
  const { addToast, removeToast } = useToast();
  const [pref, setPref] = useState<BotActivityToastsPref>(() => getBotActivityToastsPref());

  useEffect(() => {
    const sync = () => setPref(getBotActivityToastsPref());
    globalThis.addEventListener?.(BOT_ACTIVITY_TOASTS_CHANGED_EVENT, sync);
    globalThis.addEventListener?.('storage', sync);
    return () => {
      globalThis.removeEventListener?.(BOT_ACTIVITY_TOASTS_CHANGED_EVENT, sync);
      globalThis.removeEventListener?.('storage', sync);
    };
  }, []);

  const agents = useAgentsWithSwarms();
  const sessions = useChatSessionStore((state) => state.sessions);
  const canonicalChatIds = useBotRosterStore((state) => state.canonicalChatIds);
  const watermarks = useBotActivityWatermarkStore((state) => state.watermarks);
  const focusedSessionId = useBotActivityWatermarkStore((state) => state.focusedSessionId);

  // Baseline per bot so the subscription start never toasts history.
  const baselineRef = useRef<Record<string, number>>({});
  const toastIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (pref !== 'on') {
      baselineRef.current = {};
      return;
    }
    const bots = agents.filter(isBot);
    for (const bot of bots) {
      const canonicalId = canonicalChatIds[bot.id];
      if (!canonicalId) continue;
      const session = (sessions ?? []).find((s) => s.id === canonicalId);
      const activityAt = session ? new Date(session.updatedAt || 0).getTime() : 0;
      if (activityAt <= 0) continue;

      const baseline = baselineRef.current[bot.id] ?? watermarks[bot.id] ?? activityAt;
      if (activityAt <= baseline) {
        if (baselineRef.current[bot.id] !== activityAt) baselineRef.current[bot.id] = activityAt;
        continue;
      }

      // New watermark-event.
      baselineRef.current[bot.id] = activityAt;
      if (focusedSessionId === canonicalId) continue;
      if (!isToastableBot(bot)) continue;

      const name = bot.botProfile?.displayName ?? bot.name;
      const lastMessage = session?.messages?.[session.messages.length - 1];
      const dm = detectBotDmMessage(lastMessage);
      const preview = clipPreview(lastMessage?.content ?? '');

      if (toastIdsRef.current.length >= TOAST_STACK_MAX) {
        const oldest = toastIdsRef.current.shift();
        if (oldest) removeToast(oldest);
      }
      const id = addToast({
        type: 'info',
        duration: TOAST_DURATION_MS,
        title: dm === true ? `🤖 New message for ${name}` : `${name} has new activity`,
        description: preview || undefined,
        action: {
          label: 'Open chat',
          onClick: () => {
            void openBotCanonicalChat({ botId: bot.id, botName: name, setActive: false }).then(
              (sessionId) => openBotChatView(sessionId, bot.id, 'chat'),
            );
          },
        },
      });
      toastIdsRef.current.push(id);
    }
  }, [pref, agents, sessions, canonicalChatIds, watermarks, focusedSessionId, addToast, removeToast]);
}
