import { useCallback, useState } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import type { Agent } from '../agents/agent.types';
import {
  prepareBotSession,
  type BotSessionStartResult,
} from './start-bot-session';

export interface UseStartBotSessionReturn {
  startSession: (agent: Agent, options?: { modeId?: string; modelOverride?: string }) => Promise<string | null>;
  startTask: (agent: Agent, task: string, options?: { modeId?: string; modelOverride?: string }) => Promise<string | null>;
  isStarting: boolean;
  error: string | null;
  /** Non-fatal notice, e.g. "Running locally — sync pending" when the
   * backend session could not be created but a local session is live. */
  warning: string | null;
}

/**
 * Start a packaged-bot session using the existing chat session store.
 *
 * If the bot has a VM operator configured with autoStart, this creates a
 * sandbox before opening the session and injects VM instructions into the
 * system prompt. The resulting sessionId renders in the standard chat
 * surface (`viewType: 'chat'`) as the canonical conversation.
 *
 * The session-start core lives in `./start-bot-session` so non-React callers
 * (rail rows, toasts, bot home) can start sessions without mounting a hook.
 */
export function useStartBotSession(
  onSessionStarted?: (sessionId: string, botId: string) => void
): UseStartBotSessionReturn {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Creation threw, but the chat store may still hold a locally-created
  // (temp-…) bot session (e.g. backend unreachable). Open it rather than
  // orphaning it, and flag that cloud sync is pending.
  const recoverLocalBotSession = useCallback((agent: Agent): string | null => {
    const store = useChatSessionStore.getState();
    const localSession = store.sessions.find(
      (s) => s.metadata?.isBot === true && s.metadata?.botCanonicalFor === agent.id,
    );
    if (!localSession) return null;
    store.setActiveSession(localSession.id);
    setWarning('Running locally — sync pending');
    onSessionStarted?.(localSession.id, agent.id);
    return localSession.id;
  }, [onSessionStarted]);

  const applyResult = useCallback(
    (agent: Agent, result: BotSessionStartResult): string => {
      const { sessionId, sandboxError } = result;
      const store = useChatSessionStore.getState();
      store.setActiveSession(sessionId);

      if (!sessionId.startsWith('ses')) {
        // Local temp-… session: backend creation failed but the store kept
        // a working local session. Non-fatal — tell the user sync is pending.
        setWarning('Running locally — sync pending');
      }

      if (sandboxError) {
        // Surface the sandbox error as a system notice in the session metadata
        // without blocking the chat from opening.
        setError(sandboxError);
      }

      onSessionStarted?.(sessionId, agent.id);
      return sessionId;
    },
    [onSessionStarted],
  );

  const startSession = useCallback(
    async (agent: Agent, options?: { modeId?: string; modelOverride?: string }): Promise<string | null> => {
      setIsStarting(true);
      setError(null);
      setWarning(null);

      try {
        const result = await prepareBotSession(agent, options);
        if (!result) return null;
        return applyResult(agent, result);
      } catch (err) {
        const localSessionId = recoverLocalBotSession(agent);
        if (localSessionId) return localSessionId;
        const message = err instanceof Error ? err.message : 'Failed to start bot session';
        setError(message);
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [applyResult, recoverLocalBotSession]
  );

  const startTask = useCallback(
    async (agent: Agent, task: string, options?: { modeId?: string; modelOverride?: string }): Promise<string | null> => {
      if (!task.trim()) return null;

      setIsStarting(true);
      setError(null);
      setWarning(null);

      try {
        const result = await prepareBotSession(agent, options);
        if (!result) return null;

        const { sessionId, sandboxError } = result;
        const store = useChatSessionStore.getState();
        store.setActiveSession(sessionId);

        if (!sessionId.startsWith('ses')) {
          setWarning('Running locally — sync pending');
        }

        // Open the chat surface immediately so the user sees the session and
        // streaming indicator instead of a frozen "Starting..." modal while the
        // local sidecar model loads on its first turn.
        onSessionStarted?.(sessionId, agent.id);

        // Send the task as the first message so the bot starts working immediately.
        // A small delay ensures the session is active before streaming begins.
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        const taskPrefix = agent.vmOperator?.enabled
          ? `[Task] ${task.trim()}\n\nIf this task requires a computer, browser, file system, or code execution, use your virtual computer.`
          : task.trim();
        const runtimeModelId = options?.modelOverride
          ?? (((agent.config ?? {}) as Record<string, unknown>).runtimeModelId as string | undefined)
          ?? (agent.provider && agent.model ? `${agent.provider}/${agent.model}` : undefined);
        await store.sendMessageStream(sessionId, {
          text: taskPrefix,
          ...(runtimeModelId ? { modelId: runtimeModelId } : {}),
        });

        if (sandboxError) {
          setError(sandboxError);
        }

        return sessionId;
      } catch (err) {
        const localSessionId = recoverLocalBotSession(agent);
        if (localSessionId) return localSessionId;
        const message = err instanceof Error ? err.message : 'Failed to start bot task';
        setError(message);
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [onSessionStarted, recoverLocalBotSession]
  );

  return { startSession, startTask, isStarting, error, warning };
}
