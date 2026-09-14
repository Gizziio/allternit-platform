import { useCallback, useState } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { startAgentRun } from '@/lib/agents/agent.service';
import { resolveAgentSecrets } from '@/lib/agents/agent-secrets-resolver';
import { resolveAgentConnectors } from '@/lib/agents/agent-connectors-resolver';
import {
  createSandbox,
  getSandboxForAgent,
  isBotDesktopPaused,
  type Sandbox,
} from './vm-operator';
import { useBotAllternitBusStore } from './bot-allternit-bus';
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
 * system prompt. The resulting sessionId is passed to
 * `open('bot-chat-session', { sessionId, botId })` so the bot chat surface
 * renders the canonical conversation plus the computer pane.
 *
 * The session-start core lives in `./start-bot-session` so non-React callers
 * (rail rows, toasts, bot home) can start sessions without mounting a hook.
 * system prompt. The resulting sessionId can be passed to
 * `open('cowork-agent-session', { sessionId })` so the existing chat surface
 * renders it.
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
    }

    const vmPrompt = vmConfig?.enabled ? buildVMSystemPrompt(vmConfig, sandbox) : '';

    // Connect AllternitBus cloud-orchestration messaging when configured
    const allternitBusEnabled = agent.messagingConfig?.photonEnabled === true;
    if (allternitBusEnabled) {
      useBotAllternitBusStore.getState().connect(agent.id);
    }

    const basePrompt = agent.systemPrompt ?? '';
    const systemPrompt = [basePrompt, vmPrompt, notice].filter(Boolean).join('\n\n');

    const sessionId = await store.createSession({
      name: displayName,
      description: agent.botProfile?.welcomeMessage ?? agent.description,
      sessionMode: 'agent',
      agentId: agent.id,
      agentName: displayName,
      systemPrompt,
      skipBackend: true,
      metadata: {
        isBot: agent.isBot === true,
        botProfile: agent.botProfile,
        starterPrompts: agent.botProfile?.starterPrompts,
        model: agent.model,
        tags: agent.tags,
        category: agent.category,
        trustTier: agent.trustTier,
        agentModeId: options?.modeId,
        originSurface: 'chat',
        connectorBindings: agent.connectorBindings,
        secretRefs: agent.secretRefs,
        resolvedSecrets: secretsResult.secrets,
        missingSecrets: secretsResult.missing,
        resolvedConnectors: connectorsResult.credentials,
        missingConnectors: connectorsResult.missing,
        messagingConfig: agent.messagingConfig,
        identityChannels: agent.identityChannels,
        vmOperator: agent.vmOperator,
        vmSandbox: sandbox ? { id: sandbox.id, provider: sandbox.provider, status: sandbox.status, vncUrl: sandbox.vncUrl } : undefined,
        vmSandboxError: sandboxError,
        vmControlNotice: notice,
        executionPersistence: 'local',
      },
    });

    return { sessionId, sandbox, sandboxError, notice };
  }, []);

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
        // Bot sessions are local-only, so append locally and run through the agent
        // run endpoint instead of the backend chat stream.
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

        store.appendUserMessage(sessionId, {
          id: `user-${Date.now()}`,
          content: taskPrefix,
        });
        const run = await startAgentRun(agent.id, taskPrefix);
        const displayName = agent.botProfile?.displayName ?? agent.name;
        store.appendAssistantMessage(sessionId, {
          id: `assistant-${agent.id}-${Date.now()}`,
          content: run.output || 'No response',
          metadata: {
            agentId: agent.id,
            agentName: displayName,
            isBotResponse: true,
          },
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
