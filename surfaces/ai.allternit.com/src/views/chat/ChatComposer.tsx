
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsClient } from "@/lib/hooks/use-is-client";
import { useViewMode } from '@/hooks/useViewMode';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import {
  Plus,
  Square,
  ArrowUp,
  CaretDown,
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
  PlugsConnected,
  CircleNotch,
  Warning,
  Image as ImageIcon,
  Link as LinkIcon,
} from '@phosphor-icons/react';
import { AttachmentButton } from '@/components/agent-elements/input/attachment-button';
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { useVoice } from '@/providers/voice-provider';
import { FileAttachment } from '@/components/agent-elements/input/file-attachment';
import { TextShimmer } from '@/components/agent-elements/text-shimmer';
import { AgentMentionDropdown } from '@/components/chat/AgentMentionDropdown';
import { AgentPill } from '@/components/chat/AgentPill';

import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('ChatComposer');

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
import type { RuntimeExecutionMode } from '@/lib/agents/native-agent-api';

import {
  buildOpenClawImportInput,
  discoverOpenClawAgents,
  getOpenClawWorkspacePathFromAgent,
  getRegisteredOpenClawAgentId,
  resolveOpenClawRegistration,
  useAgentStore,
  useAgentsWithSwarms,
  type Agent,
  type OpenClawDiscoveredAgent,
} from '@/lib/agents';
import { useActiveChatSession } from './ChatSessionStore';
import { AgentModeGizzi } from './AgentModeGizzi';
import { getAgentModeSurfaceTheme } from './agentModeSurfaceTheme';
import { useRecordingStore } from '@/stores/recording.store';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { getProviderLogo } from './components/ProviderLogos';
import { TaskBar } from './components/TaskBar';
import { AgentModeButton } from './components/AgentModeButton';
import { ModeDock } from './components/ModeDock';
import { BottomDock } from './components/BottomDock';
import { AgentSelectorDropdown } from './components/AgentSelectorDropdown';
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
  } catch {}
  return '/api/v1/providers';
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
  inputValue?: string;
  onInteractionSignal?: (emotion: GizziEmotion) => void;
  onAttentionChange?: (attention: GizziAttention | null) => void;
  agentModeSurface?: AgentModeSurface;
  slashCommands?: SlashCommand[];
  attachments?: ChatAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onAddAttachment?: (attachment: ChatAttachment) => void;
  /** Called when sending in agent mode - if provided, opens full agent session view instead of embedded chat */
  onAgentSend?: (text: string) => void;
  /** Called when the @mention agent selection changes (Phase 2: per-message routing) */
  onMentionAgentChange?: (agentId: string | null) => void;
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
  /** Optional inline info bar rendered at the top of the composer shell. */
  topInfoBarContent?: React.ReactNode;
  /** Optional inline question bar rendered between info and textarea. */
  questionBarContent?: React.ReactNode;
  /** Optional inline info bar rendered above the composer toolbar. */
  bottomInfoBarContent?: React.ReactNode;
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

