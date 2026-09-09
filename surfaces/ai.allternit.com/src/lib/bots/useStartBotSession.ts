import { useCallback, useState } from 'react';
import { useChatSessionStore } from '@/views/chat/ChatSessionStore';
import { resolveAgentSecrets } from '@/lib/agents/agent-secrets-resolver';
import { resolveAgentConnectors } from '@/lib/agents/agent-connectors-resolver';
import { useAgentStore } from '@/lib/agents/agent.store';
import {
  createSandbox,
  getSandboxForAgent,
  isBotDesktopPaused,
  type Sandbox,
} from './vm-operator';
import { useBotAllternitBusStore } from './bot-allternit-bus';
import { injectBotMemoryIntoSystemPrompt } from './bot-memory-context';
import { useBotRosterStore } from './bot-roster.store';
import { isBot } from './bot-profile';
import {
  computeCapabilityEpoch,
  capabilityEpochLine,
  hasEpochDrifted,
  type CapabilityRosterEntry,
} from './bot-capability-epoch';
import { createAgent, getAgent } from '../agents/agent.service';
import type { Agent, CreateAgentInput } from '../agents/agent.types';

export interface UseStartBotSessionReturn {
  startSession: (agent: Agent, options?: { modeId?: string; modelOverride?: string }) => Promise<string | null>;
  startTask: (agent: Agent, task: string, options?: { modeId?: string; modelOverride?: string }) => Promise<string | null>;
  isStarting: boolean;
  error: string | null;
  /** Non-fatal notice, e.g. "Running locally — sync pending" when the
   * backend session could not be created but a local session is live. */
  warning: string | null;
}

