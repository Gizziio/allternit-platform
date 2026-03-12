"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import { AttachmentPreview, AttachmentPreviewModal, type AttachmentPreviewItem } from '@/components/chat/AttachmentPreview';
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
  Upload,
  Plug,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize, supportsTextExtraction, extractTextFromFile } from '@/lib/attachments/extract-text';
import { createModuleLogger } from '@/lib/logger';
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
import { getProviderMeta } from '@/lib/providers/provider-registry';
import { useRuntimeExecutionMode } from '@/hooks/useRuntimeExecutionMode';
import type { RuntimeExecutionMode } from '@/lib/agents/native-agent-api';
import { Compass, Hammer } from 'lucide-react';
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
import { useUnifiedStore } from '@/lib/agents/unified.store';

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
  type: 'image' | 'screenshot' | 'gif' | 'document' | 'code' | 'json' | 'spreadsheet' | 'other';
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
  /** Called when sending in agent mode - if provided, opens full agent session view instead of embedded chat */
  onAgentSend?: (text: string) => void;
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

// ============================================================================
// Provider Logo Components - Official brand logos with colors
// ============================================================================

const ProviderLogos: Record<string, React.FC<{ size?: number }>> = {
  'anthropic': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M17.304 3.541h-3.672l6.696 16.918h3.672zm-10.608 0L0 20.459h3.744l1.368-3.6h6.696l1.368 3.6h3.744L10.416 3.541H6.696zm-.264 10.656 2.088-5.472 2.088 5.472z" fill="#D97757"/>
    </svg>
  ),
  'openai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="openaiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10a37f"/>
          <stop offset="100%" stopColor="#0d8c6d"/>
        </linearGradient>
      </defs>
      <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" fill="url(#openaiGrad)"/>
    </svg>
  ),
  'gemini': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="geminiGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4285F4"/>
          <stop offset="50%" stopColor="#9B72CB"/>
          <stop offset="100%" stopColor="#EA4335"/>
        </linearGradient>
        <linearGradient id="geminiGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FBBC05"/>
          <stop offset="100%" stopColor="#34A853"/>
        </linearGradient>
      </defs>
      <path d="M12 2L14.5 9.5H22.5L16 14.5L18.5 22L12 17L5.5 22L8 14.5L1.5 9.5H9.5L12 2Z" fill="url(#geminiGrad1)"/>
      <path d="M12 6L13.5 10.5H18L14.5 13.5L16 18L12 15L8 18L9.5 13.5L6 10.5H10.5L12 6Z" fill="url(#geminiGrad2)"/>
    </svg>
  ),
  'xai': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#FFFFFF"/>
    </svg>
  ),
  'github': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" fill="#FFFFFF"/>
    </svg>
  ),
  'azure': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="azureGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0078D4"/>
          <stop offset="50%" stopColor="#005A9E"/>
          <stop offset="100%" stopColor="#003A5E"/>
        </linearGradient>
      </defs>
      <path d="M5.483 21.3H24L14.025 4.013l-3.038 8.347 5.836 6.938L5.483 21.3zM13.23 2.7L6.105 8.677 0 19.253h5.505l7.848-13.735z" fill="url(#azureGrad)"/>
    </svg>
  ),
  'aws': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="awsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF9900"/>
          <stop offset="100%" stopColor="#EC7211"/>
        </linearGradient>
      </defs>
      <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.063.056.127.056.183 0 .08-.048.16-.152.24l-.503.335a.383.383 0 0 1-.208.072c-.08 0-.16-.04-.239-.112a2.47 2.47 0 0 1-.287-.375 6.18 6.18 0 0 1-.248-.471c-.622.734-1.405 1.101-2.347 1.101-.67 0-1.205-.191-1.596-.574-.391-.384-.59-.894-.59-1.533 0-.678.239-1.23.726-1.644.487-.415 1.133-.623 1.955-.623.272 0 .551.024.846.064.296.04.6.104.918.176v-.583c0-.607-.127-1.03-.375-1.277-.255-.248-.686-.367-1.3-.367-.28 0-.568.031-.863.103-.295.072-.583.16-.863.279a2.01 2.01 0 0 1-.28.103.49.49 0 0 1-.127.023c-.112 0-.168-.08-.168-.247v-.391c0-.128.016-.224.056-.28a.597.597 0 0 1 .224-.167c.28-.144.617-.264 1.013-.36.4-.096.823-.143 1.274-.143.97 0 1.677.223 2.13.662.447.44.67 1.104.67 1.996v2.638zm-3.063.96c.263 0 .534-.048.822-.144.287-.096.543-.271.758-.51.128-.152.224-.32.272-.512.048-.191.08-.423.08-.694v-.335c-.232-.056-.479-.104-.743-.136a6.54 6.54 0 0 0-.766-.048c-.55 0-.95.104-1.22.32-.271.215-.4.518-.4.919 0 .375.095.655.295.846.191.2.47.296.842.296z" fill="url(#awsGrad)"/>
    </svg>
  ),
  'mistral': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="mistralGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF7000"/>
          <stop offset="100%" stopColor="#FFB800"/>
        </linearGradient>
      </defs>
      <path d="M2 3h3.5l3.5 8.5L12.5 3H17l-3 18h-3L11 13l-2.5 8H5.5L2 3z" fill="url(#mistralGrad)"/>
      <path d="M13 3h3l3 18h-3l-1.5-9-1.5 9h-3L13 3z" fill="url(#mistralGrad)" opacity="0.7"/>
    </svg>
  ),
  'cohere': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="cohereGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6B6B"/>
          <stop offset="100%" stopColor="#FF4757"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#cohereGrad)" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="6" stroke="url(#cohereGrad)" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="2" fill="url(#cohereGrad)"/>
    </svg>
  ),
  'deepseek': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="deepseekGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4F46E5"/>
          <stop offset="100%" stopColor="#7C3AED"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#deepseekGrad)" strokeWidth="2" fill="none"/>
      <path d="M11 7h2v6h-2zm0 8h2v2h-2z" fill="url(#deepseekGrad)"/>
    </svg>
  ),
  'perplexity': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="perplexityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4AA"/>
          <stop offset="100%" stopColor="#00A8E8"/>
        </linearGradient>
      </defs>
      <circle cx="10" cy="10" r="7" stroke="url(#perplexityGrad)" strokeWidth="2" fill="none"/>
      <path d="M15.5 15.5L21 21" stroke="url(#perplexityGrad)" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="10" cy="10" r="3" fill="url(#perplexityGrad)"/>
    </svg>
  ),
  'openrouter': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="routerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444"/>
          <stop offset="100%" stopColor="#DC2626"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="5" r="3" fill="url(#routerGrad)"/>
      <circle cx="5" cy="19" r="3" fill="url(#routerGrad)"/>
      <circle cx="19" cy="19" r="3" fill="url(#routerGrad)"/>
      <path d="M12 8L5 19M12 8L19 19" stroke="url(#routerGrad)" strokeWidth="2"/>
    </svg>
  ),
  'qwen': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="qwenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF6A00"/>
          <stop offset="100%" stopColor="#FF4500"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="9" stroke="url(#qwenGrad)" strokeWidth="2.5" fill="none"/>
      <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5c.9 0 1.74-.24 2.47-.66l2.12 2.12 1.41-1.41-2.12-2.12A4.98 4.98 0 0 0 17 12c0-2.76-2.24-5-5-5z" fill="url(#qwenGrad)"/>
    </svg>
  ),
  'kimi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="kimiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6"/>
          <stop offset="50%" stopColor="#A855F7"/>
          <stop offset="100%" stopColor="#C084FC"/>
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" stroke="url(#kimiGrad)" strokeWidth="2" fill="none"/>
      <path d="M8 7v10l4-5 4 5V7" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'glm': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="glmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E40AF"/>
          <stop offset="100%" stopColor="#3B82F6"/>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="4" stroke="url(#glmGrad)" strokeWidth="2" fill="none"/>
      <path d="M8 12h4c1.1 0 2-.9 2-2s-.9-2-2-2H8v8h2v-4z" fill="url(#glmGrad)"/>
    </svg>
  ),
  'local': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="localGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10B981"/>
          <stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="url(#localGrad)" strokeWidth="2" fill="none"/>
      <rect x="9" y="9" width="6" height="6" fill="url(#localGrad)"/>
      <path d="M2 9h2M2 15h2M20 9h2M20 15h2M9 2v2M15 2v2M9 20v2M15 20v2" stroke="url(#localGrad)" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  'a2r': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="#d4966a" strokeWidth="2" fill="none"/>
      <circle cx="12" cy="12" r="8" stroke="#d4966a" strokeWidth="2" strokeDasharray="4 2" fill="none"/>
    </svg>
  ),
  'gizzi': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M2 12l10 5 10-5" stroke="#d4966a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  'terminal': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="#9CA3AF" strokeWidth="2" fill="none"/>
      <path d="M6 8l4 4-4 4M10 16h8" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  'opencode': ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="opencodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1"/>
          <stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" stroke="url(#opencodeGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill="url(#opencodeGrad)"/>
    </svg>
  ),
};

