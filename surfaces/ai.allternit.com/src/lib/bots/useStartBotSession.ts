import { useCallback, useState } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { resolveAgentSecrets } from '@/lib/agents/agent-secrets-resolver';
import { resolveAgentConnectors } from '@/lib/agents/agent-connectors-resolver';
import { createSandbox, type Sandbox } from './vm-operator';
import type { Agent } from '../agents/agent.types';

export interface UseStartBotSessionReturn {
  startSession: (agent: Agent) => Promise<string | null>;
  startTask: (agent: Agent, task: string) => Promise<string | null>;
  isStarting: boolean;
  error: string | null;
}

interface BotSessionStartResult {
  sessionId: string;
  sandbox?: Sandbox;
  sandboxError?: string;
}

function buildVMSystemPrompt(vmConfig: NonNullable<Agent['vmOperator']>, sandbox?: Sandbox): string {
  const lines = [
    '## Virtual Computer Operator',
    '',
    `You have access to a sandboxed virtual computer (${vmConfig.provider}).`,
    `Allowed actions: ${(vmConfig.allowedActions?.length ? vmConfig.allowedActions : ['command']).join(', ')}.`,
    `Network policy: ${vmConfig.networkPolicy || 'restricted'}.`,
    `Persistence: ${vmConfig.persistence || 'session'}.`,
  ];

  if (sandbox) {
    lines.push(
      '',
      `A sandbox is already running for this session (id: ${sandbox.id}).`,
      sandbox.vncUrl ? `VNC stream: ${sandbox.vncUrl}` : '',
      'Use the sandbox to run commands, operate browsers, edit files, or stream the desktop when the user asks you to perform actions that require a computer.'
    );
  } else {
    lines.push(
      '',
      'A sandbox will be started automatically when you request a computer-use action.',
      'When the user asks you to perform actions that require a computer, ask for permission if the trust tier requires it, then use the sandbox tools available to you.'
    );
  }

  return lines.filter(Boolean).join('\n');
}

/**
 * Start a packaged-bot session using the existing chat session store.
 *
 * If the bot has a VM operator configured with autoStart, this creates a
 * sandbox before opening the session and injects VM instructions into the
 * system prompt. The resulting sessionId can be passed to
 * `open('chat-agent-session', { sessionId })` so the existing chat surface
 * renders it.
 */
export function useStartBotSession(
  onSessionStarted?: (sessionId: string) => void
): UseStartBotSessionReturn {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prepareBotSession = useCallback(async (agent: Agent): Promise<BotSessionStartResult | null> => {
    const displayName = agent.botProfile?.displayName ?? agent.name;
    const store = useChatSessionStore.getState();

    // Each bot has one persistent chat session. Reuse the latest existing
    // session for this bot instead of creating a new one every time the user
    // clicks the bot in the rail.
    const existingSession = store.sessions.find(
      (s) =>
        s.metadata?.isBot === true &&
        (s.metadata?.agentId === agent.id || s.metadata?.agentName === agent.name),
    );
    if (existingSession) {
      return { sessionId: existingSession.id };
    }

    const [secretsResult, connectorsResult] = await Promise.all([
      resolveAgentSecrets(agent.id, agent.secretRefs),
      resolveAgentConnectors(agent.id, agent.connectorBindings),
    ]);

    let sandbox: Sandbox | undefined;
    let sandboxError: string | undefined;
    const vmConfig = agent.vmOperator;
    const shouldStartSandbox = vmConfig?.enabled === true && vmConfig?.autoStart !== false;

    if (shouldStartSandbox) {
      const result = await createSandbox(agent.id, vmConfig);
      if (result.ok && result.data) {
        sandbox = result.data;
      } else {
        sandboxError = result.error ?? 'Virtual computer failed to start';
      }
    }

    const vmPrompt = vmConfig?.enabled ? buildVMSystemPrompt(vmConfig, sandbox) : '';
    const basePrompt = agent.systemPrompt ?? '';
    const systemPrompt = vmPrompt ? `${basePrompt}\n\n${vmPrompt}` : basePrompt;

    const sessionId = await store.createSession({
      name: displayName,
      description: agent.botProfile?.welcomeMessage ?? agent.description,
      sessionMode: 'agent',
      agentId: agent.id,
      agentName: agent.name,
      systemPrompt,
      metadata: {
        isBot: agent.isBot === true,
        botProfile: agent.botProfile,
        starterPrompts: agent.botProfile?.starterPrompts,
        model: agent.model,
        tags: agent.tags,
        category: agent.category,
        trustTier: agent.trustTier,
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
      },
    });

    return { sessionId, sandbox, sandboxError };
  }, []);

  const startSession = useCallback(
    async (agent: Agent): Promise<string | null> => {
      setIsStarting(true);
      setError(null);

      try {
        const result = await prepareBotSession(agent);
        if (!result) return null;

        const { sessionId, sandboxError } = result;
        const store = useChatSessionStore.getState();
        store.setActiveSession(sessionId);

        if (sandboxError) {
          // Surface the sandbox error as a system notice in the session metadata
          // without blocking the chat from opening.
          setError(sandboxError);
        }

        onSessionStarted?.(sessionId);
        return sessionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start bot session';
        setError(message);
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [prepareBotSession, onSessionStarted]
  );

  const startTask = useCallback(
    async (agent: Agent, task: string): Promise<string | null> => {
      if (!task.trim()) return null;

      setIsStarting(true);
      setError(null);

      try {
        const result = await prepareBotSession(agent);
        if (!result) return null;

        const { sessionId, sandboxError } = result;
        const store = useChatSessionStore.getState();
        store.setActiveSession(sessionId);

        // Send the task as the first message so the bot starts working immediately.
        // A small delay ensures the session is active before streaming begins.
        await new Promise((resolve) => window.setTimeout(resolve, 50));
        const taskPrefix = agent.vmOperator?.enabled
          ? `[Task] ${task.trim()}\n\nIf this task requires a computer, browser, file system, or code execution, use your virtual computer.`
          : task.trim();
        await store.sendMessageStream(sessionId, { text: taskPrefix });

        if (sandboxError) {
          setError(sandboxError);
        }

        onSessionStarted?.(sessionId);
        return sessionId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start bot task';
        setError(message);
        return null;
      } finally {
        setIsStarting(false);
      }
    },
    [prepareBotSession, onSessionStarted]
  );

  return { startSession, startTask, isStarting, error };
}