interface BotSessionStartResult {
  sessionId: string;
  sandbox?: Sandbox;
  sandboxError?: string;
  notice?: string;
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

function buildIdentityPrompt(displayName: string, capabilityEpoch: string): string {
  return (
    `You are ${displayName}. You must ALWAYS identify yourself as ${displayName}. ` +
    `NEVER say you are Kimi, GPT, Claude, an AI assistant created by another company, or any name other than ${displayName}.\n` +
    capabilityEpochLine(capabilityEpoch)
  );
}

/**
 * Start a packaged-bot session using the existing chat session store.
 *
 * If the bot has a VM operator configured with autoStart, this creates a
 * sandbox before opening the session and injects VM instructions into the
 * system prompt. The resulting sessionId can be passed to
 * `open('bot-chat-session', { sessionId, botId })` so the bot chat surface
 * renders the canonical conversation plus the computer pane.
 */
export function useStartBotSession(
  onSessionStarted?: (sessionId: string, botId: string) => void
): UseStartBotSessionReturn {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

function resolveRuntimeModelId(agent: Agent, modelOverride?: string): string | undefined {
  if (modelOverride) return modelOverride;
  const config = (agent.config ?? {}) as Record<string, unknown>;
  if (typeof config.runtimeModelId === 'string' && config.runtimeModelId) {
    return config.runtimeModelId;
  }
  if (agent.provider && agent.model) {
    return `${agent.provider}/${agent.model}`;
  }
  return undefined;
}

  const prepareBotSession = useCallback(async (agent: Agent, options?: { modeId?: string; modelOverride?: string }): Promise<BotSessionStartResult | null> => {
    const displayName = agent.botProfile?.displayName ?? agent.name;
    const store = useChatSessionStore.getState();
    const runtimeModelId = resolveRuntimeModelId(agent, options?.modelOverride);

    // Capability epoch (spec AD-4): fingerprint the bot's whole capability
    // surface so persona/skill edits are never stranded in a stale session.
    const rosterBots: CapabilityRosterEntry[] = useAgentStore
      .getState()
      .agents.filter(isBot)
      .map((a) => ({ name: a.name, handle: a.botProfile?.handle ?? a.name }));
    const capabilityEpoch = computeCapabilityEpoch(agent, rosterBots);

    // Each bot has one persistent chat session. Reuse the latest existing
    // session for this bot instead of creating a new one every time the user
    // clicks the bot in the rail. Locally-created `temp-…` sessions qualify
    // too — the metadata match is what makes it canonical, not the id shape.
    const existingSession = store.sessions.find(
      (s) =>
        s.metadata?.isBot === true &&
        (s.metadata?.agentId === agent.id || s.metadata?.agentName === agent.name),
    );
    if (existingSession) {
      // Rebuild-once-per-drift: if the stored epoch differs from the freshly
      // computed one, refresh the identity/system-prompt injection so edits
      // to the bot's persona/skills reach the reused session. The rest of
      // the session content (messages, metadata) is left untouched.
      const storedEpoch = existingSession.metadata?.capabilityEpoch;
      if (hasEpochDrifted(storedEpoch, capabilityEpoch)) {
        const basePrompt = agent.systemPrompt ?? '';
        const identityPrompt = buildIdentityPrompt(displayName, capabilityEpoch);
        const notice =
          typeof existingSession.metadata?.vmControlNotice === 'string'
            ? existingSession.metadata.vmControlNotice
            : undefined;
        const systemPrompt = [identityPrompt, basePrompt, notice].filter(Boolean).join('\n\n');
        await store.updateSession(existingSession.id, {
          metadata: {
            ...existingSession.metadata,
            capabilityEpoch,
            systemPrompt,
            botProfile: agent.botProfile,
            starterPrompts: agent.botProfile?.starterPrompts,
          },
        });
      }
      // Persistent computer (spec bot-identity-computer): reopening a bot
      // must land on the same desktop that Create Bot provisioned — resolve
      // by bot_id and refresh the session's computer reference. Never create
      // here; provisioning is part of the atomic create, and autoStart stays
      // off so opening a session never boots a replacement sandbox.
      if (agent.vmOperator?.enabled === true && !isBotDesktopPaused(agent.id)) {
        try {
          const bound = await getSandboxForAgent(agent.id, agent.vmOperator);
          if (
            bound.ok &&
            bound.data &&
            bound.data.id !== existingSession.metadata?.vmComputerId
          ) {
            await store.updateSession(existingSession.id, {
              metadata: {
                ...existingSession.metadata,
                vmSandbox: {
                  id: bound.data.id,
                  provider: bound.data.provider,
                  status: bound.data.status,
                  vncUrl: bound.data.vncUrl,
                },
                vmComputerId: bound.data.id,
                vmOperator: agent.vmOperator,
              },
            });
          }
        } catch {
          // Non-fatal: the session opens without a refreshed computer reference.
        }
      }
      useBotRosterStore.getState().setCanonicalChatId(agent.id, existingSession.id);
      return { sessionId: existingSession.id };
    }

    const [secretsResult, connectorsResult] = await Promise.all([
      resolveAgentSecrets(agent.id, agent.secretRefs),
      resolveAgentConnectors(agent.id, agent.connectorBindings),
    ]);

    let sandbox: Sandbox | undefined;
    let sandboxError: string | undefined;
    let notice: string | undefined;
    const vmConfig = agent.vmOperator;
    const isDesktopPaused = isBotDesktopPaused(agent.id);
    // Resolve the bot's persistent desktop whenever a VM operator is
    // configured. Creating a replacement sandbox is gated on autoStart: bots
    // created through the atomic Create Bot path already have a desktop bound
    // via bot_id (autoStart stays off so opening a session never boots a new
    // one), while older agents with autoStart unset keep get-or-create.
    const shouldResolveSandbox = vmConfig?.enabled === true && !isDesktopPaused;

    if (isDesktopPaused) {
      notice =
        'Desktop is under human control. The bot will resume autonomous computer use after you hand the desktop back.';
    }

    if (shouldResolveSandbox) {
      // Prefer the bot's existing persistent computer so state (toolchain,
      // files, browser sessions) survives across sessions. Only create a new
      // sandbox if none exists yet and the config allows auto-start.
      const existing = await getSandboxForAgent(agent.id, vmConfig);
      if (existing.ok && existing.data) {
        sandbox = existing.data;
      } else if (vmConfig.autoStart !== false) {
        const result = await createSandbox(agent.id, vmConfig);
        if (result.ok && result.data) {
          sandbox = result.data;
        } else {
          sandboxError = result.error ?? 'Virtual computer failed to start';
        }
      }
    }

    const vmPrompt = vmConfig?.enabled ? buildVMSystemPrompt(vmConfig, sandbox) : '';

    // Connect AllternitBus cloud-orchestration messaging when configured
    const allternitBusEnabled = agent.messagingConfig?.photonEnabled === true;
    if (allternitBusEnabled) {
      useBotAllternitBusStore.getState().connect(agent.id);
    }

    const basePrompt = agent.systemPrompt ?? '';
    const identityPrompt = buildIdentityPrompt(displayName, capabilityEpoch);
    const systemPrompt = [identityPrompt, basePrompt, vmPrompt, notice].filter(Boolean).join('\n\n');

    // Best-effort: make sure the API's agents table knows about this bot
    // before createSession runs the surface gate. Bots created while the API
    // was down live only in the localStorage fallback registry, and the gate
    // (403 agent_not_allowed_on_surface) rejects sessions for agents the API
    // has never seen. getAgent swallows 404s and returns an "Unknown Agent"
    // placeholder, which is our not-registered signal. This must never block
    // the offline path — any failure falls through to the local temp-session
    // fallback in createSession.
    try {
      const registered = await getAgent(agent.id);
      const isPlaceholder =
        registered.name === 'Unknown Agent' && !registered.systemPrompt;
      if (isPlaceholder) {
        const input: CreateAgentInput = {
          name: agent.name,
          description: agent.description ?? '',
          type: agent.type,
          model: agent.model,
          provider: agent.provider,
          systemPrompt: agent.systemPrompt,
          avatar: agent.avatar,
          isBot: true,
          botProfile: agent.botProfile,
          allowedSurfaces: ['chat'],
          tags: agent.tags,
          category: agent.category,
          trustTier: agent.trustTier,
        };
        await createAgent(input);
      }
    } catch {
      // Offline or otherwise unavailable — proceed; createSession applies its
      // own local fallback.
    }

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
        botProfile: agent.botProfile,
        starterPrompts: agent.botProfile?.starterPrompts,
        capabilityEpoch,
        model: agent.model,
        runtimeModelId,
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
        vmComputerId: sandbox?.id,
        vmSandboxError: sandboxError,
        vmControlNotice: notice,
      },
    });

    useBotRosterStore.getState().setCanonicalChatId(agent.id, sessionId);
    return { sessionId, sandbox, sandboxError, notice };
  }, []);

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

  const startSession = useCallback(
    async (agent: Agent, options?: { modeId?: string }): Promise<string | null> => {
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
    [prepareBotSession, onSessionStarted, recoverLocalBotSession]
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
        const runtimeModelId = resolveRuntimeModelId(agent, options?.modelOverride);
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
    [prepareBotSession, onSessionStarted, recoverLocalBotSession]
  );

  return { startSession, startTask, isStarting, error, warning };
}
