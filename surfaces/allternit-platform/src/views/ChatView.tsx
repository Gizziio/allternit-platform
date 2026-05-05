import React, { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatStore } from "@/views/chat/ChatStore";
import { useModelSelection } from "@/providers/model-selection-provider";
import { ModelPicker } from "@/components/model-picker";
import { Suggestions, type SuggestionItem } from "@/components/agent-elements/input/suggestions";
import { AgentContextStrip } from "@/components/agents/AgentContextStrip";
import { ArrowDown } from "lucide-react";

import { ChatComposer } from "@/views/chat/ChatComposer";
export { ChatComposer as NewChatInput }; // EXPORT FOR LEGACY IMPORTS

import { MatrixLogo } from "@/components/ai-elements/MatrixLogo";
import { GizziMascot, type GizziAttention, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { ArtifactSidePanel, type SelectedArtifact } from "@/components/ai-elements/artifact-panel";
import { getSession } from "@/lib/auth-browser";
import {
  useAgentStore,
  usePendingPermissions,
  usePendingQuestions,
} from "@/lib/agents";
import { isSwarmAgentId, getSwarmIdFromAgent } from "@/lib/agents/swarm-as-agent";
import { useAdvancedAgentStore } from "@/lib/agents/agent-advanced.store";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { useSurfaceAgentSelection } from "@/lib/agents/surface-agent-context";
import { useThreadAgentSessionsStore } from "@/stores/thread-agent-sessions.store";
import { getAgentSessionDescriptor } from "@/lib/agents/session-metadata";
import { motion, AnimatePresence } from "framer-motion";
import type { AgentModeSurface } from "@/stores/agent-surface-mode.store";
import { AgentModeBackdrop } from "./chat/agentModeSurfaceTheme";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { useRuntimeExecutionMode } from "@/hooks/useRuntimeExecutionMode";
import { useModeCanvasBridge } from "@/hooks/useModeCanvasBridge";
import { useLocalBrainStatus } from "@/hooks/useLocalBrainStatus";
import {
  ComposerPermissionInfoBar,
  ComposerQuestionBar,
  ComposerStatusInfoBar,
} from "./chat/ChatComposerEnhancements";

// Cowork mode components
import { CoworkTranscript } from "./cowork/CoworkTranscript";

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

const EMPTY_STATE_SUGGESTIONS: SuggestionItem[] = [
  { id: "week-plan", label: "Plan my week", value: "Help me plan my week with priorities and a realistic schedule." },
  { id: "meeting-summary", label: "Summarize a meeting", value: "Summarize my last meeting into actions, risks, and follow-ups." },
  { id: "todo-list", label: "Create a todo list", value: "Create a prioritized todo list from my current goals." },
  { id: "code-review", label: "Explain this code", value: "Explain this code, identify risks, and suggest improvements." },
];
function useUserMessages(_chatId?: string) {
  return [] as Array<{ role: "user" | "assistant"; content: string }>;
}

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
  onOpenAgentSession?: (text: string, surface: 'chat' | 'cowork' | 'code') => void;
}) {
  const { id: chatId, isPersisted } = useChatId();
  const { createThread, renameThread, threads, activeThreadId } = useChatStore();
  const agentSurface: AgentModeSurface = mode === 'cowork' ? 'cowork' : mode === 'code' ? 'code' : 'chat';
  const { agentModeEnabled, selectedAgentId, selectedAgent } =
    useSurfaceAgentSelection(agentSurface);
  const activeNativeSessionId = useChatSessionStore((state) => state.activeSessionId);
  const nativeSessions = useChatSessionStore((state) => state.sessions);
  const setActiveNativeSession = useChatSessionStore(
    (state) => state.setActiveSession,
  );
  const appendOptimisticEvent = useChatSessionStore(
    (state) => state.appendOptimisticEvent,
  );
  const fetchNativeMessages = useChatSessionStore((state) => state.fetchMessages);
  const fetchNativeCanvases = useChatSessionStore(
    (state) => state.fetchSessionCanvases,
  );
  const sendNativeMessageStream = useChatSessionStore(
    (state) => state.sendMessageStream,
  );
  const abortNativeGeneration = useChatSessionStore(
    (state) => state.abortGeneration,
  );
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
  // Phase 2: Linked agent sub-sessions for this thread
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

  // Connect mode tabs to canvas opening (Phase 4)
  useModeCanvasBridge({ surface: agentSurface });

  const agents = useAgentStore((state) => state.agents);
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();

  const selectedModel = modelSelection?.modelId ?? modelSelection?.profileId ?? MODELS[0].id;
  const { executionMode } = useRuntimeExecutionMode();
  const brainMode = executionMode?.mode === 'plan' ? 'plan' : 'build';
  const { ollamaRunning, modelReady } = useLocalBrainStatus();
  const isLocalBrainSelected = selectedModel === 'local-brain' || modelSelection?.profileId === 'ollama';
  const chatUserMessages = useUserMessages(chatId ?? undefined);
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
      modeLabel={brainMode === 'plan' ? 'Plan' : 'Build'}
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

  // Auto-scroll to bottom on new messages
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  // Artifact side panel
  const [selectedArtifact, setSelectedArtifact] = useState<SelectedArtifact | null>(null);
  const handleCloseArtifact = useCallback(() => setSelectedArtifact(null), []);

  const isAgentSessionEmbedded = embeddedAgentSession.isEmbedded;
  // Only show the agent-mode backdrop for actual agent sessions, not plain LLM sessions
  // that happen to be embedded (e.g. regular chat after the first message).
  const effectiveAgentModeEnabled = agentModeEnabled;
  const activeIsLoading = isAgentSessionEmbedded
    ? nativeStreaming.isStreaming
    : chatStreaming;

  // Feature 4: Auto-generate thread title from first message when streaming completes
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

    // Generate title from first user message
    const firstUserMsg = session.messages.find((m) => m.role === 'user');
    if (!firstUserMsg) return;

    const text = typeof firstUserMsg.content === 'string' ? firstUserMsg.content : '';
    // Remove common prefixes and create a concise title
    const cleaned = text
      .replace(/^(hi|hello|hey|please|can you|could you)\s+/i, '')
      .replace(/[?.,!]$/, '')
      .trim();
    const title = cleaned.length > 40 ? cleaned.slice(0, 40) + '…' : cleaned;

    if (title && title !== currentTitle) {
      renameThread(chatId, title);
      // Update document title for browser tab
      if (typeof document !== 'undefined') {
        document.title = `${title} — Allternit`;
      }
    }
    hasAutoTitledRef.current.add(chatId);
  }, [chatId, chatStreaming, renameThread]);
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
  }, [activeIsLoading, nativeMessages, shouldAutoScroll, scrollToBottom]);

  const [greeting, setGreeting] = useState({
    title: "Allternit & Coffee",
    tagline: "The Intelligent Workspace",
    effectType: "reveal" as "typing" | "reveal"
  });
  const [launchMascotEmotion, setLaunchMascotEmotion] = useState<GizziEmotion>('steady');
  // Phase 2: Track @mention agent for per-message routing
  const [mentionAgentId, setMentionAgentId] = useState<string | null>(null);
  const [launchMascotAttention, setLaunchMascotAttention] = useState<GizziAttention | null>(null);
  const mascotResetTimeoutRef = useRef<number | null>(null);
  
  // Unified Store - WIHs for quick tasks
  const { fetchWihs } = useUnifiedStore();
  
  useEffect(() => {
    fetchWihs();
  }, [fetchWihs]);

  // Restore last @mentioned agent when entering a thread
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

  // Send initial message if provided (for Cowork mode from launchpad)
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
    async function selectGreeting() {
      const session = await getSession();
      const userName = session?.name || "Eoj";

      const titles = [
        "Allternit & Coffee",
        `Welcome back, ${userName}`,
        "Ready to Build?",
        "The Architect's Den",
        "Allternit",
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

    // ── Phase 2: Per-message agent routing via @mention ─────────────────────
    if (mentionAgentId && chatId) {
      // Case A: Swarm agent — trigger swarm execution
      if (isSwarmAgentId(mentionAgentId)) {
        const swarmId = getSwarmIdFromAgent(mentionAgentId);
        if (swarmId) {
          try {
            const runId = await useAdvancedAgentStore.getState().startSwarmRun(swarmId, text.trim());
            console.log('[ChatView] Swarm run started:', runId);
            // Persist the mention agent for this thread
            useThreadAgentSessionsStore.getState().setLastMentionAgentId(chatId, mentionAgentId);

            // ── A2A Response Loop: Poll swarm messages and inject into chat ──
            const swarm = useAdvancedAgentStore.getState().swarms.find((s) => s.id === swarmId);
            const swarmName = swarm?.name || 'Swarm';
            const tempMsgId = `swarm-${runId}`;
            useChatSessionStore.getState().appendAssistantMessage(chatId, {
              id: tempMsgId,
              content: `🐝 ${swarmName} is deliberating...`,
              metadata: { swarmRunId: runId, swarmId, status: 'running' },
            });

            const pollSwarm = async () => {
              const maxAttempts = 15;
              for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise((r) => setTimeout(r, 3000));
                try {
                  await useAdvancedAgentStore.getState().fetchSwarmMessages(runId);
                  const messages = useAdvancedAgentStore.getState().swarmMessages[runId] || [];
                  const answer = messages
                    .filter((m) => m.type === 'answer' || m.type === 'consensus')
                    .pop();
                  if (answer) {
                    useChatSessionStore.getState().updateMessage(chatId, tempMsgId, {
                      content: answer.content,
                      metadata: { swarmRunId: runId, swarmId, status: 'completed', fromAgent: answer.from },
                    });
                    return;
                  }
                  const runs = useAdvancedAgentStore.getState().swarmRuns[swarmId] || [];
                  const run = runs.find((r) => r.id === runId);
                  if (run?.status === 'failed') {
                    useChatSessionStore.getState().updateMessage(chatId, tempMsgId, {
                      content: `🐝 ${swarmName} encountered an error during deliberation.`,
                      metadata: { swarmRunId: runId, swarmId, status: 'failed' },
                    });
                    return;
                  }
                } catch (pollErr) {
                  console.error('[ChatView] Swarm poll error:', pollErr);
                }
              }
              // Timeout
              useChatSessionStore.getState().updateMessage(chatId, tempMsgId, {
                content: `🐝 ${swarmName} is still working. Check the Swarm Monitor for live updates.`,
                metadata: { swarmRunId: runId, swarmId, status: 'timeout' },
              });
            };

            pollSwarm();
          } catch (err) {
            console.error('[ChatView] Failed to start swarm run:', err);
          }
        }
        return;
      }

      // Case B: Regular agent — create/find sub-session
      const threadStore = useThreadAgentSessionsStore.getState();
      let agentSessionId = threadStore.getAgentSessionId(chatId, mentionAgentId);

      if (!agentSessionId) {
        // Create a new agent sub-session for this thread+agent combo
        const agent = agents.find((a) => a.id === mentionAgentId);
        try {
          agentSessionId = await useChatSessionStore.getState().createSession({
            name: text.slice(0, 40),
            sessionMode: 'agent',
            agentId: mentionAgentId,
            agentName: agent?.name,
          });
          threadStore.registerAgentSession(chatId, mentionAgentId, agentSessionId);
        } catch (err) {
          console.error('[ChatView] Failed to create agent sub-session:', err);
          return;
        }
      }

      if (agentSessionId) {
        await sendNativeMessageStream(agentSessionId, { text: text.trim() });
      }
      // Persist the mention agent for this thread
      useThreadAgentSessionsStore.getState().setLastMentionAgentId(chatId, mentionAgentId);
      return;
    }

    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      setActiveNativeSession(embeddedAgentSession.sessionId);
      await sendNativeMessageStream(embeddedAgentSession.sessionId, { text: text.trim() });
      return;
    }

    if (!chatId) return;

    let effectiveChatId = chatId;
    const activeThread = threads.find((thread) => thread.id === activeThreadId);
    const isEphemeralThread =
      !isPersisted || chatId.startsWith("temp-") || chatId === "welcome";
    const wantsAgentConversation = agentModeEnabled || !!selectedAgentId;

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
          useChatSessionStore.getState().setActiveSession(newId);
          await sendNativeMessageStream(newId, { text: text.trim() });
          return;
        }
      } catch (err) {
        console.error("Failed to create thread:", err);
      }
      return;
    }

    useChatSessionStore.getState().setActiveSession(effectiveChatId);
    await sendNativeMessageStream(effectiveChatId, { text: text.trim() });
  }, [
    activeThreadId,
    agentModeEnabled,
    agents,
    chatId,
    createThread,
    embeddedAgentSession.sessionId,
    isAgentSessionEmbedded,
    isPersisted,
    mentionAgentId,
    sendNativeMessageStream,
    selectedAgentId,
    setActiveNativeSession,
    threads,
  ]);

  // Generative UI Feedback Loop
  useEffect(() => {
    const handleUIAction = (e: Event) => {
      const { action, data } = (e as CustomEvent).detail;
      const message = `[UI Action] User performed: ${action}${data ? ` with data: ${JSON.stringify(data)}` : ''}`;

      // Send as a hidden or system-style message if possible, otherwise regular message
      handleSend(message);
    };

    window.addEventListener('allternit:ui-action' as any, handleUIAction);
    return () => window.removeEventListener('allternit:ui-action' as any, handleUIAction);
  }, [handleSend]);

  const handleRegenerate = useCallback(() => {
    if (isAgentSessionEmbedded && embeddedAgentSession.sessionId) {
      const lastUserMsg = [...nativeMessages].reverse().find((m) => m.role === "user");
      if (lastUserMsg) {
        setActiveNativeSession(embeddedAgentSession.sessionId);
        void sendNativeMessageStream(embeddedAgentSession.sessionId, { text: lastUserMsg.content });
      }
      return;
    }

    const lastUserMsg = [...chatUserMessages].reverse().find((m) => m.role === "user");
    if (lastUserMsg && typeof lastUserMsg.content === "string" && chatId) {
      useChatSessionStore.getState().setActiveSession(chatId);
      void sendNativeMessageStream(chatId, { text: lastUserMsg.content });
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

            {/* No-provider banner — shown when nothing is connected */}
            {!modelSelection && !isAgentSessionEmbedded && (
              <div style={{
                width: '100%', marginBottom: 24,
                padding: '14px 18px', borderRadius: 14,
                background: 'color-mix(in srgb, var(--accent-chat) 6%, var(--surface-panel, var(--bg-secondary)))',
                border: '1px solid color-mix(in srgb, var(--accent-chat) 20%, transparent)',
                display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'color-mix(in srgb, var(--accent-chat) 12%, transparent)',
                  color: 'var(--accent-chat)',
                }}>
                  {/* Brain icon inline */}
                  <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M248,124a56.11,56.11,0,0,0-32-50.61V72a48,48,0,0,0-88-26.49A48,48,0,0,0,40,72v1.39A56,56,0,0,0,72,180.27V184a24,24,0,0,0,24,24h64a24,24,0,0,0,24-24v-3.73A56.09,56.09,0,0,0,248,124ZM96,200a8,8,0,0,1-8-8v-4h32v12Zm72,0H152V188h32v4A8,8,0,0,1,168,200Zm8-28H80a40,40,0,0,1-8-79.22V72a32,32,0,0,1,64,0v8h16V72a32,32,0,0,1,64,0v20.78A40,40,0,0,1,176,172Z"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary, var(--text-primary))', marginBottom: 2 }}>
                    No AI connected
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted, var(--text-tertiary))' }}>
                    {ollamaRunning && !modelReady
                      ? 'Ollama is running — download Local Brain to chat offline, or connect a cloud provider.'
                      : 'Connect a cloud provider, or add a Local Brain to chat offline with no API key.'}
                  </div>
                </div>
                <button
                  onClick={startSelection}
                  style={{
                    flexShrink: 0, padding: '6px 14px', borderRadius: 8,
                    background: 'var(--accent-chat)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  }}
                >
                  Connect
                </button>
              </div>
            )}

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
                fontFamily: "'Allternit Serif', Georgia, ui-serif, Cambria, 'Times New Roman', Times, serif",
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
                onMentionAgentChange={setMentionAgentId}
                mentionAgentId={mentionAgentId}
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
                topInfoBarContent={composerTopInfoBar}
                questionBarContent={composerQuestionBar}
                bottomInfoBarContent={composerBottomInfoBar}
              />
            </div>

            <div style={{
              width: '100%',
              maxWidth: '520px',
              margin: '32px auto 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              alignItems: 'center',
            }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 500,
                color: THEME.textMuted,
                textAlign: 'center',
              }}>
                Try asking
              </span>
              <Suggestions
                items={EMPTY_STATE_SUGGESTIONS}
                onSelect={(item) => handleSend(item.value || item.label)}
                className="justify-center"
                itemClassName="h-8 rounded-full border-[var(--ui-border-muted)] bg-[var(--chat-composer-soft)] px-3 text-[13px] text-[var(--ui-text-secondary)] hover:bg-[var(--chat-composer-hover)] hover:text-[var(--ui-text-primary)]"
              />
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
                linkedSessionIds={linkedAgentSessionIds}
                onRegenerate={handleRegenerate}
              />
            ) : (
              // Non-embedded: canonical ConversationReplyState
              <CoworkTranscript
                conversationId={chatId ?? ""}
                linkedSessionIds={linkedAgentSessionIds}
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
                    boxShadow: '0 4px 12px var(--surface-panel)',
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

      {/* Ollama-down warning — shown above composer when local-brain is selected but Ollama isn't running */}
      {isLocalBrainSelected && !ollamaRunning && (
        <div style={{
          position: 'absolute', bottom: 80, left: 0, right: 0,
          display: 'flex', justifyContent: 'center',
          padding: '0 20px', zIndex: 41, pointerEvents: 'none',
        }}>
          <div style={{
            maxWidth: 640, width: '100%',
            padding: '9px 14px', borderRadius: 10,
            background: 'color-mix(in srgb, #f59e0b 10%, var(--surface-panel, var(--bg-secondary)))',
            border: '1px solid color-mix(in srgb, #f59e0b 30%, transparent)',
            display: 'flex', alignItems: 'center', gap: 10,
            pointerEvents: 'auto',
          }}>
            <span style={{ fontSize: 13 }}>⚠️</span>
            <span style={{ fontSize: 12, color: 'var(--ui-text-primary, var(--text-primary))' }}>
              <strong>Local Brain is offline.</strong> Make sure Ollama is running, then{' '}
              <button
                onClick={() => { /* refresh status */ window.dispatchEvent(new Event('focus')); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-chat)', fontSize: 12, fontWeight: 600, padding: 0, textDecoration: 'underline' }}
              >
                retry
              </button>
              {' '}or{' '}
              <button
                onClick={startSelection}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-chat)', fontSize: 12, fontWeight: 600, padding: 0, textDecoration: 'underline' }}
              >
                switch model
              </button>.
            </span>
          </div>
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
              onMentionAgentChange={setMentionAgentId}
              mentionAgentId={mentionAgentId}
              isLoading={activeIsLoading}
              onStop={handleStop}
              selectedModel={selectedModel}
              selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
              onOpenModelPicker={startSelection}
              onSelectModel={selectModel}
              placeholder="Reply..."
              showTopActions={false}
              agentModeSurface={agentSurface}
              topInfoBarContent={composerTopInfoBar}
              questionBarContent={composerQuestionBar}
              bottomInfoBarContent={composerBottomInfoBar}
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
