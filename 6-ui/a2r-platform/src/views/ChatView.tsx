import React, { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatStore } from "@/views/chat/ChatStore";
import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker } from "@/components/model-picker";
import { AgentContextStrip } from "@/components/agents/AgentContextStrip";
import {
  Sparkles,
  CalendarClock,
  Image,
  FileText,
  Plus,
  ArrowUp,
  ArrowDown
} from "lucide-react";

import { ChatComposer } from "@/views/chat/ChatComposer";
export { ChatComposer as NewChatInput }; // EXPORT FOR LEGACY IMPORTS

import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { GizziMascot, type GizziAttention, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { StreamingChatComposer } from "@/components/chat/StreamingChatComposer";
import { ArtifactSidePanel, type SelectedArtifact } from "@/components/ai-elements/artifact-panel";
import {
  useRustStreamAdapter,
  type ChatMessage as StreamChatMessage,
} from "@/lib/ai/rust-stream-adapter";
import { getSession } from "@/lib/auth-browser";
import {
  mapNativeMessagesToStreamMessages,
  useAgentStore,
  useEmbeddedAgentSession,
  useEmbeddedAgentSessionStore,
  useNativeAgentStore,
} from "@/lib/agents";
import {
  buildAgentConversationContext,
  useSurfaceAgentSelection,
} from "@/lib/agents/surface-agent-context";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { AgentModeBackdrop } from "./chat/agentModeSurfaceTheme";

// Cowork mode components
import { CoworkTranscript } from "./cowork/CoworkTranscript";

// ============================================================================
// Theme Colors (warm dark brown to match Claude.ai)
// ============================================================================
const THEME = {
  bg: '#2B2520',
  bgGradient: 'linear-gradient(to top, #2B2520 60%, transparent)',
  bgInput: '#352F29',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  borderSubtle: 'rgba(255,255,255,0.06)',
};

// ============================================================================
// Special Text Animations
// ============================================================================

const TypingText = ({ text, delay = 0, speed = 0.05, className = "", style = {} }: { text: string, delay?: number, speed?: number, className?: string, style?: any }) => {
  const letters = text.split("");
  return (
    <span className={className} style={style}>
      {letters.map((char, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.01,
            delay: delay + i * speed,
            ease: "linear"
          }}
          style={char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {}}
        >
          {char}
        </motion.span>
      ))}
    </span>
  );
};

const StaggeredReveal = ({ text, delay = 0, className = "", style = {} }: { text: string, delay?: number, className?: string, style?: any }) => {
  const words = text.split(" ");
  return (
    <span className={className} style={{ ...style, display: 'inline-block' }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          {word.split("").map((char, j) => (
            <motion.span
              key={j}
              initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.4,
                delay: delay + (i * 0.1) + (j * 0.03),
                ease: [0.2, 0.65, 0.3, 0.9]
              }}
              style={{
                display: 'inline-block',
                ...(char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {})
              }}
            >
              {char}
            </motion.span>
          ))}
          {i < words.length - 1 && <span> </span>}
        </span>
      ))}
    </span>
  );
};

