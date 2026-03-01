"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Square,
  ArrowUp,
  ChevronDown,
  Folder,
  Code,
  PenTool,
  BookOpen,
  Sparkles,
  X,
  FileText,
  Image as ImageIcon,
  Github,
  Globe,
  Zap,
  MousePointer2,
  Check,
  ChevronRight,
  Bot,
  Camera,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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
import { useAgentSurfaceModeStore, type AgentModeSurface } from '@/stores/agent-surface-mode.store';
import {
  buildOpenClawImportInput,
  discoverOpenClawAgents,
  getOpenClawWorkspacePathFromAgent,
  getRegisteredOpenClawAgentId,
  resolveOpenClawRegistration,
  useAgentStore,
  type Agent,
  type OpenClawDiscoveredAgent,
} from '@/lib/agents';
import { AgentModeGizzi } from './AgentModeGizzi';
import { getAgentModeSurfaceTheme } from './agentModeSurfaceTheme';
import { useRecordingStore } from '@/stores/recording.store';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';

// Terminal Server URL for fetching real models
declare const __TERMINAL_SERVER_URL__: string | undefined;
const TERMINAL_SERVER_URL = typeof __TERMINAL_SERVER_URL__ !== 'undefined'
  ? __TERMINAL_SERVER_URL__
  : (typeof window !== 'undefined' && (window as any).__TERMINAL_SERVER_URL__)
    ? (window as any).__TERMINAL_SERVER_URL__
    : 'http://127.0.0.1:4096';

// ============================================================================
// Theme
// ============================================================================
const THEME = {
  bg: '#2B2520',
  inputBg: '#352F29',
  inputBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.05)',
  menuBg: '#332D27',
  menuBorder: 'rgba(255,255,255,0.08)',
};

export interface ChatAttachment {
  id: string;
  name: string;
  dataUrl: string;
  type: 'image' | 'screenshot' | 'gif';
}

export interface SlashCommand {
  command: string;
  label: string;
  icon?: React.ReactNode;
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
}