function getProviderLogo(providerId: string): React.FC<{ size?: number }> {
  const normalized = providerId.toLowerCase();
  return ProviderLogos[normalized] || ProviderLogos['a2r'];
}

// ============================================================================
// Available Providers Configuration
// ============================================================================

const AVAILABLE_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', color: '#10a37f', description: 'GPT 5.4, 5.3, 5.2', requiresKey: true },
  { id: 'anthropic', name: 'Anthropic', color: '#d97757', description: 'Claude 4.6, 4.5 Opus', requiresKey: true },
  { id: 'gemini', name: 'Google Gemini', color: '#4285f4', description: 'Gemini 3.1, 3.0 Pro', requiresKey: true },
  { id: 'xai', name: 'xAI', color: '#000000', description: 'Grok 3, Grok 2', requiresKey: true },
  { id: 'azure', name: 'Azure OpenAI', color: '#0078d4', description: 'Microsoft Azure AI models', requiresKey: true },
  { id: 'aws', name: 'AWS Bedrock', color: '#ff9900', description: 'Amazon Bedrock models', requiresKey: true },
  { id: 'github', name: 'GitHub Copilot', color: '#6e40c9', description: 'GitHub AI models', requiresKey: false },
  { id: 'mistral', name: 'Mistral AI', color: '#ff7000', description: 'Mistral Large, Medium, Small', requiresKey: true },
  { id: 'openrouter', name: 'OpenRouter', color: '#ef4444', description: '100+ models unified API', requiresKey: true },
  { id: 'perplexity', name: 'Perplexity', color: '#20b8cd', description: 'Sonar search + LLM', requiresKey: true },
  { id: 'deepseek', name: 'DeepSeek', color: '#4f46e5', description: 'V3, R1, Coder', requiresKey: true },
  { id: 'cohere', name: 'Cohere', color: '#d4a574', description: 'Command R+, Embed', requiresKey: true },
  { id: 'qwen', name: 'Alibaba Qwen', color: '#ff6a00', description: 'Qwen 3.5 (397B MoE)', requiresKey: true },
  { id: 'kimi', name: 'Moonshot Kimi', color: '#6b4c9a', description: 'Kimi 2.5 Agent Swarm', requiresKey: true },
  { id: 'glm', name: 'Zhipu GLM', color: '#1a1a1a', description: 'GLM-5 (745B MoE)', requiresKey: true },
  { id: 'opencode', name: 'OpenCode', color: '#6366f1', description: 'Zen models via ACP', requiresKey: false },
  { id: 'gizzi', name: 'Gizzi Runtime', color: '#d4966a', description: 'Managed model runtime', requiresKey: false },
  { id: 'local', name: 'Local Models', color: '#10b981', description: 'Ollama, LM Studio, llama.cpp', requiresKey: false },
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
  onAgentSend,
  bottomDockContent,
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
  const [showBrowseAllModels, setShowBrowseAllModels] = useState(false);
  const [showProviderConnect, setShowProviderConnect] = useState(false);
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
  
  // Plan/Build mode toggle
  const {
    executionMode,
    isLoading: isLoadingExecMode,
    isSaving: isSavingExecMode,
    setMode: setExecutionMode,
  } = useRuntimeExecutionMode();
  
  // Local optimistic state for immediate UI feedback
  const [optimisticMode, setOptimisticMode] = useState<'plan' | 'build'>('build');
  
  // Sync optimistic mode with executionMode when it loads
  useEffect(() => {
    if (executionMode?.mode) {
      setOptimisticMode(executionMode.mode === 'plan' ? 'plan' : 'build');
    }
  }, [executionMode?.mode]);
  
  const uiMode = optimisticMode;
  
  const handleToggleMode = useCallback(async () => {
    if (isSavingExecMode) {
      console.log('[ChatComposer] Mode toggle blocked - currently saving');
      return;
    }
    
    const newMode: RuntimeExecutionMode = optimisticMode === 'plan' ? 'auto' : 'plan';
    const newUiMode = newMode === 'plan' ? 'plan' : 'build';
    
    console.log('[ChatComposer] Toggling mode:', optimisticMode, '->', newMode);
    
    // Optimistically update UI immediately
    setOptimisticMode(newUiMode);
    
    // Fire-and-forget API call - UI already updated
    setExecutionMode(newMode).catch((err) => {
      console.error('[ChatComposer] Failed to persist mode change:', err);
      // Don't revert - keep the UI state the user selected
    });
  }, [isSavingExecMode, optimisticMode, setExecutionMode]);
  
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
  const selectedModeId = useAgentSurfaceModeStore((state) =>
    agentModeSurface ? state.selectedModeBySurface[agentModeSurface] : null,
  );
  const setSelectedMode = useAgentSurfaceModeStore((state) => state.setSelectedMode);
  const agents = useAgentStore((state) => state.agents);
  
  // ── WIH / TaskBar state ─────────────────────────────────────────────────
  const [taskBarExpanded, setTaskBarExpanded] = useState(false);
  const wihs = useUnifiedStore((state) => state.wihs);
  const myWihs = useUnifiedStore((state) => state.myWihs);
  const fetchWihs = useUnifiedStore((state) => state.fetchWihs);
  const selectWih = useUnifiedStore((state) => state.selectWih);
  const selectedWihId = useUnifiedStore((state) => state.selectedWihId);
  
  // Fetch WIHs on mount
  useEffect(() => {
    fetchWihs();
    const interval = setInterval(() => fetchWihs(), 30000);
    return () => clearInterval(interval);
  }, [fetchWihs]);
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
    if (!agentModeSurface || !agentModeEnabled || isLoadingAgents) {
      return;
    }

    // Always fetch agents when in agent mode to ensure we have latest data
    // Don't block on existing agents - refresh to ensure accuracy
    if (agentError && lastAgentFetchPulseRef.current === agentModePulse) {
      return;
    }

    lastAgentFetchPulseRef.current = agentModePulse;
    void fetchAgents().catch((err) => {
      // eslint-disable-next-line no-console
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

  // Re-resolve OpenClaw candidates when agents change (to update registered_agent_id)
  useEffect(() => {
    if (!agentModeSurface || !agentModeEnabled || openClawCandidates.length === 0) {
      return;
    }

    // Re-resolve registration status when agents list changes
    const resolved = resolveOpenClawRegistration(openClawCandidates, agents);
    const unregistered = resolved.filter(
      (candidate) => !candidate.registered_agent_id,
    );

    // Only update if changed to avoid loops
    if (unregistered.length !== openClawCandidates.length) {
      // eslint-disable-next-line no-console
      console.log('[ChatComposer] Re-resolved OpenClaw candidates after agents change:', unregistered.length);
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

    // Skip if already loading
    if (isLoadingOpenClawCandidates) {
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

        // Auto-open dialog only if no agents are registered and none selected
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
    // Note: agents is intentionally omitted here to avoid loops - we handle re-resolution in the effect above
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
    setInput(inputValue);
  }, [inputValue]);



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
      window.sessionStorage.setItem(`a2r-openclaw-import-dismissed:${agentModeSurface}`, 'true');
    }
    closeOpenClawPrompt();
  }, [agentModeSurface, closeOpenClawPrompt]);

  const handleImportOpenClawAgent = useCallback(async (candidate: OpenClawDiscoveredAgent) => {
    if (!agentModeSurface) {
      return;
    }

    console.log('[ChatComposer] Starting OpenClaw agent import:', candidate.display_name);
    const importStart = Date.now();
    
    setImportingOpenClawAgentId(candidate.agent_id);
    setOpenClawError(null);

    try {
      const input = buildOpenClawImportInput(candidate);
      console.log('[ChatComposer] Creating agent with input:', input.name);
      const created = await createAgent(input);
      console.log(`[ChatComposer] Agent created in ${Date.now() - importStart}ms, ID:`, created.id);
      setSelectedSurfaceAgent(agentModeSurface, created.id);
      void loadCharacterLayer(created.id)
        .then(() => compileCharacterLayer(created.id))
        .catch(() => {});
      setOpenClawCandidates((current) =>
        current.filter(
          (item) => getRegisteredOpenClawAgentId(item, [created]) !== created.id,
        ),
      );
      console.log(`[ChatComposer] Import completed successfully in ${Date.now() - importStart}ms`);
      closeOpenClawPrompt();
      setShowAgentMenu(false);
    } catch (error) {
      console.error(`[ChatComposer] Import failed after ${Date.now() - importStart}ms:`, error);
      let errorMessage = 'Failed to import OpenClaw agent';
      
      if (error instanceof Error) {
        const msg = error.message;
        
        // Handle JSON parse errors (API returning HTML instead of JSON)
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
      console.log(`[ChatComposer] Import handler finished in ${Date.now() - importStart}ms`);
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
    
    // If agent mode is enabled and onAgentSend is provided, use it to open full agent session view
    if (agentModeEnabled && onAgentSend && agentModeSurface) {
      onAgentSend(input);
    } else {
      onSend(input);
    }
    
    setInput('');
    setActiveCategory(null);
    setShowAgentMenu(false);
    setSlashMenuVisible(false);
    setSlashFilter('');
    if (!externalAttachments) {
      setInternalAttachments([]);
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

  // ── Drag & Drop file handling (Global Dropzone) ──────────────────────────
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AttachmentPreviewItem | null>(null);

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    for (const { file, dataUrl, extractedText } of files) {
      const isImage = file.type.startsWith('image/');
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      // Determine file type for preview
      let fileType: AttachmentPreviewItem['type'] = 'other';
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
        type: fileType === 'other' ? 'document' : fileType, // Default to document for unknown
      });
    }
  }, [addAttachment]);

  // Register as drop target for chat
  useDropTarget('chat', handleDroppedFiles);

  // Convert attachments to preview items
  const attachmentPreviewItems: AttachmentPreviewItem[] = useMemo(() => {
    return attachments.map(att => ({
      id: att.id,
      name: att.name,
      dataUrl: att.dataUrl,
      type: att.type as AttachmentPreviewItem['type'],
    }));
  }, [attachments]);

  const handlePreview = useCallback((item: AttachmentPreviewItem) => {
    setPreviewItem(item);
    setPreviewModalOpen(true);
  }, []);

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
  
  // Get provider info for branding
  const selectedProviderMeta = useMemo(() => {
    if (!selectedModel) return getProviderMeta('a2r');
    
    // Try to find model in allModels to get provider info
    const model = allModels.find(m => m.id === selectedModel);
    if (model && 'providerId' in model) {
      const providerId = (model as any).providerId || (model as any).provider;
      if (providerId) return getProviderMeta(providerId);
    }
    
    // Extract provider from model ID format: "provider/model-name"
    const parts = selectedModel.split('/');
    if (parts.length > 1) return getProviderMeta(parts[0]);
    
    return getProviderMeta('a2r');
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
      style={{
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
      
      {/* TaskBar - Shows active WIHs */}
      <TaskBar 
        wihs={[...wihs, ...myWihs]}
        selectedWihId={selectedWihId}
        onSelectWih={selectWih}
        expanded={taskBarExpanded}
        onToggleExpand={() => setTaskBarExpanded(!taskBarExpanded)}
        agentModeSurface={agentModeSurface}
      />
      
      {/* Top Action Buttons - Hidden when Agent Mode is ON */}
      {showTopActions && !agentModeEnabled && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px',
          width: '100%',
          maxWidth: '680px',
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
                // Map top pill to agent mode and select corresponding mode
                if (agentModeSurface) {
                  const modeMapping: Record<string, AgentModeId> = {
                    'code': 'code',
                    'create': 'assets',
                    'write': 'slides',
                    'learn': 'research',
                    'a2r': 'agents',
                  };
                  const targetMode = modeMapping[cat.id];
                  if (targetMode) {
                    // Enable agent mode
                    setAgentModeEnabled(agentModeSurface, true);
                    // Select the corresponding mode
                    setSelectedMode(agentModeSurface, targetMode);
                    // Clear the active category overlay
                    setActiveCategory(null);
                    onInteractionSignal?.('proud');
                    return;
                  }
                }
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

      {/* Overlay for Options - Hidden when Agent Mode is ON */}
      {showTopActions && !agentModeEnabled && activeCategory && (
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
          maxWidth: '680px',
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
            borderRadius: '24px 24px 0 0',
            border: `1px solid ${agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder}`,
            borderBottom: 'none',
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

        {/* Attachment Preview Cards */}
        <AttachmentPreview
          attachments={attachmentPreviewItems}
          onRemove={removeAttachment}
          onPreview={handlePreview}
          variant="detailed"
        />
        
        {/* Preview Modal */}
        <AttachmentPreviewModal
          item={previewItem}
          isOpen={previewModalOpen}
          onClose={() => setPreviewModalOpen(false)}
        />

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
          padding: '6px 12px 12px 12px',
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
              <AgentModeButton
                agentModeEnabled={agentModeEnabled}
                selectedModeId={selectedModeId}
                agentModeSurface={agentModeSurface}
                onToggle={() => setAgentModeEnabled(agentModeSurface, !agentModeEnabled)}
                onInteractionSignal={onInteractionSignal}
                setTrackingAttention={setTrackingAttention}
              />
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
                  {/* Provider Logo */}
                  <div
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      background: `${selectedProviderMeta.color}15`,
                      border: `1px solid ${selectedProviderMeta.color}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={`/assets/runtime-logos/${selectedProviderMeta.icon}`}
                      alt={selectedProviderMeta.name}
                      style={{ width: 12, height: 12, objectFit: 'contain' }}
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        img.style.display = 'none';
                      }}
                    />
                  </div>
                  <span style={{ fontWeight: 500 }}>{displayModelName}</span>
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
                onBrowseAllModels={() => setShowBrowseAllModels(true)}
                onOpenProviderConnect={() => setShowProviderConnect(true)}
                isTerminalModels={terminalModels.length > 0}
                onAttentionChange={onAttentionChange}
              />
            )}

            {/* Browse All Models Overlay */}
            <BrowseAllModelsOverlay
              isOpen={showBrowseAllModels}
              onClose={() => setShowBrowseAllModels(false)}
              currentModel={selectedModelDisplayName || selectedModel}
            />

            {/* Connect Provider Overlay */}
            <ConnectProviderOverlay
              isOpen={showProviderConnect}
              onClose={() => setShowProviderConnect(false)}
            />

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
      
      {/* Bottom Dock - Status bar below input container */}
      <BottomDock
        selectedModeId={selectedModeId}
        agentModeSurface={agentModeSurface}
        agentModeEnabled={agentModeEnabled}
        agentModeTheme={agentModeTheme}
        setShowAgentMenu={setShowAgentMenu}
        showAgentMenu={showAgentMenu}
        uiMode={uiMode}
        handleToggleMode={handleToggleMode}
        isLoadingExecMode={isLoadingExecMode}
        isSavingExecMode={isSavingExecMode}
        selectedSurfaceAgent={selectedSurfaceAgent}
        customLeftContent={bottomDockContent}
      />
      
      {/* Agent Selector Dropdown - Shows when clicking "Choose Agent" */}
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
      
      {/* Mode Dock - 8 Mode Tabs */}
      {agentModeSurface && agentModeEnabled && (
        <ModeDock
          selectedMode={selectedModeId}
          onSelectMode={(modeId) => {
            if (agentModeSurface) {
              setSelectedMode(agentModeSurface, modeId as AgentModeId);
            }
          }}
          agentModeSurface={agentModeSurface}
        />
      )}

      <Dialog open={showOpenClawImportDialog} onOpenChange={(open) => {
        setShowOpenClawImportDialog(open);
        if (!open) {
          dismissOpenClawPrompt();
        }
      }}>
        <DialogContent hideCloseButton className="max-w-xl max-h-[65vh] overflow-y-auto p-0" style={{ borderRadius: 20, border: 'none', background: 'transparent', maxWidth: '580px', width: '90vw' }}>
          <div
            style={{
              borderRadius: 20,
              border: '1px solid rgba(233,185,137,0.12)',
              background:
                'linear-gradient(180deg, rgba(43,37,32,0.98) 0%, rgba(32,28,24,0.98) 100%)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '18px 20px 14px',
                background:
                  'linear-gradient(115deg, rgba(212,149,106,0.12), rgba(93,133,171,0.04) 48%, rgba(255,255,255,0.02) 100%)',
                borderBottom: `1px solid ${THEME.inputBorder}`,
              }}
            >
              <DialogHeader>
                <DialogTitle style={{ color: '#f5ede6', fontSize: 18, fontWeight: 600 }}>
                  Import OpenClaw Agent
                </DialogTitle>
                <DialogDescription style={{ color: '#b8a99b', fontSize: 13, maxWidth: 480, lineHeight: 1.5 }}>
                  Import a local OpenClaw agent to bind this surface to a real agent workspace.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 12 }}>
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
                      gap: 10,
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.02)',
                      padding: 14,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              borderRadius: 999,
                              background: 'rgba(212,149,106,0.1)',
                              border: '1px solid rgba(212,149,106,0.2)',
                              color: '#e5b896',
                              padding: '3px 8px',
                              fontSize: 9,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                            }}
                          >
                            <Bot size={10} />
                            OpenClaw
                          </span>
                          <span style={{ color: THEME.textPrimary, fontSize: 15, fontWeight: 600 }}>
                            {candidate.display_name}
                          </span>
                        </div>
                        <div style={{ marginTop: 4, color: THEME.textSecondary, fontSize: 12 }}>
                          {candidate.primary_model || 'No model'} · {candidate.session_count} session{candidate.session_count === 1 ? '' : 's'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleImportOpenClawAgent(candidate)}
                        disabled={importingOpenClawAgentId === candidate.agent_id}
                        style={{
                          flexShrink: 0,
                          borderRadius: 999,
                          border: '1px solid rgba(212,149,106,0.25)',
                          background: importingOpenClawAgentId === candidate.agent_id
                            ? 'rgba(212,149,106,0.08)'
                            : 'rgba(212,149,106,0.14)',
                          color: '#e5b896',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '8px 12px',
                          cursor: importingOpenClawAgentId === candidate.agent_id ? 'wait' : 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {importingOpenClawAgentId === candidate.agent_id ? 'Importing...' : 'Import'}
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                      <div
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.1)',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Workspace
                        </div>
                        <div style={{ marginTop: 4, color: THEME.textPrimary, fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {candidate.workspace_path || 'Not declared'}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.1)',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Auth
                        </div>
                        <div style={{ marginTop: 4, color: THEME.textPrimary, fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {candidate.auth_providers.length > 0 ? candidate.auth_providers.join(', ') : 'None'}
                        </div>
                      </div>
                      <div
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${THEME.inputBorder}`,
                          background: 'rgba(0,0,0,0.1)',
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{ color: THEME.textMuted, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Files
                        </div>
                        <div style={{ marginTop: 4, color: THEME.textPrimary, fontSize: 12, lineHeight: 1.4 }}>
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
                <div style={{ 
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  color: '#fca5a5', 
                  fontSize: 13,
                  lineHeight: 1.5,
                }}>
                  <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
                  <span>{openClawError}</span>
                </div>
              ) : null}
            </div>

            <DialogFooter style={{ padding: '0 16px 16px' }}>
              <button
                type="button"
                onClick={dismissOpenClawPrompt}
                style={{
                  border: `1px solid ${THEME.inputBorder}`,
                  borderRadius: 999,
                  background: 'transparent',
                  color: THEME.textSecondary,
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '8px 14px',
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

// ============================================================================
// TaskBar Component - Shows active WIHs as thought trace
// ============================================================================

interface TaskBarProps {
  wihs: Array<{
    wih_id: string;
    node_id: string;
    dag_id?: string;
    status: string;
    title?: string;
    description?: string;
    assignee?: string;
    blocked_by?: string[];
  }>;
  selectedWihId: string | null;
  onSelectWih: (wihId: string | null) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  agentModeSurface?: AgentModeSurface;
}

function TaskBar({ wihs, selectedWihId, onSelectWih, expanded, onToggleExpand, agentModeSurface }: TaskBarProps) {
  // Filter active WIHs (not closed/archived)
  const activeWihs = wihs.filter(w => 
    w.status !== 'closed' && w.status !== 'archived'
  );
  
  if (activeWihs.length === 0) return null;
  
  // Calculate progress
  const completedCount = activeWihs.filter(w => w.status === 'completed').length;
  const inProgressCount = activeWihs.filter(w => w.status === 'in_progress').length;
  const blockedCount = activeWihs.filter(w => w.status === 'blocked').length;
  const readyCount = activeWihs.filter(w => w.status === 'ready' || w.status === 'open').length;
  
  const progress = activeWihs.length > 0 
    ? Math.round((completedCount / activeWihs.length) * 100) 
    : 0;
  
  return (
    <div style={{
      width: '100%',
      maxWidth: '680px',
      marginBottom: '-1px',
      zIndex: 15,
    }}>
      {/* TaskBar Header - Always visible */}
      <button
        onClick={onToggleExpand}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: THEME.inputBg,
          border: `1px solid ${THEME.inputBorder}`,
          borderBottom: expanded ? `1px solid ${THEME.inputBorder}` : 'none',
          borderRadius: expanded ? '16px 16px 0 0' : '16px',
          color: THEME.textSecondary,
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} style={{ color: THEME.accent }} />
            <span style={{ fontWeight: 500 }}>
              {activeWihs.length} Active Task{activeWihs.length !== 1 ? 's' : ''}
            </span>
          </div>
          
          {/* Status badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {inProgressCount > 0 && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: 'rgba(59,130,246,0.2)',
                color: '#3b82f6',
              }}>
                {inProgressCount} running
              </span>
            )}
            {blockedCount > 0 && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: 'rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}>
                {blockedCount} blocked
              </span>
            )}
            {readyCount > 0 && (
              <span style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: 'rgba(16,185,129,0.2)',
                color: '#10b981',
              }}>
                {readyCount} ready
              </span>
            )}
          </div>
          
          {/* Mini progress bar */}
          <div style={{
            width: '60px',
            height: '4px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: THEME.accent,
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
        
        <ChevronDown 
          size={16} 
          style={{ 
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
            opacity: 0.5,
          }} 
        />
      </button>
      
      {/* Expanded Task List */}
      {expanded && (
        <div style={{
          background: THEME.inputBg,
          border: `1px solid ${THEME.inputBorder}`,
          borderTop: 'none',
          borderRadius: '0 0 16px 16px',
          padding: '12px 16px 16px',
          maxHeight: '250px',
          overflow: 'auto',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeWihs.map((wih) => (
              <WihItem 
                key={wih.wih_id}
                wih={wih}
                isSelected={selectedWihId === wih.wih_id}
                onClick={() => onSelectWih(wih.wih_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WihItem({ 
  wih, 
  isSelected, 
  onClick 
}: { 
  wih: { 
    wih_id: string; 
    node_id: string; 
    dag_id?: string; 
    status: string; 
    title?: string; 
    description?: string;
    blocked_by?: string[];
  }; 
  isSelected: boolean; 
  onClick: () => void;
}) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'blocked': return '#ef4444';
      case 'ready': return '#f59e0b';
      case 'open': return '#6b7280';
      case 'signed': return '#8b5cf6';
      default: return '#6b7280';
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Done';
      case 'in_progress': return 'Running';
      case 'blocked': return 'Blocked';
      case 'ready': return 'Ready';
      case 'open': return 'Open';
      case 'signed': return 'Signed';
      default: return status;
    }
  };
  
  const statusColor = getStatusColor(wih.status);
  
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 12px',
        background: isSelected ? `${THEME.accent}15` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? `${THEME.accent}40` : 'rgba(255,255,255,0.05)'}`,
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
        }
      }}
    >
      {/* Status dot */}
      <div style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: statusColor,
        flexShrink: 0,
        animation: wih.status === 'in_progress' ? 'pulse 2s infinite' : undefined,
      }} />
      
      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: 500,
          color: isSelected ? THEME.accent : THEME.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {wih.title || wih.node_id}
        </div>
        {wih.description && (
          <div style={{
            fontSize: '11px',
            color: THEME.textMuted,
            marginTop: '2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {wih.description}
          </div>
        )}
      </div>
      
      {/* Status label */}
      <span style={{
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '4px',
        background: `${statusColor}20`,
        color: statusColor,
        flexShrink: 0,
      }}>
        {getStatusLabel(wih.status)}
      </span>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </button>
  );
}

// ============================================================================
// Agent Mode Button - Shows "Agent | Mode" with color matching
// ============================================================================

interface AgentModeButtonProps {
  agentModeEnabled: boolean;
  selectedModeId: string | null;
  agentModeSurface: AgentModeSurface;
  onToggle: () => void;
  onInteractionSignal?: (emotion: GizziEmotion) => void;
  setTrackingAttention: (x: number, y: number, state?: GizziAttention['state']) => void;
}

const MODE_COLORS: Record<string, { accent: string; soft: string; glow: string; label: string }> = {
  research: { accent: '#3b82f6', soft: 'rgba(59,130,246,0.15)', glow: 'rgba(59,130,246,0.4)', label: 'Research' },
  data: { accent: '#10b981', soft: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.4)', label: 'Data' },
  slides: { accent: '#f59e0b', soft: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.4)', label: 'Slides' },
  code: { accent: '#8b5cf6', soft: 'rgba(139,92,246,0.15)', glow: 'rgba(139,92,246,0.4)', label: 'Code' },
  assets: { accent: '#ec4899', soft: 'rgba(236,72,153,0.15)', glow: 'rgba(236,72,153,0.4)', label: 'Assets' },
  agents: { accent: '#ef4444', soft: 'rgba(239,68,68,0.15)', glow: 'rgba(239,68,68,0.4)', label: 'Agents' },
  flow: { accent: '#06b6d4', soft: 'rgba(6,182,212,0.15)', glow: 'rgba(6,182,212,0.4)', label: 'Flow' },
  web: { accent: '#6366f1', soft: 'rgba(99,102,241,0.15)', glow: 'rgba(99,102,241,0.4)', label: 'Web' },
};

function AgentModeButton({
  agentModeEnabled,
  selectedModeId,
  agentModeSurface,
  onToggle,
  onInteractionSignal,
  setTrackingAttention,
}: AgentModeButtonProps) {
  // Only use mode colors when agent mode is ENABLED
  const modeColors = agentModeEnabled && selectedModeId ? MODE_COLORS[selectedModeId] : null;
  const surfaceTheme = getAgentModeSurfaceTheme(agentModeSurface);
  
  const accentColor = modeColors?.accent || (agentModeEnabled ? surfaceTheme.accent : THEME.textSecondary);
  const softColor = modeColors?.soft || (agentModeEnabled ? surfaceTheme.soft : 'transparent');
  const glowColor = modeColors?.glow || (agentModeEnabled ? surfaceTheme.glow : THEME.inputBorder);
  
  const buttonText = agentModeEnabled
    ? selectedModeId 
      ? `Agent | ${modeColors?.label || 'Mode'}`
      : 'Agent On'
    : 'Agent Off';
  
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderRadius: 999,
        border: `1px solid ${glowColor}`,
        background: softColor,
        color: accentColor,
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: agentModeEnabled ? `0 0 12px ${glowColor}` : 'none',
      }}
      onMouseEnter={(e) => {
        onInteractionSignal?.('focused');
        setTrackingAttention(0.16, 0.56, 'locked-on');
        if (agentModeEnabled) {
          e.currentTarget.style.boxShadow = `0 0 20px ${glowColor}`;
        }
      }}
      onMouseLeave={(e) => {
        setTrackingAttention(0, 0.44);
        if (agentModeEnabled) {
          e.currentTarget.style.boxShadow = `0 0 12px ${glowColor}`;
        }
      }}
    >
      <Bot size={14} />
      {buttonText}
    </button>
  );
}

// ============================================================================
// Mode Dock - 8 Mode Tabs (Research, Data, Slides, Code, Assets, Agents, Flow, Web)
// ============================================================================

interface ModeDockProps {
  selectedMode: string | null;
  onSelectMode: (modeId: string) => void;
  agentModeSurface: AgentModeSurface;
}

const MODES = [
  { id: 'research', label: 'Research', color: '#3b82f6', icon: '🔬' },
  { id: 'data', label: 'Data', color: '#10b981', icon: '📊' },
  { id: 'slides', label: 'Slides', color: '#f59e0b', icon: '📑' },
  { id: 'code', label: 'Code', color: '#8b5cf6', icon: '💻' },
  { id: 'assets', label: 'Assets', color: '#ec4899', icon: '🎨' },
  { id: 'agents', label: 'Agents', color: '#ef4444', icon: '🤖' },
  { id: 'flow', label: 'Flow', color: '#06b6d4', icon: '🌊' },
  { id: 'web', label: 'Web', color: '#6366f1', icon: '🌐' },
] as const;

// ============================================================================
// Bottom Dock - Status bar below input container
// ============================================================================

interface BottomDockProps {
  selectedModel?: string;
  selectedModelDisplayName?: string;
  selectedProviderMeta: { name: string; icon: string; color: string };
  terminalModels: Array<{ id: string; name: string; provider: string }>;
  terminalModelsLoading: boolean;
  agentModeEnabled: boolean;
  selectedModeId: string | null;
  agentModeSurface?: AgentModeSurface;
  onOpenModelPicker?: () => void;
  setShowBrowseAllModels: (show: boolean) => void;
  setShowProviderConnect: (show: boolean) => void;
}

interface BottomDockProps {
  selectedModeId: string | null;
  agentModeSurface?: AgentModeSurface;
  agentModeEnabled: boolean;
  agentModeTheme: { glow: string; soft: string; accent: string };
  setShowAgentMenu: (show: boolean) => void;
  showAgentMenu: boolean;
  uiMode: string;
  handleToggleMode: () => void;
  isLoadingExecMode: boolean;
  isSavingExecMode: boolean;
  selectedSurfaceAgent: { name: string } | null;
  customLeftContent?: React.ReactNode;
}

function BottomDock({
  selectedModeId,
  agentModeEnabled,
  agentModeTheme,
  setShowAgentMenu,
  showAgentMenu,
  uiMode,
  handleToggleMode,
  isLoadingExecMode,
  isSavingExecMode,
  selectedSurfaceAgent,
  customLeftContent,
}: BottomDockProps & { customLeftContent?: React.ReactNode }) {
  // Get mode color if mode is selected
  const modeColor = selectedModeId ? MODE_TABS.find(m => m.id === selectedModeId)?.color : null;
  
  // Use agent mode theme glow when enabled, otherwise use default border
  const borderColor = agentModeEnabled ? agentModeTheme.glow : THEME.inputBorder;
  
  return (
    <div style={{
      width: '100%',
      maxWidth: '680px',
      marginTop: '-1px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 16px 12px',
      background: THEME.inputBg,
      border: `1px solid ${borderColor}`,
      borderTop: 'none',
      borderRadius: '0 0 24px 24px',
      zIndex: 9,
      position: 'relative',
    }}>
      {/* Left: Custom content (utility pills) or Choose Agent */}
      {customLeftContent ? (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {customLeftContent}
        </div>
      ) : (
        <button
          onClick={() => setShowAgentMenu(!showAgentMenu)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 10px',
            borderRadius: '8px',
            background: 'transparent',
            border: 'none',
            color: agentModeEnabled && modeColor ? modeColor : THEME.textSecondary,
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Bot size={16} />
          <span>{selectedSurfaceAgent ? selectedSurfaceAgent.name : 'Choose Agent'}</span>
          <ChevronDown size={14} style={{ opacity: 0.5, transform: showAgentMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      )}
      
      {/* Right: Build/Plan Toggle - Minimal design with text label */}
      <button
        type="button"
        onClick={handleToggleMode}
        disabled={isLoadingExecMode || isSavingExecMode}
        title={uiMode === 'plan' ? 'Switch to Build mode' : 'Switch to Plan mode'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${uiMode === 'plan' ? 'rgba(212,149,106,0.4)' : THEME.inputBorder}`,
          color: uiMode === 'plan' ? THEME.accent : THEME.textSecondary,
          fontSize: '12px',
          fontWeight: 500,
          cursor: isLoadingExecMode || isSavingExecMode ? 'wait' : 'pointer',
          transition: 'all 0.2s',
          opacity: isLoadingExecMode || isSavingExecMode ? 0.7 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isLoadingExecMode && !isSavingExecMode) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            e.currentTarget.style.borderColor = 'rgba(212,149,106,0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isLoadingExecMode && !isSavingExecMode) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = uiMode === 'plan' ? 'rgba(212,149,106,0.4)' : THEME.inputBorder;
          }
        }}
      >
        {uiMode === 'plan' ? <Compass size={14} /> : <Hammer size={14} />}
        <span>{uiMode === 'plan' ? 'Plan' : 'Build'}</span>
      </button>
    </div>
  );
}

// Template data for each mode
const MODE_TEMPLATES: Record<string, Array<{ title: string; description: string; prompt: string }>> = {
  research: [
    { title: 'Market Analysis', description: 'Analyze market trends and opportunities', prompt: 'Conduct a comprehensive market analysis for [industry/product]. Include market size, growth trends, key players, and emerging opportunities.' },
    { title: 'Competitor Report', description: 'Deep dive into competitor strategies', prompt: 'Create a detailed competitor analysis report for [company/product]. Include their strengths, weaknesses, market position, and strategic initiatives.' },
    { title: 'Industry Overview', description: 'Broad industry landscape analysis', prompt: 'Provide an overview of the [industry] industry, including current state, key trends, challenges, and future outlook.' },
  ],
  data: [
    { title: 'Data Analysis', description: 'Analyze datasets for insights', prompt: 'Analyze this dataset and provide key insights, trends, and recommendations: [describe your data]' },
    { title: 'Visualization', description: 'Create charts and dashboards', prompt: 'Help me visualize this data effectively. Suggest the best chart types and create a dashboard mockup for: [describe data]' },
    { title: 'Predictive Model', description: 'Build forecasting models', prompt: 'Build a predictive model for [outcome] based on [variables]. Explain the approach and expected accuracy.' },
  ],
  slides: [
    { title: 'Pitch Deck', description: 'Investor presentation', prompt: 'Create a pitch deck outline for [company/idea]. Include key slides, messaging, and visual recommendations.' },
    { title: 'Quarterly Review', description: 'Business performance slides', prompt: 'Design a quarterly business review presentation covering: [metrics/achievements/challenges]' },
    { title: 'Product Launch', description: 'Go-to-market deck', prompt: 'Create a product launch presentation for [product]. Include positioning, features, target audience, and go-to-market strategy.' },
  ],
  code: [
    { title: 'Feature Implementation', description: 'Build new functionality', prompt: 'Help me implement [feature] in [language/framework]. Include code structure, key components, and best practices.' },
    { title: 'Code Review', description: 'Review and improve code', prompt: 'Review this code for [language] and suggest improvements: [paste code]' },
    { title: 'Architecture Design', description: 'System architecture planning', prompt: 'Design the architecture for [system/app]. Include components, data flow, and technology recommendations.' },
  ],
  assets: [
    { title: 'Brand Guidelines', description: 'Design system and style guide', prompt: 'Create brand guidelines for [company/product]. Include color palette, typography, logo usage, and visual style.' },
    { title: 'Icon Set', description: 'Custom icon design', prompt: 'Design a custom icon set for [purpose]. Include style specifications and usage guidelines.' },
    { title: 'Marketing Assets', description: 'Social media and web graphics', prompt: 'Create marketing asset concepts for [campaign/product]. Include social media posts, banners, and email headers.' },
  ],
  agents: [
    { title: 'Agent Configuration', description: 'Set up custom agents', prompt: 'Help me configure an agent for [purpose]. Include system prompt, capabilities, and tool integration.' },
    { title: 'Multi-Agent Flow', description: 'Orchestrate agent teams', prompt: 'Design a multi-agent workflow for [task]. Define agent roles, handoffs, and coordination patterns.' },
    { title: 'Agent Testing', description: 'Validate agent behavior', prompt: 'Create test cases and evaluation criteria for [agent/system]. Include edge cases and success metrics.' },
  ],
  flow: [
    { title: 'Workflow Design', description: 'Process automation', prompt: 'Design a workflow for [process]. Include steps, decision points, and automation opportunities.' },
    { title: 'Integration Flow', description: 'Connect systems', prompt: 'Create an integration flow between [system A] and [system B]. Include data mapping and error handling.' },
    { title: 'Approval Process', description: 'Review and sign-off flows', prompt: 'Design an approval workflow for [process]. Include roles, escalation rules, and notification logic.' },
  ],
  web: [
    { title: 'Landing Page', description: 'High-conversion web page', prompt: 'Design a landing page for [product/service]. Include structure, copy suggestions, and conversion optimization tips.' },
    { title: 'Web App UI', description: 'Application interface design', prompt: 'Create a UI design for [web app]. Include wireframes, component hierarchy, and responsive considerations.' },
    { title: 'E-commerce Site', description: 'Online store design', prompt: 'Design an e-commerce experience for [product/category]. Include product pages, checkout flow, and trust signals.' },
  ],
};

// Mode tabs configuration - pill style like the reference
const MODE_TABS = [
  { id: 'research', label: 'Research', color: '#3b82f6' },
  { id: 'data', label: 'Data', color: '#10b981' },
  { id: 'slides', label: 'Slides', color: '#f59e0b' },
  { id: 'code', label: 'Code', color: '#8b5cf6' },
  { id: 'assets', label: 'Assets', color: '#ec4899' },
  { id: 'agents', label: 'Agents', color: '#ef4444' },
  { id: 'flow', label: 'Flow', color: '#06b6d4' },
  { id: 'web', label: 'Web', color: '#6366f1' },
] as const;

function ModeDock({ selectedMode, onSelectMode, agentModeSurface }: ModeDockProps) {
  const modeData = selectedMode ? MODE_TEMPLATES[selectedMode] : null;
  const modeColors = selectedMode ? MODE_TABS.find(m => m.id === selectedMode) : null;
  
  return (
    <div style={{
      width: '100%',
      maxWidth: '680px',
      marginTop: '8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
      zIndex: 9,
    }}>
      {/* Mode Tabs - Individual pill tabs (not connected) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        gap: '8px',
        justifyContent: 'center',
      }}>
        {MODE_TABS.map((mode) => {
          const isSelected = selectedMode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 16px',
                borderRadius: '20px',
                background: isSelected ? `${mode.color}20` : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isSelected ? mode.color : 'rgba(255,255,255,0.1)'}`,
                color: isSelected ? mode.color : THEME.textSecondary,
                fontSize: '12px',
                fontWeight: isSelected ? 600 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
                boxShadow: isSelected ? `0 0 0 1px ${mode.color}40` : 'none',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                }
              }}
            >
              <span>{mode.label}</span>
            </button>
          );
        })}
      </div>
      
      {/* Template Cards - Show when a mode is selected */}
      {selectedMode && modeData && (
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          marginTop: '8px',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              color: THEME.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Featured {modeColors?.label} Cases
            </span>
            <button style={{
              fontSize: '11px',
              color: modeColors?.color || THEME.accent,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}>
              More cases →
            </button>
          </div>
          
          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
          }}>
            {modeData.map((template, index) => (
              <TemplateCard
                key={index}
                title={template.title}
                description={template.description}
                color={modeColors?.color || THEME.accent}
                gradientIndex={index}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Template Card Component
function TemplateCard({ 
  title, 
  description, 
  color,
  gradientIndex 
}: { 
  title: string; 
  description: string; 
  color: string;
  gradientIndex: number;
}) {
  // Generate gradient based on color and index
  const gradients = [
    `linear-gradient(135deg, ${color}40 0%, ${color}10 100%)`,
    `linear-gradient(135deg, ${color}30 0%, ${color}05 100%)`,
    `linear-gradient(135deg, ${color}50 0%, ${color}20 100%)`,
  ];
  
  return (
    <button
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px',
        background: THEME.inputBg,
        border: `1px solid ${THEME.inputBorder}`,
        borderRadius: '12px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        overflow: 'hidden',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = THEME.inputBorder;
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Gradient Preview */}
      <div style={{
        height: '60px',
        borderRadius: '8px',
        background: gradients[gradientIndex % gradients.length],
        marginBottom: '10px',
        position: 'relative',
      }}>
        {/* Decorative dots */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          display: 'flex',
          gap: '4px',
        }}>
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: `${color}60` }} />
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: `${color}40` }} />
          <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: `${color}20` }} />
        </div>
      </div>
      
      {/* Content */}
      <div style={{
        fontSize: '13px',
        fontWeight: 600,
        color: THEME.textPrimary,
        marginBottom: '4px',
      }}>
        {title}
      </div>
      <div style={{
        fontSize: '11px',
        color: THEME.textMuted,
        lineHeight: 1.4,
      }}>
        {description}
      </div>
    </button>
  );
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
  onBrowseAllModels?: () => void;
  onOpenProviderConnect?: () => void;
  isTerminalModels?: boolean;
  onAttentionChange?: (attention: GizziAttention | null) => void;
}

function ModelSelectorDropdown({
  models,
  selectedModel,
  onSelect,
  onClose,
  onOpenModelPicker,
  onBrowseAllModels,
  onOpenProviderConnect,
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
            onClick={() => { onClose(); onBrowseAllModels?.(); }}
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
          <button
            onClick={() => { onClose(); onOpenProviderConnect?.(); }}
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
              marginTop: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME.hoverBg;
              onAttentionChange?.({ state: 'locked-on', target: { x: 0.42, y: 0.58 } });
            }}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <Plug size={14} />
            Connect provider
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================================
// Connect Provider Overlay
// ============================================================================

interface ConnectProviderOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

function ConnectProviderOverlay({ isOpen, onClose }: ConnectProviderOverlayProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectedProviders, setConnectedProviders] = useState<string[]>(['gizzi']);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!selectedProvider) return;
    setIsConnecting(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setConnectedProviders(prev => [...prev, selectedProvider]);
    setIsConnecting(false);
    setSelectedProvider(null);
    setApiKey('');
  };

  const handleDisconnect = (providerId: string) => {
    setConnectedProviders(prev => prev.filter(id => id !== providerId));
  };

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          background: THEME.inputBg,
          borderRadius: '16px',
          border: `1px solid ${THEME.inputBorder}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${THEME.inputBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: '0 0 4px 0',
            }}>
              Connect AI Provider
            </h2>
            <p style={{
              fontSize: '13px',
              color: THEME.textMuted,
              margin: 0,
            }}>
              Add your API keys to unlock more AI models
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer',
            borderRadius: '8px', color: THEME.textMuted,
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {selectedProvider ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <button onClick={() => setSelectedProvider(null)} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'transparent', border: 'none', color: THEME.textMuted,
                fontSize: '13px', cursor: 'pointer', padding: 0, alignSelf: 'flex-start',
              }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                Back to providers
              </button>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px',
                border: `1px solid ${THEME.inputBorder}`,
              }}>
                <div style={{ 
                  width: '56px', height: '56px', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
                }}>
                  {selectedProviderData && React.createElement(getProviderLogo(selectedProviderData.id), { size: 36 })}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: THEME.textPrimary, margin: '0 0 4px 0' }}>
                    {selectedProviderData?.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>
                    {selectedProviderData?.modelCount} models available
                  </p>
                </div>
              </div>

              {selectedProviderData?.requiresKey ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: THEME.textSecondary }}>API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={`Enter your ${selectedProviderData.name} API key`}
                    style={{
                      padding: '12px 16px', background: 'rgba(0,0,0,0.3)',
                      borderRadius: '10px', border: `1px solid ${THEME.inputBorder}`,
                      color: THEME.textPrimary, fontSize: '14px', outline: 'none',
                    }}
                  />
                </div>
              ) : (
                <div style={{
                  padding: '16px', background: 'rgba(16,185,129,0.1)',
                  borderRadius: '10px', border: '1px solid rgba(16,185,129,0.3)',
                }}>
                  <p style={{ fontSize: '13px', color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} />
                    This provider connects automatically. Click connect to enable.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {connectedProviders.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{
                    fontSize: '11px', fontWeight: 700, color: THEME.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0',
                  }}>
                    Connected
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {connectedProviders.map(providerId => {
                      const provider = AVAILABLE_PROVIDERS.find(p => p.id === providerId) || { id: providerId, name: providerId };
                      const ProviderLogo = getProviderLogo(providerId);
                      return (
                        <div key={providerId} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '12px 16px', background: 'rgba(16,185,129,0.08)',
                          borderRadius: '10px', border: '1px solid rgba(16,185,129,0.2)',
                        }}>
                          <div style={{ 
                            width: '36px', height: '36px', display: 'flex', 
                            alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(16,185,129,0.12)', borderRadius: '8px',
                          }}>
                            <ProviderLogo size={24} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>{provider.name}</div>
                            <div style={{ fontSize: '12px', color: '#10b981' }}>Connected</div>
                          </div>
                          <button onClick={() => handleDisconnect(providerId)} style={{
                            padding: '6px 12px', borderRadius: '6px', background: 'transparent',
                            border: `1px solid ${THEME.inputBorder}`, color: THEME.textMuted, fontSize: '12px', cursor: 'pointer',
                          }}>Disconnect</button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <h4 style={{
                fontSize: '11px', fontWeight: 700, color: THEME.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px 0',
              }}>
                Available Providers
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                {AVAILABLE_PROVIDERS.filter(p => !connectedProviders.includes(p.id)).map(provider => {
                  const ProviderLogo = getProviderLogo(provider.id);
                  return (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider.id)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        gap: '10px', padding: '16px', background: 'rgba(0,0,0,0.2)',
                        borderRadius: '12px', border: `1px solid ${THEME.inputBorder}`,
                        cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = THEME.hoverBg;
                        e.currentTarget.style.borderColor = provider.color || THEME.accent;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                        e.currentTarget.style.borderColor = THEME.inputBorder;
                      }}
                    >
                      <div style={{ 
                        width: '40px', height: '40px', display: 'flex', 
                        alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(255,255,255,0.05)', borderRadius: '10px',
                      }}>
                        <ProviderLogo size={28} />
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: THEME.textPrimary, marginBottom: '2px' }}>
                          {provider.name}
                        </div>
                        <div style={{ fontSize: '11px', color: THEME.textMuted, lineHeight: 1.4 }}>
                          {provider.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {selectedProvider && (
          <div style={{
            padding: '16px 24px', borderTop: `1px solid ${THEME.inputBorder}`,
            display: 'flex', justifyContent: 'flex-end', gap: '12px',
          }}>
            <button onClick={() => setSelectedProvider(null)} style={{
              padding: '10px 20px', borderRadius: '8px', background: 'transparent',
              border: `1px solid ${THEME.inputBorder}`, color: THEME.textSecondary,
              fontSize: '14px', cursor: 'pointer',
            }}>Cancel</button>
            <button
              onClick={handleConnect}
              disabled={selectedProviderData?.requiresKey && !apiKey || isConnecting}
              style={{
                padding: '10px 20px', borderRadius: '8px', background: THEME.accent,
                border: 'none', color: THEME.textPrimary, fontSize: '14px', fontWeight: 500,
                cursor: selectedProviderData?.requiresKey && !apiKey ? 'not-allowed' : 'pointer',
                opacity: selectedProviderData?.requiresKey && !apiKey ? 0.5 : 1,
                display: 'flex', alignItems: 'center', gap: '8px',
              }}
            >
              {isConnecting ? 'Connecting...' : <><Check size={16} /> Connect</>}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================================
// Browse All Models Overlay - Same layout as ConnectProviderOverlay
// ============================================================================

interface BrowseAllModelsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectModel?: (providerId: string, modelId: string) => void;
  currentModel?: string;
}

function BrowseAllModelsOverlay({ isOpen, onClose, onSelectModel, currentModel }: BrowseAllModelsOverlayProps) {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [models, setModels] = useState<Array<{id: string; name: string; providerId: string; providerName: string}>>([]);
  const [providers, setProviders] = useState<Array<{id: string; name: string; modelCount: number}>>([]);
  const [providerModels, setProviderModels] = useState<Array<{id: string; name: string}>>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState(false);

  // Fetch all providers and models from Terminal Server when overlay opens
  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchModels() {
      setLoading(true);
      try {
        const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        
        const allModels: Array<{id: string; name: string; providerId: string; providerName: string}> = [];
        const allProviders: Array<{id: string; name: string; modelCount: number}> = [];
        
        if (data.all && Array.isArray(data.all)) {
          data.all.forEach((provider: any) => {
            const modelCount = provider.models ? Object.keys(provider.models).length : 0;
            allProviders.push({
              id: provider.id,
              name: provider.name || provider.id,
              modelCount,
            });
            
            if (provider.models && typeof provider.models === 'object') {
              Object.entries(provider.models).forEach(([modelId, modelData]: [string, any]) => {
                allModels.push({
                  id: `${provider.id}/${modelId}`,
                  name: modelData.name || modelId,
                  providerId: provider.id,
                  providerName: provider.name || provider.id,
                });
              });
            }
          });
        }
        
        // Sort providers by model count (descending)
        allProviders.sort((a, b) => b.modelCount - a.modelCount);
        
        setProviders(allProviders);
        setModels(allModels);
      } catch (err) {
        console.error('Failed to fetch models:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchModels();
  }, [isOpen]);

  // Fetch models for selected provider
  useEffect(() => {
    if (!selectedProvider) return;
    
    async function fetchProviderModels() {
      setLoadingProvider(true);
      try {
        const response = await fetch(`${TERMINAL_SERVER_URL}/provider`);
        if (!response.ok) throw new Error('Failed to fetch');
        const data = await response.json();
        
        const provider = data.all?.find((p: any) => p.id === selectedProvider);
        if (provider?.models) {
          const modelsList = Object.entries(provider.models).map(([modelId, modelData]: [string, any]) => ({
            id: modelId,
            name: modelData.name || modelId,
          }));
          setProviderModels(modelsList);
        } else {
          setProviderModels([]);
        }
      } catch (err) {
        console.error('Failed to fetch provider models:', err);
        setProviderModels([]);
      } finally {
        setLoadingProvider(false);
      }
    }
    
    fetchProviderModels();
  }, [selectedProvider]);

  if (!isOpen) return null;

  const handleProviderClick = (providerId: string) => {
    setSelectedProvider(providerId);
  };

  const handleBack = () => {
    setSelectedProvider(null);
    setProviderModels([]);
  };

  const handleModelSelect = (modelId: string) => {
    if (selectedProvider && onSelectModel) {
      onSelectModel(selectedProvider, modelId);
    }
    onClose();
  };

  const selectedProviderData = AVAILABLE_PROVIDERS.find(p => p.id === selectedProvider);
  
  const getModelsForProvider = (providerId: string) => {
    return models.filter(m => m.providerId === providerId);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          maxHeight: '80vh',
          background: THEME.inputBg,
          borderRadius: '16px',
          border: `1px solid ${THEME.inputBorder}`,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${THEME.inputBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: THEME.textPrimary,
              margin: '0 0 4px 0',
            }}>
              {selectedProvider ? 'Select Model' : 'Browse All Models'}
            </h2>
            <p style={{
              fontSize: '13px',
              color: THEME.textMuted,
              margin: 0,
            }}>
              {selectedProvider 
                ? `Choose a model from ${selectedProviderData?.name}`
                : 'Select an AI provider to browse available models'
              }
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', padding: '8px', cursor: 'pointer',
            borderRadius: '8px', color: THEME.textMuted,
          }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {selectedProvider ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <button onClick={handleBack} style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'transparent', border: 'none', color: THEME.textMuted,
                fontSize: '13px', cursor: 'pointer', padding: 0, alignSelf: 'flex-start',
              }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                Back to providers
              </button>

              <div style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px',
                border: `1px solid ${THEME.inputBorder}`,
              }}>
                <div style={{ 
                  width: '56px', height: '56px', display: 'flex', 
                  alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(255,255,255,0.05)', borderRadius: '12px',
                }}>
                  {selectedProviderData && React.createElement(getProviderLogo(selectedProviderData.id), { size: 36 })}
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: THEME.textPrimary, margin: '0 0 4px 0' }}>
                    {selectedProviderData?.name}
                  </h3>
                  <p style={{ fontSize: '13px', color: THEME.textMuted, margin: 0 }}>
                    {selectedProviderData?.description}
                  </p>
                </div>
              </div>

              {loadingProvider ? (
                <div style={{ padding: '40px', textAlign: 'center', color: THEME.textMuted }}>
                  <Loader2 size={32} style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
                  <p>Loading models...</p>
                </div>
              ) : providerModels.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: THEME.textMuted }}>
                  <AlertCircle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <p>No models available</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {providerModels.map((model) => {
                    const fullModelId = `${selectedProvider}/${model.id}`;
                    const isCurrent = currentModel === fullModelId || currentModel === model.name;
                    return (
                      <button
                        key={model.id}
                        onClick={() => handleModelSelect(model.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px',
                          background: isCurrent ? 'rgba(212,150,106,0.08)' : 'rgba(0,0,0,0.2)',
                          borderRadius: '10px',
                          border: `1px solid ${isCurrent ? 'rgba(212,150,106,0.3)' : THEME.inputBorder}`,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = THEME.hoverBg;
                          e.currentTarget.style.borderColor = THEME.accent;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isCurrent ? 'rgba(212,150,106,0.08)' : 'rgba(0,0,0,0.2)';
                          e.currentTarget.style.borderColor = isCurrent ? 'rgba(212,150,106,0.3)' : THEME.inputBorder;
                        }}
                      >
                        <div style={{ 
                          width: '40px', height: '40px', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,255,255,0.05)', borderRadius: '10px', flexShrink: 0,
                        }}>
                          <Sparkles size={20} style={{ color: isCurrent ? '#d4966a' : THEME.textMuted }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '15px', fontWeight: 600,
                            color: isCurrent ? '#d4966a' : THEME.textPrimary,
                            marginBottom: '2px',
                          }}>
                            {model.name}
                            {isCurrent && (
                              <span style={{
                                fontSize: '10px', fontWeight: 700, color: '#d4966a',
                                background: 'rgba(212,150,106,0.2)', padding: '2px 6px',
                                borderRadius: '4px', textTransform: 'uppercase', marginLeft: '8px',
                              }}>Active</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: THEME.textMuted, fontFamily: 'monospace' }}>
                            {model.id}
                          </div>
                        </div>
                        {isCurrent && <Check size={18} style={{ color: '#d4966a', flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {currentModel && (
                <div style={{ marginBottom: '8px' }}>
                  <h4 style={{
                    fontSize: '11px', fontWeight: 700, color: THEME.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 10px 0',
                  }}>
                    Current Model
                  </h4>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', background: 'rgba(212,150,106,0.1)',
                    borderRadius: '10px', border: '1px solid rgba(212,150,106,0.2)',
                  }}>
                    <div style={{ 
                      width: '40px', height: '40px', display: 'flex', 
                      alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(212,150,106,0.15)', borderRadius: '10px',
                    }}>
                      <Check size={20} style={{ color: '#d4966a' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#d4966a' }}>
                        {currentModel}
                      </div>
                      <div style={{ fontSize: '12px', color: THEME.textMuted }}>
                        Currently selected
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <h4 style={{
                fontSize: '11px', fontWeight: 700, color: THEME.textMuted,
                textTransform: 'uppercase', letterSpacing: '0.05em', margin: '8px 0 10px 0',
              }}>
                All Providers {loading && <span style={{ fontWeight: 400, textTransform: 'none' }}>(loading...)</span>}
              </h4>
              
              {loading && (
                <div style={{ padding: '40px', textAlign: 'center', color: THEME.textMuted }}>
                  <Loader2 size={32} style={{ marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
                  <p>Loading providers from Terminal Server...</p>
                </div>
              )}
              
              {!loading && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {providers.map(provider => {
                    const ProviderLogo = getProviderLogo(provider.id);
                    const isCurrent = currentModel?.toLowerCase().includes(provider.id.toLowerCase());
                    return (
                      <button
                        key={provider.id}
                        onClick={() => handleProviderClick(provider.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '14px 16px',
                          background: isCurrent ? 'rgba(212,150,106,0.08)' : 'rgba(0,0,0,0.2)',
                          borderRadius: '10px',
                          border: `1px solid ${isCurrent ? 'rgba(212,150,106,0.3)' : THEME.inputBorder}`,
                          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = THEME.hoverBg;
                          e.currentTarget.style.borderColor = THEME.accent;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isCurrent ? 'rgba(212,150,106,0.08)' : 'rgba(0,0,0,0.2)';
                          e.currentTarget.style.borderColor = isCurrent ? 'rgba(212,150,106,0.3)' : THEME.inputBorder;
                        }}
                      >
                        <div style={{ 
                          width: '44px', height: '44px', display: 'flex', 
                          alignItems: 'center', justifyContent: 'center',
                          background: 'rgba(255,255,255,0.05)', borderRadius: '10px', flexShrink: 0,
                        }}>
                          <ProviderLogo size={28} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: '15px', fontWeight: 600, color: THEME.textPrimary,
                            marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '8px',
                          }}>
                            {provider.name}
                            {provider.modelCount > 0 && (
                              <span style={{
                                fontSize: '11px', fontWeight: 500, color: THEME.textMuted,
                                background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '10px',
                              }}>
                                {provider.modelCount} models
                              </span>
                            )}
                            {isCurrent && (
                              <span style={{
                                fontSize: '10px', fontWeight: 700, color: '#d4966a',
                                background: 'rgba(212,150,106,0.2)', padding: '2px 6px',
                                borderRadius: '4px', textTransform: 'uppercase',
                              }}>Active</span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: THEME.textMuted, lineHeight: 1.4 }}>
                            {provider.id}
                          </div>
                        </div>
                        <ChevronRight size={18} style={{ color: THEME.textMuted, opacity: 0.5, flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedProvider && (
          <div style={{
            padding: '16px 24px', borderTop: `1px solid ${THEME.inputBorder}`,
            display: 'flex', justifyContent: 'flex-end', gap: '12px',
          }}>
            <button onClick={handleBack} style={{
              padding: '10px 20px', borderRadius: '8px', background: 'transparent',
              border: `1px solid ${THEME.inputBorder}`, color: THEME.textSecondary,
              fontSize: '14px', cursor: 'pointer',
            }}>Back</button>
          </div>
        )}
      </div>
    </div>
  );
}
