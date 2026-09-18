import { useCallback, useState } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import type { Agent } from '../agents/agent.types';
import {
  applyModeContractToPrompt,
  getAgentModeContract,
  modeMetadataPatch,
} from '@/lib/agents/agent-mode-contracts';
import {
  prepareBotSession,
  type BotSessionStartResult,
} from './start-bot-session';

type StartBotOptions = { modeId?: string; templateTitle?: string; modelOverride?: string };

export interface UseStartBotSessionReturn {
  startSession: (agent: Agent, options?: { modeId?: string; modelOverride?: string }) => Promise<string | null>;
  startTask: (agent: Agent, task: string, options?: { modeId?: string; templateTitle?: string; modelOverride?: string }) => Promise<string | null>;
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
 * system prompt. The resulting sessionId is passed to
 * `open('bot-chat-session', { sessionId, botId })` so the bot chat surface
 * renders the canonical conversation plus the computer pane.
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
  // P0-A: if none exists, create a minimal local bot session so rail/hub
  // clicks always reach BotChatSessionView even when ao/brain is down.
  const recoverLocalBotSession = useCallback(async (agent: Agent, options?: StartBotOptions): Promise<string | null> => {
    const store = useChatSessionStore.getState();
    const modeContract = getAgentModeContract(options?.modeId);
    const localSession = store.sessions.find(
      (s) =>
        s.metadata?.isBot === true &&
        (s.metadata?.botCanonicalFor === agent.id || s.metadata?.agentId === agent.id),
    );
    if (localSession) {
      if (modeContract) {
        const existingPrompt =
          typeof localSession.metadata.systemPrompt === 'string'
            ? localSession.metadata.systemPrompt
            : undefined;
        await store.updateSession(localSession.id, {
          metadata: {
            ...localSession.metadata,
            systemPrompt: applyModeContractToPrompt(
              existingPrompt,
              modeContract,
              options?.templateTitle,
            ),
            executionPersistence: 'local',
            ...modeMetadataPatch(modeContract, options?.templateTitle),
          },
        });
      }
      store.setActiveSession(localSession.id);
      setWarning('Running locally — sync pending');
      onSessionStarted?.(localSession.id, agent.id);
      return localSession.id;
    }

    const displayName = agent.botProfile?.displayName ?? agent.name;
    const systemPrompt = modeContract
      ? applyModeContractToPrompt(agent.systemPrompt ?? '', modeContract, options?.templateTitle)
      : (agent.systemPrompt ?? '');
    try {
      const sessionId = await store.createSession({
        name: displayName,
        description: agent.botProfile?.welcomeMessage ?? agent.description,
        sessionMode: 'agent',
        agentId: agent.id,
        agentName: displayName,
        systemPrompt,
        metadata: {
          isBot: true,
          botCanonicalFor: agent.id,
          agentId: agent.id,
          botProfile: agent.botProfile,
          originSurface: 'chat',
          ...(modeContract
            ? { executionPersistence: 'local', ...modeMetadataPatch(modeContract, options?.templateTitle) }
            : {}),
        },
      });
      if (!sessionId) return null;
      store.setActiveSession(sessionId);
      setWarning('Running locally — sync pending');
      onSessionStarted?.(sessionId, agent.id);
      return sessionId;
    } catch {
      return null;
    }
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
        if (!result) {
          // prepare returned null — still open a local session (P0-A).
          return await recoverLocalBotSession(agent, options);
        }
        return applyResult(agent, result);
      } catch (err) {
        const localSessionId = await recoverLocalBotSession(agent, options);
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
    async (agent: Agent, task: string, options?: StartBotOptions): Promise<string | null> => {
      if (!task.trim()) return null;

      setIsStarting(true);
      setError(null);
      setWarning(null);

      const sendTask = async (sessionId: string, sandboxError?: string): Promise<string> => {
        const store = useChatSessionStore.getState();
        store.setActiveSession(sessionId);

        if (!sessionId.startsWith('ses')) {
          setWarning('Running locally — sync pending');
        }

        onSessionStarted?.(sessionId, agent.id);

        await new Promise((resolve) => window.setTimeout(resolve, 50));
        const modeContract = getAgentModeContract(options?.modeId);
        const modeLabel = modeContract
          ? `[Execute in ${modeContract.label} mode${options?.templateTitle ? ` — ${options.templateTitle}` : ''}]\n\n`
          : '';
        const taskPrefix = agent.vmOperator?.enabled
          ? `${modeLabel}[Task] ${task.trim()}\n\nIf this task requires a computer, browser, file system, or code execution, use your virtual computer.`
          : `${modeLabel}${task.trim()}`;
        const liveSession = store.sessions.find((s) => s.id === sessionId);
        const localOnly =
          liveSession?.metadata?.executionPersistence === 'local' || sessionId.startsWith('temp-');
        const runtimeModelId = options?.modelOverride
          ?? (((agent.config ?? {}) as Record<string, unknown>).runtimeModelId as string | undefined)
          ?? (agent.provider && agent.model ? `${agent.provider}/${agent.model}` : undefined);
        // Local-only temp sessions must omit modelId so the client mode
        // executor can run. Live backend sessions keep the bot's brain and
        // receive the mode contract via systemPrompt.
        await store.sendMessageStream(sessionId, {
          text: taskPrefix,
          ...(!localOnly && runtimeModelId ? { modelId: runtimeModelId } : {}),
        });

        if (sandboxError) {
          setError(sandboxError);
        }

        return sessionId;
      };

      try {
        const result = await prepareBotSession(agent, options);
        if (!result) {
          const localSessionId = await recoverLocalBotSession(agent, options);
          if (!localSessionId) return null;
          return await sendTask(localSessionId);
        }
        return await sendTask(result.sessionId, result.sandboxError);
      } catch (err) {
        const localSessionId = await recoverLocalBotSession(agent, options);
        if (localSessionId) {
          try {
            return await sendTask(localSessionId);
          } catch {
            return localSessionId;
          }
        }
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
