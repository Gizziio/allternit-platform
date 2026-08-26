// @ts-nocheck

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import {
  Plus,
  Square,
  ArrowUp,
  ArrowElbowDownRight,
  CaretDown,
  CaretUp,
  Folder,
  Code,
  Pen as PenTool,
  BookOpen,
  Sparkle,
  X,
  FileText,
  GithubLogo as Github,
  Globe,
  Lightning,
  CursorClick,
  Check,
  CaretRight,
  Robot,
  Camera,
  Video,
  CircleNotch,
  Image as ImageIcon,
  Link as LinkIcon,
  Waveform,
} from '@phosphor-icons/react';
import { AttachmentButton } from '@/components/agent-elements/input/attachment-button';
import { useVoice } from '@/providers/voice-provider';
import { FileAttachment } from '@/components/agent-elements/input/file-attachment';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import { AgentMentionDropdown } from '@/components/chat/AgentMentionDropdown';
import { AgentPill } from '@/components/chat/AgentPill';
import { PluginMentionChip } from '@/components/chat/PluginMentionChip';
import { usePluginMentionTargets, type PluginMentionTarget } from '@/lib/mentions/use-mention-targets';

import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';

const _logger = createModuleLogger('ChatComposer');

import type { GizziAttention, GizziEmotion } from '@/components/ai-elements/GizziMascot';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModelDiscovery } from '@/integration/api-client';
import { useAgentSurfaceModeStore, type AgentModeSurface, type AgentModeId } from '@/stores/agent-surface-mode.store';
import { getProviderMeta } from '@/lib/providers/provider-registry';
import { useRuntimeExecutionMode } from '@/hooks/useRuntimeExecutionMode';
import { useIsMobile } from '@/hooks/useMediaQuery';
import type { RuntimeExecutionMode } from '@/lib/agents/native-agent-api';

import {
  buildOpenClawImportInput,
  discoverOpenClawAgents,
  getOpenClawWorkspacePathFromAgent,
  getRegisteredOpenClawAgentId,
  resolveOpenClawRegistration,
  useAgentStore,
  useAgentsWithSwarms,
  isAgentAllowedOnSurface,
  type Agent,
  type OpenClawDiscoveredAgent,
} from '@/lib/agents';
import { getBotDisplayName } from '@/lib/bots/bot-profile';
import { useMentionHandoff } from '@/lib/bots/use-mention-handoff';
import { parseMentions } from '@/lib/bots/mention-handoff.service';
import { useActiveChatSession } from './ChatSessionStore';
import { useChatStore } from './ChatStore';
import { ALL_MODELS } from '@/lib/ai/models';
import { AgentModeGizzi } from './AgentModeGizzi';
import { getAgentModeSurfaceTheme } from './agentModeSurfaceTheme';
import { useRecordingStore } from '@/stores/recording.store';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { TaskBar } from './components/TaskBar';
import { ModeDock, MODE_TABS, SURFACE_MODES } from './components/ModeDock';
import { TemplateGallery } from './components/TemplateGallery';
import { SwarmSubModeTabs } from './components/SwarmSubModeTabs';
import { ComposerPlusSheet, type ToolAccessLevel, type ResponseStyle } from './components/ComposerPlusSheet';
import { ConnectorMarketplaceDialog } from './components/ConnectorMarketplaceDialog';
import { MiroFishPanel } from './panels/MiroFishPanel';
import { useMiroFishRunStore } from '@/stores/mirofish-run.store';
import { BottomDock } from './components/BottomDock';
import { isCanonicalAgentMode, type CanonicalAgentModeId } from '@/lib/agents/agent-mode-contracts';
import { CoworkTopDeck } from '@/views/cowork/CoworkTopDeck';
import { PromptModelSelector } from '@/components/prompt-kit/prompt-model-selector';
import { ProviderGallery } from '@/components/chat/ProviderGallery';

// Terminal Server URL for fetching real models
declare const __TERMINAL_SERVER_URL__: string | undefined;
function getProviderDiscoveryUrl(): string {
  if (typeof window === 'undefined') return '/api/v1/providers';
  try {
    const stored = window.localStorage.getItem('allternit.runtime-backend.snapshot');
    if (stored) {
      const snap = JSON.parse(stored) as { resolved_gateway_url?: string };
      const gw = snap?.resolved_gateway_url ?? '';
      if (gw && !/^https?:\/\/(?:127\.0\.0\.1|localhost)/.test(gw)) return `${gw}/api/v1/providers`;
    }
  } catch {
    // storage unavailable
  }
  return '/api/v1/providers';
}

async function fetchRegisteredProviders(signal: AbortSignal): Promise<Response> {
  const sidecar = typeof window !== 'undefined' ? window.allternitSidecar : undefined;
  if (sidecar && typeof sidecar.getApiUrl === 'function') {
    const apiUrl = await sidecar.getApiUrl();
    if (apiUrl) {
      return fetch(`${apiUrl.replace(/\/$/, '')}/provider`, {
        signal,
      });
    }
  }
  return fetch(getProviderDiscoveryUrl(), { signal });
}

// Provider discovery is slow (~2-5s) and the composer remounts whenever the
// code-mode canvas swaps sessions, which left the model pill stuck on
// "Loading..." after every session switch. Cache the discovery payload in
// memory + localStorage (10 min TTL) so remounts render models instantly and
// refresh silently in the background.
const PROVIDER_DISCOVERY_CACHE_KEY = 'allternit-provider-discovery-cache-v2';
const PROVIDER_DISCOVERY_TTL_MS = 10 * 60 * 1000;
let providerDiscoveryMemoryCache: any[] | null = null;

function readProviderDiscoveryCache(): any[] | null {
  if (providerDiscoveryMemoryCache) return providerDiscoveryMemoryCache;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PROVIDER_DISCOVERY_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts?: number; models?: any[] };
    if (!parsed?.models?.length) return null;
    if (typeof parsed.ts === 'number' && Date.now() - parsed.ts > PROVIDER_DISCOVERY_TTL_MS) return null;
    providerDiscoveryMemoryCache = parsed.models;
    return parsed.models;
  } catch {
    return null;
  }
}

function writeProviderDiscoveryCache(models: any[]): void {
  providerDiscoveryMemoryCache = models;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROVIDER_DISCOVERY_CACHE_KEY, JSON.stringify({ ts: Date.now(), models }));
  } catch {
    // storage unavailable
  }
}

const THEME = {
  bg: 'var(--surface-canvas)',
  inputBg: 'var(--chat-composer-bg)',
  inputBorder: 'var(--chat-composer-border)',
  textPrimary: 'var(--ui-text-primary)',
  textSecondary: 'var(--chat-composer-muted)',
  textMuted: 'var(--ui-text-muted)',
  accent: 'var(--accent-chat)',
  hoverBg: 'var(--chat-composer-hover)',
  menuBg: 'var(--chat-composer-menu-bg)',
  menuBorder: 'var(--chat-composer-menu-border)',
};

export interface ChatAttachment {
  id: string;
  name: string;
  dataUrl: string;
  type: 'image' | 'screenshot' | 'gif' | 'document' | 'code' | 'json' | 'spreadsheet' | 'other';
}

export interface SlashCommand {
  command: string;
  label: string;
  icon?: React.ReactNode;
}

interface AgentCommand {
  command: string;
  label: string;
  detail: string;
}

interface ChatComposerProps {
  onSend: (text: string) => void;
  isLoading?: boolean;
  onStop?: () => void;
  selectedModel?: string;
  selectedModelDisplayName?: string;
  onOpenModelPicker?: () => void;
  onSelectModel?: (selection: any) => void;
  placeholder?: string;
  variant?: 'default' | 'large';
  showTopActions?: boolean;
  /** Compact input bar (narrower vertical padding) for terminal-style surfaces like Code Mode. */
  compact?: boolean;
  /** Floating HUD mode: force a minimal placeholder and tight chrome. */
  hudMode?: boolean;
  inputValue?: string;
  onInteractionSignal?: (emotion: GizziEmotion) => void;
  onAttentionChange?: (attention: GizziAttention | null) => void;
  agentModeSurface?: AgentModeSurface;
  slashCommands?: SlashCommand[];
  attachments?: ChatAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onAddAttachment?: (attachment: ChatAttachment) => void;
  /** Called when sending in agent mode - if provided, opens full agent session view instead of embedded chat */
  onAgentSend?: (text: string, execution?: { modeId: CanonicalAgentModeId; templateTitle?: string }) => void;
  /** Called when bot mode is toggled on or a bot is selected from the home-view composer; starts a real bot session. */
  onStartBotSession?: (agent: Agent) => void;
  /** Called when the @mention agent selection changes (Phase 2: per-message routing) */
  onMentionAgentChange?: (agentId: string | null) => void;
  /** Called when the @mention plugin/connector selection changes */
  onPluginMentionChange?: (target: PluginMentionTarget | null) => void;
  /** External @mention agent ID to sync with parent (for persistent pill restoration) */
  mentionAgentId?: string | null;
  /** Whether to show slash command suggestions in the composer */
  showSlashCommands?: boolean;
  /** Surface theme for agent mode styling */
  surfaceTheme?: {
    edge: string;
    soft: string;
    panelTint: string;
  };
  /** Custom content to render in the bottom dock (left side) instead of "Choose Agent" */
  bottomDockContent?: React.ReactNode;
  /** Show the Chat/Cowork mode toggle in the bottom dock. Pass false for in-session composers, which are locked to their session's mode. */
  showModeToggle?: boolean;
  /** Optional inline info bar rendered at the top of the composer shell. */
  topInfoBarContent?: React.ReactNode;
  /** Optional inline question bar rendered between info and textarea. */
  questionBarContent?: React.ReactNode;
  /** Optional inline info bar rendered above the composer toolbar. */
  bottomInfoBarContent?: React.ReactNode;
  /** Optional top deck content rendered inside the composer card, above the input area. */
  topDeckContent?: React.ReactNode;
}

const CATEGORY_EMOTIONS: Record<string, { hover: GizziEmotion; select: GizziEmotion }> = {
  code: { hover: 'focused', select: 'proud' },
  create: { hover: 'curious', select: 'pleased' },
  write: { hover: 'pleased', select: 'proud' },
  learn: { hover: 'alert', select: 'focused' },
  allternit: { hover: 'mischief', select: 'mischief' },
};

const AGENT_COMMANDS: AgentCommand[] = [
  { command: 'A://ultrathink', label: 'Ultrathink', detail: 'Bias the request toward deeper reasoning and visible thinking.' },
  { command: 'A://plan', label: 'Plan', detail: 'Start in planning mode before executing changes.' },
  { command: 'A://build', label: 'Build', detail: 'Switch back to direct execution and implementation.' },
  { command: 'A://search', label: 'Search', detail: 'Lead with retrieval, docs, and grounded research.' },
  { command: 'A://tools', label: 'Tools', detail: 'Favor tool use and runtime actions over plain text responses.' },
];

interface ComposerMenuSubItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface ComposerMenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  hasSubmenu?: boolean;
  submenuItems?: ComposerMenuSubItem[];
  isActive?: boolean;
}

interface AgentWorkspacePreview {
  artifactCount: number;
  workspacePath: string | null;
  source: 'character' | 'openclaw' | null;
}

const ACTION_CATEGORIES = [
  {
    id: 'code',
    label: 'Code',
    icon: <Code size={14} />,
    options: [
      "Refactor this code for better readability",
      "Write a unit test for this function",
      "Explain how this logic works",
      "Find potential bugs in this snippet"
    ]
  },
  {
    id: 'create',
    label: 'Create',
    icon: <Plus size={14} />,
    options: [
      "Design a futuristic architecture concept",
      "Plan milestones for a creative project",
      "Generate character concepts for fiction",
      "Generate illustration ideas",
      "Develop editorial calendars"
    ]
  },
  {
    id: 'write',
    label: 'Write',
    icon: <PenTool size={14} />,
    options: [
      "Draft a professional email",
      "Write a blog post about AI",
      "Create a product description",
      "Summarize these meeting notes"
    ]
  },
  {
    id: 'learn',
    label: 'Learn',
    icon: <BookOpen size={14} />,
    options: [
      "Explain quantum physics simply",
      "How to bake sourdough bread",
      "Learn React hooks basics",
      "Basic Spanish phrases for travel"
    ]
  },
  {
    id: 'allternit',
    label: "Allternit's choice",
    icon: <Sparkle size={14} />,
    options: [
      "Surprise me with a fun fact",
      "Give me a daily productivity tip",
      "Recommend a classic book",
      "Tell me a joke"
    ]
  },
];

