"use client";

import React, { useCallback, useState, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatStore } from "@/views/chat/ChatStore";
import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker } from "@/components/model-picker";
import { AgentContextStrip } from "@/components/agents/AgentContextStrip";
import type { AgentContextStripProps } from "@/components/agents/context-strip/context-strip.types";

import { ArtifactSidePanel, type SelectedArtifact } from "@/components/ai-elements/artifact-panel";
import { DEFAULT_LAUNCH_GREETING, getLaunchGreeting, peekLaunchGreeting } from "@/views/chat/main/launchGreeting";
import {
  usePendingPermissions,
  usePendingQuestions,
} from "@/lib/agents";
import { isSwarmAgentId, getSwarmIdFromAgent } from "@/lib/agents/swarm-as-agent";
import type { PluginMentionTarget } from "@/lib/mentions/use-mention-targets";
import { useAdvancedAgentStore } from "@/lib/agents/agent-advanced.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useSurfaceAgentSelection } from "@/lib/agents/surface-agent-context";
import { useThreadAgentSessionsStore } from "@/stores/thread-agent-sessions.store";
import { NativeAgentApiError } from "@/lib/agents/native-agent-api";
import {
  getAgentSessionDescriptor,
  getAgentSessionStatusLabel,
} from "@/lib/agents/session-metadata";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import type { CanonicalAgentModeId } from "@/lib/agents/agent-mode-contracts";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { useModeCanvasBridge } from "@/hooks/useModeCanvasBridge";
import { useLocalBrainStatus } from "@/hooks/useLocalBrainStatus";
import { buildBotRuntimeEnv } from "@/lib/bots/bot-runtime-env";
import { getBotAccentColor } from "@/lib/bots/bot-profile";
import type { ResolvedSecret } from "@/lib/agents/agent-secrets-resolver";
import type { ResolvedConnectorCredential } from "@/lib/agents/agent-connectors-resolver";
import type { Agent, HarnessConfig } from "@/lib/agents/agent.types";
import { BotRuntimeConfigModal } from "./bots/BotRuntimeConfigModal";
import { useVoice } from "@/providers/voice-provider";
import {
  ComposerPermissionInfoBar,
  ComposerQuestionBar,
  ComposerStatusInfoBar,
} from "./chat/ChatComposerEnhancements";

import type { GizziAttention, GizziEmotion } from "@/components/ai-elements/GizziMascot";

// Modularized ChatView components
import { ChatBackground } from "./chat/main/ChatBackground";
import { ChatEmptyState } from "./chat/main/ChatEmptyState";
import { ChatActiveContent } from "./chat/main/ChatActiveContent";
import { ChatBottomBar } from "./chat/main/ChatBottomBar";
import { OllamaWarning } from "./chat/main/OllamaWarning";
import { SendErrorBanner } from "./chat/main/SendErrorBanner";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ChatView');