const PLUS_MENU_ITEMS: ComposerMenuItem[] = [
  { id: 'files', label: 'Add files or photos', icon: <ImageIcon size={16} /> },
  {
    id: 'project',
    label: 'Add to project',
    icon: <Folder size={16} />,
    hasSubmenu: true,
    submenuItems: [
      { id: 'new-project', label: 'Start a new project', icon: <Plus size={14} /> },
      { id: 'existing-project', label: 'How to use Allternit', icon: <FileText size={14} /> },
    ]
  },
  { id: 'github', label: 'Add from GitHub', icon: <Github size={16} /> },
  { id: 'web', label: 'Web search', icon: <Globe size={16} />, isActive: true },
  {
    id: 'style',
    label: 'Use style',
    icon: <PenTool size={16} />,
    hasSubmenu: true,
    submenuItems: [
      { id: 'formal', label: 'Formal' },
      { id: 'creative', label: 'Creative' },
      { id: 'technical', label: 'Technical' },
    ]
  },
  { id: 'connectors', label: 'Add connectors', icon: <Lightning size={16} /> },
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
  mentionAgentId: externalMentionAgentId,
  bottomDockContent,
  topInfoBarContent,
  questionBarContent,
}: ChatComposerProps) {
  const [input, setInput] = useState(inputValue);
  const { isRecording: isVoiceRecording, interimTranscript } = useVoice();
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
  const [activeStyle, setActiveStyle] = useState<'formal' | 'creative' | 'technical' | null>(null);
  const [showGitHubInput, setShowGitHubInput] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubLoading, setGithubLoading] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProviderConnect, setShowProviderConnect] = useState(false);
  const [showOpenClawImportDialog, setShowOpenClawImportDialog] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
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
  const agentModeEnabled = hasEmbeddedSession || locallyEnabled;
  const [agentModePulse, setAgentModePulse] = useState(0);
  const prevAgentModeEnabledRef = useRef(agentModeEnabled);
  if (prevAgentModeEnabledRef.current !== agentModeEnabled) {
    prevAgentModeEnabledRef.current = agentModeEnabled;
    if (agentModeEnabled) setAgentModePulse((p) => p + 1);
  }
  
  const {
    executionMode,
    isLoading: isLoadingExecMode,
    isSaving: isSavingExecMode,
    setMode: setExecutionMode,
  } = useRuntimeExecutionMode();
  
  const [optimisticMode, setOptimisticMode] = useState<'plan' | 'build'>('build');
  
  useEffect(() => {
    if (executionMode?.mode) {
      setOptimisticMode(executionMode.mode === 'plan' ? 'plan' : 'build');
    }
  }, [executionMode?.mode]);
  
  const uiMode = optimisticMode;
  
  const handleToggleMode = useCallback(async () => {
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

  useEffect(() => {
    if (externalMentionAgentId !== undefined) {
      setSelectedMentionAgentId(externalMentionAgentId);
      if (externalMentionAgentId) {
        setLocallyEnabled(true);
      }
    }
  }, [externalMentionAgentId]);

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

  const toggleAgentMode = () => {
    if (agentModeEnabled) {
      setLocallyEnabled(false);
    } else {
      setLocallyEnabled(true);
    }
  };
  const selectedSurfaceAgentId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedAgentIdBySurface[agentModeSurface] : null,
  );
  const setSelectedSurfaceAgent = useAgentSurfaceModeStore((state) => state.setSelectedAgent);
  const selectedModeId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedModeBySurface[agentModeSurface] : null,
  );
  const setSelectedMode = useAgentSurfaceModeStore((state) => state.setSelectedMode);
  const agents = useAgentsWithSwarms();

  const selectedMentionAgent = useMemo(() => {
    if (!selectedMentionAgentId) return null;
    return agents.find((a) => a.id === selectedMentionAgentId) || null;
  }, [selectedMentionAgentId, agents]);

  const filteredMentionAgents = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQuery.toLowerCase();
    return agents.filter((a) => a.name.toLowerCase().includes(q));
  }, [mentionOpen, mentionQuery, agents]);

  const handleSelectMentionAgent = useCallback((agent: Agent) => {
    const lastAtIndex = input.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const before = input.slice(0, lastAtIndex);
      const after = input.slice(lastAtIndex + mentionQuery.length + 1);
      setInput(before + after);
    }
    setSelectedMentionAgentId(agent.id);
    onMentionAgentChange?.(agent.id);
    setLocallyEnabled(true);
    setMentionOpen(false);
    setMentionQuery('');
    setMentionIndex(0);
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [input, mentionQuery, onMentionAgentChange]);

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
  }, [fetchWihs]);
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

  const [terminalModels, setTerminalModels] = useState<any[]>([]);
  const [terminalModelsLoading, setTerminalModelsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTerminalModels() {
      try {
        const response = await fetch(getProviderDiscoveryUrl(), { signal: AbortSignal.timeout(5000) });
        if (!response.ok || cancelled) return;
        const data = await response.json();
        const allModels: any[] = [];
        if (data.all && Array.isArray(data.all)) {
          data.all.forEach((provider: any) => {
            if (!provider.models) return;
            Object.entries(provider.models).forEach(([modelId, modelData]: [string, any]) => {
              allModels.push({
                id: `${provider.id}/${modelId}`,
                name: modelData.name || modelId,
                providerId: provider.id,
                providerName: provider.name || provider.id,
              });
            });
          });
        }
        if (!cancelled && allModels.length > 0) setTerminalModels(allModels);
      } catch {
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

  useEffect(() => {
    if (!agentModeSurface || !agentModeEnabled || openClawCandidates.length === 0) {
      return;
    }

    const resolved = resolveOpenClawRegistration(openClawCandidates, agents);
    const unregistered = resolved.filter(
      (candidate) => !candidate.registered_agent_id,
    );

    if (unregistered.length !== openClawCandidates.length) {
      setOpenClawCandidates(unregistered);
    }
  }, [agents, agentModeEnabled, agentModeSurface, openClawCandidates]);

  useEffect(() => {
    if (!agentModeSurface || !agentModeEnabled) {
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
    selectedSurfaceAgentId,
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

  useEffect(() => {
    setInput(inputValue);
  }, [inputValue]);

  const allModels = useMemo(() => {
    let models: any[] = [];
    if (terminalModels.length > 0) {
      models = terminalModels;
    } else if (realModels && realModels.length > 0) {
      const flattened = realModels.flatMap(provider => {
        const modelsList = Array.isArray(provider.models) 
          ? provider.models 
          : (provider.models ? Object.entries(provider.models).map(([id, data]: [string, any]) => ({ id, ...data })) : []);
        return modelsList.map(model => ({
          ...model,
          providerId: provider.id,
          providerName: provider.name
        }));
      });
      if (flattened.length > 0) models = flattened;
    } else {
      models = discoveryResult?.models || [];
    }
    if (models.length > 0) {
      return [...models].sort((a, b) => {
        const aIsBigPickle = a.id === 'kimi/kimi-for-coding' || a.id?.includes('kimi/kimi-for-coding') || a.id?.startsWith('kimi');
        const bIsBigPickle = b.id === 'kimi/kimi-for-coding' || b.id?.includes('kimi/kimi-for-coding') || b.id?.startsWith('kimi');
        if (aIsBigPickle && !bIsBigPickle) return -1;
        if (!aIsBigPickle && bIsBigPickle) return 1;
        return 0;
      });
    }
    return [
      { id: 'kimi/kimi-for-coding', name: 'Kimi K2.5 (Coding)', description: 'Kimi K2.5 via Kimi API', providerId: 'kimi' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship model', providerId: 'openai' },
      { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic balanced model', providerId: 'anthropic' },
    ];
  }, [discoveryResult, realModels, terminalModels]);

  useEffect(() => {
    if (!selectedModel && allModels.length > 0) {
      const defaultModel = allModels.find(m =>
        m.id === 'kimi/kimi-for-coding' ||
        m.id?.toLowerCase().includes('kimi/kimi-for-coding') ||
        m.id?.startsWith('kimi') ||
        m.name?.toLowerCase().includes('big pickle')
      ) ||
      allModels.find(m =>
        m.id?.toLowerCase().includes('zen') ||
        m.name?.toLowerCase().includes('zen')
      ) ||
      allModels.find(m => m.id === 'openai/gpt-4o') ||
      allModels.find(m => m.id === 'anthropic/claude-3-5-sonnet') ||
      allModels[0];
      handleModelSelect(defaultModel);
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

  const requiresAgentSelection = Boolean(agentModeSurface && agentModeEnabled);
  const canSubmit = Boolean(input.trim()) && !isLoading && (!requiresAgentSelection || Boolean(selectedSurfaceAgent));
  const hasTopInfoBar = Boolean(topInfoBarContent);
  const hasQuestionBar = Boolean(questionBarContent);
  const agentWorkspaceSummary = selectedWorkspacePreview.artifactCount > 0
    ? `${selectedWorkspacePreview.artifactCount} workspace files ready`
    : selectedWorkspacePreview.source === 'openclaw'
      ? 'OpenClaw workspace linked'
    : 'Workspace profile will compile on first use';
  const agentHelperText = !requiresAgentSelection
    ? null
      : selectedSurfaceAgent
        ? `${selectedSurfaceAgent.name} active. ${agentWorkspaceSummary}.`
        : isLoadingAgents && agents.length === 0
          ? 'Loading agents...'
          : agents.length > 0
            ? 'Choose an agent before sending so this surface can bind to a real agent workspace.'
            : openClawCandidates.length > 0
              ? openClawCandidates.length === 1 && openClawCandidates[0]?.display_name
                ? `Found "${openClawCandidates[0].display_name}" OpenClaw agent. Import to continue.`
                : `Detected ${openClawCandidates.length} OpenClaw agent${openClawCandidates.length === 1 ? '' : 's'} on this machine. Import one to continue.`
              : agentError === 'API_OFFLINE'
                ? 'Agent registry is offline. Turn Agent Off or bring the gateway back to choose an agent.'
                : 'No agents are available yet. Create one in Agent Studio first.';

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

  const handleSubmit = () => {
    if (!canSubmit) return;

    const stylePrefix = activeStyle
      ? { formal: 'Respond in a formal, professional tone. ', creative: 'Respond in a creative, imaginative style. ', technical: 'Respond in a precise, technical manner. ' }[activeStyle]
      : '';
    const webSearchPrefix = webSearchEnabled ? '[web_search_enabled] ' : '';
    const enrichedInput = `${webSearchPrefix}${stylePrefix}${input}`.trim();

    if (selectedModeId === 'computer-use') {
      useBrowserAgentStore.getState().runAcuTask(enrichedInput);
    }

    if (agentModeEnabled && onAgentSend && agentModeSurface) {
      onAgentSend(enrichedInput);
    } else {
      onSend(enrichedInput);
    }
    
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
    } finally {
      setGithubLoading(false);
      setGithubUrl('');
      setShowGitHubInput(false);
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

  function handleModelSelect(model: any) {
    if (onSelectModel) {
      const providerId = model.providerId || 'allternit';
      onSelectModel({
        providerId: providerId,
        profileId: `${providerId}-acp`,
        modelId: model.id,
        modelName: model.name
      });
    }
    setShowModelMenu(false);
  }

  const handleBrowseAllModels = useCallback(() => {
    setShowModelMenu(false);
    onOpenModelPicker?.();
  }, [onOpenModelPicker]);

  const displayModelName = selectedModelDisplayName || (allModels.find(m => m.id === selectedModel)?.name || allModels[0]?.name || "Select Model");
  
  const selectedProviderMeta = useMemo(() => {
    if (!selectedModel) return getProviderMeta('allternit');
    
    const model = allModels.find(m => m.id === selectedModel);
    if (model && 'providerId' in model) {
      const providerId = (model as any).providerId || (model as any).provider;
      if (providerId) return getProviderMeta(providerId);
    }
    
    const parts = selectedModel.split('/');
    if (parts.length > 1) return getProviderMeta(parts[0]);
    
    return getProviderMeta('allternit');
  }, [selectedModel, allModels]);
  
  const setTrackingAttention = useCallback((x: number, y: number, state: GizziAttention['state'] = 'tracking') => {
    onAttentionChange?.({
      state,
      target: { x, y },
    });
  }, [onAttentionChange]);

  const clearAttention = useCallback(() => {
    onAttentionChange?.(null);
  }, [onAttentionChange]);

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
            <button
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
                'flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg text-sm transition-all',
                activeCategory === cat.id
                  ? 'bg-chat-mode-pill-active-bg border-accent-chat/30 text-chat-mode-pill-active-fg font-semibold'
                  : 'bg-chat-mode-pill-bg border-input-border text-chat-mode-pill-fg font-medium'
              )}
              onMouseEnter={(e) => {
                onInteractionSignal?.(CATEGORY_EMOTIONS[cat.id]?.hover ?? 'curious');
                setTrackingAttention((index - (ACTION_CATEGORIES.length - 1) / 2) * 0.24, 0.18, 'locked-on');
                if (activeCategory !== cat.id) {
                  e.currentTarget.style.background = THEME.hoverBg;
                  e.currentTarget.style.color = THEME.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeCategory !== cat.id) {
                  e.currentTarget.style.background = 'var(--chat-mode-pill-bg)';
                  e.currentTarget.style.color = 'var(--chat-mode-pill-fg)';
                }
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
          className="absolute bottom-[calc(100%-30px)] left-1/2 -translate-x-1/2 w-full max-w-[600px] lg:max-w-[760px] bg-menu-bg rounded-2xl border border-menu-border shadow-xl z-100 p-2 mb-10"
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
            <button
              onClick={() => setActiveCategory(null)}
              className="bg-transparent border-none text-muted cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
          {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.options.map((option, idx) => (
            <div
              key={idx}
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
          'w-full max-w-[600px] lg:max-w-[760px] relative overflow-visible z-14',
          variant === 'large' && 'lg:max-w-[760px]'
        )}
      >
        {showAgentRailGuide ? (
          <AgentModeGizzi
            active={agentModeEnabled}
            pulse={agentModePulse}
            surface={agentModeSurface || 'chat'}
            selectedAgentName={selectedSurfaceAgent?.name ?? null}
            theme={agentModeTheme}
            hasActionPills={showTopActions}
          />
        ) : null}
        <div
          className={cn(
            'w-full bg-input-bg rounded-t-2xl border-t border-r border-l border-input-border flex flex-col overflow-visible transition-shadow z-10 relative',
            agentModeEnabled && 'border-glow shadow-glow',
            composerFocused && !agentModeEnabled && 'shadow-glow-accent'
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImageFileSelect}
          />

          {slashMenuVisible && filteredSlashCommands.length > 0 && (
            <div className="absolute bottom-[calc(100%+8px)] left-0 right-0 max-w-full bg-menu-bg rounded-xl border border-menu-border shadow-xl p-1.5 z-250">
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
            <textarea
              ref={textareaRef}
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
              onKeyDown={(e) => {
                if (mentionOpen && filteredMentionAgents.length > 0) {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    setMentionOpen(false);
                    setMentionQuery('');
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setMentionIndex((prev) =>
                      Math.min(prev + 1, filteredMentionAgents.length - 1)
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
                    handleSelectMentionAgent(filteredMentionAgents[mentionIndex]);
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
              }}
              placeholder={placeholder}
              rows={1}
              onFocus={() => setTrackingAttention(0, 0.34, 'locked-on')}
              className="w-full bg-transparent border-none outline-none text-primary text-base resize-none font-inherit p-0 m-0 block"
            />
          </div>
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

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-1 relative">
              <AttachmentButton
                onClick={() => { setShowPlusMenu(!showPlusMenu); setActiveSubMenu(null); }}
                className="size-8 transition-colors bg-transparent shadow-none border-none"
                icon={
                  <Plus
                    size={20}
                    strokeWidth={2.5}
                    className={cn(
                      'text-composer-muted transition-transform',
                      showPlusMenu && 'rotate-45'
                    )}
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

              {showPlusMenu && (
                <div
                  className="absolute bottom-[calc(100%+12px)] left-0 w-60 bg-menu-bg rounded-xl border border-menu-border shadow-xl p-1.5 z-200"
                  onMouseEnter={() => setTrackingAttention(-0.48, 0.5, 'locked-on')}
                  onMouseLeave={() => {
                    if (!activeSubMenu) setShowPlusMenu(false);
                    setTrackingAttention(0, 0.44);
                  }}
                >
                  {isBrowserSurface && (
                    <>
                      <button
                        type="button"
                        onClick={handleCaptureScreenshot}
                        className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg bg-transparent border-none text-primary text-sm cursor-pointer transition-colors hover:bg-hover"
                      >
                        <span className="text-secondary"><Camera size={16} /></span>
                        <span>Take a screenshot</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleToggleGifRecording}
                        className={cn(
                          'w-full flex items-center gap-2.5 py-2 px-3 rounded-lg border-none text-sm cursor-pointer transition-colors',
                          isGifRecording ? 'bg-status-error-bg text-status-error hover:bg-status-error/18' : 'bg-transparent text-primary hover:bg-hover'
                        )}
                      >
                        <span className={cn(isGifRecording ? 'text-status-error' : 'text-secondary')}>
                          {isGifRecording ? <Square size={16} fill="currentColor" /> : <Video size={16} />}
                        </span>
                        <span>{isGifRecording ? `Stop recording (${gifDuration}s)` : 'Record screen (GIF)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                        className="w-full flex items-center gap-2.5 py-2 px-3 rounded-lg bg-transparent border-none text-primary text-sm cursor-pointer transition-colors hover:bg-hover"
                      >
                        <span className="text-secondary"><ImageIcon size={16} /></span>
                        <span>Add an image</span>
                      </button>
                      <div className="h-px bg-menu-border my-1 mx-2" />
                    </>
                  )}
                  {showGitHubInput && (
                    <div className="p-2">
                      <div className="flex items-center gap-1.5 bg-hover rounded-lg p-2 border border-menu-border">
                        <LinkIcon size={13} className="text-secondary flex-shrink-0" />
                        <input
                          autoFocus
                          value={githubUrl}
                          onChange={(e) => setGithubUrl(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleGitHubFetch(); if (e.key === 'Escape') { setShowGitHubInput(false); setGithubUrl(''); } }}
                          placeholder="github.com/user/repo/blob/main/file"
                          className="flex-1 bg-transparent border-none outline-none text-xs text-primary"
                        />
                        {githubLoading
                          ? <CircleNotch size={13} className="text-secondary animate-spin" />
                          : <button type="button" onClick={handleGitHubFetch} className="bg-transparent border-none cursor-pointer text-accent text-xs font-semibold p-0">Add</button>
                        }
                      </div>
                    </div>
                  )}
                  <div className="py-0.5 px-2 text-xs font-semibold text-muted tracking-widest uppercase">Attach</div>
                  {PLUS_MENU_ITEMS.filter(i => ['files', 'github'].includes(i.id)).map((item) => (
                    <div key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.id === 'files') { fileInputRef.current?.click(); setShowPlusMenu(false); }
                          if (item.id === 'github') { setShowGitHubInput((v) => !v); setActiveSubMenu(null); }
                        }}
                        onMouseEnter={() => { setActiveSubMenu(null); setTrackingAttention(-0.48, 0.5, 'locked-on'); }}
                        className={cn(
                          'w-full flex items-center gap-2.5 py-2 px-3 rounded-lg border-none text-primary text-sm cursor-pointer transition-colors',
                          item.id === 'github' && showGitHubInput ? 'bg-hover' : 'bg-transparent'
                        )}
                      >
                        <span className="text-secondary">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    </div>
                  ))}
                  <div className="h-px bg-menu-border my-1 mx-2" />
                  <div className="py-0.5 px-2 text-xs font-semibold text-muted tracking-widest uppercase">Context</div>
                  {PLUS_MENU_ITEMS.filter(i => ['project', 'web'].includes(i.id)).map((item) => (
                    <div key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.id === 'web') { setWebSearchEnabled((v) => !v); setShowPlusMenu(false); }
                        }}
                        onMouseEnter={() => {
                          if (item.hasSubmenu) setActiveSubMenu(item.id); else setActiveSubMenu(null);
                          setTrackingAttention(-0.48, 0.5, 'locked-on');
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 py-2 px-3 rounded-lg border-none text-sm cursor-pointer transition-colors',
                          (item.id === 'web' && webSearchEnabled) ? 'bg-accent/12 text-accent' : activeSubMenu === item.id ? 'bg-hover text-primary' : 'bg-transparent text-primary'
                        )}
                      >
                        <span className={cn((item.id === 'web' && webSearchEnabled) ? 'text-accent' : 'text-secondary')}>{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.hasSubmenu && <CaretRight size={14} className="opacity-50" />}
                        {item.id === 'web' && webSearchEnabled && <Check size={14} className="text-accent" />}
                      </button>
                      {activeSubMenu === item.id && item.submenuItems && (
                        <div
                          className="absolute left-[calc(100%+10px)] bottom-0 w-52 bg-menu-bg rounded-xl border border-menu-border shadow-xl p-1.5 z-210"
                          onMouseEnter={() => setTrackingAttention(-0.26, 0.46, 'locked-on')}
                          onMouseLeave={() => setTrackingAttention(-0.48, 0.5, 'locked-on')}
                        >
                          {item.submenuItems.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => { if (item.id === 'project' && sub.id === 'new-project') { import('@/views/chat/ChatStore').then(m => m.useChatStore.getState().createProject('New Project')); setShowPlusMenu(false); } }}
                              className="w-full flex items-center gap-2 py-2 px-3 rounded-lg bg-transparent border-none text-primary text-sm cursor-pointer hover:bg-hover"
                              onMouseEnter={() => setTrackingAttention(-0.24, 0.46, 'locked-on')}
                            >
                              {sub.icon && <span className="text-secondary">{sub.icon}</span>}
                              <span>{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="h-px bg-menu-border my-1 mx-2" />
                  <div className="py-0.5 px-2 text-xs font-semibold text-muted tracking-widest uppercase">Style</div>
                  {PLUS_MENU_ITEMS.filter(i => ['style', 'connectors'].includes(i.id)).map((item) => (
                    <div key={item.id} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.id === 'connectors') { setShowProviderConnect(true); setShowPlusMenu(false); }
                        }}
                        onMouseEnter={() => {
                          if (item.hasSubmenu) setActiveSubMenu(item.id); else setActiveSubMenu(null);
                          setTrackingAttention(-0.48, 0.5, 'locked-on');
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 py-2 px-3 rounded-lg border-none text-sm cursor-pointer transition-colors',
                          (item.id === 'style' && activeStyle) ? 'bg-accent/12 text-accent' : activeSubMenu === item.id ? 'bg-hover text-primary' : 'bg-transparent text-primary'
                        )}
                      >
                        <span className={cn((item.id === 'style' && activeStyle) ? 'text-accent' : 'text-secondary')}>{item.icon}</span>
                        <span className="flex-1 text-left">{item.id === 'style' && activeStyle ? `Style: ${activeStyle.charAt(0).toUpperCase() + activeStyle.slice(1)}` : item.label}</span>
                        {item.hasSubmenu && <CaretRight size={14} className="opacity-50" />}
                        {item.id === 'style' && activeStyle && <Check size={14} className="text-accent" />}
                      </button>
                      {activeSubMenu === item.id && item.submenuItems && (
                        <div
                          className="absolute left-[calc(100%+10px)] bottom-0 w-52 bg-menu-bg rounded-xl border border-menu-border shadow-xl p-1.5 z-210"
                          onMouseEnter={() => setTrackingAttention(-0.26, 0.46, 'locked-on')}
                          onMouseLeave={() => setTrackingAttention(-0.48, 0.5, 'locked-on')}
                        >
                          {item.submenuItems.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => { if (item.id === 'style') { setActiveStyle(activeStyle === sub.id ? null : sub.id as 'formal' | 'creative' | 'technical'); setShowPlusMenu(false); } }}
                              className={cn(
                                'w-full flex items-center gap-2 py-2 px-3 rounded-lg border-none text-sm cursor-pointer',
                                activeStyle === sub.id ? 'bg-accent/12 text-accent' : 'bg-transparent text-primary hover:bg-hover'
                              )}
                            >
                              {activeStyle === sub.id && <Check size={12} className="text-accent" />}
                              <span>{sub.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
              <SpeechInput
                size="icon"
                variant="ghost"
                className="size-7 rounded-full text-composer-muted hover:text-primary hover:bg-transparent transition-colors"
                onTranscriptionChange={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)}
                title="Voice input"
              />
              {agentModeSurface ? (
                <AgentModeButton
                  agentModeEnabled={agentModeEnabled}
                  selectedModeId={selectedModeId}
                  agentModeSurface={agentModeSurface}
                  onToggle={toggleAgentMode}
                  onInteractionSignal={onInteractionSignal}
                  setTrackingAttention={setTrackingAttention}
                />
              ) : null}
              <button
                onClick={() => setShowModelMenu(!showModelMenu)}
                type="button"
                disabled={terminalModelsLoading}
                className="flex items-center gap-1 py-1 px-2.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: showModelMenu ? THEME.hoverBg : 'transparent',
                  color: terminalModelsLoading ? THEME.textMuted : THEME.textSecondary,
                  cursor: terminalModelsLoading ? 'wait' : 'pointer',
                  opacity: terminalModelsLoading ? 0.7 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!terminalModelsLoading) {
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
                {terminalModelsLoading ? (
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
                  onOpenModelPicker={onOpenModelPicker}
                  onBrowseAllModels={handleBrowseAllModels}
                  onOpenProviderConnect={() => setShowProviderConnect(true)}
                  isTerminalModels={terminalModels.length > 0}
                  onAttentionChange={onAttentionChange}
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
                    className="size-8 rounded-full bg-composer-soft border border-input-border text-accent flex items-center justify-center cursor-pointer transition-all"
                  >
                    <Square size={12} fill="currentColor" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  type="button"
                  className="size-8 rounded-full flex items-center justify-center transition-all"
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
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="w-full max-w-[600px] lg:max-w-[760px] flex flex-col items-center -mt-px">
        <BottomDock
          selectedModeId={selectedModeId}
          agentModeSurface={agentModeSurface}
          agentModeEnabled={agentModeEnabled}
          agentModeTheme={agentModeTheme}
          setShowAgentMenu={setShowAgentMenu}
          showAgentMenu={showAgentMenu}
          selectedSurfaceAgent={selectedSurfaceAgent}
          customLeftContent={bottomDockContent}
        />
      </div>
      
      {showAgentMenu && agentModeSurface && (
        <AgentSelectorDropdown
          agents={agents}
          isLoading={isLoadingAgents}
          selectedAgent={selectedSurfaceAgentId}
          workspaceArtifacts={characterArtifacts}
          error={agentError}
          openClawCandidatesCount={openClawCandidates.length}
          onOpenImportWizard={() => setShowOpenClawImportDialog(true)}
          onSelect={(agent) => {
            setSelectedSurfaceAgent(agentModeSurface, agent.id);
            setShowAgentMenu(false);
          }}
          onClear={() => {
            setSelectedSurfaceAgent(agentModeSurface, null);
            setShowAgentMenu(false);
          }}
          onClose={() => setShowAgentMenu(false)}
        />
      )}
      
      {mentionOpen && agentModeSurface && (
        <AgentMentionDropdown
          agents={agents}
          query={mentionQuery}
          selectedIndex={mentionIndex}
          onSelect={handleSelectMentionAgent}
          onHoverIndex={setMentionIndex}
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
      
      {agentModeSurface && agentModeEnabled && (
        <div className="w-full max-w-[600px] lg:max-w-[760px] flex flex-col items-center">
          <ModeDock
            selectedMode={selectedModeId}
            onSelectMode={(modeId) => {
              if (agentModeSurface) {
                setSelectedMode(agentModeSurface, modeId as AgentModeId);
              }
            }}
            agentModeSurface={agentModeSurface}
            isLoading={isLoading}
            selectedSurfaceAgent={selectedSurfaceAgent}
            onSelectTemplate={(prompt) => {
              setInput(prompt);
              const textarea = textareaRef.current;
              if (textarea) {
                textarea.focus();
              }
            }}
          />
        </div>
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