const CATEGORY_EMOTIONS: Record<string, { hover: GizziEmotion; select: GizziEmotion }> = {
  code: { hover: 'focused', select: 'proud' },
  create: { hover: 'curious', select: 'pleased' },
  write: { hover: 'pleased', select: 'proud' },
  learn: { hover: 'alert', select: 'focused' },
  a2r: { hover: 'mischief', select: 'mischief' },
};

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
    id: 'a2r',
    label: "A2R's choice",
    icon: <Sparkles size={14} />,
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
      { id: 'existing-project', label: 'How to use A2R', icon: <FileText size={14} /> },
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
  { id: 'connectors', label: 'Add connectors', icon: <Zap size={16} /> },
];

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
}: ChatComposerProps) {
  const [input, setInput] = useState(inputValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastAgentFetchPulseRef = useRef<number | null>(null);
  const openClawDiscoveryRequestRef = useRef(0);
  const showAgentRailGuide = Boolean(
    agentModeSurface && agentModeSurface !== 'code',
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showOpenClawImportDialog, setShowOpenClawImportDialog] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [openClawCandidates, setOpenClawCandidates] = useState<OpenClawDiscoveredAgent[]>([]);
  const [isLoadingOpenClawCandidates, setIsLoadingOpenClawCandidates] = useState(false);
  const [openClawError, setOpenClawError] = useState<string | null>(null);
  const [importingOpenClawAgentId, setImportingOpenClawAgentId] = useState<string | null>(null);
  const agentModeEnabled = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.enabledBySurface[agentModeSurface] : false,
  );
  const agentModePulse = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.pulseBySurface[agentModeSurface] : 0,
  );
  const [showAgentGuidePadding, setShowAgentGuidePadding] = useState(
    Boolean(agentModeEnabled && showAgentRailGuide),
  );
  // ── Slash command state ───────────────────────────────────────────────────
  const [slashMenuVisible, setSlashMenuVisible] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');

  // ── Attachment state (internal when external not provided) ───────────────
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

  // ── Recording store (for GIF screen recording) ──────────────────────────
  const isGifRecording = useRecordingStore((s) => s.isRecording);
  const gifDuration = useRecordingStore((s) => s.duration);
  const startGifRecording = useRecordingStore((s) => s.startRecording);
  const stopGifRecording = useRecordingStore((s) => s.stopRecording);

  // ── Browser-specific plus menu items ────────────────────────────────────
  const isBrowserSurface = agentModeSurface === 'browser';

  const setAgentModeEnabled = useAgentSurfaceModeStore((state) => state.setEnabled);
  const selectedSurfaceAgentId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedAgentIdBySurface[agentModeSurface] : null,
  );
  const setSelectedSurfaceAgent = useAgentSurfaceModeStore((state) => state.setSelectedAgent);
  const agents = useAgentStore((state) => state.agents);
  const fetchAgents = useAgentStore((state) => state.fetchAgents);
  const createAgent = useAgentStore((state) => state.createAgent);
  const isLoadingAgents = useAgentStore((state) => state.isLoadingAgents);
  const agentError = useAgentStore((state) => state.error);
  const characterArtifacts = useAgentStore((state) => state.characterArtifacts);
  const compileCharacterLayer = useAgentStore((state) => state.compileCharacterLayer);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  const { authenticatedProviders, discoverModels, discoveryResult, fetchProviders, realModels } = useModelDiscovery();

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

  // Fetch models from Terminal Server
  useEffect(() => {
    async function fetchTerminalModels() {
      try {
        const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
        if (!response.ok) throw new Error(`Failed to fetch models: ${response.status}`);
        const data = await response.json();
        const transformedModels: any[] = [];
        if (data.all && Array.isArray(data.all)) {
          data.all.forEach((provider: any) => {
            if (provider.models && typeof provider.models === 'object') {
              Object.entries(provider.models).forEach(([modelId, modelData]: [string, any]) => {
                transformedModels.push({
                  id: `${provider.id}/${modelId}`,
                  name: modelData.name || modelId,
                  description: modelData.description || `${provider.name} model`,
                  providerId: provider.id,
                  providerName: provider.name,
                });
              });
            }
          });
        }
        if (transformedModels.length > 0) setTerminalModels(transformedModels);
      } catch (err) {
        console.error('Failed to fetch models from Terminal Server:', err);
      } finally {
        setTerminalModelsLoading(false);
      }
    }
    fetchTerminalModels();
  }, []);

  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  useEffect(() => {
    if (!agentModeSurface || !agentModeEnabled || isLoadingAgents || agents.length > 0) {
      return;
    }

    if (agentError && lastAgentFetchPulseRef.current === agentModePulse) {
      return;
    }

    lastAgentFetchPulseRef.current = agentModePulse;
    void fetchAgents().catch(() => {});
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
    if (!agentModeSurface || !agentModeEnabled || isLoadingOpenClawCandidates) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const hasSelectedAgent = Boolean(selectedSurfaceAgentId);
    const hasRegistryAgents = agents.length > 0;
    const dismissKey = `a2r-openclaw-import-dismissed:${agentModeSurface}`;
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
    agents,
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
    if (inputValue !== undefined && inputValue !== input) {
      setInput(inputValue);
    }
  }, [input, inputValue]);

  const allModels = useMemo(() => {
    let models: any[] = [];
    if (terminalModels.length > 0) {
      models = terminalModels;
    } else if (realModels && realModels.length > 0) {
      const flattened = realModels.flatMap(provider =>
        (provider.models || []).map(model => ({
          ...model,
          providerId: provider.id,
          providerName: provider.name
        }))
      );
      if (flattened.length > 0) models = flattened;
    } else {
      models = discoveryResult?.models || [];
    }
    if (models.length > 0) {
      return [...models].sort((a, b) => {
        const aIsBigPickle = a.id === 'big-pickle' || a.id?.includes('big-pickle');
        const bIsBigPickle = b.id === 'big-pickle' || b.id?.includes('big-pickle');
        if (aIsBigPickle && !bIsBigPickle) return -1;
        if (!aIsBigPickle && bIsBigPickle) return 1;
        return 0;
      });
    }
    return [
      { id: 'big-pickle', name: 'Big Pickle (Free)', description: 'Free zen model via OpenCode', providerId: 'opencode' },
      { id: 'openai/gpt-4o', name: 'GPT-4o', description: 'OpenAI flagship model', providerId: 'openai' },
      { id: 'anthropic/claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic balanced model', providerId: 'anthropic' },
    ];
  }, [discoveryResult, realModels, terminalModels]);

  useEffect(() => {
    if (!selectedModel && allModels.length > 0) {
      const defaultModel = allModels.find(m =>
        m.id === 'big-pickle' ||
        m.id?.toLowerCase().includes('big-pickle') ||
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
  }, [allModels, selectedModel]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.max(24, Math.min(textareaRef.current.scrollHeight, 200));
      textareaRef.current.style.height = `${newHeight}px`;
    }
  }, [input]);

  const requiresAgentSelection = Boolean(agentModeSurface && agentModeEnabled);
  const canSubmit = Boolean(input.trim()) && !isLoading && (!requiresAgentSelection || Boolean(selectedSurfaceAgent));
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
              ? `Detected ${openClawCandidates.length} OpenClaw agent${openClawCandidates.length === 1 ? '' : 's'} on this machine. Import one to continue.`
              : agentError === 'API_OFFLINE'
                ? 'Agent registry is offline. Turn Agent Off or bring the gateway back to choose an agent.'
                : 'No agents are available yet. Create one in Agent Studio first.';

  const closeOpenClawPrompt = useCallback(() => {
    setShowOpenClawImportDialog(false);
  }, []);

  const dismissOpenClawPrompt = useCallback(() => {
    if (typeof window !== 'undefined' && agentModeSurface) {
      window.sessionStorage.setItem(`a2r-openclaw-import-dismissed:${agentModeSurface}`, 'true');
    }
    closeOpenClawPrompt();
  }, [agentModeSurface, closeOpenClawPrompt]);

  const handleImportOpenClawAgent = useCallback(async (candidate: OpenClawDiscoveredAgent) => {
    if (!agentModeSurface) {
      return;
    }

    setImportingOpenClawAgentId(candidate.agent_id);
    setOpenClawError(null);

    try {
      const created = await createAgent(buildOpenClawImportInput(candidate));
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
      setOpenClawError(error instanceof Error ? error.message : 'Failed to import OpenClaw agent');
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
    if (canSubmit) {
      onSend(input);
      setInput('');
      setActiveCategory(null);
      setShowAgentMenu(false);
      setSlashMenuVisible(false);
      setSlashFilter('');
      if (!externalAttachments) {
        setInternalAttachments([]);
      }
    }
  };

  // ── Slash command filtering ─────────────────────────────────────────────
  const filteredSlashCommands = useMemo(() => {
    if (!slashCommands || !slashMenuVisible) return [];
    if (!slashFilter) return slashCommands;
    return slashCommands.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(slashFilter.toLowerCase()) ||
        cmd.label.toLowerCase().includes(slashFilter.toLowerCase()),
    );
  }, [slashCommands, slashMenuVisible, slashFilter]);

  // ── Screenshot capture ──────────────────────────────────────────────────
  const handleCaptureScreenshot = useCallback(async () => {
    setShowPlusMenu(false);
    try {
      // Notify the browser agent store
      useBrowserAgentStore.getState().captureScreenshot();

      // Use MediaDevices getDisplayMedia to capture the screen/tab
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

  // ── GIF screen recording ────────────────────────────────────────────────
  const handleToggleGifRecording = useCallback(async () => {
    setShowPlusMenu(false);
    if (isGifRecording) {
      try {
        const result = await stopGifRecording();
        if (result.filePath) {
          // Fetch the file and convert to data URL for attachment
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
            // If fetch fails, add a placeholder attachment with the path
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

  // ── Image file picker ───────────────────────────────────────────────────
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
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [addAttachment]);

  // ── Slash command execution ─────────────────────────────────────────────
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
        // Trigger workflow recording via store
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

  const handleOptionHover = (option: string) => {
    setInput(option);
    if (activeCategory) {
      onInteractionSignal?.(CATEGORY_EMOTIONS[activeCategory]?.hover ?? 'curious');
    }
  };

  const handleModelSelect = (model: any) => {
    if (onSelectModel) {
      const providerId = model.providerId || 'a2r';
      onSelectModel({
        providerId: providerId,
        profileId: `${providerId}-acp`,
        modelId: model.id,
        modelName: model.name
      });
    }
    setShowModelMenu(false);
  };

  const displayModelName = selectedModelDisplayName || (allModels.find(m => m.id === selectedModel)?.name || allModels[0]?.name || "Select Model");
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
    <div style={{
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      boxSizing: 'border-box',
      position: 'relative',
      paddingTop: 0,
      animation: agentModeSurface && agentModeEnabled && agentModePulse ? 'a2r-agent-mode-flash 560ms ease' : undefined,
    }}
    onMouseLeave={() => {
      clearAttention();
      onInteractionSignal?.('steady');
    }}>
      <style>{`
        @keyframes a2r-agent-mode-sweep {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes a2r-agent-mode-flash {
          0% { transform: scale(0.996); }
          45% { transform: scale(1); }
          100% { transform: scale(1); }
        }
      `}</style>
      {/* Top Action Buttons */}
      {showTopActions && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          width: '100%',
          maxWidth: variant === 'large' ? '800px' : '640px',
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}
        onMouseEnter={() => setTrackingAttention(0, 0.18, 'locked-on')}
        onMouseLeave={() => {
          if (!activeCategory) {
            clearAttention();
          }
        }}>
          {ACTION_CATEGORIES.map((cat, index) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(activeCategory === cat.id ? null : cat.id);
                onInteractionSignal?.(CATEGORY_EMOTIONS[cat.id]?.select ?? 'focused');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '10px',
                background: activeCategory === cat.id ? 'rgba(212,149,106,0.15)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${activeCategory === cat.id ? 'rgba(212,149,106,0.3)' : THEME.inputBorder}`,
                color: activeCategory === cat.id ? THEME.accent : THEME.textSecondary,
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
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
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.color = THEME.textSecondary;
                }
              }}
            >
              {cat.icon}
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Overlay for Options */}
      {showTopActions && activeCategory && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% - 30px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: variant === 'large' ? '760px' : '600px',
            background: THEME.menuBg,
            borderRadius: '16px',
            border: `1px solid ${THEME.menuBorder}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            zIndex: 100,
            padding: '8px 0',
            marginBottom: '40px'
          }}
          onMouseEnter={() => setTrackingAttention(0, 0.26, 'locked-on')}
          onMouseLeave={() => {
            setActiveCategory(null);
            clearAttention();
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px',
            borderBottom: `1px solid ${THEME.inputBorder}`,
            marginBottom: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: THEME.textSecondary, fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
              {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.icon}
              {ACTION_CATEGORIES.find(c => c.id === activeCategory)?.label}
            </div>
            <button
              onClick={() => setActiveCategory(null)}
              style={{ background: 'none', border: 'none', color: THEME.textMuted, cursor: 'pointer' }}
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
                e.currentTarget.style.background = THEME.hoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                setInput(option);
                setActiveCategory(null);
                onInteractionSignal?.(activeCategory ? CATEGORY_EMOTIONS[activeCategory]?.select ?? 'pleased' : 'pleased');
                textareaRef.current?.focus();
              }}
              style={{
                padding: '12px 16px',
                color: THEME.textPrimary,
                fontSize: '14px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: idx === (ACTION_CATEGORIES.find(c => c.id === activeCategory)?.options.length || 0) - 1 ? 'none' : `1px solid ${THEME.inputBorder}`
              }}
            >
              <span>{option}</span>
              <MousePointer2 size={12} style={{ opacity: 0.3 }} />
            </div>
          ))}
        </div>
      )}

      {/* ── Main Composer Box ── */}
      <div
        style={{
          width: '100%',
          maxWidth: variant === 'large' ? '800px' : '680px',
          position: 'relative',
          overflow: 'visible',
          zIndex: 14,
        }}
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
          style={{
            width: '100%',
            background: THEME.inputBg,
            borderRadius: '24px',
            border: `1px solid ${agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder}`,
            boxShadow: agentModeEnabled
              ? `0 0 0 1px ${agentModeTheme.soft}, 0 12px 36px ${agentModeTheme.glow}`
              : '0 8px 32px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'visible',
            transition: 'box-shadow 0.2s ease',
            position: 'relative',
            zIndex: 10
          }}
          onMouseEnter={() => setTrackingAttention(0, 0.44)}
        >
        {agentModeSurface && agentModeEnabled ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: 24,
              pointerEvents: 'none',
              background: `linear-gradient(120deg, transparent 0%, ${agentModeTheme.soft} 20%, ${agentModeTheme.glow} 50%, ${agentModeTheme.soft} 80%, transparent 100%)`,
              backgroundSize: '200% 200%',
              animation: 'a2r-agent-mode-sweep 3.2s linear infinite',
              mixBlendMode: 'screen',
              opacity: 0.36,
            }}
          />
        ) : null}
        {/* Hidden file input for image attachments */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageFileSelect}
        />

        {/* Slash Command Dropdown */}
        {slashMenuVisible && filteredSlashCommands.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              maxWidth: '100%',
              background: THEME.menuBg,
              borderRadius: 12,
              border: `1px solid ${THEME.menuBorder}`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
              padding: 6,
              zIndex: 250,
            }}
          >
            <div style={{ padding: '6px 12px 4px', fontSize: 11, color: THEME.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Commands
            </div>
            {filteredSlashCommands.map((cmd) => (
              <button
                key={cmd.command}
                type="button"
                onClick={() => handleSlashCommand(cmd)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: 'none',
                  color: THEME.textPrimary,
                  fontSize: 13,
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = THEME.hoverBg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: THEME.accent, fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{cmd.command}</span>
                <span style={{ color: THEME.textSecondary }}>{cmd.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Attachment Chips */}
        {attachments.length > 0 && (
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '10px 20px 0',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 8px 4px 4px',
                  borderRadius: 10,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontSize: 11,
                  color: THEME.textSecondary,
                  maxWidth: 200,
                }}
              >
                {att.dataUrl.startsWith('data:image') ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: att.type === 'gif' ? 'rgba(143,199,223,0.15)' : 'rgba(212,149,106,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {att.type === 'gif' ? <Video size={14} style={{ color: '#8fc7df' }} /> : <Camera size={14} style={{ color: THEME.accent }} />}
                  </div>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 0%' }}>
                  {att.name}
                </span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  style={{
                    padding: 2,
                    border: 'none',
                    background: 'transparent',
                    color: THEME.textMuted,
                    cursor: 'pointer',
                    display: 'flex',
                    flexShrink: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div style={{ padding: '16px 20px 8px 20px' }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const val = e.target.value;
              setInput(val);
              // Slash command detection
              if (slashCommands && slashCommands.length > 0) {
                if (val.startsWith('/')) {
                  setSlashMenuVisible(true);
                  setSlashFilter(val);
                } else {
                  setSlashMenuVisible(false);
                  setSlashFilter('');
                }
              }
            }}
            onKeyDown={(e) => {
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
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            onFocus={() => setTrackingAttention(0, 0.34, 'locked-on')}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: THEME.textPrimary,
              fontSize: '16px',
              lineHeight: '1.5',
              resize: 'none',
              fontFamily: 'inherit',
              padding: 0,
              margin: 0,
              display: 'block',
            }}
          />
        </div>

        {requiresAgentSelection ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '0 20px 8px 20px',
              color: selectedSurfaceAgent ? agentModeTheme.accent : THEME.textSecondary,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', minWidth: 0, alignItems: 'center', gap: 8 }}>
              <Bot size={14} />
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {agentHelperText}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {!selectedSurfaceAgent && openClawCandidates.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowOpenClawImportDialog(true)}
                  style={{
                    flexShrink: 0,
                    border: `1px solid ${agentModeTheme.glow}`,
                    borderRadius: 999,
                    background: agentModeTheme.soft,
                    color: agentModeTheme.accent,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '5px 9px',
                    cursor: 'pointer',
                  }}
                >
                  Import OpenClaw
                </button>
              ) : null}
              {selectedSurfaceAgent && selectedWorkspacePreview.workspacePath ? (
                <span
                  style={{
                    flexShrink: 0,
                    color: THEME.textMuted,
                    fontSize: 11,
                    maxWidth: 180,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={selectedWorkspacePreview.workspacePath}
                >
                  {selectedWorkspacePreview.workspacePath}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Bottom Toolbar */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px 12px 12px'
        }}>
          {/* Left side: Plus button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setShowPlusMenu(!showPlusMenu); setActiveSubMenu(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: showPlusMenu ? 'rgba(255,255,255,0.08)' : 'transparent',
                border: 'none',
                color: THEME.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = THEME.hoverBg;
                onInteractionSignal?.('alert');
                setTrackingAttention(-0.44, 0.56, 'locked-on');
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = showPlusMenu ? 'rgba(255,255,255,0.08)' : 'transparent';
                setTrackingAttention(0, 0.44);
              }}
            >
              <Plus size={20} strokeWidth={2.5} style={{ transform: showPlusMenu ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Plus Menu Popover */}
            {showPlusMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 12px)',
                  left: 0,
                  width: '240px',
                  background: THEME.menuBg,
                  borderRadius: '12px',
                  border: `1px solid ${THEME.menuBorder}`,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  padding: '6px',
                  zIndex: 200,
                }}
                onMouseEnter={() => setTrackingAttention(-0.48, 0.5, 'locked-on')}
                onMouseLeave={() => {
                  if (!activeSubMenu) setShowPlusMenu(false);
                  setTrackingAttention(0, 0.44);
                }}
              >
                {/* Browser-specific capture actions */}
                {isBrowserSurface && (
                  <>
                    <button
                      type="button"
                      onClick={handleCaptureScreenshot}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: THEME.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = THEME.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ color: THEME.textSecondary }}><Camera size={16} /></span>
                      <span>Take a screenshot</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleGifRecording}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: isGifRecording ? 'rgba(239,68,68,0.08)' : 'transparent',
                        border: 'none',
                        color: isGifRecording ? '#f87171' : THEME.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isGifRecording ? 'rgba(239,68,68,0.12)' : THEME.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isGifRecording ? 'rgba(239,68,68,0.08)' : 'transparent'; }}
                    >
                      <span style={{ color: isGifRecording ? '#f87171' : THEME.textSecondary }}>
                        {isGifRecording ? <Square size={16} fill="currentColor" /> : <Video size={16} />}
                      </span>
                      <span>{isGifRecording ? `Stop recording (${gifDuration}s)` : 'Record screen (GIF)'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { fileInputRef.current?.click(); setShowPlusMenu(false); }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'transparent',
                        border: 'none',
                        color: THEME.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = THEME.hoverBg; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ color: THEME.textSecondary }}><ImageIcon size={16} /></span>
                      <span>Add an image</span>
                    </button>
                    <div style={{ height: 1, background: THEME.menuBorder, margin: '4px 8px' }} />
                  </>
                )}
                {PLUS_MENU_ITEMS.map((item) => (
                  <div key={item.id} style={{ position: 'relative' }}>
                    <button
                      onMouseEnter={() => {
                        if (item.hasSubmenu) setActiveSubMenu(item.id); else setActiveSubMenu(null);
                        setTrackingAttention(-0.48, 0.5, 'locked-on');
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: activeSubMenu === item.id ? THEME.hoverBg : 'transparent',
                        border: 'none',
                        color: THEME.textPrimary,
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}
                    >
                      <span style={{ color: THEME.textSecondary }}>{item.icon}</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                      {item.hasSubmenu && <ChevronRight size={14} style={{ opacity: 0.5 }} />}
                      {item.isActive && !item.hasSubmenu && <Check size={14} style={{ color: THEME.accent }} />}
                    </button>

                    {activeSubMenu === item.id && item.submenuItems && (
                      <div style={{
                        position: 'absolute',
                        left: 'calc(100% + 10px)',
                        bottom: 0,
                        width: '200px',
                        background: THEME.menuBg,
                        borderRadius: '12px',
                        border: `1px solid ${THEME.menuBorder}`,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        padding: '6px',
                        zIndex: 210
                      }}
                      onMouseEnter={() => setTrackingAttention(-0.26, 0.46, 'locked-on')}
                      onMouseLeave={() => setTrackingAttention(-0.48, 0.5, 'locked-on')}
                      >
                        {item.submenuItems.map((sub) => (
                          <button
                            key={sub.id}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              background: 'transparent',
                              border: 'none',
                              color: THEME.textPrimary,
                              fontSize: '13px',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = THEME.hoverBg;
                              setTrackingAttention(-0.24, 0.46, 'locked-on');
                            }}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            {sub.icon && <span style={{ color: THEME.textSecondary }}>{sub.icon}</span>}
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

          {/* Right side: Model selector + Send button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            {agentModeSurface ? (
              <button
                type="button"
                onClick={() => setAgentModeEnabled(agentModeSurface, !agentModeEnabled)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: `1px solid ${agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder}`,
                  background: agentModeEnabled ? agentModeTheme.soft : 'transparent',
                  color: agentModeEnabled ? agentModeTheme.accent : THEME.textSecondary,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={() => {
                  onInteractionSignal?.('focused');
                  setTrackingAttention(0.16, 0.56, 'locked-on');
                }}
                onMouseLeave={() => setTrackingAttention(0, 0.44)}
              >
                <Bot size={14} />
                {agentModeEnabled ? 'Agent On' : 'Agent Off'}
              </button>
            ) : null}
            {agentModeSurface && agentModeEnabled ? (
              <>
                <button
                  onClick={() => setShowAgentMenu(!showAgentMenu)}
                  type="button"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: showAgentMenu ? agentModeTheme.soft : 'transparent',
                    border: `1px solid ${selectedSurfaceAgent ? agentModeTheme.glow : THEME.inputBorder}`,
                    color: selectedSurfaceAgent ? agentModeTheme.accent : THEME.textSecondary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    maxWidth: '190px',
                  }}
                  onMouseEnter={() => {
                    onInteractionSignal?.('focused');
                    setTrackingAttention(0.28, 0.56, 'locked-on');
                  }}
                  onMouseLeave={() => setTrackingAttention(0, 0.44)}
                >
                  <Bot size={14} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isLoadingAgents
                      ? 'Loading agents...'
                      : selectedSurfaceAgent
                        ? selectedSurfaceAgent.name
                        : 'Choose Agent'}
                  </span>
                  <ChevronDown size={12} style={{ transform: showAgentMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
                </button>
                {showAgentMenu ? (
                  <AgentSelectorDropdown
                    agents={agents}
                    isLoading={isLoadingAgents}
                    selectedAgent={selectedSurfaceAgentId}
                    workspaceArtifacts={characterArtifacts}
                    error={agentError}
                    openClawCandidatesCount={openClawCandidates.length}
                    onOpenImportWizard={() => setShowOpenClawImportDialog(true)}
                    onSelect={(agent) => {
                      if (!agentModeSurface) {
                        return;
                      }
                      setSelectedSurfaceAgent(agentModeSurface, agent.id);
                      void loadCharacterLayer(agent.id)
                        .then(() => compileCharacterLayer(agent.id))
                        .catch(() => {});
                      setShowAgentMenu(false);
                    }}
                    onClear={
                      selectedSurfaceAgent
                        ? () => {
                            if (!agentModeSurface) {
                              return;
                            }
                            setSelectedSurfaceAgent(agentModeSurface, null);
                            setShowAgentMenu(false);
                          }
                        : undefined
                    }
                    onClose={() => setShowAgentMenu(false)}
                  />
                ) : null}
              </>
            ) : null}
            {/* Model Selector Pill */}
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              type="button"
              disabled={terminalModelsLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                borderRadius: '999px',
                background: showModelMenu ? THEME.hoverBg : 'transparent',
                border: 'none',
                color: terminalModelsLoading ? THEME.textMuted : THEME.textSecondary,
                fontSize: '13px',
                fontWeight: 500,
                cursor: terminalModelsLoading ? 'wait' : 'pointer',
                transition: 'all 0.2s',
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
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    width: 12,
                    height: 12,
                    border: `2px solid ${THEME.textMuted}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Loading...
                </span>
              ) : (
                <>
                  <span>{displayModelName}</span>
                  <span style={{ fontSize: '11px', opacity: 0.5, marginLeft: '2px' }}>Extended</span>
                </>
              )}
              <ChevronDown size={12} style={{ transform: showModelMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.6 }} />
            </button>

            {/* Model Menu Popover */}
            {showModelMenu && (
              <ModelSelectorDropdown
                models={allModels}
                selectedModel={selectedModel}
                onSelect={handleModelSelect}
                onClose={() => setShowModelMenu(false)}
                onOpenModelPicker={onOpenModelPicker}
                isTerminalModels={terminalModels.length > 0}
                onAttentionChange={onAttentionChange}
              />
            )}

            {/* Waveform + Stop Button (during streaming) */}
            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Waveform bars — 3 animated bars showing stream activity */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '18px' }}>
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: '3px',
                        borderRadius: '2px',
                        background: THEME.accent,
                        animationDelay: `${i * 0.18}s`,
                      }}
                      className="a2r-waveform-bar"
                    />
                  ))}
                </div>
                <button
                  onClick={onStop}
                  type="button"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.08)',
                    border: `1px solid ${THEME.inputBorder}`,
                    color: THEME.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <Square size={12} fill="currentColor" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                type="button"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: canSubmit ? THEME.accent : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  color: canSubmit ? '#FFF' : THEME.textMuted,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canSubmit ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                  boxShadow: canSubmit ? '0 2px 8px rgba(212,149,106,0.3)' : 'none',
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

      <Dialog open={showOpenClawImportDialog} onOpenChange={(open) => {
        if (!open) {
          dismissOpenClawPrompt();
          return;
        }
        setShowOpenClawImportDialog(open);
      }}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <div
            style={{
              borderRadius: 28,
              border: '1px solid rgba(233,185,137,0.14)',
              background:
                'linear-gradient(180deg, rgba(43,35,30,0.98) 0%, rgba(28,24,21,0.98) 100%)',
              boxShadow: '0 28px 100px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '22px 24px 18px',
                background:
                  'linear-gradient(115deg, rgba(212,149,106,0.18), rgba(93,133,171,0.06) 48%, rgba(255,255,255,0.02) 100%)',
                borderBottom: `1px solid ${THEME.inputBorder}`,
              }}
            >
              <DialogHeader>
                <DialogTitle style={{ color: '#f5ede6', fontSize: 24, fontWeight: 700 }}>
                  Import your OpenClaw agent
                </DialogTitle>
                <DialogDescription style={{ color: '#b8a99b', maxWidth: 680 }}>
                  A2R found local OpenClaw agent workspace data on this machine. Import one into
                  Agent Studio so Agent Mode can bind this surface to a real agent instead of an
                  empty selector.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div style={{ padding: 24, display: 'grid', gap: 14 }}>
              {openClawCandidates.length === 0 ? (
                <div
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${THEME.inputBorder}`,
                    padding: 18,
                    color: THEME.textSecondary,
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  {isLoadingOpenClawCandidates
                    ? 'Checking local OpenClaw agent directories...'
                    : openClawError || 'No importable OpenClaw agents were found.'}
                </div>
              ) : (
                openClawCandidates.map((candidate) => (
                  <div
                    key={candidate.agent_id}
                    style={{
                      display: 'grid',
                      gap: 12,
                      borderRadius: 20,
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(255,255,255,0.03)',
                      padding: 18,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              borderRadius: 999,
                              background: 'rgba(212,149,106,0.12)',
                              border: '1px solid rgba(212,149,106,0.24)',
                              color: '#f2c9a6',
                              padding: '4px 9px',
                              fontSize: 10,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                            }}
                          >
                            <Bot size={12} />
                            OpenClaw Agent
                          </span>
                          <span style={{ color: THEME.textPrimary, fontSize: 18, fontWeight: 700 }}>
                            {candidate.display_name}
                          </span>
                        </div>
                        <div style={{ marginTop: 6, color: THEME.textSecondary, fontSize: 13 }}>
                          {candidate.primary_model || 'Model not declared'} · {candidate.session_count} recorded session{candidate.session_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportOpenClawAgent(candidate)}
                        disabled={importingOpenClawAgentId === candidate.agent_id}
                        style={{
                          flexShrink: 0,
                          borderRadius: 999,
                          border: '1px solid rgba(212,149,106,0.28)',
                          background: importingOpenClawAgentId === candidate.agent_id
                            ? 'rgba(212,149,106,0.08)'
                            : 'rgba(212,149,106,0.16)',
                          color: '#f2c9a6',
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '10px 14px',
                          cursor: importingOpenClawAgentId === candidate.agent_id ? 'wait' : 'pointer',
                        }}
                      >
                        {importingOpenClawAgentId === candidate.agent_id ? 'Importing...' : 'Import to Agent Studio'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                      <div
                        style={{
                          borderRadius: 14,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.14)',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Workspace
                        </div>
                        <div style={{ marginTop: 6, color: THEME.textPrimary, fontSize: 13, lineHeight: 1.5 }}>
                          {candidate.workspace_path || 'No workspace path declared'}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: 14,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.14)',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Auth Providers
                        </div>
                        <div style={{ marginTop: 6, color: THEME.textPrimary, fontSize: 13, lineHeight: 1.5 }}>
                          {candidate.auth_providers.length > 0 ? candidate.auth_providers.join(', ') : 'No auth profiles detected'}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: 14,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.14)',
                          padding: '12px 14px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          Files Found
                        </div>
                        <div style={{ marginTop: 6, color: THEME.textPrimary, fontSize: 13, lineHeight: 1.5 }}>
                          {candidate.files.models ? 'models.json' : 'No models.json'}
                          {' · '}
                          {candidate.files.auth_profiles ? 'auth-profiles.json' : 'No auth-profiles.json'}
                          {' · '}
                          {candidate.files.sessions_store ? 'sessions.json' : 'No sessions.json'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {openClawError ? (
                <div style={{ color: '#fca5a5', fontSize: 13 }}>
                  {openClawError}
                </div>
              ) : null}
            </div>

            <DialogFooter style={{ padding: '0 24px 24px' }}>
              <button
                type="button"
                onClick={dismissOpenClawPrompt}
                style={{
                  border: `1px solid ${THEME.inputBorder}`,
                  borderRadius: 999,
                  background: 'transparent',
                  color: THEME.textSecondary,
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
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


// ============================================================================
// Agent Selector Dropdown Component
// ============================================================================

interface AgentSelectorDropdownProps {
  agents: Agent[];
  isLoading: boolean;
  selectedAgent: string | null;
  workspaceArtifacts: Record<string, Array<{ path?: string }>>;
  error: string | null;
  openClawCandidatesCount?: number;
  onOpenImportWizard?: () => void;
  onSelect: (agent: Agent) => void;
  onClear?: () => void;
  onClose: () => void;
}

function AgentSelectorDropdown({
  agents,
  isLoading,
  selectedAgent,
  workspaceArtifacts,
  error,
  openClawCandidatesCount = 0,
  onOpenImportWizard,
  onSelect,
  onClear,
  onClose,
}: AgentSelectorDropdownProps) {
  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
        onClick={onClose}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(100% + 12px)',
          right: 148,
          width: '300px',
          maxHeight: '320px',
          background: THEME.menuBg,
          borderRadius: '12px',
          border: `1px solid ${THEME.menuBorder}`,
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            padding: '10px 12px',
            borderBottom: `1px solid ${THEME.inputBorder}`,
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: THEME.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Agent Workspace
            </div>
            <div style={{ marginTop: 2, fontSize: 13, color: THEME.textPrimary }}>
              Choose an agent
            </div>
          </div>
          {onClear ? (
            <button
              type="button"
              onClick={onClear}
              style={{
                border: 'none',
                background: 'transparent',
                color: THEME.textSecondary,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 6 }}>
          {isLoading ? (
            <div style={{ padding: 16, color: THEME.textSecondary, fontSize: 13 }}>
              Loading agents...
            </div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 16, color: THEME.textSecondary, fontSize: 13, lineHeight: 1.5 }}>
              {error === 'API_OFFLINE'
                ? 'The agent registry is offline right now. Bring the gateway back to bind this surface to a real agent.'
                : openClawCandidatesCount > 0
                  ? `No platform agents are registered yet. ${openClawCandidatesCount} OpenClaw agent${openClawCandidatesCount === 1 ? '' : 's'} can be imported.`
                  : 'No agents are available yet. Create one in Agent Studio first.'}
              {onOpenImportWizard && openClawCandidatesCount > 0 ? (
                <button
                  type="button"
                  onClick={onOpenImportWizard}
                  style={{
                    marginTop: 12,
                    borderRadius: 999,
                    border: `1px solid ${THEME.inputBorder}`,
                    background: 'rgba(212,149,106,0.14)',
                    color: THEME.accent,
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '8px 12px',
                    cursor: 'pointer',
                  }}
                >
                  Import from OpenClaw
                </button>
              ) : null}
            </div>
          ) : (
            agents.map((agent) => {
              const artifactCount = workspaceArtifacts[agent.id]?.length || 0;
              const isSelected = agent.id === selectedAgent;
              const linkedWorkspacePath = getOpenClawWorkspacePathFromAgent(agent);

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => onSelect(agent)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: isSelected ? 'rgba(212,149,106,0.12)' : 'transparent',
                    color: THEME.textPrimary,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(event) => {
                    if (!isSelected) {
                      event.currentTarget.style.background = THEME.hoverBg;
                    }
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.background = isSelected ? 'rgba(212,149,106,0.12)' : 'transparent';
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 10,
                      background: isSelected ? 'rgba(212,149,106,0.18)' : 'rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSelected ? THEME.accent : THEME.textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={14} />
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {agent.name}
                      </span>
                      {isSelected ? (
                        <span style={{ fontSize: 10, fontWeight: 700, color: THEME.accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Active
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 11, color: THEME.textSecondary }}>
                      {agent.provider} / {agent.model}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: THEME.textMuted, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <span>
                        {artifactCount > 0
                          ? `${artifactCount} workspace files`
                          : linkedWorkspacePath
                            ? 'OpenClaw workspace linked'
                            : 'Workspace pending'}
                      </span>
                      <span>{agent.capabilities.length} capabilities</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}


// ============================================================================
// Model Selector Dropdown Component
// ============================================================================

interface ModelSelectorDropdownProps {
  models: any[];
  selectedModel?: string;
  onSelect: (model: any) => void;
  onClose: () => void;
  onOpenModelPicker?: () => void;
  isTerminalModels?: boolean;
  onAttentionChange?: (attention: GizziAttention | null) => void;
}

function ModelSelectorDropdown({
  models,
  selectedModel,
  onSelect,
  onClose,
  onOpenModelPicker,
  isTerminalModels,
  onAttentionChange,
}: ModelSelectorDropdownProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { searchInputRef.current?.focus(); }, []);

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter(model =>
      model.name?.toLowerCase().includes(query) ||
      model.id?.toLowerCase().includes(query) ||
      model.providerName?.toLowerCase().includes(query) ||
      model.providerId?.toLowerCase().includes(query)
    );
  }, [models, searchQuery]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredModels.forEach(model => {
      const provider = model.providerName || model.providerId || 'Other';
      if (!groups[provider]) groups[provider] = [];
      groups[provider].push(model);
    });
    return groups;
  }, [filteredModels]);

  const sortedProviders = useMemo(() => {
    return Object.keys(groupedModels).sort((a, b) => a.localeCompare(b));
  }, [groupedModels]);

  const handleSelect = (model: any) => { onSelect(model); onClose(); };

  const ITEM_HEIGHT = 36;
  const MAX_VISIBLE_ITEMS = 6;
  const MAX_HEIGHT = 44 + (MAX_VISIBLE_ITEMS * ITEM_HEIGHT) + 40 + 20;

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 199 }}
        onClick={onClose}
      />
      <div style={{
        position: 'absolute',
        bottom: 'calc(100% + 12px)',
        right: 0,
        width: '320px',
        maxHeight: `${MAX_HEIGHT}px`,
        background: THEME.menuBg,
        borderRadius: '12px',
        border: `1px solid ${THEME.menuBorder}`,
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
      onMouseEnter={() => onAttentionChange?.({ state: 'locked-on', target: { x: 0.42, y: 0.5 } })}
      onMouseLeave={() => onAttentionChange?.({ state: 'tracking', target: { x: 0, y: 0.44 } })}
      >
        {/* Header with Search */}
        <div style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${THEME.inputBorder}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              color: THEME.textMuted,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {isTerminalModels ? 'Terminal Server' : 'Models'}
            </span>
            <span style={{ fontSize: '11px', color: THEME.textMuted }}>
              {filteredModels.length} / {models.length}
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            border: `1px solid ${THEME.inputBorder}`,
          }}>
            <Globe size={14} color={THEME.textMuted} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: THEME.textPrimary,
                fontSize: '13px',
                padding: 0,
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={14} color={THEME.textMuted} />
              </button>
            )}
          </div>
        </div>

        {/* Models List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: `${MAX_VISIBLE_ITEMS * ITEM_HEIGHT + (sortedProviders.length * 28)}px`,
          padding: '4px',
        }}>
          {filteredModels.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: THEME.textMuted, fontSize: '13px' }}>
              No models found
            </div>
          ) : (
            sortedProviders.map(provider => (
              <div key={provider}>
                <div style={{
                  padding: '6px 12px',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: THEME.accent,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  position: 'sticky',
                  top: 0,
                  background: THEME.menuBg,
                  zIndex: 1,
                }}>
                  {provider} ({groupedModels[provider].length})
                </div>
                {groupedModels[provider].map((model: any) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      background: selectedModel === model.id ? 'rgba(212,149,106,0.12)' : 'transparent',
                      border: 'none',
                      color: selectedModel === model.id ? THEME.accent : THEME.textPrimary,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      marginBottom: '2px',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedModel !== model.id) e.currentTarget.style.background = THEME.hoverBg;
                      onAttentionChange?.({ state: 'locked-on', target: { x: 0.44, y: 0.5 } });
                    }}
                    onMouseLeave={(e) => { if (selectedModel !== model.id) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{
                      fontWeight: selectedModel === model.id ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {model.name}
                    </span>
                    {selectedModel === model.id && (
                      <Check size={14} style={{ color: THEME.accent, flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ borderTop: `1px solid ${THEME.inputBorder}`, padding: '8px' }}>
          <button
            onClick={() => { onClose(); onOpenModelPicker?.(); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: THEME.textSecondary,
              fontSize: '13px',
              textAlign: 'left',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME.hoverBg;
              onAttentionChange?.({ state: 'locked-on', target: { x: 0.42, y: 0.58 } });
            }}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Sparkles size={14} />
            Browse all models...
          </button>
        </div>
      </div>
    </>
  );
}