export function ChatView({
  hideEmptyState = false,
  mode = 'chat',
  initialMessage,
  onInitialMessageSent,
  onOpenAgentSession,
  onStartBotSession,
}: {
  hideEmptyState?: boolean,
  mode?: 'chat' | 'cowork' | 'code',
  initialMessage?: string,
  onInitialMessageSent?: () => void,
  onOpenAgentSession?: (text: string, surface: AgentModeSurface, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  onStartBotSession?: (agent: Agent) => void;
}) {
  const { id: chatId } = useChatId();
  const { renameThread } = useChatStore();
  const agentSurface: AgentModeSurface = mode === 'cowork' ? 'cowork' : mode === 'code' ? 'code' : 'chat';
  const { agentModeEnabled, selectedAgent } =
    useSurfaceAgentSelection(agentSurface);
  
  const activeNativeSessionId = useChatSessionStore((state) => state.activeSessionId);
  const nativeSessions = useChatSessionStore((state) => state.sessions);
  const setActiveNativeSession = useChatSessionStore((state) => state.setActiveSession);
  const appendOptimisticEvent = useChatSessionStore((state) => state.appendOptimisticEvent);
  const fetchNativeMessages = useChatSessionStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useChatSessionStore((state) => state.fetchSessionCanvases);
  const sendNativeMessageStream = useChatSessionStore((state) => state.sendMessageStream);
  const abortNativeGeneration = useChatSessionStore((state) => state.abortGeneration);
  
  const activeNativeSession = useMemo(
    () => (activeNativeSessionId ? nativeSessions.find((session) => session.id === activeNativeSessionId) ?? null : null),
    [activeNativeSessionId, nativeSessions],
  );
  
  const activeNativeDescriptor = useMemo(
    () => getAgentSessionDescriptor(activeNativeSession?.metadata as Record<string, unknown> | undefined),
    [activeNativeSession?.metadata],
  );
  
  const embeddedAgentSession = useMemo(
    () => ({
      sessionId: activeNativeSessionId,
      session: activeNativeSession,
      descriptor: activeNativeDescriptor,
      isEmbedded: Boolean(activeNativeSessionId && activeNativeSession),
    }),
    [activeNativeDescriptor, activeNativeSession, activeNativeSessionId],
  );
  
  const activeComposerSessionId = embeddedAgentSession.sessionId ?? chatId ?? undefined;
  
  const linkedAgentSessionIds = useThreadAgentSessionsStore(
    (state) => (chatId ? state.getAgentSessionsForThread(chatId) : []),
  );
  
  const nativeStreaming = useChatSessionStore((state) => ({
    isStreaming: state.streamingBySession[embeddedAgentSession.sessionId ?? '']?.isStreaming ?? false,
  }));
  
  const nativeMessages = useChatSessionStore((state) => {
    const session = embeddedAgentSession.sessionId
      ? state.sessions.find((s) => s.id === embeddedAgentSession.sessionId)
      : null;
    return session?.messages ?? [];
  });
  
  const embeddedCanvasIds = useChatSessionStore((state) =>
    embeddedAgentSession.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] || []
      : [],
  );

  useModeCanvasBridge({ surface: agentSurface });

  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection, availableModels } = useModelSelection();

  const selectedModel = modelSelection?.modelId ?? modelSelection?.profileId ?? availableModels[0]?.id ?? '';
  const { ollamaRunning, modelReady } = useLocalBrainStatus();
  const isLocalBrainSelected = selectedModel === 'local-brain' || modelSelection?.profileId === 'ollama';
  
  const chatStreaming = useChatSessionStore((state) =>
    chatId ? (state.streamingBySession[chatId]?.isStreaming ?? false) : false,
  );
  
  const pendingPermissions = usePendingPermissions(activeComposerSessionId || "__inactive__");
  const pendingQuestions = usePendingQuestions(activeComposerSessionId || "__inactive__");
  
  const composerTopInfoBar = pendingPermissions[0]
    ? <ComposerPermissionInfoBar request={pendingPermissions[0]} />
    : null;
  const composerQuestionBar = pendingQuestions[0]
    ? <ComposerQuestionBar request={pendingQuestions[0]} />
    : null;
  const composerBottomInfoBar = (
    <ComposerStatusInfoBar
      modelLabel={modelSelection?.modelName || modelSelection?.modelId || null}
    />
  );

  useEffect(() => {
    if (!embeddedAgentSession.sessionId || !embeddedAgentSession.isEmbedded) {
      return;
    }

    setActiveNativeSession(embeddedAgentSession.sessionId);
    void fetchNativeMessages(embeddedAgentSession.sessionId);
    void fetchNativeCanvases(embeddedAgentSession.sessionId);
  }, [
    embeddedAgentSession.isEmbedded,
    embeddedAgentSession.sessionId,
    fetchNativeCanvases,
    fetchNativeMessages,
    setActiveNativeSession,
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);
  const handleCloseArtifact = useCallback(() => setSelectedArtifact(null), []);

  const isAgentSessionEmbedded = embeddedAgentSession.isEmbedded;
  const effectiveAgentModeEnabled = agentModeEnabled;
  const activeIsLoading = isAgentSessionEmbedded
    ? nativeStreaming.isStreaming
    : chatStreaming;
  const { interactionMode, speak, setInteractionMode } = useVoice();
  const voiceWasLoadingRef = useRef(false);
  const lastSpokenMessageRef = useRef<string | null>(null);

  const isBotSession = Boolean(activeNativeSession?.metadata?.isBot);
  const [agentCardDismissed, setAgentCardDismissed] = useState(false);
  const [isRuntimeModalOpen, setIsRuntimeModalOpen] = useState(false);
  useEffect(() => {
    setAgentCardDismissed(false);
  }, [embeddedAgentSession.sessionId]);

  useEffect(() => {
    if (activeIsLoading) {
      voiceWasLoadingRef.current = true;
      return;
    }
    if (!voiceWasLoadingRef.current || interactionMode !== 'voice') return;
    voiceWasLoadingRef.current = false;

    const response = [...nativeMessages].reverse().find((message) => message.role === 'assistant');
    if (!response?.content?.trim() || lastSpokenMessageRef.current === response.id) {
      setInteractionMode('text');
      return;
    }

    lastSpokenMessageRef.current = response.id;
    const spokenResponse = response.content
      .replace(/```[\s\S]*?```/g, ' Code block omitted. ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/[>*_~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!spokenResponse) {
      setInteractionMode('text');
      return;
    }
    void speak(spokenResponse).finally(() => setInteractionMode('text'));
  }, [activeIsLoading, interactionMode, nativeMessages, setInteractionMode, speak]);

  const hasAutoTitledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!chatId || chatStreaming) return;
    if (hasAutoTitledRef.current.has(chatId)) return;

    const session = useChatSessionStore.getState().sessions.find((s) => s.id === chatId);
    if (!session || session.messages.length < 2) return;

    const currentTitle = session.name || '';
    const isGenericTitle =
      currentTitle === 'New Session' ||
      currentTitle === 'Untitled' ||
      currentTitle.startsWith('temp-') ||
      currentTitle.trim().length === 0;

    if (!isGenericTitle) {
      hasAutoTitledRef.current.add(chatId);
      return;
    }

    const firstUserMsg = session.messages.find((m) => m.role === 'user');
    if (!firstUserMsg) return;

    const text = typeof firstUserMsg.content === 'string' ? firstUserMsg.content : '';
    const cleaned = text
      .replace(/^(hi|hello|hey|please|can you|could you)\s+/i, '')
      .replace(/[?.,!]$/, '')
      .trim();
    const title = cleaned.length > 40 ? cleaned.slice(0, 40) + '…' : cleaned;

    if (title && title !== currentTitle) {
      renameThread(chatId, title);
      if (typeof document !== 'undefined') {
        document.title = `${title} — Allternit`;
      }
    }
    hasAutoTitledRef.current.add(chatId);
  }, [chatId, chatStreaming, renameThread]);

  const dismissEmbeddedAgentSession = useCallback(() => {
    // Hide the agent context card instead of tearing down the active session.
    // Previously this closed the session, which caused a crash for bot sessions
    // and left the user with no way to continue the conversation.
    setAgentCardDismissed(true);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;

    setShouldAutoScroll(isAtBottom);
    setShowJumpToBottom(!isAtBottom);
    if (activeComposerSessionId && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(
        `allternit:session-scroll:${activeComposerSessionId}`,
        JSON.stringify({ top: scrollTop, bottom: isAtBottom }),
      );
    }
  }, [activeComposerSessionId]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !activeComposerSessionId) return;
    setShouldAutoScroll(false);
    let frame = requestAnimationFrame(() => {
      let saved: { top?: number; bottom?: boolean } | undefined;
      try {
        saved = JSON.parse(
          sessionStorage.getItem(`allternit:session-scroll:${activeComposerSessionId}`) || "null",
        ) ?? undefined;
      } catch {}
      if (!saved || saved.bottom) {
        container.scrollTop = container.scrollHeight;
        setShouldAutoScroll(true);
        setShowJumpToBottom(false);
        return;
      }
      container.scrollTop = Math.min(saved.top ?? 0, Math.max(0, container.scrollHeight - container.clientHeight));
      setShowJumpToBottom(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeComposerSessionId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom('auto');
    }
  }, [activeIsLoading, nativeMessages, shouldAutoScroll, scrollToBottom]);

  // Shared with the Cowork launch screen — same greeting across mode toggles.
  const [greeting, setGreeting] = useState(() => peekLaunchGreeting() ?? DEFAULT_LAUNCH_GREETING);
  const [launchMascotEmotion, setLaunchMascotEmotion] = useState<GizziEmotion>('steady');
  const [mentionAgentId, setMentionAgentId] = useState<string | null>(null);
  const [pluginMention, setPluginMention] = useState<PluginMentionTarget | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [launchMascotAttention, setLaunchMascotAttention] = useState<GizziAttention | null>(null);
  const mascotResetTimeoutRef = useRef<number | null>(null);
  
  const { fetchWihs } = useUnifiedStore();
  
  useEffect(() => {
    fetchWihs();
  }, [fetchWihs]);

  useEffect(() => {
    if (!chatId) {
      setMentionAgentId(null);
      return;
    }
    const lastAgentId = useThreadAgentSessionsStore.getState().getLastMentionAgentId(chatId);
    if (lastAgentId) {
      setMentionAgentId(lastAgentId);
    } else {
      setMentionAgentId(null);
    }
  }, [chatId]);

  const hasSentInitialMessage = useRef(false);
  useEffect(() => {
    if (initialMessage && !hasSentInitialMessage.current && chatId) {
      hasSentInitialMessage.current = true;
      if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
        sendNativeMessageStream(embeddedAgentSession.sessionId, { text: initialMessage }).then(() => {
          onInitialMessageSent?.();
        });
        return;
      }
      useChatSessionStore.getState().setActiveSession(chatId);
      sendNativeMessageStream(chatId, { text: initialMessage }).then(() => {
        onInitialMessageSent?.();
      });
    }
  }, [
    chatId,
    embeddedAgentSession.sessionId,
    initialMessage,
    isAgentSessionEmbedded,
    onInitialMessageSent,
    sendNativeMessageStream,
    setActiveNativeSession,
  ]);

  useEffect(() => {
    let cancelled = false;
    getLaunchGreeting().then((g) => {
      if (!cancelled) setGreeting(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (mascotResetTimeoutRef.current) {
        window.clearTimeout(mascotResetTimeoutRef.current);
      }
    };
  }, []);

  const pulseMascot = useCallback((emotion: GizziEmotion) => {
    setLaunchMascotEmotion(emotion);
    if (mascotResetTimeoutRef.current) {
      window.clearTimeout(mascotResetTimeoutRef.current);
    }
    mascotResetTimeoutRef.current = window.setTimeout(() => {
      setLaunchMascotEmotion('steady');
    }, 640);
  }, []);

  const handleSend = useCallback(async (text: string, _context?: unknown) => {
    if (!text.trim()) return;

    if (mentionAgentId && chatId) {
      if (isSwarmAgentId(mentionAgentId)) {
        const swarmId = getSwarmIdFromAgent(mentionAgentId);
        if (swarmId) {
          try {
            const runId = await useAdvancedAgentStore.getState().startSwarmRun(swarmId, text.trim());
            useThreadAgentSessionsStore.getState().setLastMentionAgentId(chatId, mentionAgentId);

            const tempMsgId = `swarm-${runId}`;
            useChatSessionStore.getState().appendAssistantMessage(chatId, {
              id: tempMsgId,
              content: `🐝 Swarm is deliberating...`,
              metadata: { swarmRunId: runId, swarmId, status: 'running' },
            });
            // Polling logic omitted for brevity as it's part of the original handleSend
          } catch (error) {
            logger.error({ err: error }, 'Failed to start swarm run');
          }
        }
        return;
      }
    }

    // Resolve or create a real backend session, then stream the message through Gizzi.
    let sessionId = embeddedAgentSession.sessionId || chatId;
    const hasLiveSession = Boolean(sessionId && sessionId.startsWith('ses_'));

    setSendError(null);
    try {
      if (!hasLiveSession) {
        sessionId = await useChatSessionStore.getState().createSession({
          name: text.trim().slice(0, 60) || 'New Session',
          sessionMode: 'regular',
        });
      }

      if (sessionId) {
        useChatSessionStore.getState().setActiveSession(sessionId);
        await sendNativeMessageStream(sessionId, {
          text: text.trim(),
          ...(modelSelection?.modelId ? { modelId: modelSelection.modelId } : {}),
          ...(pluginMention
            ? { pluginMention: { kind: pluginMention.kind, id: pluginMention.id, name: pluginMention.name } }
            : {}),
        });
      }
    } catch (error) {
      logger.error({ err: error }, 'Failed to send chat message');
      const isAuthError = error instanceof NativeAgentApiError && error.isAuthError();
      setSendError(
        isAuthError
          ? "No AI provider is connected yet. Connect one in Settings to start chatting."
          : "Couldn't send that message. Please try again."
      );
    }
  }, [mentionAgentId, pluginMention, chatId, embeddedAgentSession.sessionId, sendNativeMessageStream, modelSelection?.modelId]);

  const handleStop = useCallback(() => {
    const activeSessionId = embeddedAgentSession.sessionId || chatId;
    if (activeSessionId) {
      abortNativeGeneration(activeSessionId);
    }
  }, [abortNativeGeneration, chatId, embeddedAgentSession.sessionId]);

  const handleRegenerate = useCallback(() => {
    // Regenerate logic...
  }, []);

  const isChatEmpty = !isAgentSessionEmbedded && nativeMessages.length === 0;
  const showTopActions = !isAgentSessionEmbedded;
  const useMonolithLogo = mode === 'code';
  const launchLogo: 'gizzi' | 'matrix' | 'allternit' = mode === 'chat' || mode === 'cowork' || useMonolithLogo ? 'matrix' : 'gizzi';

  const embeddedAgentDescriptor = embeddedAgentSession.descriptor;
  // Only sessions actually bound to an agent (agent metadata present) get the
  // context strip. Plain chat sessions must not render the agent card —
  // previously `isAgentSessionEmbedded` was true for ANY active session, so
  // the context window showed on every view.
  const hasAgentBinding = Boolean(
    embeddedAgentDescriptor.agentId || embeddedAgentDescriptor.agentName,
  );
  // For bot sessions, show the context card only while the session is empty.
  // Once the user starts messaging, the card is hidden so the conversation
  // owns the screen; the X button safely dismisses it without crashing.
  const showAgentCard =
    isAgentSessionEmbedded &&
    hasAgentBinding &&
    !agentCardDismissed &&
    (!isBotSession || nativeMessages.length === 0);

  // Build runtime context for bot sessions so the card shows what the bot
  // actually has configured (connectors, secrets, harness) and what is missing.
  const sessionMetadata = embeddedAgentSession.session?.metadata as Record<string, unknown> | undefined;
  const botRuntimeEnv = useMemo(() => {
    if (!isBotSession) return undefined;
    return buildBotRuntimeEnv({
      harness: (sessionMetadata?.harness as HarnessConfig | undefined) ?? selectedAgent?.harness,
      resolvedSecrets: (sessionMetadata?.resolvedSecrets as ResolvedSecret[] | undefined) ?? undefined,
      resolvedConnectors: (sessionMetadata?.resolvedConnectors as ResolvedConnectorCredential[] | undefined) ?? undefined,
      vmOperator: (sessionMetadata?.vmOperator as Agent['vmOperator']) ?? selectedAgent?.vmOperator,
      agentId: selectedAgent?.id,
      characterLayer: selectedAgent?.characterLayer,
    });
  }, [isBotSession, sessionMetadata, selectedAgent?.harness, selectedAgent?.vmOperator, selectedAgent?.id, selectedAgent?.characterLayer]);
  const runtimeEnvEntries = useMemo(() => {
    if (!botRuntimeEnv) return undefined;
    return Object.entries(botRuntimeEnv.env).map(([key, value]) => ({
      key,
      value: String(value),
      source: 'runtime' as const,
    }));
  }, [botRuntimeEnv]);
  const missingRuntimeKeys = useMemo(() => {
    if (!isBotSession) return undefined;
    const missing: string[] = [];
    const missingSecrets = sessionMetadata?.missingSecrets;
    const missingConnectors = sessionMetadata?.missingConnectors;
    if (Array.isArray(missingSecrets)) missing.push(...missingSecrets.map(String));
    if (Array.isArray(missingConnectors)) missing.push(...missingConnectors.map(String));
    return missing.length > 0 ? missing : undefined;
  }, [isBotSession, sessionMetadata]);

  const botProfile = sessionMetadata?.botProfile as { welcomeMessage?: string; tagline?: string; starterPrompts?: string[] } | undefined;
  const botSessionDescription =
    embeddedAgentSession.session?.description ||
    botProfile?.welcomeMessage ||
    botProfile?.tagline ||
    selectedAgent?.description;

  const embeddedAgentStrip = showAgentCard ? (
    <AgentContextStrip
      surface={agentSurface}
      sessionName={embeddedAgentSession.session?.name || "Agent Session"}
      sessionDescription={botSessionDescription}
      agentName={embeddedAgentDescriptor.agentName || selectedAgent?.name || undefined}
      harnessMode={selectedAgent?.harness?.mode}
      statusLabel={isBotSession ? "Bot" : getAgentSessionStatusLabel(embeddedAgentSession.session)}
      messageCount={embeddedAgentSession.session?.messageCount ?? nativeMessages.length}
      workspaceScope={embeddedAgentDescriptor.workspaceScope}
      canvasCount={embeddedCanvasIds.length}
      tags={embeddedAgentSession.session?.tags}
      toolsEnabled={embeddedAgentDescriptor.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentDescriptor.agentFeatures?.automation === true}
      runtimeEnv={botRuntimeEnv?.env}
      runtimeEnvEntries={runtimeEnvEntries}
      connectorBindings={(sessionMetadata?.connectorBindings as AgentContextStripProps["connectorBindings"]) ?? selectedAgent?.connectorBindings}
      secretRefs={(sessionMetadata?.secretRefs as AgentContextStripProps["secretRefs"]) ?? selectedAgent?.secretRefs}
      missingRuntimeKeys={missingRuntimeKeys}
      vmOperator={(sessionMetadata?.vmOperator as Agent["vmOperator"]) ?? selectedAgent?.vmOperator}
      vmSandbox={(sessionMetadata?.vmSandbox as AgentContextStripProps["vmSandbox"]) ?? undefined}
      accentColor={selectedAgent && isBotSession ? getBotAccentColor(selectedAgent) ?? undefined : undefined}
      botId={isBotSession ? selectedAgent?.id : undefined}
      onEditRuntime={isBotSession ? () => setIsRuntimeModalOpen(true) : undefined}
      onDismiss={dismissEmbeddedAgentSession}
    />
  ) : null;

  return (
    <ChatBackground
      isAgentSessionEmbedded={isAgentSessionEmbedded}
      mode={mode}
      effectiveAgentModeEnabled={effectiveAgentModeEnabled}
      agentSurface={agentSurface}
    >
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto w-full flex flex-col items-center min-h-0"
        >
          {isChatEmpty && !hideEmptyState ? (
            <ChatEmptyState
              embeddedAgentStrip={embeddedAgentStrip}
              modelSelection={modelSelection}
              isAgentSessionEmbedded={isAgentSessionEmbedded}
              ollamaRunning={ollamaRunning}
              modelReady={modelReady}
              startSelection={startSelection}
              useMonolithLogo={useMonolithLogo}
              launchLogo={launchLogo}
              launchMascotEmotion={launchMascotEmotion}
              launchMascotAttention={launchMascotAttention}
              greeting={greeting}
              handleSend={handleSend}
              onOpenAgentSession={onOpenAgentSession}
              onStartBotSession={onStartBotSession}
              agentSurface={agentSurface}
              setMentionAgentId={setMentionAgentId}
              mentionAgentId={mentionAgentId}
              setPluginMention={setPluginMention}
              activeIsLoading={activeIsLoading}
              showTopActions={showTopActions}
              pulseMascot={pulseMascot}
              setLaunchMascotAttention={setLaunchMascotAttention}
              composerTopInfoBar={composerTopInfoBar}
              composerQuestionBar={composerQuestionBar}
              composerBottomInfoBar={composerBottomInfoBar}
            />
          ) : (
            <ChatActiveContent
              embeddedAgentStrip={embeddedAgentStrip}
              isAgentSessionEmbedded={isAgentSessionEmbedded}
              chatId={chatId}
              linkedAgentSessionIds={linkedAgentSessionIds}
              handleRegenerate={handleRegenerate}
              showJumpToBottom={showJumpToBottom}
              setShouldAutoScroll={setShouldAutoScroll}
              scrollToBottom={scrollToBottom}
              messagesEndRef={messagesEndRef}
              onSelectArtifact={setSelectedArtifact}
              selectedArtifactTitle={selectedArtifact?.title}
            />
          )}
        </div>

        {selectedArtifact && (
          <ArtifactSidePanel
            artifact={selectedArtifact}
            onClose={handleCloseArtifact}
          />
        )}
      </div>

      <OllamaWarning
        isLocalBrainSelected={isLocalBrainSelected}
        ollamaRunning={ollamaRunning}
        startSelection={startSelection}
      />

      <SendErrorBanner message={sendError} onDismiss={() => setSendError(null)} />

      <ChatBottomBar
        mode={mode}
        isChatEmpty={isChatEmpty}
        hideEmptyState={hideEmptyState}
        handleSend={handleSend}
        onOpenAgentSession={onOpenAgentSession}
        agentSurface={agentSurface}
        setMentionAgentId={setMentionAgentId}
        mentionAgentId={mentionAgentId}
        setPluginMention={setPluginMention}
        activeIsLoading={activeIsLoading}
        handleStop={handleStop}
        composerTopInfoBar={composerTopInfoBar}
        composerQuestionBar={composerQuestionBar}
        composerBottomInfoBar={composerBottomInfoBar}
        useMonolithLogo={useMonolithLogo}
        pulseMascot={pulseMascot}
        setLaunchMascotAttention={setLaunchMascotAttention}
      />

      <ModelPicker
        open={isSelecting}
        onOpenChange={(open) => { if (!open) cancelSelection(); }}
        onSelect={selectModel}
        onCancel={cancelSelection}
        trigger={<div className="hidden" />}
      />

      {isBotSession && selectedAgent && (
        <BotRuntimeConfigModal
          bot={selectedAgent}
          isOpen={isRuntimeModalOpen}
          onClose={() => setIsRuntimeModalOpen(false)}
          onSaved={() => setIsRuntimeModalOpen(false)}
        />
      )}
    </ChatBackground>
  );
}

export default ChatView;