const MODELS = [
  { id: "big-pickle", name: "Big Pickle (Free)", provider: "opencode" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
] as const;

export function ChatView({ 
  hideEmptyState = false, 
  mode = 'chat',
  initialMessage,
  onInitialMessageSent
}: { 
  hideEmptyState?: boolean, 
  mode?: 'chat' | 'cowork' | 'code',
  initialMessage?: string,
  onInitialMessageSent?: () => void
}) {
  const { id: chatId, isPersisted } = useChatId();
  const { createThread, threads, activeThreadId } = useChatStore();
  const agentSurface: AgentModeSurface = mode === 'cowork' ? 'cowork' : mode === 'code' ? 'code' : 'chat';
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection(agentSurface);
  const embeddedAgentSession = useEmbeddedAgentSession(agentSurface);
  const clearEmbeddedAgentSession = useEmbeddedAgentSessionStore(
    (state) => state.clearSurfaceSession,
  );
  const setActiveNativeSession = useNativeAgentStore(
    (state) => state.setActiveSession,
  );
  const fetchNativeMessages = useNativeAgentStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useNativeAgentStore(
    (state) => state.fetchSessionCanvases,
  );
  const sendNativeMessageStream = useNativeAgentStore(
    (state) => state.sendMessageStream,
  );
  const abortNativeGeneration = useNativeAgentStore(
    (state) => state.abortGeneration,
  );
  const nativeStreaming = useNativeAgentStore((state) => state.streaming);
  const nativeMessages = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.messages[embeddedAgentSession.sessionId] || []
      : [],
  );
  const embeddedCanvasIds = useNativeAgentStore((state) =>
    embeddedAgentSession.sessionId
      ? state.sessionCanvases[embeddedAgentSession.sessionId] || []
      : [],
  );
  const agents = useAgentStore((state) => state.agents);
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();

  const selectedModel = modelSelection?.profileId ?? MODELS[0].id;
  const runtimeModelId = modelSelection?.modelId;

  const {
    messages,
    isLoading,
    submitMessage,
    regenerate,
    stop,
  } = useRustStreamAdapter({
    onError: (error) => console.error("Chat error:", error),
  });

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

  // Auto-scroll to bottom on new messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  // Artifact side panel
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);
  const handleSelectArtifact = useCallback((artifact: SelectedArtifact) => {
    setSelectedArtifact((prev) =>
      prev?.title === artifact.title ? null : artifact
    );
  }, []);
  const handleCloseArtifact = useCallback(() => setSelectedArtifact(null), []);
  const agentsById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent])),
    [agents],
  );
  const embeddedStreamMessages = useMemo(
    () => mapNativeMessagesToStreamMessages(nativeMessages),
    [nativeMessages],
  );
  const activeMessages: StreamChatMessage[] = embeddedAgentSession.isEmbedded
    ? embeddedStreamMessages
    : messages;
  const isAgentSessionEmbedded = embeddedAgentSession.isEmbedded;
  const effectiveAgentModeEnabled = agentModeEnabled || isAgentSessionEmbedded;
  const activeIsLoading = isAgentSessionEmbedded
    ? nativeStreaming.isStreaming
    : isLoading;

  // Detect user scroll to toggle autoscroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;

    setShouldAutoScroll(isAtBottom);
    // Show jump button whenever user has scrolled up — not just during loading
    setShowJumpToBottom(!isAtBottom);
  }, []);

  // Scroll to bottom helper
  // During active streaming use instant scroll so it keeps up with fast token delivery.
  // 'smooth' is reserved for the manual "Jump to present" tap.
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    if (shouldAutoScroll) {
      scrollToBottom('auto');
    }
  }, [activeIsLoading, activeMessages, shouldAutoScroll, scrollToBottom]);

  const [greeting, setGreeting] = useState({
    title: "A2R & Coffee",
    tagline: "The Intelligent Workspace",
    effectType: "reveal" as "typing" | "reveal"
  });
  const [launchMascotEmotion, setLaunchMascotEmotion] = useState<GizziEmotion>('steady');
  const [launchMascotAttention, setLaunchMascotAttention] = useState<GizziAttention | null>(null);
  const mascotResetTimeoutRef = useRef<number | null>(null);

  // Send initial message if provided (for Cowork mode from launchpad)
  const hasSentInitialMessage = useRef(false);
  useEffect(() => {
    if (initialMessage && !hasSentInitialMessage.current && chatId) {
      hasSentInitialMessage.current = true;
      if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
        sendNativeMessageStream(embeddedAgentSession.sessionId, initialMessage).then(() => {
          onInitialMessageSent?.();
        });
        return;
      }
      const initialAgentContext = buildAgentConversationContext({
        agentModeEnabled,
        agentId: selectedAgentId,
        agent: selectedAgent,
        chatId,
      });
      submitMessage({
        chatId,
        message: initialMessage,
        modelId: selectedModel,
        runtimeModelId,
        ...initialAgentContext,
      }).then(() => {
        onInitialMessageSent?.();
      });
    }
  }, [
    agentModeEnabled,
    chatId,
    embeddedAgentSession.sessionId,
    initialMessage,
    isAgentSessionEmbedded,
    onInitialMessageSent,
    runtimeModelId,
    sendNativeMessageStream,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    submitMessage,
  ]);

  useEffect(() => {
    async function selectGreeting() {
      const session = await getSession();
      const userName = session?.name || "Eoj";

      const titles = [
        "A2R & Coffee",
        `Welcome back, ${userName}`,
        "Ready to Build?",
        "The Architect's Den",
        "A2Rchitech",
        "Good to see you, Architect",
        "Creative Control",
        "Morning Ritual"
      ];

      const taglines = [
        "The Intelligent Workspace",
        "Your Architecture, Amplified",
        "Coffee, Code, and Creativity",
        "Building the Future, One Block at a Time",
        "Where Logic Meets Elegance",
        "Precision in Every Interaction",
        "Designing Better Workflows",
        "Stay curious, stay creative."
      ];

      const randomTitle = titles[Math.floor(Math.random() * titles.length)];
      const randomTagline = taglines[Math.floor(Math.random() * taglines.length)];
      const randomEffect = Math.random() > 0.5 ? "typing" : "reveal";

      setGreeting({
        title: randomTitle,
        tagline: randomTagline,
        effectType: randomEffect
      });
    }
    selectGreeting();
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

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      await sendNativeMessageStream(embeddedAgentSession.sessionId, text.trim());
      return;
    }

    if (!chatId) return;

    let effectiveChatId = chatId;
    const activeThread = threads.find((thread) => thread.id === activeThreadId);
    const isEphemeralThread =
      !isPersisted || chatId.startsWith("temp-") || chatId === "welcome";
    const activeThreadAgent =
      activeThread?.agentId ? agentsById.get(activeThread.agentId) ?? null : null;
    const wantsAgentConversation = agentModeEnabled;

    if (wantsAgentConversation && !selectedAgentId) {
      console.warn("[ChatView] Agent mode is enabled but no agent is selected");
      return;
    }

    const shouldSpawnAgentThread =
      wantsAgentConversation &&
      (!activeThread ||
        activeThread.mode !== "agent" ||
        activeThread.agentId !== selectedAgentId ||
        isEphemeralThread);
    const shouldSpawnLlmThread =
      !wantsAgentConversation && (!activeThread || activeThread.mode === "agent" || isEphemeralThread);

    if (shouldSpawnAgentThread) {
      try {
        const newId = await createThread(
          text.slice(0, 40),
          undefined,
          "agent",
          selectedAgentId,
        );
        if (newId) effectiveChatId = newId;
      } catch (err) {
        console.error("Failed to create agent thread:", err);
      }
    } else if (shouldSpawnLlmThread) {
      try {
        const newId = await createThread(text.slice(0, 40), undefined, "llm");
        if (newId) effectiveChatId = newId;
      } catch (err) {
        console.error("Failed to create thread:", err);
      }
    }

    const continueActiveAgentThread =
      !shouldSpawnAgentThread && !shouldSpawnLlmThread && activeThread?.mode === "agent";
    const effectiveAgentMode = shouldSpawnAgentThread || continueActiveAgentThread;
    const effectiveAgentId = shouldSpawnAgentThread
      ? selectedAgentId
      : continueActiveAgentThread
        ? activeThread.agentId
        : null;
    const agentContext = buildAgentConversationContext({
      agentModeEnabled: effectiveAgentMode,
      agentId: effectiveAgentId,
      agent: shouldSpawnAgentThread
        ? selectedAgent
        : continueActiveAgentThread
          ? activeThreadAgent
          : null,
      chatId: effectiveChatId,
    });

    await submitMessage({
      chatId: effectiveChatId,
      message: text,
      modelId: selectedModel,
      runtimeModelId,
      ...agentContext,
    });
  }, [
    activeThreadId,
    agentModeEnabled,
    agentsById,
    chatId,
    createThread,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    isPersisted,
    runtimeModelId,
    sendNativeMessageStream,
    selectedAgent,
    selectedAgentId,
    selectedModel,
    setActiveNativeSession,
    submitMessage,
    threads,
  ]);

  const handleRegenerate = useCallback(() => {
    const lastUserMsg = [...activeMessages].reverse().find((m) => m.role === "user");

    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      if (lastUserMsg && typeof lastUserMsg.content === "string") {
        setActiveNativeSession(embeddedAgentSession.sessionId);
        void sendNativeMessageStream(
          embeddedAgentSession.sessionId,
          lastUserMsg.content,
        );
      }
      return;
    }

    const activeThread = threads.find((thread) => thread.id === activeThreadId);
    const activeThreadAgent =
      activeThread?.agentId ? agentsById.get(activeThread.agentId) ?? null : null;
    if (lastUserMsg && typeof lastUserMsg.content === "string") {
      const agentContext = buildAgentConversationContext({
        agentModeEnabled: activeThread?.mode === "agent",
        agentId: activeThread?.agentId,
        agent: activeThreadAgent,
        chatId,
      });
      regenerate(lastUserMsg.content, {
        chatId: chatId ?? "",
        modelId: selectedModel,
        runtimeModelId,
        ...agentContext,
      });
    }
  }, [
    activeThreadId,
    activeMessages,
    agentsById,
    chatId,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    regenerate,
    runtimeModelId,
    sendNativeMessageStream,
    selectedModel,
    setActiveNativeSession,
    threads,
  ]);

  const handleStop = useCallback(() => {
    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      void abortNativeGeneration(embeddedAgentSession.sessionId);
      return;
    }

    stop();
  }, [
    abortNativeGeneration,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    stop,
  ]);

  if (!chatId && !isAgentSessionEmbedded) return null;

  const isChatEmpty = activeMessages.length === 0;
  const useMonolithLogo = mode === 'chat';

  // Don't hide entirely in cowork mode - we need the input bar visible
  if (isChatEmpty && hideEmptyState && mode !== 'cowork') return null;

  const showTopActions = mode === 'chat';
  const embeddedAgentDescriptor = embeddedAgentSession.descriptor;
  const embeddedAgentStrip = isAgentSessionEmbedded ? (
    <AgentContextStrip
      surface={agentSurface}
      sessionName={embeddedAgentSession.session?.name || "Agent Session"}
      sessionDescription={embeddedAgentSession.session?.description}
      agentName={embeddedAgentDescriptor.agentName || selectedAgent?.name || undefined}
      statusLabel={
        embeddedAgentSession.session?.metadata?.a2r_local_draft === true
          ? "Local Draft"
          : embeddedAgentSession.session?.isActive
            ? "Live"
            : "Paused"
      }
      messageCount={
        embeddedAgentSession.session?.messageCount ?? activeMessages.length
      }
      workspaceScope={embeddedAgentDescriptor.workspaceScope}
      canvasCount={embeddedCanvasIds.length}
      tags={embeddedAgentSession.session?.tags}
      localDraft={embeddedAgentSession.session?.metadata?.a2r_local_draft === true}
      toolsEnabled={embeddedAgentDescriptor.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentDescriptor.agentFeatures?.automation === true}
      onDismiss={() => clearEmbeddedAgentSession(agentSurface)}
    />
  ) : null;

  // Get theme colors for embedded agent session styling
  const getEmbeddedChatBackground = () => {
    if (!isAgentSessionEmbedded) {
      return hideEmptyState || mode === 'cowork' ? 'transparent' : THEME.bg;
    }
    // Branded embedded session styling for chat surface (amber tones)
    return 'radial-gradient(circle at top right, rgba(212,149,106,0.08), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 18%)';
  };

  const getEmbeddedChatBoxShadow = () => {
    if (!isAgentSessionEmbedded) return 'none';
    return 'inset 0 0 0 1px rgba(212,149,106,0.08), inset 0 24px 120px rgba(212,149,106,0.04)';
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      /* Cowork mode inherits global background, Chat mode uses theme bg */
      background: getEmbeddedChatBackground(),
      position: 'relative',
      overflow: 'hidden',
      isolation: 'isolate',
      boxShadow: getEmbeddedChatBoxShadow(),
    }}>
      <AgentModeBackdrop
        active={effectiveAgentModeEnabled}
        surface={agentSurface}
        dataTestId={`agent-mode-${agentSurface}-backdrop`}
      />

      {/* 1. Content row: message scroll + optional artifact panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

      {/* Message scroll list */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {isChatEmpty && !hideEmptyState ? (
          /* ── BRANDED EMPTY STATE ── */
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            maxWidth: '640px',
            minHeight: '100%',
            padding: '10vh 24px 80px 24px',
            boxSizing: 'border-box'
          }}>
            {embeddedAgentStrip}
            {/* Interactive Logo Section */}
            <div style={{ marginBottom: '64px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                className="relative group cursor-pointer mb-12"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  padding: '20px'
                }}
              >
                <div className="absolute inset-0 bg-[#D4956A]/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <div
                  className="relative z-10 transition-transform duration-500 group-hover:scale-110"
                >
                  {useMonolithLogo ? (
                    <MatrixLogo state="idle" size={84} />
                  ) : (
                    <GizziMascot
                      size={76}
                      emotion={launchMascotEmotion}
                      attention={launchMascotAttention}
                    />
                  )}
                </div>
              </div>

              <h1 style={{
                fontSize: '48px',
                fontWeight: 500,
                color: THEME.textPrimary,
                margin: '0 0 24px 0',
                fontFamily: 'Georgia, serif',
                letterSpacing: '-0.02em',
                minHeight: '60px'
              }}>
                {greeting.effectType === "typing" ? (
                  <TypingText text={greeting.title} speed={0.08} />
                ) : (
                  <StaggeredReveal text={greeting.title} />
                )}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
                <div style={{ height: '1px', width: '32px', background: THEME.borderSubtle }} />
                <div style={{
                  fontSize: '14px',
                  color: THEME.textSecondary,
                  margin: 0,
                  textTransform: 'uppercase',
                  letterSpacing: '0.2em',
                  fontWeight: 600,
                  minWidth: '200px'
                }}>
                  {greeting.effectType === "typing" ? (
                    <TypingText text={greeting.tagline} delay={1.5} speed={0.04} />
                  ) : (
                    <StaggeredReveal text={greeting.tagline} delay={0.8} />
                  )}
                </div>
                <div style={{ height: '1px', width: '32px', background: THEME.borderSubtle }} />
              </div>
            </div>

            {/* Centered Composer */}
            <div style={{ width: '100%', marginBottom: '64px' }}>
              <ChatComposer
                onSend={handleSend}
                isLoading={activeIsLoading}
                placeholder="What's brewing today?"
                variant="large"
                selectedModel={selectedModel}
                selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
                onOpenModelPicker={startSelection}
                onSelectModel={selectModel}
                showTopActions={showTopActions}
                onInteractionSignal={useMonolithLogo ? undefined : pulseMascot}
                onAttentionChange={useMonolithLogo ? undefined : setLaunchMascotAttention}
                agentModeSurface={agentSurface}
              />
            </div>

            {/* Task List */}
            <div style={{ width: '100%', borderTop: `1px solid ${THEME.borderSubtle}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '24px 8px 16px 8px', opacity: 0.4 }}>
                <Plus size={14} color={THEME.textPrimary} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: THEME.textPrimary }}>Pick a task, any task</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                {[
                  { icon: <CalendarClock size={20} />, label: "Optimize my week" },
                  { icon: <Image size={20} />, label: "Organize my screenshots" },
                  { icon: <FileText size={20} />, label: "Find insights in files" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleSend(item.label)}
                    onMouseEnter={() => {
                      if (!useMonolithLogo) {
                        setLaunchMascotAttention({ state: 'locked-on', target: { x: 0, y: 0.76 } });
                        pulseMascot('focused');
                      }
                    }}
                    onMouseLeave={() => {
                      if (!useMonolithLogo) {
                        setLaunchMascotAttention(null);
                        setLaunchMascotEmotion('steady');
                      }
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${THEME.borderSubtle}`,
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{
                      padding: '8px',
                      borderRadius: '8px',
                      background: THEME.bgInput,
                      border: `1px solid ${THEME.borderSubtle}`,
                      color: THEME.textSecondary
                    }}>
                      {item.icon}
                    </div>
                    <span style={{ fontSize: '15px', fontWeight: 500, color: THEME.textSecondary }}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ── ACTIVE CHAT AREA ── */
          <div style={{
            width: '100%',
            maxWidth: '760px',
            padding: '24px 20px 180px 20px',
            boxSizing: 'border-box'
          }}>
            {embeddedAgentStrip}
            {mode === 'cowork' ? (
              // Cowork mode: messages + inline work blocks
              <CoworkTranscript 
                messages={activeMessages}
                isLoading={activeIsLoading}
                onRegenerate={handleRegenerate}
              />
            ) : (
              // Normal chat mode
              activeMessages.map((msg, idx) => (
                <StreamingChatComposer
                  key={msg.id}
                  message={msg}
                  isLoading={activeIsLoading && idx === activeMessages.length - 1}
                  isLast={idx === activeMessages.length - 1}
                  onRegenerate={handleRegenerate}
                  onSelectArtifact={handleSelectArtifact}
                  selectedArtifactTitle={selectedArtifact?.title}
                />
              ))
            )}
            
            {/* Jump to present button */}
            <AnimatePresence>
              {showJumpToBottom && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={() => {
                    setShouldAutoScroll(true);
                    scrollToBottom('smooth');
                  }}
                  style={{
                    position: 'fixed',
                    bottom: '120px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 50,
                    padding: '8px 16px',
                    borderRadius: '999px',
                    background: THEME.accent,
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    cursor: 'pointer'
                  }}
                >
                  <ArrowDown size={14} />
                  Jump to present
                </motion.button>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>{/* end message scroll */}

      {/* Artifact side panel — slides in from right when a card is clicked */}
      {selectedArtifact && (
        <ArtifactSidePanel
          artifact={selectedArtifact}
          onClose={handleCloseArtifact}
        />
      )}

      </div>{/* end content row */}

      {/* 2. Floating Bottom Input + Disclaimer */}
      {/* Always show input in cowork mode, otherwise depend on chat state */}
      {(mode === 'cowork' || !isChatEmpty || hideEmptyState) && (
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          /* Cowork mode inherits global background, Chat mode uses theme gradient */
          background: hideEmptyState || mode === 'cowork' ? 'transparent' : THEME.bgGradient,
          pointerEvents: 'none',
          paddingBottom: '12px',
          zIndex: 40,
        }}>
          <div style={{ width: '100%', maxWidth: '760px', pointerEvents: 'auto', padding: '0 20px', boxSizing: 'border-box' }}>
            <ChatComposer
              onSend={handleSend}
              isLoading={activeIsLoading}
              onStop={handleStop}
              selectedModel={selectedModel}
              selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
              onOpenModelPicker={startSelection}
              onSelectModel={selectModel}
              placeholder="Reply..."
              showTopActions={false}
              agentModeSurface={agentSurface}
            />
          </div>
          {/* Disclaimer */}
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            color: THEME.textMuted,
            textAlign: 'center',
            pointerEvents: 'auto',
          }}>
            A2R is AI and can make mistakes. Please double-check responses.
          </div>
        </div>
      )}

      {/* Model Picker Dialog */}
      <ModelPicker
        open={isSelecting}
        onOpenChange={(open) => { if (!open) cancelSelection(); }}
        onSelect={selectModel}
        onCancel={cancelSelection}
        trigger={<div style={{ display: 'none' }} />}
      />
    </div>
  );
}

export default ChatView;