function getTextareaCaretPosition(
  textarea: HTMLTextAreaElement,
  text: string,
  index: number
): { x: number; y: number } {
  const div = document.createElement('div');
  const style = getComputedStyle(textarea);

  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.wordWrap = 'break-word';
  div.style.overflowWrap = 'break-word';
  div.style.font = style.font;
  div.style.lineHeight = style.lineHeight;
  div.style.padding = style.padding;
  div.style.width = style.width;
  div.style.boxSizing = 'border-box';
  div.style.letterSpacing = style.letterSpacing;
  div.style.textIndent = style.textIndent;
  div.style.textTransform = style.textTransform;

  const textBefore = text.slice(0, index);
  div.textContent = textBefore;
  const marker = document.createElement('span');
  marker.textContent = '\u200b'; // zero-width space
  div.appendChild(marker);

  document.body.appendChild(div);
  const markerRect = marker.getBoundingClientRect();
  const textareaRect = textarea.getBoundingClientRect();
  document.body.removeChild(div);

  return {
    x: markerRect.left - textareaRect.left,
    y: markerRect.top - textareaRect.top,
  };
}

export function ChatComposer({
  onSend,
  isLoading,
  onStop,
  selectedModel,
  selectedModelDisplayName,
  onOpenModelPicker,
  onSelectModel,
  placeholder = "How can I help you today?",
  variant = 'default',
  showTopActions = true,
  compact = false,
  hudMode = false,
  inputValue = '',
  onInteractionSignal,
  onAttentionChange,
  agentModeSurface,
  slashCommands,
  attachments: externalAttachments,
  onRemoveAttachment: externalRemoveAttachment,
  onAddAttachment: externalAddAttachment,
  onAgentSend,
  onMentionAgentChange,
  onPluginMentionChange,
  mentionAgentId: externalMentionAgentId,
  bottomDockContent,
  showModeToggle,
  topInfoBarContent,
  questionBarContent,
  topDeckContent,
  onStartBotSession,
}: ChatComposerProps) {
  const [input, setInput] = useState(inputValue);
  const effectivePlaceholder = placeholder;
  const isMobile = useIsMobile();
  const {
    isRecording: isVoiceRecording,
    interimTranscript,
    transcript: voiceTranscript,
    audioLevel,
    personaState,
    error: voiceError,
    startRecording: startVoiceRecording,
    stopRecording: stopVoiceRecording,
    clearTranscript: clearVoiceTranscript,
    setInteractionMode,
  } = useVoice();
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [composerFocused, setComposerFocused] = useState(false);
  const lastAgentFetchPulseRef = useRef<number | null>(null);
  const openClawDiscoveryRequestRef = useRef(0);
  const showAgentRailGuide = Boolean(
    agentModeSurface && agentModeSurface !== 'code',
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [toolAccess, setToolAccess] = useState<ToolAccessLevel>('all');
  const [activeStyle, setActiveStyle] = useState<ResponseStyle | null>(null);
  const chatProjects = useChatStore((s) => s.projects);
  const chatActiveProjectId = useChatStore((s) => s.activeProjectId);
  const chatSetActiveProject = useChatStore((s) => s.setActiveProject);
  const chatCreateProject = useChatStore((s) => s.createProject);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showModeSelectorMenu, setShowModeSelectorMenu] = useState(false);
  const [showProviderConnect, setShowProviderConnect] = useState(false);
  const [showConnectorMarketplace, setShowConnectorMarketplace] = useState(false);
  const [showOpenClawImportDialog, setShowOpenClawImportDialog] = useState(false);
  const [openClawCandidates, setOpenClawCandidates] = useState<OpenClawDiscoveredAgent[]>([]);
  const [isLoadingOpenClawCandidates, setIsLoadingOpenClawCandidates] = useState(false);
  const [openClawError, setOpenClawError] = useState<string | null>(null);
  const [importingOpenClawAgentId, setImportingOpenClawAgentId] = useState<string | null>(null);
  const activeSession = useActiveChatSession();
  const hasEmbeddedSession = useMemo(
    () => Boolean(activeSession && activeSession?.metadata?.sessionMode === 'agent'),
    [activeSession],
  );
  const [locallyEnabled, setLocallyEnabled] = useState(false);
  const [selectedTemplateTitle, setSelectedTemplateTitle] = useState<string | undefined>();
  const agentModeEnabled = hasEmbeddedSession || locallyEnabled;
  const [agentModePulse, setAgentModePulse] = useState(0);
  const prevAgentModeEnabledRef = useRef(agentModeEnabled);
  if (prevAgentModeEnabledRef.current !== agentModeEnabled) {
    prevAgentModeEnabledRef.current = agentModeEnabled;
    setAgentModePulse((p) => p + 1);
  }
  
  const {
    executionMode,
    isLoading: _isLoadingExecMode,
    isSaving: isSavingExecMode,
    setMode: setExecutionMode,
  } = useRuntimeExecutionMode();

  const [optimisticMode, setOptimisticMode] = useState<'plan' | 'build'>('build');

  useEffect(() => {
    if (executionMode?.mode) {
      setOptimisticMode(executionMode.mode === 'plan' ? 'plan' : 'build');
    }
  }, [executionMode?.mode]);

  const _uiMode = optimisticMode;

  const _handleToggleMode = useCallback(async () => {
    if (isSavingExecMode) {
      return;
    }

    const newMode: RuntimeExecutionMode = optimisticMode === 'plan' ? 'auto' : 'plan';
    const newUiMode = newMode === 'plan' ? 'plan' : 'build';

    setOptimisticMode(newUiMode);

    setExecutionMode(newMode).catch((err) => {
      console.error('[ChatComposer] Failed to persist mode change:', err);
    });
  }, [isSavingExecMode, optimisticMode, setExecutionMode]);

  const [showAgentGuidePadding, setShowAgentGuidePadding] = useState(
    Boolean(agentModeEnabled && showAgentRailGuide),
  );
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [agentCommandMenuVisible, setAgentCommandMenuVisible] = useState(false);
  const [agentCommandFilter, setAgentCommandFilter] = useState('');

  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [selectedMentionAgentId, setSelectedMentionAgentId] = useState<string | null>(externalMentionAgentId ?? null);
  const [selectedPluginMention, setSelectedPluginMention] = useState<PluginMentionTarget | null>(null);
  const pluginMentionTargets = usePluginMentionTargets();

  const [prevExternalMentionAgentId, setPrevExternalMentionAgentId] = useState(externalMentionAgentId);
  if (externalMentionAgentId !== prevExternalMentionAgentId) {
    setPrevExternalMentionAgentId(externalMentionAgentId);
    if (externalMentionAgentId !== undefined) {
      setSelectedMentionAgentId(externalMentionAgentId);
      if (externalMentionAgentId) {
        setLocallyEnabled(true);
      }
    }
  }

  const [internalAttachments, setInternalAttachments] = useState<ChatAttachment[]>([]);
  const attachments = externalAttachments ?? internalAttachments;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addAttachment = useCallback((attachment: ChatAttachment) => {
    if (externalAddAttachment) {
      externalAddAttachment(attachment);
    } else {
      setInternalAttachments((prev) => [...prev, attachment]);
    }
  }, [externalAddAttachment]);

  const removeAttachment = useCallback((id: string) => {
    if (externalRemoveAttachment) {
      externalRemoveAttachment(id);
    } else {
      setInternalAttachments((prev) => prev.filter((a) => a.id !== id));
    }
  }, [externalRemoveAttachment]);

  const isGifRecording = useRecordingStore((s) => s.isRecording);
  const gifDuration = useRecordingStore((s) => s.duration);
  const startGifRecording = useRecordingStore((s) => s.startRecording);
  const stopGifRecording = useRecordingStore((s) => s.stopRecording);

  const isBrowserSurface = agentModeSurface === 'browser';
  // Glass composer look applies to Chat, Cowork, and Code — the Browser and
  // Design surfaces keep the solid composer background.
  const useGlassComposer = agentModeSurface !== 'browser' && agentModeSurface !== 'design';

  const selectedSurfaceAgentId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedAgentIdBySurface[agentModeSurface] : null,
  );
  const setSelectedSurfaceAgent = useAgentSurfaceModeStore((state) => state.setSelectedAgent);
  const selectedModeId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedModeBySurface[agentModeSurface] : null,
  );
  const setSelectedMode = useAgentSurfaceModeStore((state) => state.setSelectedMode);
  const selectedSwarmSubMode = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.swarmSubModeBySurface[agentModeSurface] : 'specialist-team',
  );
  const setSwarmSubMode = useAgentSurfaceModeStore((state) => state.setSwarmSubMode);
  const agents = useAgentsWithSwarms();
  const { isHandingOff, handoff: runMentionHandoff } = useMentionHandoff();

  const selectedMentionAgent = useMemo(() => {
    if (!selectedMentionAgentId) return null;
    return agents.find((a) => a.id === selectedMentionAgentId) || null;
  }, [selectedMentionAgentId, agents]);

  const filteredMentionAgents = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return agents.filter(
      (a) =>
        a.isBot === true &&
        (a.name.toLowerCase().includes(q) ||
          (a.botProfile?.displayName ?? '').toLowerCase().includes(q)) &&
        isAgentAllowedOnSurface(a, agentModeSurface ?? 'chat'),
    );
  }, [mentionOpen, mentionQuery, agents, agentModeSurface]);

  const filteredPluginTargets = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    const matches = pluginMentionTargets.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description ?? '').toLowerCase().includes(q),
    );
    // Empty query: show a compact starter set (connected connectors first,
    // then plugins) — the full catalog is one keystroke away.
    return q ? matches : matches.slice(0, 8);
  }, [mentionOpen, mentionQuery, pluginMentionTargets]);

  const mentionItemCount = filteredMentionAgents.length + filteredPluginTargets.length;

  const handleSelectMentionAgent = useCallback((agent: Agent) => {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = input.slice(0, lastAtIndex);
      const after = input.slice(lastAtIndex + mentionQuery.length + 1);
      setInput(before + after);
    }
    setSelectedMentionAgentId(agent.id);
    onMentionAgentChange?.(agent.id);
    // One chip at a time: clear any plugin/connector mention
    setSelectedPluginMention(null);
    onPluginMentionChange?.(null);
    setLocallyEnabled(true);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(0);
    // If the user @mentioned a bot, also bind it as the surface's selected bot
    // so the composer and session creation are aligned.
    if (agent.isBot && agentModeSurface) {
      setSelectedSurfaceAgent(agentModeSurface, agent.id);
    }
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [input, mentionQuery, onMentionAgentChange, onPluginMentionChange, agentModeSurface, setSelectedSurfaceAgent]);

  const handleSelectPluginMention = useCallback((target: PluginMentionTarget) => {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = input.slice(0, lastAtIndex);
      const after = input.slice(lastAtIndex + mentionQuery.length + 1);
      setInput(before + after);
    }
    setSelectedPluginMention(target);
    onPluginMentionChange?.(target);
    // One chip at a time: clear any agent mention
    setSelectedMentionAgentId(null);
    onMentionAgentChange?.(null);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(0);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [input, mentionQuery, onMentionAgentChange, onPluginMentionChange]);

  const handleRemovePluginMention = useCallback(() => {
    setSelectedPluginMention(null);
    onPluginMentionChange?.(null);
  }, [onPluginMentionChange]);

  const handleRemoveMentionAgent = useCallback(() => {
    setSelectedMentionAgentId(null);
    onMentionAgentChange?.(null);
    setLocallyEnabled(false);
  }, [onMentionAgentChange]);

  const parseMention = useCallback((val: string) => {
    const lastAtIndex = val.lastIndexOf('@');
    if (lastAtIndex === -1) {
      setMentionOpen(false);
      setMentionQuery('');
      return;
    }
    const afterAt = val.slice(lastAtIndex + 1);
    const beforeAt = val.slice(0, lastAtIndex);
    const charBeforeAt = beforeAt.slice(-1);
    if (beforeAt.length > 0 && !/\s/.test(charBeforeAt)) {
      setMentionOpen(false);
      setMentionQuery('');
      return;
    }
    if (afterAt.includes(' ') || afterAt.includes('\n')) {
      setMentionOpen(false);
      setMentionQuery('');
      return;
    }
    setMentionOpen(true);
    setMentionQuery(afterAt);
    setMentionIndex(0);
  }, []);
  
  const [taskBarExpanded, setTaskBarExpanded] = useState(false);
  const wihs = useUnifiedStore((state) => state.wihs);
  const myWihs = useUnifiedStore((state) => state.myWihs);
  const fetchWihs = useUnifiedStore((state) => state.fetchWihs);
  const selectWih = useUnifiedStore((state) => state.selectWih);
  const selectedWihId = useUnifiedStore((state) => state.selectedWihId);

  useEffect(() => {
    if (!taskBarExpanded) {
      return;
    }

    let cancelled = false;
    const loadWihs = async () => {
      try {
        await fetchWihs();
      } catch {
        // Silent fail
      }
    };
    loadWihs();
    const interval = setInterval(() => {
      if (!cancelled) {
        loadWihs();
      }
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchWihs, taskBarExpanded]);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  const createAgent = useAgentStore((state) => state.createAgent);
  const isLoadingAgents = useAgentStore((state) => state.isLoadingAgents);
  const agentError = useAgentStore((state) => state.error);
  const characterArtifacts = useAgentStore((state) => state.characterArtifacts);
  const compileCharacterLayer = useAgentStore((state) => state.compileCharacterLayer);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  const { discoveryResult, fetchProviders, realModels } = useModelDiscovery();

  const selectedSurfaceAgent = useMemo(
    () =>
      selectedSurfaceAgentId
        ? agents.find((agent) => agent.id === selectedSurfaceAgentId) || null
        : null,
    [agents, selectedSurfaceAgentId],
  );

  const handleToggleAgentMode = useCallback(() => {
    setLocallyEnabled((prev) => {
      const next = !prev;
      if (next) {
        // When a bot is already selected, mount its session in the rail
        // instead of leaving the user on a generic home chat.
        if (selectedSurfaceAgent?.isBot && onStartBotSession) {
          onStartBotSession(selectedSurfaceAgent);
          return next;
        }
        // When turning bot mode on and no bot is selected, open the bot picker
        // so the user can choose one immediately.
        if (!selectedSurfaceAgent && agents.some((a) => a.isBot)) {
          setShowAgentMenu(true);
        }
      }
      return next;
    });
  }, [selectedSurfaceAgent, agents, onStartBotSession]);

  const selectedWorkspacePreview = useMemo<AgentWorkspacePreview>(() => {
    if (!selectedSurfaceAgent) {
      return {
        artifactCount: 0,
        workspacePath: null,
        source: null,
      };
    }

    const artifacts = characterArtifacts[selectedSurfaceAgent.id] || [];
    const workspaceArtifact =
      artifacts.find((artifact) => artifact.path?.includes('/workspace/')) ||
      artifacts.find((artifact) => artifact.path?.includes('/agents/')) ||
      null;
    const importedWorkspacePath = getOpenClawWorkspacePathFromAgent(selectedSurfaceAgent);

    return {
      artifactCount: artifacts.length,
      workspacePath: workspaceArtifact?.path ?? importedWorkspacePath,
      source: workspaceArtifact?.path ? 'character' : importedWorkspacePath ? 'openclaw' : null,
    };
  }, [characterArtifacts, selectedSurfaceAgent]);
  const agentModeTheme = useMemo(() => {
    return getAgentModeSurfaceTheme(agentModeSurface);
  }, [agentModeSurface]);

  const cachedProviderModels = useMemo(() => readProviderDiscoveryCache(), []);
  const [terminalModels, setTerminalModels] = useState<any[]>(cachedProviderModels ?? []);
  const [terminalModelsLoading, setTerminalModelsLoading] = useState(cachedProviderModels === null);

  useEffect(() => {
    // The web client already loads the provider registry through
    // useModelDiscovery below. A second eager GET here duplicated the same
    // request on every composer mount and doubled the console/network noise
    // when a runtime was offline. Keep this path only for Electron's sidecar,
    // whose /provider response is a distinct local source.
    if (!window.allternitSidecar) {
      setTerminalModelsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchTerminalModels() {
      try {
        const response = await fetchRegisteredProviders(AbortSignal.timeout(5000));
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const allModels: any[] = [];
        if (data.all && Array.isArray(data.all)) {
          // Normalize two backend shapes:
          // - Gizzi runtime: { all: [...], connected: ['id', ...] }
          // - allternit-api: { all: [...] } with per-provider status field
          const connected = Array.isArray(data.connected) ? new Set<string>(data.connected) : null;
          const registeredProviders = data.all.filter((provider: any) => {
            if (provider.id === 'echo') return false;
            if (connected?.size) return connected.has(provider.id);
            return provider.status === 'active';
          });
          registeredProviders.forEach((provider: any) => {
            if (!provider.models) return;
            const entries = Array.isArray(provider.models)
              ? provider.models.map((m: string) => [m, { name: m }] as const)
              : Object.entries(provider.models);
            entries.forEach(([modelId, modelData]: [string, any]) => {
              allModels.push({
                id: `${provider.id}/${modelId}`,
                name: modelData?.name || modelId,
                providerId: provider.id,
                providerName: provider.name || provider.id,
              });
            });
          });
        }
        if (!cancelled && allModels.length > 0) {
          setTerminalModels(allModels);
          writeProviderDiscoveryCache(allModels);
        }
      } catch {
        // provider discovery failed; leave cache as-is
      } finally {
        if (!cancelled) setTerminalModelsLoading(false);
      }
    }
    void fetchTerminalModels();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  useEffect(() => {
    if (!agentModeSurface || !agentModeEnabled || isLoadingAgents) {
      return;
    }

    if (agentError && lastAgentFetchPulseRef.current === agentModePulse) {
      return;
    }

    lastAgentFetchPulseRef.current = agentModePulse;
    void fetchAgents().catch((err) => {
      console.warn('[ChatComposer] Failed to fetch agents:', err);
    });
  }, [
    agentError,
    agentModeEnabled,
    agentModePulse,
    agentModeSurface,
    agents.length,
    fetchAgents,
    isLoadingAgents,
  ]);

  const [prevAgentsOC, setPrevAgentsOC] = useState(agents);
  const [prevAgentModeEnabledOC, setPrevAgentModeEnabledOC] = useState(agentModeEnabled);
  const [prevAgentModeSurfaceOC, setPrevAgentModeSurfaceOC] = useState(agentModeSurface);

  if (agents !== prevAgentsOC || agentModeEnabled !== prevAgentModeEnabledOC || agentModeSurface !== prevAgentModeSurfaceOC) {
    setPrevAgentsOC(agents);
    setPrevAgentModeEnabledOC(agentModeEnabled);
    setPrevAgentModeSurfaceOC(agentModeSurface);

    if (agentModeSurface && agentModeEnabled && openClawCandidates.length > 0) {
      const resolved = resolveOpenClawRegistration(openClawCandidates, agents);
      const unregistered = resolved.filter(
        (candidate) => !candidate.registered_agent_id,
      );

      if (unregistered.length !== openClawCandidates.length) {
        setOpenClawCandidates(unregistered);
      }
    }
  }

  useEffect(() => {
    // Canonical built-in modes execute without binding an OpenClaw workspace.
    // Discovery here previously retriggered after every failed request and
    // flooded the gateway with hundreds of 501 responses.
    if (!agentModeSurface || !agentModeEnabled || isCanonicalAgentMode(selectedModeId)) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    if (isLoadingOpenClawCandidates) {
      return;
    }

    const hasSelectedAgent = Boolean(selectedSurfaceAgentId);
    const hasRegistryAgents = agents.length > 0;
    const dismissKey = `allternit-openclaw-import-dismissed:${agentModeSurface}`;
    const dismissed = window.sessionStorage.getItem(dismissKey) === 'true';

    const requestId = openClawDiscoveryRequestRef.current + 1;
    openClawDiscoveryRequestRef.current = requestId;
    setIsLoadingOpenClawCandidates(true);
    setOpenClawError(null);

    void discoverOpenClawAgents()
      .then((response) => {
        if (openClawDiscoveryRequestRef.current !== requestId) {
          return;
        }

        const resolved = resolveOpenClawRegistration(response.agents || [], agents);
        const unregistered = resolved.filter(
          (candidate) => !candidate.registered_agent_id,
        );
        setOpenClawCandidates(unregistered);

        if (unregistered.length === 0) {
          setShowOpenClawImportDialog(false);
          return;
        }

        if (!hasSelectedAgent && !hasRegistryAgents && !dismissed) {
          setShowOpenClawImportDialog(true);
        }
      })
      .catch((error) => {
        if (openClawDiscoveryRequestRef.current !== requestId) {
          return;
        }
        setOpenClawError(error instanceof Error ? error.message : 'Failed to inspect OpenClaw agents');
      })
      .finally(() => {
        if (openClawDiscoveryRequestRef.current === requestId) {
          setIsLoadingOpenClawCandidates(false);
        }
      });
  }, [
    agentModeEnabled,
    agentModeSurface,
    selectedModeId,
    selectedSurfaceAgentId,
    agents,
    isLoadingOpenClawCandidates,
  ]);

  useEffect(() => {
    if (!selectedSurfaceAgent) {
      return;
    }

    if ((characterArtifacts[selectedSurfaceAgent.id] || []).length > 0) {
      return;
    }

    void loadCharacterLayer(selectedSurfaceAgent.id)
      .then(() => compileCharacterLayer(selectedSurfaceAgent.id))
      .catch(() => {});
  }, [
    characterArtifacts,
    compileCharacterLayer,
    loadCharacterLayer,
    selectedSurfaceAgent,
  ]);

  useEffect(() => {
    if (!agentModeEnabled && showAgentMenu) {
      setShowAgentMenu(false);
    }
  }, [agentModeEnabled, showAgentMenu]);

  // When a bot is selected as the surface agent, surface it as an @mention chip
  // in the composer so the user sees which bot will handle the message.
  useEffect(() => {
    if (selectedSurfaceAgent?.isBot) {
      setSelectedMentionAgentId(selectedSurfaceAgent.id);
      setLocallyEnabled(true);
    }
  }, [selectedSurfaceAgent?.id, selectedSurfaceAgent?.isBot]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { agentId, agentName } = (e as CustomEvent).detail;
      if (!agentId) return;
      setSelectedMentionAgentId(agentId);
      onMentionAgentChange?.(agentId);
      setLocallyEnabled(true);
      window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      window.dispatchEvent(new CustomEvent('allternit:agent-pulse', {
        detail: { agentId, agentName },
      }));
    };
    window.addEventListener('allternit:mention-agent' as any, handler);
    return () => window.removeEventListener('allternit:mention-agent' as any, handler);
  }, [onMentionAgentChange]);

  useEffect(() => {
    if (!showAgentRailGuide) {
      if (showAgentGuidePadding) {
        setShowAgentGuidePadding(false);
      }
      return;
    }

    if (agentModeEnabled) {
      if (!showAgentGuidePadding) {
        setShowAgentGuidePadding(true);
      }
      return;
    }

    if (!showAgentGuidePadding) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowAgentGuidePadding(false);
    }, 360);

    return () => window.clearTimeout(timeoutId);
  }, [agentModeEnabled, showAgentGuidePadding, showAgentRailGuide]);

  // Inline state adjustment for inputValue change
  const [prevInputValue, setPrevInputValue] = useState(inputValue);
  if (inputValue !== prevInputValue) {
    setPrevInputValue(inputValue);
    setInput(inputValue);
  }

  const allModels = useMemo(() => {
    const modelMap = new Map<string, any>();

    // 1) Runtime-discovered models (e.g. terminal server / gateway providers)
    terminalModels.forEach((model) => {
      if (!model?.id) return;
      modelMap.set(model.id, model);
    });

    // 2) Registry models from Allternit Brain / Gizzi provider catalog
    (realModels || []).forEach((provider) => {
      const modelsList = Array.isArray(provider.models)
        ? provider.models
        : provider.models
          ? Object.entries(provider.models as Record<string, any>).map(([id, data]) => ({ id, ...data }))
          : [];
      modelsList.forEach((model: any) => {
        if (!model?.id) return;
        const existing = modelMap.get(model.id);
        const enriched = {
          ...model,
          providerId: provider.id,
          providerName: provider.name,
        };
        modelMap.set(model.id, existing ? { ...existing, ...enriched } : enriched);
      });
    });

    // 3) Provider-specific discovery result (lowest priority, fills gaps)
    (discoveryResult?.models || []).forEach((model: any) => {
      if (!model?.id || modelMap.has(model.id)) return;
      modelMap.set(model.id, model);
    });

    // 4) Local CLI agents (Kimi CLI, Claude Code, Codex, etc.) so the HUD and
    // inline composer can route messages to installed subprocess brains.
    ALL_MODELS.filter((m) => m.runtimeType === 'cli').forEach((model) => {
      if (modelMap.has(model.id)) return;
      modelMap.set(model.id, {
        id: model.id,
        name: model.name,
        providerId: model.provider,
        providerName: model.provider,
        runtimeType: model.runtimeType,
      });
    });

    return Array.from(modelMap.values());
  }, [discoveryResult, realModels, terminalModels]);

  // Model lookup map for performance
  const modelsMap = useMemo(() => {
    return new Map<string, any>(allModels.map((m) => [m.id, m]));
  }, [allModels]);

  const handleModelSelect = useCallback((model: any) => {
    if (onSelectModel) {
      const isCli = model.runtimeType === 'cli';
      const providerId = model.providerId || 'allternit';
      onSelectModel({
        providerId,
        // CLI agents use their own id as the profile (e.g. "kimi-cli") so the
        // backend and Gizzi runtime can route to the right subprocess adapter.
        profileId: isCli ? model.id : `${providerId}-acp`,
        modelId: model.id,
        modelName: model.name,
      });
    }
    setShowModelMenu(false);
  }, [onSelectModel]);

  useEffect(() => {
    if (!selectedModel && allModels.length > 0) {
      // Pick the first real model returned by the registry/terminal discovery.
      // Avoid hardcoding model IDs that may not exist on this machine.
      handleModelSelect(allModels[0]);
    }
  }, [allModels, selectedModel, handleModelSelect]);

  useEffect(() => {
    if (variant !== 'large') {
      const raf = window.requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(raf);
    }
  }, [variant]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(24, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const requiresAgentSelection = Boolean(
    agentModeSurface && agentModeEnabled && !isCanonicalAgentMode(selectedModeId),
  );
  const canSubmit = Boolean(input.trim()) && !isLoading && !isHandingOff && (!requiresAgentSelection || Boolean(selectedSurfaceAgent));

  const buildEnrichedInput = useCallback((baseInput: string) => {
    const parts: string[] = [];
    if (webSearchEnabled) parts.push('[web_search_enabled]');
    if (researchEnabled) parts.push('[research_enabled]');
    if (toolAccess !== 'all') parts.push(`[tool_access:${toolAccess}]`);
    const stylePrefix = activeStyle
      ? { formal: 'Respond in a formal, professional tone. ', creative: 'Respond in a creative, imaginative style. ', technical: 'Respond in a precise, technical manner. ' }[activeStyle]
      : '';
    return `${parts.join(' ')}${parts.length > 0 ? ' ' : ''}${stylePrefix}${baseInput}`.trim();
  }, [activeStyle, researchEnabled, toolAccess, webSearchEnabled]);

  const enterVoiceMode = useCallback(async () => {
    clearVoiceTranscript();
    setInteractionMode('voice');
    setVoiceModeActive(true);
    const started = await startVoiceRecording();
    if (!started) {
      setVoiceModeActive(false);
      setInteractionMode('text');
    }
  }, [clearVoiceTranscript, setInteractionMode, startVoiceRecording]);

  const leaveVoiceMode = useCallback(() => {
    if (isVoiceRecording) stopVoiceRecording();
    setVoiceModeActive(false);
    setInteractionMode('text');
  }, [isVoiceRecording, setInteractionMode, stopVoiceRecording]);

  // Core send path shared by text submit and voice submit. Resolves inline
  // @mentions, hands them off, and routes the enriched prompt to the right
  // consumer (browser agent, MiroFish, agent-mode send, or plain chat).
  const submitMessage = useCallback(async (rawText: string) => {
    let messageText = rawText;

    // Inline @mention handoff: resolve, execute, and append replies before
    // sending to the active agent.
    const inlineMentions = parseMentions(messageText);
    if (inlineMentions.length > 0) {
      try {
        const handoff = await runMentionHandoff(messageText, selectedSurfaceAgent ?? undefined);
        messageText = `${handoff.cleanText}${handoff.handoffNote}`;
      } catch (err) {
        // If handoff fails, send the original text with a note so the user
        // knows the mention could not be routed.
        messageText = `${messageText}\n\n[@mention routing failed: ${err instanceof Error ? err.message : String(err)}]`;
      }
    }

    const enrichedInput = buildEnrichedInput(messageText);

    if (selectedModeId === 'computer-use') {
      useBrowserAgentStore.getState().runAcuTask(enrichedInput);
    }

    if (selectedModeId === 'swarms' && selectedSwarmSubMode === 'population-simulation') {
      // MiroFish's single entry point is this composer: the prompt goes to
      // the results-only panel below, which interprets and runs it — never
      // through the normal agent-mode send.
      useMiroFishRunStore.getState().requestRun(enrichedInput);
    } else if (onAgentSend && agentModeSurface && (agentModeEnabled || isCanonicalAgentMode(selectedModeId))) {
      onAgentSend(enrichedInput, selectedModeId ? { modeId: selectedModeId as CanonicalAgentModeId, templateTitle: selectedTemplateTitle } : undefined);
    } else {
      onSend(enrichedInput);
    }
  }, [
    agentModeEnabled,
    agentModeSurface,
    buildEnrichedInput,
    isCanonicalAgentMode,
    onAgentSend,
    onSend,
    runMentionHandoff,
    selectedModeId,
    selectedSurfaceAgent,
    selectedSwarmSubMode,
    selectedTemplateTitle,
  ]);

  useEffect(() => {
    if (!voiceModeActive || !voiceTranscript?.trim()) return;
    const spokenInput = voiceTranscript.trim();
    if (requiresAgentSelection && !selectedSurfaceAgent) {
      setInput(spokenInput);
      setInteractionMode('text');
      setVoiceModeActive(false);
      clearVoiceTranscript();
      return;
    }

    void submitMessage(spokenInput);

    setVoiceModeActive(false);
    clearVoiceTranscript();
  }, [
    clearVoiceTranscript,
    requiresAgentSelection,
    selectedSurfaceAgent,
    setInteractionMode,
    submitMessage,
    voiceModeActive,
    voiceTranscript,
  ]);
  const hasTopInfoBar = Boolean(topInfoBarContent);
  const hasQuestionBar = Boolean(questionBarContent);
  const agentWorkspaceSummary = selectedWorkspacePreview.artifactCount > 0
    ? `${selectedWorkspacePreview.artifactCount} workspace files ready`
    : selectedWorkspacePreview.source === 'openclaw'
      ? 'OpenClaw workspace linked'
    : 'Workspace profile will compile on first use';
  const availableBots = useMemo(() => agents.filter((a) => a.isBot === true), [agents]);
  const agentHelperText = !requiresAgentSelection
    ? null
      : selectedSurfaceAgent
        ? `${getBotDisplayName(selectedSurfaceAgent)} active. ${agentWorkspaceSummary}.`
        : isLoadingAgents && availableBots.length === 0
          ? 'Loading bots...'
          : availableBots.length > 0
            ? 'Choose a bot before sending so this surface can bind to a real bot workspace.'
            : openClawCandidates.length > 0
              ? openClawCandidates.length === 1 && openClawCandidates[0]?.display_name
                ? `Found "${openClawCandidates[0].display_name}" OpenClaw agent. Import to continue.`
                : `Detected ${openClawCandidates.length} OpenClaw agent${openClawCandidates.length === 1 ? '' : 's'} on this machine. Import one to continue.`
              : agentError === 'API_OFFLINE'
                ? 'Bot registry is offline. Turn Bot Off or bring the gateway back to choose a bot.'
                : 'No bots are available yet. Create one in Agent Studio and package it as a bot.';

  const closeOpenClawPrompt = useCallback(() => {
    setShowOpenClawImportDialog(false);
  }, []);

  const dismissOpenClawPrompt = useCallback(() => {
    if (typeof window !== 'undefined' && agentModeSurface) {
      window.sessionStorage.setItem(`allternit-openclaw-import-dismissed:${agentModeSurface}`, 'true');
    }
    closeOpenClawPrompt();
  }, [agentModeSurface, closeOpenClawPrompt]);

  const handleImportOpenClawAgent = useCallback(async (candidate: OpenClawDiscoveredAgent) => {
    if (!agentModeSurface) {
      return;
    }

    const importStart = Date.now();
    
    setImportingOpenClawAgentId(candidate.agent_id);
    setOpenClawError(null);

    try {
      const input = buildOpenClawImportInput(candidate);
      const created = await createAgent(input);
      setSelectedSurfaceAgent(agentModeSurface, created.id);
      void loadCharacterLayer(created.id)
        .then(() => compileCharacterLayer(created.id))
        .catch(() => {});
      setOpenClawCandidates((current) =>
        current.filter(
          (item) => getRegisteredOpenClawAgentId(item, [created]) !== created.id,
        ),
      );
      closeOpenClawPrompt();
      setShowAgentMenu(false);
    } catch (error) {
      console.error(`[ChatComposer] Import failed after ${Date.now() - importStart}ms:`, error);
      let errorMessage = 'Failed to import OpenClaw agent';
      
      if (error instanceof Error) {
        const msg = error.message;
        
        if (msg.includes('is not valid JSON') || msg.includes('Unexpected token')) {
          errorMessage = 'Agent Studio API is not available. Please ensure the backend services are running and try again.';
        } else if (msg.includes('API_OFFLINE') || msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
          errorMessage = 'Cannot connect to Agent Studio. Please check your connection and ensure the API is running.';
        } else if (msg.includes('429') || msg.includes('rate limit') || msg.includes('Rate limit')) {
          errorMessage = 'Rate limit exceeded. Please wait a few seconds and try again.';
        } else if (msg.includes('409') || msg.includes('already exists') || msg.includes('duplicate')) {
          errorMessage = 'An agent with this name already exists in Agent Studio.';
        } else if (msg.includes('404')) {
          errorMessage = 'Agent Studio endpoint not found. Please verify your setup.';
        } else if (msg.includes('500') || msg.includes('Internal Server Error')) {
          errorMessage = 'Agent Studio encountered an internal error. Please try again later.';
        } else {
          errorMessage = msg;
        }
      }
      
      setOpenClawError(errorMessage);
    } finally {
      setImportingOpenClawAgentId(null);
    }
  }, [
    agentModeSurface,
    compileCharacterLayer,
    closeOpenClawPrompt,
    createAgent,
    loadCharacterLayer,
    setSelectedSurfaceAgent,
  ]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await submitMessage(input);

    setInput('');
    setActiveCategory(null);
    setShowAgentMenu(false);
    setSlashMenuVisible(false);
    setSlashFilter('');
    setAgentCommandMenuVisible(false);
    setAgentCommandFilter('');
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(0);
    // Plugin/connector mentions are one-shot: sending consumes the chip.
    setSelectedPluginMention(null);
    onPluginMentionChange?.(null);
    if (!externalAttachments) {
      setInternalAttachments([]);
    }
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const filteredSlashCommands = useMemo(() => {
    if (!slashCommands || !slashMenuVisible) return [];
    if (!slashFilter) return slashCommands;
    return slashCommands.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(slashFilter.toLowerCase()) ||
        cmd.label.toLowerCase().includes(slashFilter.toLowerCase()),
    );
  }, [slashCommands, slashMenuVisible, slashFilter]);
  const filteredAgentCommands = useMemo(() => {
    if (!agentCommandMenuVisible) return [];
    if (!agentCommandFilter) return AGENT_COMMANDS;
    return AGENT_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(agentCommandFilter.toLowerCase()) ||
        cmd.label.toLowerCase().includes(agentCommandFilter.toLowerCase()) ||
        cmd.detail.toLowerCase().includes(agentCommandFilter.toLowerCase()),
    );
  }, [agentCommandFilter, agentCommandMenuVisible]);
  const isAgentCommandMode = input.trimStart().startsWith('A://');

  const handleGitHubFetch = useCallback(async () => {
    if (!githubUrl.trim()) return;
    setGithubLoading(true);
    try {
      const raw = githubUrl
        .replace('https://github.com/', 'https://raw.githubusercontent.com/')
        .replace('/blob/', '/');
      const resp = await fetch(raw);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const filename = githubUrl.split('/').pop() || 'github-file';
      const blob = new Blob([text], { type: 'text/plain' });
      const file = new File([blob], filename, { type: 'text/plain' });
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        addAttachment({ id: `gh-${Date.now()}`, name: filename, dataUrl, type: 'code' });
      };
      reader.readAsDataURL(file);
    } catch {
      // ignore import failures
    } finally {
      setGithubLoading(false);
      setGithubUrl('');
      setShowPlusMenu(false);
    }
  }, [githubUrl, addAttachment]);

  const handleCaptureScreenshot = useCallback(async () => {
    setShowPlusMenu(false);
    try {
      useBrowserAgentStore.getState().captureScreenshot();

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d')!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      const dataUrl = c.toDataURL('image/png');
      addAttachment({
        id: `screenshot-${Date.now()}`,
        name: `Screenshot ${new Date().toLocaleTimeString()}`,
        dataUrl,
        type: 'screenshot',
      });
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    }
  }, [addAttachment]);

  const handleToggleGifRecording = useCallback(async () => {
    setShowPlusMenu(false);
    if (isGifRecording) {
      try {
        const result = await stopGifRecording();
        if (result.filePath) {
          try {
            const resp = await fetch(result.filePath);
            const blob = await resp.blob();
            const reader = new FileReader();
            reader.onload = () => {
              addAttachment({
                id: `gif-${Date.now()}`,
                name: `Recording ${result.duration || 0}s (${result.frames || 0} frames)`,
                dataUrl: reader.result as string,
                type: 'gif',
              });
            };
            reader.readAsDataURL(blob);
          } catch {
            addAttachment({
              id: `gif-${Date.now()}`,
              name: `Recording ${result.duration || 0}s — ${result.filePath}`,
              dataUrl: `file://${result.filePath}`,
              type: 'gif',
            });
          }
        }
      } catch (err) {
        console.error('Failed to stop GIF recording:', err);
      }
    } else {
      try {
        await startGifRecording(undefined, 'gif', 10);
      } catch (err) {
        console.error('Failed to start GIF recording:', err);
      }
    }
  }, [addAttachment, isGifRecording, startGifRecording, stopGifRecording]);

  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        addAttachment({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: file.name,
          dataUrl: reader.result as string,
          type: 'image',
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }, [addAttachment]);

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    for (const { file, dataUrl } of files) {
      const isImage = file.type.startsWith('image/');
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      let fileType: ChatAttachment['type'] = 'other';
      if (file.type === 'image/gif' || ext === 'gif') fileType = 'gif';
      else if (isImage) fileType = 'image';
      else if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) fileType = 'document';
      else if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'css', 'html'].includes(ext)) fileType = 'code';
      else if (['json'].includes(ext)) fileType = 'json';
      else if (['csv', 'xlsx', 'xls'].includes(ext)) fileType = 'spreadsheet';
      
      addAttachment({
        id: `${fileType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        dataUrl: dataUrl,
        type: fileType === 'other' ? 'document' : fileType,
      });
    }
  }, [addAttachment]);

  useDropTarget('chat', handleDroppedFiles);

  const handleSlashCommand = useCallback((cmd: SlashCommand) => {
    setSlashMenuVisible(false);
    setSlashFilter('');

    switch (cmd.command) {
      case '/screenshot':
        void handleCaptureScreenshot();
        break;
      case '/navigate':
        setInput('/navigate ');
        textareaRef.current?.focus();
        break;
      case '/extract':
        onSend('/extract');
        setInput('');
        break;
      case '/workflow':
        onSend('/workflow');
        setInput('');
        break;
      case '/task':
        onSend('/task');
        setInput('');
        break;
      default:
        onSend(cmd.command);
        setInput('');
        break;
    }
  }, [handleCaptureScreenshot, onSend]);

  const handleAgentCommand = useCallback((cmd: AgentCommand) => {
    setInput(`${cmd.command} `);
    setAgentCommandMenuVisible(false);
    setAgentCommandFilter('');
    textareaRef.current?.focus();
  }, []);

  const handleOptionHover = (option: string) => {
    setInput(option);
    if (activeCategory) {
      onInteractionSignal?.(CATEGORY_EMOTIONS[activeCategory]?.hover ?? 'curious');
    }
  };

  const handleBrowseAllModels = useCallback(() => {
    setShowModelMenu(false);
    onOpenModelPicker?.();
  }, [onOpenModelPicker]);

  const displayModelName = selectedModelDisplayName || (modelsMap.get(selectedModel)?.name || allModels[0]?.name || "Select Model");
  
  const selectedProviderMeta = useMemo(() => {
    if (!selectedModel) return getProviderMeta('allternit');
    
    const model = modelsMap.get(selectedModel);
    if (model && 'providerId' in model) {
      const providerId = (model as any).providerId || (model as any).provider;
      if (providerId) return getProviderMeta(providerId);
    }
    
    const parts = selectedModel.split('/');
    if (parts.length > 1) return getProviderMeta(parts[0]);
    
    return getProviderMeta('allternit');
  }, [selectedModel, modelsMap]);
  
  const setTrackingAttention = useCallback((x: number, y: number, state: GizziAttention['state'] = 'tracking') => {
    onAttentionChange?.({
      state,
      target: { x, y },
    });
  }, [onAttentionChange]);

  const clearAttention = useCallback(() => {
    onAttentionChange?.(null);
  }, [onAttentionChange]);

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && mentionItemCount > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        setMentionQuery('');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) =>
          Math.min(prev + 1, mentionItemCount - 1)
        );
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (mentionIndex < filteredMentionAgents.length) {
          handleSelectMentionAgent(filteredMentionAgents[mentionIndex]);
        } else {
          handleSelectPluginMention(filteredPluginTargets[mentionIndex - filteredMentionAgents.length]);
        }
        return;
      }
    }
    if (slashMenuVisible && filteredSlashCommands.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlashMenuVisible(false);
        setSlashFilter('');
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault();
        handleSlashCommand(filteredSlashCommands[0]);
        return;
      }
    }
    if (agentCommandMenuVisible && filteredAgentCommands.length > 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setAgentCommandMenuVisible(false);
        setAgentCommandFilter('');
        return;
      }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey && !input.trim().includes(' '))) {
        e.preventDefault();
        handleAgentCommand(filteredAgentCommands[0]);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={cn(
        'w-full flex flex-col items-center box-border relative pt-0',
        agentModeSurface && agentModeEnabled && agentModePulse && 'animate-agent-mode-flash'
      )}
      onMouseLeave={() => {
        clearAttention();
        onInteractionSignal?.('steady');
      }}
    >
      <TaskBar
        wihs={[...(wihs ?? []), ...(myWihs ?? [])]}
        selectedWihId={selectedWihId}
        onSelectWih={selectWih}
        expanded={taskBarExpanded}
        onToggleExpand={() => setTaskBarExpanded(!taskBarExpanded)}
      />

      {showTopActions && !agentModeEnabled && (
        <div
          className="flex gap-2 mb-3 w-[720px] max-w-full justify-center flex-wrap"
          onMouseEnter={() => setTrackingAttention(0, 0.18, 'locked-on')}
          onMouseLeave={() => {
            if (!activeCategory) {
              clearAttention();
            }
          }}
        >
          {ACTION_CATEGORIES.map((cat, index) => (
            <button type="button"
              key={cat.id}
              onClick={() => {
                if (agentModeSurface) {
                  const modeMapping: Record<string, AgentModeId> = {
                    'code': 'web',
                    'create': 'slides',
                    'write': 'slides',
                    'learn': 'research',
                    'allternit': 'flow',
                  };
                  const targetMode = modeMapping[cat.id];
                  if (targetMode) {
                    setLocallyEnabled(true);
                    setSelectedMode(agentModeSurface, targetMode);
                    setActiveCategory(null);
                    onInteractionSignal?.('proud');
                    return;
                  }
                }
                setActiveCategory(activeCategory === cat.id ? null : cat.id);
                onInteractionSignal?.(CATEGORY_EMOTIONS[cat.id]?.select ?? 'focused');
              }}
              className={cn(
                'flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-sm border backdrop-blur-md transition-all',
                activeCategory === cat.id
                  ? 'bg-[var(--accent-chat)]/15 border-[var(--accent-chat)]/30 text-[var(--text-primary)] font-semibold'
                  : 'bg-[var(--surface-panel)]/30 border-[var(--border-subtle)]/40 text-[var(--text-primary)] font-medium hover:bg-[var(--surface-panel)]/50'
              )}
              onMouseEnter={() => {
                onInteractionSignal?.(CATEGORY_EMOTIONS[cat.id]?.hover ?? 'curious');
                setTrackingAttention((index - (ACTION_CATEGORIES.length - 1) / 2) * 0.24, 0.18, 'locked-on');
              }}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {showTopActions && !agentModeEnabled && activeCategory && (
        <div
          className="absolute bottom-[calc(100%-30px)] left-1/2 -translate-x-1/2 w-full max-w-[600px] lg:max-w-[760px] bg-menu-bg backdrop-blur-[20px] rounded-2xl border border-menu-border shadow-xl z-100 p-2 mb-10"
          onMouseEnter={() => setTrackingAttention(0, 0.26, 'locked-on')}
          onMouseLeave={() => {
            setActiveCategory(null);
            clearAttention();
          }}
        >
          <div className="flex items-center justify-between p-2 border-b border-input-border mb-1">
            <div className="flex items-center gap-2 text-secondary text-xs font-semibold uppercase">
              {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.icon}
              {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.label}
            </div>
            <button type="button"
              onClick={() => setActiveCategory(null)}
              className="bg-transparent border-none text-muted cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.options.map((option, idx) => (
            <div
              key={`chatcomposer-${idx}`}
              onMouseEnter={(e) => {
                handleOptionHover(option);
                setTrackingAttention(0, 0.28, 'locked-on');
                e.currentTarget.classList.add('bg-hover');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.classList.remove('bg-hover');
              }}
              onClick={() => {
                setInput(option);
                setActiveCategory(null);
                onInteractionSignal?.(activeCategory ? CATEGORY_EMOTIONS[activeCategory]?.select ?? 'pleased' : 'pleased');
                textareaRef.current?.focus();
              }}
              className="py-3 px-4 text-primary text-sm cursor-pointer transition-colors flex items-center justify-between border-b border-input-border last:border-b-0"
            >
              <span>{option}</span>
              <CursorClick size={12} className="opacity-30" />
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          'w-full relative overflow-visible z-14',
          !hudMode && 'max-w-[600px] lg:max-w-[760px]',
          variant === 'large' && !hudMode && 'lg:max-w-[760px]'
        )}
      >
        {showAgentRailGuide ? (
          <AgentModeGizzi
            active={agentModeEnabled}
            pulse={agentModePulse}
            surface={agentModeSurface || 'chat'}
            selectedAgentName={selectedSurfaceAgent?.name ?? null}
            selectedAgent={selectedSurfaceAgent}
            theme={agentModeTheme}
            hasActionPills={showTopActions}
          />
        ) : null}
        {agentModeSurface === 'cowork' && <CoworkTopDeck />}
        <div
          className={cn(
            'w-full rounded-2xl flex flex-col overflow-visible transition-shadow z-10 relative',
            useGlassComposer
              ? 'bg-composer-glass-bg border border-composer-glass-border backdrop-blur-xl backdrop-saturate-150 shadow-xl'
              : 'bg-input-bg border border-input-border',
            !hudMode && agentModeEnabled && 'border-glow shadow-glow',
            !hudMode && composerFocused && !agentModeEnabled && 'shadow-glow-accent'
          )}
          onFocusCapture={() => setComposerFocused(true)}
          onBlurCapture={(event) => {
            const nextFocused = event.relatedTarget;
            if (!(nextFocused instanceof Node) || !event.currentTarget.contains(nextFocused)) {
              setComposerFocused(false);
            }
          }}
        >
          {agentModeSurface && agentModeEnabled ? (
            <div className="absolute inset-0 rounded-2xl pointer-events-none bg-agent-mode-sweep mix-blend-screen opacity-30" />
          ) : null}

          {topDeckContent && (
            <div className="relative z-10">{topDeckContent}</div>
          )}

          <input aria-label="Upload images" ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {voiceModeActive && (
            <div className="absolute inset-0 z-[260] min-h-[132px] rounded-2xl bg-input-bg border border-input-border flex items-center px-5 animate-in fade-in zoom-in-95 duration-200">
              <button
                type="button"
                onClick={leaveVoiceMode}
                aria-label="Cancel voice mode"
                className="size-8 shrink-0 rounded-full border border-input-border bg-composer-soft text-composer-muted hover:text-primary flex items-center justify-center cursor-pointer transition-colors"
              >
                <X size={15} weight="bold" />
              </button>

              <div className="flex-1 min-w-0 flex flex-col items-center gap-2 px-5">
                <div className="h-9 flex items-center justify-center gap-[3px]" aria-hidden="true">
                  {Array.from({ length: 17 }, (_, index) => {
                    const distance = Math.abs(index - 8);
                    const level = Math.max(0.16, audioLevel || 0.18);
                    const height = 7 + Math.max(0, 20 - distance * 2) * level;
                    return (
                      <span
                        key={index}
                        className="w-[3px] rounded-full bg-[var(--accent-chat)] transition-[height,opacity] duration-100 animate-pulse"
                        style={{
                          height: `${height}px`,
                          opacity: Math.max(0.35, 1 - distance * 0.065),
                          animationDelay: `${index * 45}ms`,
                        }}
                      />
                    );
                  })}
                </div>
                <div className="w-full text-center text-sm text-primary truncate">
                  {voiceError || interimTranscript || (personaState === 'thinking' ? 'Transcribing…' : 'Listening…')}
                </div>
                <div className={cn('text-[11px]', voiceError ? 'text-[var(--status-error)]' : 'text-muted')}>
                  {voiceError ? 'Check the microphone and voice service, then retry' : 'Speak naturally, then press stop'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => voiceError ? void enterVoiceMode() : stopVoiceRecording()}
                aria-label={voiceError ? 'Retry voice input' : 'Finish voice input'}
                className="size-9 shrink-0 rounded-full border-none bg-[var(--accent-chat)] text-white flex items-center justify-center cursor-pointer shadow-[var(--shadow-glow)] transition-transform hover:scale-105"
              >
                {voiceError
                  ? <Waveform size={17} weight="bold" />
                  : personaState === 'thinking'
                  ? <CircleNotch size={17} className="animate-spin" />
                  : <Square size={12} weight="fill" />}
              </button>
            </div>
          )}

          {slashMenuVisible && filteredSlashCommands.length > 0 && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 max-w-full bg-menu-bg backdrop-blur-[20px] rounded-xl border border-menu-border shadow-xl p-1.5 z-250">
              <div className="py-1.5 px-3 text-xs text-muted font-semibold uppercase tracking-wider">
                Commands
              </div>
              {filteredSlashCommands.map((cmd) => (
                <button
                  key={cmd.command}
                  type="button"
                  onClick={() => handleSlashCommand(cmd)}
                  className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg bg-transparent border-none text-primary text-sm cursor-pointer text-left hover:bg-hover"
                >
                  <span className="text-accent font-mono font-bold text-xs">{cmd.command}</span>
                  <span className="text-secondary">{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {attachments.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-3">
              {attachments.map((attachment) => (
                <FileAttachment
                  key={attachment.id}
                  id={attachment.id}
                  filename={attachment.name}
                  isImage={attachment.type === 'image' || attachment.type === 'screenshot' || attachment.type === 'gif'}
                  url={attachment.dataUrl}
                  onRemove={() => removeAttachment(attachment.id)}
                  className="border border-composer-border bg-composer-soft"
                />
              ))}
            </div>
          ) : null}

          {hasTopInfoBar && (
            <div className="p-2.5 pb-0">
              <div className="min-h-[36px] rounded-xl border border-input-border bg-composer-soft overflow-hidden">
                {topInfoBarContent}
              </div>
            </div>
          )}

          {hasQuestionBar && (
            <div className={cn('p-2.5', hasTopInfoBar ? 'pt-2.5' : 'pt-3.5')}>
              <div className="rounded-2xl border border-input-border bg-composer-soft overflow-hidden">
                {questionBarContent}
              </div>
            </div>
          )}
          
          {compact ? (
            <div className="flex flex-col">
              {isAgentCommandMode ? (
                <div className="flex items-center justify-between gap-3 mb-2.5 py-2 px-2.5 mx-3 mt-2 rounded-xl border border-input-border bg-composer-soft">
                  <div className="flex items-center gap-2 min-w-0">
                    <TextShimmer as="span" className="text-xs font-medium text-accent">
                      A:// command mode
                    </TextShimmer>
                    <span className="text-secondary text-xs truncate">
                      Tab autocompletes. Enter submits after the first space.
                    </span>
                  </div>
                </div>
              ) : null}
              {selectedMentionAgent && (
                <div className="mb-2 flex gap-1.5 flex-wrap px-3">
                  <AgentPill
                    agent={selectedMentionAgent}
                    onRemove={handleRemoveMentionAgent}
                  />
                </div>
              )}
              <div className="flex items-center gap-2 py-2 px-3">
                <AttachmentButton
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)]/40 backdrop-blur-md text-[var(--text-primary)] transition-all hover:scale-105 hover:brightness-110 hover:bg-[var(--surface-panel)]/70',
                    isMobile ? 'size-11' : 'size-8'
                  )}
                  icon={
                    <Plus
                      size={isMobile ? 22 : 20}
                      strokeWidth={2.5}
                      className="transition-transform"
                    />
                  }
                />
                {selectedPluginMention && (
                  <PluginMentionChip
                    target={selectedPluginMention}
                    onRemove={handleRemovePluginMention}
                  />
                )}
                <textarea aria-label="Text Area" ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInput(val);
                    if (slashCommands && slashCommands.length > 0) {
                      if (val.startsWith('/')) {
                        setSlashMenuVisible(true);
                        setSlashFilter(val);
                      } else {
                        setSlashMenuVisible(false);
                        setSlashFilter('');
                      }
                    }
                    if (val.trimStart().startsWith('A://')) {
                      setAgentCommandMenuVisible(true);
                      setAgentCommandFilter(val.trimStart());
                    } else {
                      setAgentCommandMenuVisible(false);
                      setAgentCommandFilter('');
                    }
                    parseMention(val);
                  }}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={effectivePlaceholder}
                  rows={1}
                  onFocus={() => setTrackingAttention(0, 0.34, 'locked-on')}
                  className={cn(
                    'flex-1 min-w-0 bg-transparent border-none outline-none text-primary resize-none font-inherit p-0 m-0 block text-sm'
                  )}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void enterVoiceMode()}
                    aria-label="Start voice mode"
                    title="Voice mode"
                    className={cn(
                      'rounded-full border-none bg-transparent text-composer-muted hover:text-primary hover:bg-composer-soft transition-colors flex items-center justify-center cursor-pointer',
                      isMobile ? 'size-11' : 'size-7'
                    )}
                  >
                    <Waveform size={17} weight="bold" />
                  </button>
                  <button type="button"
                    onClick={() => setShowModelMenu(!showModelMenu)}
                    disabled={terminalModelsLoading && allModels.length === 0}
                    className={cn(
                      'flex items-center gap-1 px-2 rounded-full text-xs font-medium transition-all',
                      isMobile ? 'py-3.5' : 'py-1'
                    )}
                    style={{
                      background: showModelMenu ? THEME.hoverBg : 'transparent',
                      color: terminalModelsLoading && allModels.length === 0 ? THEME.textMuted : THEME.textSecondary,
                      cursor: terminalModelsLoading && allModels.length === 0 ? 'wait' : 'pointer',
                      opacity: terminalModelsLoading && allModels.length === 0 ? 0.7 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!(terminalModelsLoading && allModels.length === 0)) {
                        e.currentTarget.style.color = THEME.textPrimary;
                        onInteractionSignal?.('curious');
                        setTrackingAttention(0.4, 0.56, 'locked-on');
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = showModelMenu ? THEME.textPrimary : THEME.textSecondary;
                      setTrackingAttention(0, 0.44);
                    }}
                  >
                    {terminalModelsLoading && allModels.length === 0 ? (
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                      </span>
                    ) : (
                      <>
                        <div
                          className="size-4 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                          style={{
                            background: `${selectedProviderMeta.color}18`,
                            border: `1px solid ${selectedProviderMeta.color}40`,
                          }}
                        >
                          <img
                            src={`/assets/runtime-logos/${selectedProviderMeta.icon}`}
                            alt={selectedProviderMeta.name}
                            className="w-3 h-3 object-contain"
                          />
                        </div>
                        <span className="font-medium hidden sm:inline">{displayModelName}</span>
                      </>
                    )}
                    <CaretDown size={11} className={cn('transition-transform opacity-80', showModelMenu && 'rotate-180')} />
                  </button>

                  {showModelMenu && (
                    <PromptModelSelector
                      models={allModels}
                      selectedModel={selectedModel}
                      onSelect={handleModelSelect}
                      onClose={() => setShowModelMenu(false)}
                      onBrowseAllModels={handleBrowseAllModels}
                      onOpenProviderConnect={() => setShowProviderConnect(true)}
                      isTerminalModels={terminalModels.length > 0}
                      triggerless
                    />
                  )}

                  <ProviderGallery
                    isOpen={showProviderConnect}
                    onClose={() => setShowProviderConnect(false)}
                  />

                  {isHandingOff ? (
                    <button
                      disabled
                      type="button"
                      className={cn(
                        'rounded-full bg-composer-soft border border-input-border text-accent flex items-center justify-center transition-all',
                        isMobile ? 'size-11' : 'size-7'
                      )}
                      title="Routing @mentions..."
                    >
                      <CircleNotch size={14} className="animate-spin" />
                    </button>
                  ) : isLoading ? (
                    <button
                      onClick={onStop}
                      type="button"
                      className={cn(
                        'rounded-full bg-composer-soft border border-input-border text-accent flex items-center justify-center cursor-pointer transition-all',
                        isMobile ? 'size-11' : 'size-7'
                      )}
                    >
                      <Square size={11} fill="currentColor" />
                    </button>
                  ) : canSubmit ? (
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit}
                      type="button"
                      className={cn(
                        'rounded-full flex items-center justify-center transition-all',
                        isMobile ? 'size-11' : 'size-7'
                      )}
                      style={{
                        background: canSubmit ? THEME.accent : 'var(--chat-composer-soft)',
                        border: canSubmit ? 'none' : `1px solid ${THEME.inputBorder}`,
                        color: canSubmit ? 'var(--shell-control-active-fg)' : THEME.textSecondary,
                        cursor: canSubmit ? 'pointer' : 'default',
                        boxShadow: canSubmit ? 'var(--shadow-glow)' : 'none',
                      }}
                      onMouseEnter={() => {
                        if (canSubmit) {
                          setTrackingAttention(0.58, 0.6, 'locked-on');
                          onInteractionSignal?.('proud');
                        }
                      }}
                      onMouseLeave={() => {
                        if (canSubmit) {
                          setTrackingAttention(0, 0.44);
                        }
                      }}
                    >
                      {agentModeSurface === 'code' ? (
                        <ArrowElbowDownRight size={16} strokeWidth={2.5} />
                      ) : (
                        <ArrowUp size={16} strokeWidth={2.5} />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              {isAgentCommandMode ? (
                <div className="flex items-center justify-between gap-3 mb-2.5 py-2 px-2.5 rounded-xl border border-input-border bg-composer-soft">
                  <div className="flex items-center gap-2 min-w-0">
                    <TextShimmer as="span" className="text-xs font-medium text-accent">
                      A:// command mode
                    </TextShimmer>
                    <span className="text-secondary text-xs truncate">
                      Tab autocompletes. Enter submits after the first space.
                    </span>
                  </div>
                </div>
              ) : null}
              {selectedMentionAgent && (
                <div className="mb-2 flex gap-1.5 flex-wrap">
                  <AgentPill
                    agent={selectedMentionAgent}
                    onRemove={handleRemoveMentionAgent}
                  />
                </div>
              )}
              <div className={selectedPluginMention ? 'flex items-start gap-2' : 'contents'}>
              {selectedPluginMention && (
                <div className="pt-0.5 shrink-0">
                  <PluginMentionChip
                    target={selectedPluginMention}
                    onRemove={handleRemovePluginMention}
                  />
                </div>
              )}
              <textarea aria-label="Text Area" ref={textareaRef}
                value={input}
                onChange={(e) => {
                  const val = e.target.value;
                  setInput(val);
                  if (slashCommands && slashCommands.length > 0) {
                    if (val.startsWith('/')) {
                      setSlashMenuVisible(true);
                      setSlashFilter(val);
                    } else {
                      setSlashMenuVisible(false);
                      setSlashFilter('');
                    }
                  }
                  if (val.trimStart().startsWith('A://')) {
                    setAgentCommandMenuVisible(true);
                    setAgentCommandFilter(val.trimStart());
                  } else {
                    setAgentCommandMenuVisible(false);
                    setAgentCommandFilter('');
                  }
                  parseMention(val);
                }}
                onKeyDown={handleTextareaKeyDown}
                placeholder={effectivePlaceholder}
                rows={1}
                onFocus={() => setTrackingAttention(0, 0.34, 'locked-on')}
                className={cn(
                  'w-full min-w-0 flex-1 bg-transparent border-none outline-none text-primary resize-none font-inherit p-0 m-0 block',
                  compact ? 'text-sm' : 'text-base'
                )}
              />
              </div>
            </div>
          )}
          {isVoiceRecording && interimTranscript && (
            <div className="py-0.5 px-4 pb-1.5 flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-red-500/80 flex-shrink-0 animate-pulse" />
              <span className="text-xs text-muted italic truncate flex-1">
                {interimTranscript}
              </span>
            </div>
          )}
          {agentCommandMenuVisible && filteredAgentCommands.length > 0 ? (
            <div className="p-3.5 pt-0">
              <div className="grid gap-1.5">
                {filteredAgentCommands.map((cmd) => (
                  <button
                    key={cmd.command}
                    type="button"
                    onClick={() => handleAgentCommand(cmd)}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl border border-input-border bg-composer-soft text-primary cursor-pointer text-left hover:bg-hover"
                  >
                    <div className="min-w-0">
                      <div className="text-accent font-mono text-xs font-bold">
                        {cmd.command}
                      </div>
                      <div className="text-secondary text-xs">
                        {cmd.detail}
                      </div>
                    </div>
                    <span className="text-muted text-xs flex-shrink-0">
                      {cmd.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {requiresAgentSelection ? (
            <div
              className="flex items-center justify-between gap-3 py-2 px-5 text-xs"
              style={{ color: selectedSurfaceAgent ? agentModeTheme.accent : THEME.textSecondary }}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Robot size={14} />
                <span className="min-w-0 truncate">
                  {agentHelperText}
                </span>
              </div>
              <div className="flex items-center gap-2.5 min-w-0">
                {!selectedSurfaceAgent && openClawCandidates.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowOpenClawImportDialog(true)}
                    className="flex-shrink-0 border border-glow rounded-full bg-soft text-accent text-xs font-bold py-1 px-2.5 cursor-pointer"
                    style={{
                      borderColor: agentModeTheme.glow,
                      background: agentModeTheme.soft,
                      color: agentModeTheme.accent,
                    }}
                  >
                    Import OpenClaw
                  </button>
                ) : null}
                {selectedSurfaceAgent && selectedWorkspacePreview.workspacePath ? (
                  <span
                    className="flex-shrink-0 text-muted text-xs max-w-[180px] truncate"
                    title={selectedWorkspacePreview.workspacePath}
                  >
                    {selectedWorkspacePreview.workspacePath}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {compact && bottomDockContent ? (
            <div
              data-testid="chat-composer-compact-bottom-dock"
              className="flex w-full items-center px-3 pb-2 pt-1"
            >
              {bottomDockContent}
            </div>
          ) : null}

          {!compact && (<div className={cn('flex items-center justify-between', isMobile ? 'p-2' : 'p-3')}>
            <div className="flex items-center gap-1 relative">
              <AttachmentButton
                onClick={() => { setShowPlusMenu(!showPlusMenu); }}
                className={cn(
                  'rounded-full border border-[var(--border-subtle)] bg-[var(--surface-panel)]/40 backdrop-blur-md text-[var(--text-primary)] transition-all hover:scale-105 hover:brightness-110 hover:bg-[var(--surface-panel)]/70',
                  isMobile ? 'size-11' : 'size-8',
                  showPlusMenu && 'bg-[var(--surface-panel)]/70'
                )}
                icon={
                  <Plus
                    size={isMobile ? 22 : 20}
                    strokeWidth={2.5}
                    className={cn('transition-transform duration-200', showPlusMenu && 'rotate-45')}
                  />
                }
                onMouseEnter={() => {
                  onInteractionSignal?.('alert');
                  setTrackingAttention(-0.44, 0.56, 'locked-on');
                }}
                onMouseLeave={() => {
                  setTrackingAttention(0, 0.44);
                }}
              />

              <BottomDock
                inline
                selectedModeId={selectedModeId}
                agentModeSurface={agentModeSurface}
                agentModeEnabled={agentModeEnabled}
                agentModeTheme={agentModeTheme}
                setShowAgentMenu={setShowAgentMenu}
                showAgentMenu={showAgentMenu}
                selectedSurfaceAgent={selectedSurfaceAgent}
                onToggleAgentMode={handleToggleAgentMode}
                customLeftContent={bottomDockContent}
                showModeToggle={showModeToggle}
                sessionLocked={showModeToggle === false}
                onOpenModeMenu={() => setShowModeSelectorMenu(true)}
                agents={agents}
                isLoadingAgents={isLoadingAgents}
                selectedSurfaceAgentId={selectedSurfaceAgentId}
                workspaceArtifacts={characterArtifacts}
                agentError={agentError}
                openClawCandidatesCount={openClawCandidates.length}
                onOpenImportWizard={() => setShowOpenClawImportDialog(true)}
                onSelectAgent={(agent) => {
                  if (agentModeSurface) setSelectedSurfaceAgent(agentModeSurface, agent.id);
                  // Selecting a bot from the home-view picker mounts a real bot
                  // session in the rail rather than just changing the surface agent.
                  if (agent.isBot && onStartBotSession) {
                    onStartBotSession(agent);
                  }
                }}
                onClearAgent={() => {
                  if (agentModeSurface) setSelectedSurfaceAgent(agentModeSurface, null);
                }}
              />

              {showModeSelectorMenu && agentModeSurface && (
                <div
                  className="absolute bottom-[calc(100%+12px)] left-4 mb-2 w-[340px] p-3 bg-menu-bg backdrop-blur-[20px] rounded-2xl border border-menu-border shadow-xl z-200"
                  onMouseEnter={() => setTrackingAttention(-0.4, 0.5, 'locked-on')}
                  onMouseLeave={() => {
                    setShowModeSelectorMenu(false);
                    setTrackingAttention(0, 0.44);
                  }}
                >
                  <div className="mb-2">
                    <div className="text-xs font-extrabold text-muted tracking-wider uppercase">
                      Bot mode
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {MODE_TABS.filter((mode) => {
                      const allowed = agentModeSurface ? SURFACE_MODES[agentModeSurface] : MODE_TABS.map((m) => m.id);
                      return allowed.includes(mode.id);
                    }).map((mode) => {
                      const isSelected = selectedModeId === mode.id;
                      const ModeIcon = mode.icon;
                      return (
                        <button
                          type="button"
                          key={mode.id}
                          onClick={() => {
                            if (agentModeSurface) {
                              setSelectedMode(agentModeSurface, mode.id as AgentModeId);
                              setSelectedTemplateTitle(undefined);
                            }
                            setShowModeSelectorMenu(false);
                          }}
                          className={cn(
                            'group relative flex flex-col items-center gap-1 p-1.5 rounded-xl text-center transition-all',
                            isSelected ? 'bg-composer-hover' : 'hover:bg-hover'
                          )}
                          style={isSelected ? { boxShadow: `inset 0 0 0 1.5px ${mode.color}50` } : undefined}
                        >
                          <div
                            className="flex items-center justify-center size-9 rounded-lg transition-transform group-hover:scale-105"
                            style={{ background: `${mode.color}18`, color: mode.color }}
                          >
                            <ModeIcon size={16} weight={isSelected ? 'fill' : 'bold'} />
                          </div>
                          <span
                            className={cn(
                              'text-[10px] leading-tight',
                              isSelected ? 'font-bold text-primary' : 'font-medium text-secondary'
                            )}
                          >
                            {mode.label}
                          </span>
                          {isSelected && (
                            <div
                              className="absolute top-1 right-1 size-3 rounded-full flex items-center justify-center"
                              style={{ background: mode.color }}
                            >
                              <Check size={7} weight="bold" className="text-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <ComposerPlusSheet
                open={showPlusMenu}
                onClose={() => { setShowPlusMenu(false); }}
                isBrowserSurface={isBrowserSurface}
                onFilesClick={() => { fileInputRef.current?.click(); }}
                onCameraClick={() => { fileInputRef.current?.click(); }}
                onScreenshotClick={handleCaptureScreenshot}
                onGifClick={handleToggleGifRecording}
                isGifRecording={isGifRecording}
                gifDuration={gifDuration}
                githubUrl={githubUrl}
                setGithubUrl={setGithubUrl}
                githubLoading={githubLoading}
                onGitHubFetch={handleGitHubFetch}
                webSearchEnabled={webSearchEnabled}
                setWebSearchEnabled={setWebSearchEnabled}
                researchEnabled={researchEnabled}
                setResearchEnabled={setResearchEnabled}
                activeStyle={activeStyle}
                setActiveStyle={setActiveStyle}
                toolAccess={toolAccess}
                setToolAccess={setToolAccess}
                projects={chatProjects.map((p) => ({ id: p.id, title: p.title }))}
                activeProjectId={chatActiveProjectId}
                setActiveProjectId={(id) => chatSetActiveProject(id)}
                onCreateProject={() => { void chatCreateProject('New Project'); }}
                onOpenConnectors={() => setShowConnectorMarketplace(true)}
                onOpenFormSurfaces={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'form-surfaces' } }))}
                onOpenBrainCapture={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'brain' } }))}
                onOpenCoworkTasks={() => window.dispatchEvent(new CustomEvent('allternit:open-view', { detail: { viewType: 'cowork-tasks' } }))}
                onOpenAgentActivity={() => window.dispatchEvent(new CustomEvent('allternit:open-agent-activity'))}
                onOpenPermissions={() => window.dispatchEvent(new CustomEvent('allternit:open-settings', { detail: { section: 'permissions' } }))}
              />

              <ConnectorMarketplaceDialog
                open={showConnectorMarketplace}
                onClose={() => setShowConnectorMarketplace(false)}
              />
            </div>

            <div className="flex items-center gap-1 flex-1 pl-1 overflow-hidden">
              {webSearchEnabled && (
                <button type="button" onClick={() => setWebSearchEnabled(false)} title="Web search on — click to remove" className="inline-flex items-center gap-1 py-1 px-2 rounded-full bg-accent/12 border border-accent/35 text-accent text-xs font-semibold cursor-pointer whitespace-nowrap transition-all">
                  <Globe size={11} />
                  Web
                  <X size={10} className="opacity-60" />
                </button>
              )}
              {activeStyle && (
                <button type="button" onClick={() => setActiveStyle(null)} title="Style active — click to remove" className="inline-flex items-center gap-1 py-1 px-2 rounded-full bg-accent/12 border border-accent/35 text-accent text-xs font-semibold cursor-pointer whitespace-nowrap transition-all">
                  <PenTool size={11} />
                  {activeStyle.charAt(0).toUpperCase() + activeStyle.slice(1)}
                  <X size={10} className="opacity-60" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 relative">
              <button
                type="button"
                onClick={() => void enterVoiceMode()}
                aria-label="Start voice mode"
                title="Voice mode"
                className={cn(
                  'rounded-full border-none bg-transparent text-composer-muted hover:text-primary hover:bg-composer-soft transition-colors flex items-center justify-center cursor-pointer',
                  isMobile ? 'size-11' : 'size-7'
                )}
              >
                <Waveform size={17} weight="bold" />
              </button>
              <button type="button"
                onClick={() => setShowModelMenu(!showModelMenu)}
                disabled={terminalModelsLoading && allModels.length === 0}
                className={cn(
                  'flex items-center gap-1 px-2.5 rounded-full text-sm font-medium transition-all',
                  isMobile ? 'py-3' : 'py-1'
                )}
                style={{
                  background: showModelMenu ? THEME.hoverBg : 'transparent',
                  color: terminalModelsLoading && allModels.length === 0 ? THEME.textMuted : THEME.textSecondary,
                  cursor: terminalModelsLoading && allModels.length === 0 ? 'wait' : 'pointer',
                  opacity: terminalModelsLoading && allModels.length === 0 ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!(terminalModelsLoading && allModels.length === 0)) {
                    e.currentTarget.style.color = THEME.textPrimary;
                    onInteractionSignal?.('curious');
                    setTrackingAttention(0.4, 0.56, 'locked-on');
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = showModelMenu ? THEME.textPrimary : THEME.textSecondary;
                  setTrackingAttention(0, 0.44);
                }}
              >
                {terminalModelsLoading && allModels.length === 0 ? (
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 border-2 border-muted border-t-transparent rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  <>
                    <div
                      className="size-5 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden"
                      style={{
                        background: `${selectedProviderMeta.color}18`,
                        border: `1px solid ${selectedProviderMeta.color}40`,
                      }}
                    >
                      <img
                        src={`/assets/runtime-logos/${selectedProviderMeta.icon}`}
                        alt={selectedProviderMeta.name}
                        className="w-3.5 h-3.5 object-contain"
                      />
                    </div>
                    <span className="font-medium">{displayModelName}</span>
                  </>
                )}
                <CaretDown size={12} className={cn('transition-transform opacity-80', showModelMenu && 'rotate-180')} />
              </button>

              {showModelMenu && (
                <PromptModelSelector
                  models={allModels}
                  selectedModel={selectedModel}
                  onSelect={handleModelSelect}
                  onClose={() => setShowModelMenu(false)}
                  onBrowseAllModels={handleBrowseAllModels}
                  onOpenProviderConnect={() => setShowProviderConnect(true)}
                  isTerminalModels={terminalModels.length > 0}
                  triggerless
                />
              )}

              <ProviderGallery
                isOpen={showProviderConnect}
                onClose={() => setShowProviderConnect(false)}
              />

              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-end gap-0.5 h-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-0.5 rounded-sm bg-accent allternit-waveform-bar"
                        style={{ animationDelay: `${i * 0.18}s` }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={onStop}
                    type="button"
                    className={cn(
                      'rounded-full bg-composer-soft border border-input-border text-accent flex items-center justify-center cursor-pointer transition-all',
                      isMobile ? 'size-11' : 'size-8'
                    )}
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                </div>
              ) : canSubmit ? (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  type="button"
                  className={cn(
                    'rounded-full flex items-center justify-center transition-all',
                    isMobile ? 'size-11' : 'size-8'
                  )}
                  style={{
                    background: canSubmit ? THEME.accent : 'var(--chat-composer-soft)',
                    border: canSubmit ? 'none' : `1px solid ${THEME.inputBorder}`,
                    color: canSubmit ? 'var(--shell-control-active-fg)' : THEME.textSecondary,
                    cursor: canSubmit ? 'pointer' : 'default',
                    boxShadow: canSubmit ? 'var(--shadow-glow)' : 'none',
                  }}
                  onMouseEnter={() => {
                    if (canSubmit) {
                      setTrackingAttention(0.58, 0.6, 'locked-on');
                      onInteractionSignal?.('proud');
                    }
                  }}
                  onMouseLeave={() => {
                    if (canSubmit) {
                      setTrackingAttention(0, 0.44);
                    }
                  }}
                >
                  {agentModeSurface === 'code' ? (
                    <ArrowElbowDownRight size={18} strokeWidth={2.5} />
                  ) : (
                    <ArrowUp size={18} strokeWidth={2.5} />
                  )}
                </button>
              ) : null}
            </div>
          </div>)}
        </div>
      </div>

      {/* Agent-mode bottom deck — tray tucked behind the card's bottom
          edge (z-0 under the composer card's z-10), sliding down from behind
          with the same deck-rise/fall motion as the top deck. */}
      {agentModeSurface && agentModeEnabled && selectedSurfaceAgent && !voiceModeActive && (
        <div className={cn('w-full flex flex-col items-center', !hudMode && 'max-w-[600px] lg:max-w-[760px]')}>
          <div className="relative z-0 w-full h-[60px] -mt-3 box-border bg-input-bg border-b border-r border-l border-input-border rounded-b-2xl px-4 pt-4 flex items-start gap-3 animate-deck-fall">
            <ModeDock
              selectedMode={selectedModeId}
              onSelectMode={(modeId) => {
                if (agentModeSurface) {
                  setSelectedMode(agentModeSurface, modeId as AgentModeId);
                  setSelectedTemplateTitle(undefined);
                }
              }}
              agentModeSurface={agentModeSurface}
              isLoading={isLoading}
              selectedSurfaceAgent={selectedSurfaceAgent}
            />
          </div>
          {selectedModeId === 'swarms' && (
            <div className="w-full mt-8">
              <SwarmSubModeTabs
                selectedSubMode={selectedSwarmSubMode}
                onSelectSubMode={(subModeId) => {
                  if (agentModeSurface) {
                    setSwarmSubMode(agentModeSurface, subModeId);
                  }
                }}
              />
            </div>
          )}
          {selectedModeId && (
            <div className="w-full mt-8 pb-4">
              {selectedModeId === 'swarms' && selectedSwarmSubMode === 'population-simulation' ? (
                <MiroFishPanel />
              ) : (
                <TemplateGallery
                  modeId={selectedModeId}
                  onSelectTemplate={(prompt, template) => {
                    setInput(prompt);
                    setSelectedTemplateTitle(template.title);
                    window.requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
      
      {mentionOpen && (
        <AgentMentionDropdown
          agents={filteredMentionAgents}
          query={mentionQuery}
          selectedIndex={mentionIndex}
          onSelect={handleSelectMentionAgent}
          onHoverIndex={setMentionIndex}
          pluginTargets={filteredPluginTargets}
          onSelectPluginTarget={handleSelectPluginMention}
          activeAgentId={selectedSurfaceAgent?.id}
          onClose={() => {
            setMentionOpen(false);
            setMentionQuery('');
          }}
          position={(() => {
            const ta = textareaRef.current;
            if (!ta) return undefined;
            const atIndex = input.lastIndexOf('@');
            if (atIndex === -1) return undefined;
            return getTextareaCaretPosition(ta, input, atIndex);
          })()}
        />
      )}
      
      <Dialog open={showOpenClawImportDialog} onOpenChange={(open) => {
        setShowOpenClawImportDialog(open);
        if (!open) {
          dismissOpenClawPrompt();
        }
      }}>
        <DialogContent className="max-w-xl max-h-[65vh] overflow-y-auto p-0 rounded-2xl border-none bg-transparent">
          <div className="rounded-2xl border border-menu-border bg-shell-dialog-bg shadow-xl overflow-hidden">
            <div className="p-4 border-b border-input-border bg-gradient-to-r from-accent-chat/12 via-status-info/5 to-surface-floating/20">
              <DialogHeader>
                <DialogTitle className="text-shell-dialog-title text-lg font-semibold">
                  Import OpenClaw Agent
                </DialogTitle>
                <DialogDescription className="text-shell-dialog-text text-sm max-w-md leading-relaxed">
                  Import a local OpenClaw agent to bind this surface to a real agent workspace.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-4 grid gap-3">
              {openClawCandidates.length === 0 ? (
                <div className="rounded-2xl border border-input-border p-4 text-secondary bg-composer-soft">
                  {isLoadingOpenClawCandidates
                    ? 'Checking local OpenClaw agent directories...'
                    : openClawError || 'No importable OpenClaw agents were found.'}
                </div>
              ) : (
                openClawCandidates.map((candidate) => (
                  <div
                    key={candidate.agent_id}
                    className="grid gap-2.5 rounded-xl border border-input-border bg-composer-soft p-3.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-chat/12 border border-accent-chat/25 text-accent-primary py-1 px-2 text-xs font-bold tracking-wider uppercase">
                            <Robot size={10} />
                            OpenClaw
                          </span>
                          <span className="text-primary text-base font-semibold">
                            {candidate.display_name}
                          </span>
                        </div>
                        <div className="mt-1 text-secondary text-xs">
                          {candidate.primary_model || 'No model'} · {candidate.session_count} session{candidate.session_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportOpenClawAgent(candidate)}
                        disabled={importingOpenClawAgentId === candidate.agent_id}
                        className="flex-shrink-0 rounded-full border border-accent-chat/25 bg-accent-chat/10 text-accent-primary text-xs font-bold py-2 px-3 cursor-pointer whitespace-nowrap disabled:cursor-wait"
                      >
                        {importingOpenClawAgentId === candidate.agent_id ? 'Importing...' : 'Import'}
                      </button>
                    </div>

                    <div className="grid grid-cols-auto-fit-140 gap-2">
                      <div className="rounded-lg border border-input-border bg-composer-soft p-2.5">
                        <div className="text-muted text-xs font-bold uppercase tracking-wider">
                          Workspace
                        </div>
                        <div className="mt-1 text-primary text-xs truncate">
                          {candidate.workspace_path || 'Not declared'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-input-border bg-composer-soft p-2.5">
                        <div className="text-muted text-xs font-bold uppercase tracking-wider">
                          Auth
                        </div>
                        <div className="mt-1 text-primary text-xs truncate">
                          {candidate.auth_providers.length > 0 ? candidate.auth_providers.join(', ') : 'None'}
                        </div>
                      </div>
                      <div className="rounded-lg border border-input-border bg-composer-soft p-2.5">
                        <div className="text-muted text-xs font-bold uppercase tracking-wider">
                          Files
                        </div>
                        <div className="mt-1 text-primary text-xs">
                          {candidate.files.models ? 'models' : '—'}
                          {' · '}
                          {candidate.files.auth_profiles ? 'auth' : '—'}
                          {' · '}
                          {candidate.files.sessions_store ? 'sessions' : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {openClawError ? (
                <div className="flex items-start gap-2 p-3.5 rounded-lg bg-shell-danger-soft-bg border border-status-error/30 text-status-error text-sm leading-relaxed">
                  <span className="flex-shrink-0 mt-px">⚠️</span>
                  <span>{openClawError}</span>
                </div>
              ) : null}
            </div>

            <DialogFooter className="p-4">
              <button
                type="button"
                onClick={dismissOpenClawPrompt}
                className="border border-input-border rounded-full bg-transparent text-secondary text-xs font-semibold py-2 px-3.5 cursor-pointer"
              >
                Not now
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


