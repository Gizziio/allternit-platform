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
  ArrowDown,
  Briefcase,
  CheckCircle,
  Clock,
  AlertCircle,
  Circle,
  Hammer,
  Search,
  FileCode,
  Bug,
  Lightbulb,
  Zap,
  Target,
  type LucideIcon
} from "lucide-react";
// ShareDialog is not available - create inline or skip for now
const ShareDialogPlaceholder = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => null;

import { ChatComposer } from "@/views/chat/ChatComposer";
export { ChatComposer as NewChatInput }; // EXPORT FOR LEGACY IMPORTS

import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { GizziMascot, type GizziAttention, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { ArtifactSidePanel, type SelectedArtifact } from "@/components/ai-elements/artifact-panel";
import { getSession } from "@/lib/auth-browser";
import {
  useAgentStore,
  useNativeAgentStore,
  useConversationReplies,
  useUserMessages,
} from "@/lib/agents";
import { useSurfaceAgentSelection } from "@/lib/agents/surface-agent-context";
import { getAgentSessionDescriptor } from "@/lib/agents/session-metadata";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { AgentModeBackdrop } from "./chat/agentModeSurfaceTheme";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { useRuntimeExecutionMode } from "@/hooks/useRuntimeExecutionMode";
import { useModeCanvasBridge } from "@/hooks/useModeCanvasBridge";

// Cowork mode components
import { CoworkTranscript } from "./cowork/CoworkTranscript";
import { PermissionModal } from "./cowork/PermissionModal";
import { QuestionModal } from "./cowork/QuestionModal";

// ============================================================================
// Shared semantic theme bridge
// ============================================================================
const THEME = {
  bg: 'var(--surface-canvas)',
  bgGradient: 'linear-gradient(to top, color-mix(in srgb, var(--surface-canvas) 94%, transparent) 60%, transparent)',
  bgInput: 'var(--chat-composer-bg)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--ui-text-secondary)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-chat)',
  borderSubtle: 'var(--ui-border-muted)',
};

// ============================================================================
// Special Text Animations
// ============================================================================

const TypingText = ({ text, delay = 0, speed = 0.05, className = "", style = {} }: { text: string, delay?: number, speed?: number, className?: string, style?: any }) => {
  // Render as plain text without per-character animation to prevent missing letters
  return (
    <span className={className} style={style}>
      {text.split('').map((char, i) => (
        <span key={i} style={char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {}}>
          {char}
        </span>
      ))}
    </span>
  );
};

const StaggeredReveal = ({ text, delay = 0, className = "", style = {} }: { text: string, delay?: number, className?: string, style?: any }) => {
  // Render as plain text without per-character animation to prevent missing letters
  const words = text.split(" ");
  return (
    <span className={className} style={{ ...style, display: 'inline-block' }}>
      {words.map((word, i) => (
        <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre' }}>
          {word.split("").map((char, j) => (
            <span
              key={j}
              style={{
                display: 'inline-block',
                ...(char === '&' ? { color: THEME.accent, opacity: 0.8, margin: '0 4px' } : {})
              }}
            >
              {char}
            </span>
          ))}
          {i < words.length - 1 && <span> </span>}
        </span>
      ))}
    </span>
  );
};

const MODELS = [
  { id: "kimi/kimi-for-coding", name: "Kimi K2.5 (Coding)", provider: "kimi" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "anthropic" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek" },
] as const;

export function ChatView({ 
  hideEmptyState = false, 
  mode = 'chat',
  initialMessage,
  onInitialMessageSent,
  onOpenAgentSession,
}: { 
  hideEmptyState?: boolean, 
  mode?: 'chat' | 'cowork' | 'code',
  initialMessage?: string,
  onInitialMessageSent?: () => void,
  /** Callback to open full agent session view instead of embedded chat */
  onOpenAgentSession?: (text: string, surface: 'chat' | 'cowork' | 'code' | 'browser') => void;
}) {
  const { id: chatId, isPersisted } = useChatId();
  const { createThread, threads, activeThreadId } = useChatStore();
  const agentSurface: AgentModeSurface = mode === 'cowork' ? 'cowork' : mode === 'code' ? 'code' : 'chat';
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection(agentSurface);
  const activeNativeSessionId = useNativeAgentStore((state) => state.activeSessionId);
  const nativeSessions = useNativeAgentStore((state) => state.sessions);
  const setActiveNativeSession = useNativeAgentStore(
    (state) => state.setActiveSession,
  );
  const appendOptimisticEvent = useNativeAgentStore(
    (state) => state.appendOptimisticEvent,
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
  const activeNativeSession = useMemo(
    () => (activeNativeSessionId ? nativeSessions.find((session) => session.id === activeNativeSessionId) ?? null : null),
    [activeNativeSessionId, nativeSessions],
  );
  const activeNativeDescriptor = useMemo(
    () => getAgentSessionDescriptor(activeNativeSession?.metadata),
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
  const nativeStreaming = useNativeAgentStore((state) => ({
    isStreaming: state.streamingBySession[embeddedAgentSession.sessionId ?? '']?.isStreaming ?? false,
  }));
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

  // Connect mode tabs to canvas opening (Phase 4)
  useModeCanvasBridge({ surface: agentSurface });

  const agents = useAgentStore((state) => state.agents);
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();

  const selectedModel = modelSelection?.profileId ?? MODELS[0].id;
  const runtimeModelId = modelSelection?.modelId;

  const { executionMode } = useRuntimeExecutionMode();
  const brainMode = executionMode?.mode === 'plan' ? 'plan' : 'build';

  const chatReplyState = useConversationReplies(chatId ?? undefined);
  const chatUserMessages = useUserMessages(chatId ?? undefined);
  const chatStreaming = useNativeAgentStore((state) =>
    chatId ? (state.streamingBySession[chatId]?.isStreaming ?? false) : false,
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

  const isAgentSessionEmbedded = embeddedAgentSession.isEmbedded;
  // Only show the agent-mode backdrop for actual agent sessions, not plain LLM sessions
  // that happen to be embedded (e.g. regular chat after the first message).
  const effectiveAgentModeEnabled = agentModeEnabled;
  const activeIsLoading = isAgentSessionEmbedded
    ? nativeStreaming.isStreaming
    : chatStreaming;
  const dismissEmbeddedAgentSession = useCallback(() => {
    if (embeddedAgentSession.sessionId) {
      appendOptimisticEvent(embeddedAgentSession.sessionId, {
        id: `evt_agent_mode_dismiss_${Date.now()}`,
        sessionId: embeddedAgentSession.sessionId,
        actor: 'ui',
        surface: agentSurface,
        type: 'agent.mode.changed',
        payload: {
          enabled: false,
          scope: 'surface',
          reason: 'dismissed',
        },
        createdAt: new Date().toISOString(),
        seq: 0,
      });
    }
    if (embeddedAgentSession.sessionId && embeddedAgentSession.sessionId === activeNativeSessionId) {
      setActiveNativeSession(null);
    }
  }, [activeNativeSessionId, agentSurface, appendOptimisticEvent, embeddedAgentSession.sessionId, setActiveNativeSession]);

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
  }, [activeIsLoading, nativeMessages, activeMessages, shouldAutoScroll, scrollToBottom]);

  const [greeting, setGreeting] = useState({
    title: "Allternit & Coffee",
    tagline: "The Intelligent Workspace",
    effectType: "reveal" as "typing" | "reveal"
  });
  const [launchMascotEmotion, setLaunchMascotEmotion] = useState<GizziEmotion>('steady');
  const [launchMascotAttention, setLaunchMascotAttention] = useState<GizziAttention | null>(null);
  const mascotResetTimeoutRef = useRef<number | null>(null);
  
  // Share dialog state (placeholder)
  const shareVisibility: 'private' | 'workspace' | 'public' = 'private';
  const currentChatId = chatId || 'welcome';



  // Unified Store - WIHs for quick tasks
  const { wihs, fetchWihs, selectWih } = useUnifiedStore();
  
  useEffect(() => {
    fetchWihs();
  }, [fetchWihs]);

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
      useNativeAgentStore.getState().setActiveSession(chatId);
      sendNativeMessageStream(chatId, initialMessage).then(() => {
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
    async function selectGreeting() {
      const session = await getSession();
      const userName = session?.name || "Eoj";

      const titles = [
        "Allternit & Coffee",
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

  const handleSend = useCallback(async (text: string, context?: any) => {
    if (!text.trim()) return;

    // Log context if provided
    if (context) {
      console.log('[ChatView] Received context:', context);
    }

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
        if (newId) {
          useNativeAgentStore.getState().setActiveSession(newId);
          await sendNativeMessageStream(newId, text.trim());
          return;
        }
      } catch (err) {
        console.error("Failed to create thread:", err);
      }
      return;
    }

    useNativeAgentStore.getState().setActiveSession(effectiveChatId);
    await sendNativeMessageStream(effectiveChatId, text.trim());
  }, [
    activeThreadId,
    agentModeEnabled,
    chatId,
    createThread,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    isPersisted,
    sendNativeMessageStream,
    selectedAgentId,
    setActiveNativeSession,
    threads,
  ]);

  // Helper: Get icon based on WIH title/content
  const getWihIcon = useCallback((wih: typeof wihs[0]): React.ReactNode => {
    const title = (wih.title || '').toLowerCase();
    const description = (wih.description || '').toLowerCase();
    const text = `${title} ${description}`;
    
    if (text.includes('bug') || text.includes('fix') || text.includes('error')) return <Bug size={20} />;
    if (text.includes('test') || text.includes('verify') || text.includes('check')) return <CheckCircle size={20} />;
    if (text.includes('refactor') || text.includes('clean') || text.includes('organize')) return <Sparkles size={20} />;
    if (text.includes('search') || text.includes('find') || text.includes('lookup')) return <Search size={20} />;
    if (text.includes('implement') || text.includes('build') || text.includes('create') || text.includes('add')) return <Hammer size={20} />;
    if (text.includes('optimize') || text.includes('improve') || text.includes('perf')) return <Zap size={20} />;
    if (text.includes('review') || text.includes('audit')) return <FileCode size={20} />;
    if (text.includes('plan') || text.includes('design') || text.includes('architecture')) return <Lightbulb size={20} />;
    if (text.includes('deploy') || text.includes('release') || text.includes('ship')) return <Target size={20} />;
    if (wih.status === 'blocked') return <AlertCircle size={20} />;
    if (wih.status === 'ready') return <Clock size={20} />;
    
    return <Briefcase size={20} />;
  }, []);

  // Helper: Handle WIH click
  const handleWihClick = useCallback((wih: typeof wihs[0]) => {
    selectWih(wih.wih_id);
    // Send a message about working on this WIH
    const message = `Work on: ${wih.title || wih.wih_id}`;
    handleSend(message);
  }, [selectWih, handleSend]);

  // Filter and sort WIHs for quick tasks
  const quickTasks = useMemo(() => {
    return wihs
      .filter(w => ['open', 'ready'].includes(w.status))
      .sort((a, b) => {
        // Sort by status (ready first), then by title
        if (a.status === 'ready' && b.status !== 'ready') return -1;
        if (b.status === 'ready' && a.status !== 'ready') return 1;
        return (a.title || '').localeCompare(b.title || '');
      })
      .slice(0, 5); // Limit to top 5
  }, [wihs]);

  const handleRegenerate = useCallback(() => {
    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      const lastUserMsg = [...nativeMessages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setActiveNativeSession(embeddedAgentSession.sessionId);
        void sendNativeMessageStream(embeddedAgentSession.sessionId, lastUserMsg.content);
      }
      return;
    }

    const lastUserMsg = [...chatUserMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg && typeof lastUserMsg.content === "string" && chatId) {
      useNativeAgentStore.getState().setActiveSession(chatId);
      void sendNativeMessageStream(chatId, lastUserMsg.content);
    }
  }, [
    chatUserMessages,
    chatId,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    nativeMessages,
    sendNativeMessageStream,
    setActiveNativeSession,
  ]);

  const handleStop = useCallback(() => {
    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      void abortNativeGeneration(embeddedAgentSession.sessionId);
      return;
    }

    if (chatId) void abortNativeGeneration(chatId);
  }, [
    abortNativeGeneration,
    chatId,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
  ]);

  if (!chatId && !isAgentSessionEmbedded) return null;

  const isChatEmpty = isAgentSessionEmbedded
    ? nativeMessages.length === 0
    : chatUserMessages.length === 0;
  const useMonolithLogo = mode === 'chat';

  // Don't hide entirely in cowork mode - we need the input bar visible
  if (isChatEmpty && hideEmptyState && mode !== 'cowork') return null;

  const showTopActions = mode === 'chat';
  const embeddedAgentDescriptor = embeddedAgentSession.descriptor;
  // Only show the agent context strip for actual agent sessions.
  const isActualAgentSession = isAgentSessionEmbedded && embeddedAgentSession.descriptor.sessionMode === 'agent';
  const embeddedAgentStrip = isActualAgentSession ? (
    <AgentContextStrip
      surface={agentSurface}
      sessionName={embeddedAgentSession.session?.name || "Agent Session"}
      sessionDescription={embeddedAgentSession.session?.description}
      agentName={embeddedAgentDescriptor.agentName || selectedAgent?.name || undefined}
      statusLabel={
        embeddedAgentSession.session?.metadata?.allternit_local_draft === true
          ? "Local Draft"
          : embeddedAgentSession.session?.isActive
            ? "Live"
            : "Paused"
      }
      messageCount={
        embeddedAgentSession.session?.messageCount ?? nativeMessages.length
      }
      workspaceScope={embeddedAgentDescriptor.workspaceScope}
      canvasCount={embeddedCanvasIds.length}
      tags={embeddedAgentSession.session?.tags}
      localDraft={embeddedAgentSession.session?.metadata?.allternit_local_draft === true}
      toolsEnabled={embeddedAgentDescriptor.agentFeatures?.tools === true}
      automationEnabled={embeddedAgentDescriptor.agentFeatures?.automation === true}
      onDismiss={dismissEmbeddedAgentSession}
    />
  ) : null;

  // Get theme colors for embedded agent session styling
  const getEmbeddedChatBackground = () => {
    if (!isAgentSessionEmbedded) {
      return hideEmptyState || mode === 'cowork' || mode === 'chat' ? 'transparent' : THEME.bg;
    }
    return 'radial-gradient(circle at top right, color-mix(in srgb, var(--accent-chat) 10%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--surface-floating) 18%, transparent) 0%, transparent 18%)';
  };

  const getEmbeddedChatBoxShadow = () => {
    if (!isAgentSessionEmbedded) return 'none';
    return 'inset 0 0 0 1px color-mix(in srgb, var(--accent-chat) 12%, transparent), inset 0 24px 120px color-mix(in srgb, var(--accent-chat) 8%, transparent)';
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden', minHeight: 0 }}>

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
          alignItems: 'center',
          minHeight: 0,  // Allow flex item to shrink below content size
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
            padding: '10vh 24px 80px 24px',
            boxSizing: 'border-box',
            flex: 1,  // Allow content to fill available space
            minHeight: 0,  // Prevent pushing beyond bounds
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
                <div className="absolute inset-0 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700" style={{ background: 'color-mix(in srgb, var(--accent-chat) 8%, transparent)' }} />
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
            <div style={{ width: '100%', marginBottom: '64px', marginInline: 'auto' }}>
              <ChatComposer
                onSend={handleSend}
                onAgentSend={onOpenAgentSession ? (text) => onOpenAgentSession(text, agentSurface) : undefined}
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

            {/* Suggested Prompts - Inline with input */}
            <div style={{ 
              width: '87.3%',
              maxWidth: '248px',
              margin: '32px auto 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <span style={{ 
                fontSize: '11px', 
                fontWeight: 500, 
                color: THEME.textMuted,
                textAlign: 'center'
              }}>
                Try asking
              </span>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '8px'
              }}>
                {[
                  "Help me plan my week",
                  "Summarize my last meeting",
                  "Create a todo list",
                  "Explain this code",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    style={{
                      padding: '8px 16px',
                      background: 'var(--chat-composer-soft)',
                      border: `1px solid ${THEME.borderSubtle}`,
                      borderRadius: '20px',
                      color: THEME.textSecondary,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--chat-composer-hover)';
                      e.currentTarget.style.color = THEME.textPrimary;
                      e.currentTarget.style.borderColor = 'var(--ui-border-default)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--chat-composer-soft)';
                      e.currentTarget.style.color = THEME.textSecondary;
                      e.currentTarget.style.borderColor = THEME.borderSubtle;
                    }}
                  >
                    {prompt}
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
            boxSizing: 'border-box',
            position: 'relative'
          }}>
            {embeddedAgentStrip}
            {isAgentSessionEmbedded ? (
              // Embedded agent session: read from canonical ConversationReplyState
              <CoworkTranscript
                conversationId={embeddedAgentSession.sessionId ?? ""}
                onRegenerate={handleRegenerate}
              />
            ) : (
              // Non-embedded: canonical ConversationReplyState
              <CoworkTranscript
                conversationId={chatId ?? ""}
                onRegenerate={handleRegenerate}
              />
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

      {/* Gate overlay: permission + question modals above composer */}
      {embeddedAgentSession.sessionId && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(480px, calc(100% - 32px))',
          zIndex: 50,
          pointerEvents: 'auto',
        }}>
          <PermissionModal sessionId={embeddedAgentSession.sessionId} />
          <QuestionModal sessionId={embeddedAgentSession.sessionId} />
        </div>
      )}

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
          background: hideEmptyState || mode === 'cowork' || mode === 'chat' ? 'transparent' : THEME.bgGradient,
          pointerEvents: 'none',
          paddingBottom: '12px',
          zIndex: 40,
        }}>
          <div style={{ width: '100%', maxWidth: '760px', pointerEvents: 'auto', padding: '0 20px', boxSizing: 'border-box' }}>
            <ChatComposer
              onSend={handleSend}
              onAgentSend={onOpenAgentSession ? (text) => onOpenAgentSession(text, agentSurface) : undefined}
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
            Allternit is AI and can make mistakes. Please double-check responses.
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
