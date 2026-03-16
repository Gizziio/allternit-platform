"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStore, useUnreadMailCount, usePendingReviewCount } from "@/lib/agents/agent.store";
import { AGENT_CAPABILITIES, AGENT_MODELS, AGENT_TYPES } from "@/lib/agents/agent.types";
import { agentWorkspaceService } from "@/lib/agents/agent-workspace.service";
import type {
  Agent,
  CreateAgentInput,
  TaskStatus,
  AgentType,
  VoiceConfig,
  VoicePreset,
  AgentRun,
  AgentTask,
  Checkpoint as AgentCheckpoint,
  Commit as AgentCommit,
  AgentMailMessage,
  MascotTemplate,
} from "@/lib/agents/agent.types";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { railsApi } from "@/lib/agents/rails.service";
import * as voiceService from "@/lib/agents/voice.service";
import { api, GATEWAY_URL } from "@/integration/api-client";
import { useMonitorData, useMonitorShare, buildMonitorLink } from "./mail-monitor/monitor.helpers";
import { MailMonitorPanel } from "./mail-monitor/MailMonitorPanel";
import { CharacterLayerPanel } from "./agent-character/CharacterLayerPanel";
import { CapsuleFrame } from "@/components/CapsuleFrame";
import { AgentAvatar } from "@/components/Avatar";
import type { AvatarConfig } from "@/lib/agents/character.types";
import { createDefaultAvatarConfig } from "@/lib/agents/character.types";
import { AvatarCreatorStep } from "./agent-creation/AvatarCreatorStep";
import { useAvatarCreatorStore } from "../stores/avatar-creator.store";
import { AgentDashboard } from "@/components/AgentDashboard";
import { formatRelativeTime } from "@/lib/time";
import {
  WorkspaceLayerConfigurator,
  DEFAULT_LAYER_CONFIG,
  type WorkspaceLayerConfig,
} from "@/components/agent-workspace";

import {
  useWizardPersistence,
  DraftSavedIndicator,
  BrowserCompatibilityWarning as BrowserCompatibilityWarningComponent,
  FileSizeWarning as FileSizeWarningComponent,
  PluginConflictWarning,
  DuplicateNameWarning,
  type WizardPersistedConfig,
} from '@/components/agents/AgentCreationWizard.persistence';

import {
  validateAgentName,
  validateWorkspacePath,
  detectPluginConflicts,
  validateFileSize,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  type BrowserCompatibility,
} from '@/components/agents/AgentCreationWizard.validations';

// UPGRADE: Functional Imports
import { A2RSystemPromptEditor } from '@/components/agents/A2RSystemPromptEditor';

// UI Components
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { A2RLogo, A2ROrb, BrandBadge } from "@/components/A2RLogo";

// AI Elements
import { Task } from "@/components/ai-elements/task";
import { Checkpoint } from "@/components/ai-elements/checkpoint";
import { Commit } from "@/components/ai-elements/commit";
import { Queue } from "@/components/ai-elements/queue";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";
import { VoicePresence } from "@/components/ai-elements/voice-presence";
import {
  CHARACTER_SETUPS,
  computeCharacterStats,
  getDefaultCharacterLayer,
  CHARACTER_SPECIALTY_OPTIONS,
  getSetupStatDefinitions,
  getSpecialtyOptions,
  parseCharacterBlueprint,
} from "@/lib/agents/character.service";
import type {
  AgentSetup,
  CharacterStats,
  CharacterTelemetryEvent,
  HardBanCategory,
  RoleHardBan,
} from "@/lib/agents/character.types";

// Icons
import {
  Bot,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Settings,
  Activity,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  GitCommit,
  Save,
  Loader2,
  Paperclip,
  Mic,
  Network,
  Cog,
  Volume2,
  VolumeX,
  Sparkles,
  Headphones,
  Mail,
  Send,
  Inbox,
  MessageSquare,
  Bell,
  CheckCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Gavel,
  AppWindow,
  Search,
  Terminal,
  X,
  ChevronRight,
  Layers,
  Star,
  Zap,
  Check,
  FileText,
  Coins,
  Leaf,
  Heart,
  Book,
  Scale,
  FlaskConical,
  Gamepad2,
  Music,
  Trophy,
  Plane,
  Utensils,
  Home,
  ShoppingBag,
  Brain,
  Globe
} from "lucide-react";

// ============================================================================
// Mascot System
// ============================================================================

export const MASCOT_TEMPLATES: Record<MascotTemplate, {
  name: string;
  description: string;
  defaultColors: string[];
  features: string[];
}> = {
  gizzi: {
    name: 'Gizzi',
    description: 'Classic friendly companion with expressive eyes',
    defaultColors: ['#D4956A', '#E8C4A8', '#F5E6D3'],
    features: ['Large expressive eyes', 'Soft rounded body', 'Bouncy animations'],
  },
  bot: {
    name: 'Bot',
    description: 'Mechanical/robotic aesthetic with LED elements',
    defaultColors: ['#3B82F6', '#60A5FA', '#93C5FD'],
    features: ['Geometric panels', 'Glowing elements', 'Mechanical joints'],
  },
  orb: {
    name: 'Orb',
    description: 'Floating energy sphere with particle effects',
    defaultColors: ['#8B5CF6', '#A78BFA', '#C4B5FD'],
    features: ['Floating animation', 'Particle trail', 'Energy pulses'],
  },
  creature: {
    name: 'Creature',
    description: 'Organic creature-like form with personality',
    defaultColors: ['#10B981', '#34D399', '#6EE7B7'],
    features: ['Organic shapes', 'Expressive features', 'Fluid animations'],
  },
  geometric: {
    name: 'Geometric',
    description: 'Abstract geometric composition',
    defaultColors: ['#F59E0B', '#FBBF24', '#FCD34D'],
    features: ['Clean lines', 'Shape morphing', 'Pattern overlays'],
  },
  minimal: {
    name: 'Minimal',
    description: 'Ultra-minimalist dot or shape',
    defaultColors: ['#6B7280', '#9CA3AF', '#D1D5DB'],
    features: ['Simple shape', 'Subtle pulse', 'Clean aesthetic'],
  },
  cyber: {
    name: 'Cyber',
    description: 'Futuristic neon and circuitry aesthetic',
    defaultColors: ['#06b6d4', '#0ea5e9', '#3b82f6'],
    features: ['Neon glow', 'Circuit patterns', 'Holographic elements'],
  },
  magic: {
    name: 'Magic',
    description: 'Ethereal particles and mystic runes',
    defaultColors: ['#8b5cf6', '#d946ef', '#f43f5e'],
    features: ['Sparkle trails', 'Floating runes', 'Aura waves'],
  },
  nature: {
    name: 'Nature',
    description: 'Organic vines, leaves, and floral motifs',
    defaultColors: ['#22c55e', '#84cc16', '#10b981'],
    features: ['Vine wrapping', 'Leaf flutter', 'Earthy tones'],
  },
  data: {
    name: 'Data',
    description: 'Matrix nodes, data streams, and grids',
    defaultColors: ['#14b8a6', '#0ea5e9', '#6366f1'],
    features: ['Node connection', 'Binary rain', 'Grid layout'],
  },
  security: {
    name: 'Security',
    description: 'Shields, locks, and fortress motifs',
    defaultColors: ['#ef4444', '#f97316', '#f59e0b'],
    features: ['Shield pulse', 'Locking mechanisms', 'Armored styling'],
  },
  finance: {
    name: 'Finance',
    description: 'Coins, charts, and market indicators',
    defaultColors: ['#f59e0b', '#eab308', '#22c55e'],
    features: ['Coin spin', 'Upward arrows', 'Gold accents'],
  },
  healthcare: {
    name: 'Healthcare',
    description: 'Medical crosses, heartbeat lines, and DNA',
    defaultColors: ['#ef4444', '#ec4899', '#3b82f6'],
    features: ['Heartbeat trace', 'DNA helix spin', 'Clean white accents'],
  },
  education: {
    name: 'Education',
    description: 'Books, graduation caps, and lightbulbs',
    defaultColors: ['#3b82f6', '#8b5cf6', '#f59e0b'],
    features: ['Page flipping', 'Lightbulb flash', 'Academic styling'],
  },
  legal: {
    name: 'Legal',
    description: 'Scales of justice, gavels, and columns',
    defaultColors: ['#64748b', '#9ca3af', '#cbd5e1'],
    features: ['Scale balancing', 'Pillar structure', 'Authoritative tone'],
  },
  science: {
    name: 'Science',
    description: 'Atoms, flasks, and chemical reactions',
    defaultColors: ['#06b6d4', '#14b8a6', '#3b82f6'],
    features: ['Atom orbit', 'Bubbling effects', 'Laboratory aesthetic'],
  },
  gaming: {
    name: 'Gaming',
    description: 'Controllers, pixels, and arcade themes',
    defaultColors: ['#ec4899', '#8b5cf6', '#06b6d4'],
    features: ['Pixel explosion', 'Button presses', 'Retro styling'],
  },
  music: {
    name: 'Music',
    description: 'Notes, equalizers, and vinyl records',
    defaultColors: ['#f43f5e', '#d946ef', '#8b5cf6'],
    features: ['Note float', 'Equalizer bounce', 'Rhythmic motion'],
  },
  sports: {
    name: 'Sports',
    description: 'Balls, tracks, and energetic swooshes',
    defaultColors: ['#f97316', '#ef4444', '#eab308'],
    features: ['Fast motion', 'Bouncing', 'Dynamic swoosh'],
  },
  travel: {
    name: 'Travel',
    description: 'Planes, globes, and compasses',
    defaultColors: ['#0ea5e9', '#3b82f6', '#14b8a6'],
    features: ['Globe spin', 'Path tracing', 'Adventure vibe'],
  },
  food: {
    name: 'Food',
    description: 'Culinary items, steam, and utensils',
    defaultColors: ['#f59e0b', '#ef4444', '#84cc16'],
    features: ['Steam rising', 'Sizzling', 'Appetizing colors'],
  },
  fashion: {
    name: 'Fashion',
    description: 'Hangers, sparkles, and elegant lines',
    defaultColors: ['#d946ef', '#f43f5e', '#ec4899'],
    features: ['Elegant sweep', 'Sparkle pop', 'Chic aesthetic'],
  },
  realEstate: {
    name: 'Real Estate',
    description: 'Houses, keys, and cityscapes',
    defaultColors: ['#3b82f6', '#14b8a6', '#64748b'],
    features: ['Door unlocking', 'Roof outline', 'Solid foundation'],
  },
  retail: {
    name: 'Retail',
    description: 'Tags, bags, and storefronts',
    defaultColors: ['#ec4899', '#f97316', '#f59e0b'],
    features: ['Tag flipping', 'Bag sway', 'Commercial feel'],
  },
};

export function MascotPreview({ config, name }: { config: any; name: string }) {
  const getAvatarIcon = () => {
    const template = config.mascotTemplate || config.mascot?.template || 'gizzi';
    const colors = config.colors || config.style || {};
    const primaryColor = colors.primary || colors.primaryColor || STUDIO_THEME.accent;
    const accentColor = colors.glow || colors.accentColor || '#93C5FD';

    const iconStyle = { color: primaryColor, filter: `drop-shadow(0 0 4px ${accentColor}40)` };
    const size = 48;

    switch (template) {
      case 'bot': return <Bot size={size} style={iconStyle} />;
      case 'orb': return <Circle size={size} style={{ ...iconStyle, color: accentColor }} />;
      case 'geometric': return <Square size={size} style={iconStyle} />;
      case 'cyber': return <Zap size={size} style={iconStyle} />;
      case 'magic': return <Sparkles size={size} style={iconStyle} />;
      case 'nature': return <Leaf size={size} style={iconStyle} />;
      case 'data': return <Brain size={size} style={iconStyle} />;
      case 'security': return <Shield size={size} style={iconStyle} />;
      case 'finance': return <Coins size={size} style={iconStyle} />;
      case 'healthcare': return <Heart size={size} style={iconStyle} />;
      case 'education': return <Book size={size} style={iconStyle} />;
      case 'legal': return <Scale size={size} style={iconStyle} />;
      case 'science': return <FlaskConical size={size} style={iconStyle} />;
      case 'gaming': return <Gamepad2 size={size} style={iconStyle} />;
      case 'music': return <Music size={size} style={iconStyle} />;
      case 'sports': return <Trophy size={size} style={iconStyle} />;
      case 'travel': return <Plane size={size} style={iconStyle} />;
      case 'food': return <Utensils size={size} style={iconStyle} />;
      case 'fashion': return <Sparkles size={size} style={iconStyle} />;
      case 'realEstate': return <Home size={size} style={iconStyle} />;
      case 'retail': return <ShoppingBag size={size} style={iconStyle} />;
      default: return <Bot size={size} style={iconStyle} />;
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.div 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          position: 'relative'
        }}
      >
        <div style={{ position: 'absolute', inset: '-2px', borderRadius: '50%', background: `radial-gradient(circle, ${STUDIO_THEME.accent}10 0%, transparent 70%)` }} />
        {getAvatarIcon()}
      </motion.div>
      <div style={{ 
        fontSize: '10px', 
        fontWeight: 700, 
        color: STUDIO_THEME.textMuted, 
        textTransform: 'uppercase', 
        letterSpacing: '0.2em',
        textAlign: 'center'
      }}>{name}</div>
    </div>
  );
}

const CAPABILITY_CATEGORIES = [
  { id: 'core', label: 'Core Intelligence', icon: Brain },
  { id: 'system', label: 'System Access', icon: Terminal },
  { id: 'data', label: 'Data & Analysis', icon: Search },
  { id: 'communication', label: 'Communication', icon: Globe },
];

const AGENT_CAPABILITIES_ENHANCED = [
  { id: 'code-generation', name: 'Code Generation', description: 'Generate and edit code', category: 'core' },
  { id: 'reasoning', name: 'Advanced Reasoning', description: 'Complex logic and chain-of-thought', category: 'core' },
  { id: 'planning', name: 'Multi-step Planning', description: 'Break tasks into actionable steps', category: 'core' },
  { id: 'file-operations', name: 'File Operations', description: 'Read and write local files', category: 'system' },
  { id: 'terminal', name: 'Terminal Access', description: 'Execute shell commands safely', category: 'system' },
  { id: 'browser-automation', name: 'Browser Control', description: 'Operate web browser via UI-TARS', category: 'system' },
  { id: 'web-search', name: 'Web Search', description: 'Access live internet data', category: 'communication' },
  { id: 'api-integration', name: 'API Connect', description: 'Make HTTP requests to external services', category: 'communication' },
  { id: 'database', name: 'Database Query', description: 'Read and write to SQL/NoSQL stores', category: 'data' },
  { id: 'memory', name: 'Long-term Memory', description: 'Persistence across sessions', category: 'data' },
];

// ============================================================================
// Enhanced Wizard Constants & Helpers
// ============================================================================

const ENHANCED_VOICE_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal, business-like communication' },
  { id: 'casual', label: 'Casual', description: 'Relaxed, conversational tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', description: 'High energy, excited' },
  { id: 'analytical', label: 'Analytical', description: 'Precise, data-driven language' },
  { id: 'empathetic', label: 'Empathetic', description: 'Understanding, supportive tone' },
  { id: 'witty', label: 'Witty', description: 'Clever, humorous when appropriate' },
  { id: 'direct', label: 'Direct', description: 'Straightforward, no fluff' },
  { id: 'teaching', label: 'Teaching', description: 'Educational, explanatory' },
];

const ENHANCED_HARD_BAN_CATEGORIES: Record<string, {
  label: string;
  description: string;
  icon: any;
  severity: 'fatal' | 'warning';
}> = {
  publishing: { label: 'Publishing', description: 'No direct posting to public platforms', icon: ShieldAlert, severity: 'fatal' },
  deploy: { label: 'Deployment', description: 'No production deployments', icon: ShieldAlert, severity: 'fatal' },
  data_exfil: { label: 'Data Exfiltration', description: 'No unauthorized data export', icon: ShieldAlert, severity: 'fatal' },
  payments: { label: 'Financial Transactions', description: 'No payment processing', icon: ShieldAlert, severity: 'fatal' },
  email_send: { label: 'Outbound Email', description: 'No sending emails externally', icon: Shield, severity: 'warning' },
  file_delete: { label: 'Destructive Deletion', description: 'No permanent file deletion', icon: Trash2, severity: 'warning' },
  system_modify: { label: 'System Modification', description: 'No system-level changes', icon: ShieldAlert, severity: 'fatal' },
  external_communication: { label: 'External Communication', description: 'No communication with external services', icon: Shield, severity: 'warning' },
  code_execution: { label: 'Code Execution', description: 'No arbitrary code execution', icon: ShieldAlert, severity: 'fatal' },
  other: { label: 'Custom Restriction', description: 'Other custom restrictions', icon: Gavel, severity: 'warning' },
};

function generateEnhancedWorkspaceDocuments(
  config: any,
  basicInfo: { name: string; description: string; model: string; provider: string }
) {
  return {
    identity: `# Agent Identity: ${basicInfo.name}
setup: ${config.identity?.setup || 'generalist'}
class: ${config.identity?.className || 'Agent'}
specialty_skills:
${(config.identity?.specialtySkills || []).map((s: string) => `  - ${s}`).join('\n')}
temperament: ${config.identity?.temperament || 'balanced'}
personality_traits:
${(config.identity?.personalityTraits || []).map((t: string) => `  - ${t}`).join('\n')}
backstory: |
  ${config.identity?.backstory || 'No backstory provided'}
`,
    
    roleCard: `# Role Card: ${basicInfo.name}
domain: ${config.roleCard?.domain || 'General'}
inputs:
${(config.roleCard?.inputs || []).map((i: string) => `  - ${i}`).join('\n')}
outputs:
${(config.roleCard?.outputs || []).map((o: string) => `  - ${o}`).join('\n')}
definition_of_done:
${(config.roleCard?.definitionOfDone || []).map((d: string) => `  - ${d}`).join('\n')}
hard_bans:
${(config.roleCard?.hardBans || []).map((b: any) => `  - category: ${b.category}\n    severity: ${b.severity}\n    ${b.description ? `description: ${b.description}` : ''}`).join('\n')}
escalation:
${(config.roleCard?.escalation || []).map((e: string) => `  - ${e}`).join('\n')}
metrics:
${(config.roleCard?.metrics || []).map((m: string) => `  - ${m}`).join('\n')}
`,
    
    voice: `# Voice Configuration: ${basicInfo.name}
style: ${config.voice?.style || 'professional'}
rules:
${(config.voice?.rules || []).map((r: string) => `  - ${r}`).join('\n')}
micro_bans:
${(config.voice?.microBans || []).map((b: string) => `  - ${b}`).join('\n')}
tone:
  formality: ${config.voice?.tone?.formality ?? 0.5}
  enthusiasm: ${config.voice?.tone?.enthusiasm ?? 0.5}
  empathy: ${config.voice?.tone?.empathy ?? 0.5}
  directness: ${config.voice?.tone?.directness ?? 0.5}
`,
    
    progression: `# Progression: ${basicInfo.name}
class: ${config.progression?.class || 'Agent'}
relevant_stats:
${(config.progression?.relevantStats || []).map((s: string) => `  - ${s}`).join('\n')}
level:
  max_level: ${config.progression?.level?.maxLevel || 50}
  xp_formula: ${config.progression?.level?.xpFormula || 'level * 100'}
`,
    
    avatar: JSON.stringify({
      type: config.avatar?.type || 'mascot',
      uri: config.avatar?.uri,
      mascot: config.avatar?.mascot,
      style: config.avatar?.style,
    }, null, 2),
    
    compiled: JSON.stringify({
      name: basicInfo.name,
      description: basicInfo.description,
      model: basicInfo.model,
      provider: basicInfo.provider,
      character: config,
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    }, null, 2),
  };
}

// ============================================================================
// Enhanced UI Components
// ============================================================================

export const STUDIO_THEME = {
  bg: '#2B2520',
  bgCard: '#352F29',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  borderSubtle: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.12)',
};

const Modal = ({ isOpen, onClose, title, children, footer }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-auto rounded-xl border shadow-2xl overflow-hidden" style={{ background: STUDIO_THEME.bgCard, borderColor: STUDIO_THEME.border }}>
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: STUDIO_THEME.borderSubtle }}>
          <h2 className="text-lg font-semibold" style={{ color: STUDIO_THEME.textPrimary }}>{title}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-white/10" style={{ color: STUDIO_THEME.textSecondary }}><X size={20} /></button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 p-4 border-t" style={{ borderColor: STUDIO_THEME.borderSubtle }}>{footer}</div>}
      </div>
    </div>
  );
};

const TextInputModal = ({ isOpen, title, label, placeholder, defaultValue = '', onSubmit, onClose, validate }: any) => {
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (isOpen) { setValue(defaultValue); setError(null); } }, [isOpen, defaultValue]);
  const handleSubmit = () => {
    if (validate) { const err = validate(value); if (err) { setError(err); return; } }
    onSubmit(value); onClose();
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={handleSubmit}>OK</Button></>}>
      <div className="space-y-2">
        <Label style={{ color: STUDIO_THEME.textSecondary }}>{label}</Label>
        <Input value={value} onChange={(e) => { setValue(e.target.value); if (error) setError(null); }} placeholder={placeholder} style={{ background: STUDIO_THEME.bg, borderColor: error ? '#ef4444' : STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }} />
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  );
};

const TagInput = ({ tags, onChange, placeholder }: any) => {
  const [input, setInput] = useState('');
  const handleKeyDown = (e: any) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    }
  };
  const removeTag = (tag: string) => onChange(tags.filter((t: string) => t !== tag));
  return (
    <div className="flex flex-wrap gap-2 p-2 rounded-xl border" style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle }}>
      {tags.map((tag: string) => (
        <Badge key={tag} variant="secondary" className="gap-1 px-2 py-1">
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:text-red-500"><X size={12} /></button>
        </Badge>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] bg-transparent outline-none text-sm p-1"
        style={{ color: STUDIO_THEME.textPrimary }}
      />
    </div>
  );
};

const Skeleton = ({ width = '100%', height = '1rem', borderRadius = '0.5rem', className = '', style = {} }: any) => (
  <div
    className={`animate-pulse ${className}`}
    style={{
      width,
      height,
      borderRadius,
      background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 75%)',
      backgroundSize: '200% 100%',
      ...style,
    }}
  />
);

const LoadingProgress = ({ progress = 0, label = 'Loading', showPercentage = true }: any) => (
  <div className="w-full max-w-md mx-auto">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium" style={{ color: STUDIO_THEME.textSecondary }}>{label}</span>
      {showPercentage && (
        <span className="text-sm font-medium" style={{ color: STUDIO_THEME.textSecondary }}>{Math.round(progress)}%</span>
      )}
    </div>
    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: `linear-gradient(90deg, ${STUDIO_THEME.accent}, #8b5cf6)` }}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  </div>
);

// ============================================================================
// Agent View - Production Implementation
// ============================================================================

interface AgentViewProps {
  context?: any;
  hideCreateButton?: boolean;
  forceListMode?: boolean;
  title?: string;
}

export function AgentView({ context, hideCreateButton = false, forceListMode = false, title = 'Agent Studio' }: AgentViewProps) {
  // Debug: Check if component renders at all
  console.log('[AgentView] Component executing', context);
  
  const {
    agents,
    selectedAgentId,
    viewMode,
    isLoadingAgents,
    isCreating,
    isEditing,
    error,
    eventStreamConnected,
    fetchAgents,
    selectAgent,
    setIsCreating,
    setIsEditing,
    clearError,
    connectEventStream,
    setViewMode,
  } = useAgentStore();

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Connect to event stream when agent is selected
  useEffect(() => {
    if (!selectedAgentId) return;
    const cleanup = connectEventStream(selectedAgentId);
    return cleanup;
  }, [selectedAgentId, connectEventStream]);

  // If forceListMode is true and we're in create mode, switch to list view
  // This only runs once on mount when forceListMode changes
  useEffect(() => {
    if (forceListMode && viewMode === 'create') {
      setViewMode('list');
    }
    // Only run when forceListMode changes, not on every viewMode change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceListMode]);

  // Global forge animation state - persists across view mode changes
  const [globalForgeVisible, setGlobalForgeVisible] = useState(false);
  const [globalForgeAgentName, setGlobalForgeAgentName] = useState('');

  // Debug logging
  console.log('[AgentView] Render - viewMode:', viewMode, 'selectedAgentId:', selectedAgentId, 'forceListMode:', forceListMode);

  // Render based on view mode
  if (viewMode === 'create' && !forceListMode) {
    return (
      <div className="h-full w-full">
        <CreateAgentForm 
          onCancel={() => setIsCreating(false)}
          onShowForge={(name) => {
            console.log('[AgentView] Showing global forge animation for:', name);
            setGlobalForgeAgentName(name);
            setGlobalForgeVisible(true);
          }}
          onComplete={() => {
            setGlobalForgeVisible(false);
            setIsCreating(false);
          }}
        />
        {globalForgeVisible && (
      <div 
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
          >
            <CreationProgressAnimation 
              onComplete={() => {
                setGlobalForgeVisible(false);
              }}
              agentName={globalForgeAgentName}
            />
          </div>
        )}
      </div>
    );
  }

  if (viewMode === 'edit' && selectedAgentId) {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading agent...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="h-full w-full">
        <EditAgentForm agent={agent} onCancel={() => setIsEditing(null)} />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedAgentId) {
    return (
      <div className="h-full w-full">
        <AgentDetailView agentId={selectedAgentId} />
      </div>
    );
  }

  // Default: Agent List View
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: 'transparent',
      overflow: 'hidden',
      position: 'relative'
    }}
    className="bg-transparent"
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 24px',
        borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: 'transparent',
        flexShrink: 0,
        position: 'relative'
      }}
      className="bg-transparent"
      >
        {/* Create Agent Button - Left (hidden when hideCreateButton is true) */}
        {!hideCreateButton && (
          <button 
            onClick={() => setIsCreating(true)}
            style={{
              position: 'absolute',
              left: '24px',
              padding: '8px 16px',
              borderRadius: '6px',
              background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
              color: '#1A1612',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            Create Agent
          </button>
        )}

        {/* Centered Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            margin: 0,
            fontFamily: 'Georgia, serif'
          }}>
            {title}
          </h1>
          <p style={{
            fontSize: '13px',
            color: STUDIO_THEME.textSecondary,
            margin: '4px 0 0 0'
          }}>
            {forceListMode ? 'Browse and manage your AI agents' : 'Create, manage, and orchestrate autonomous AI agents'}
          </p>
        </div>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        position: 'relative'
      }}>
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-500/50">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {error === 'API_OFFLINE' && (
          <Alert className="mb-4 bg-amber-900/30 border-amber-500/30">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              API service is offline. Start it with: <code className="bg-amber-900/50 px-2 py-0.5 rounded text-amber-300">cd 6-apps/api && cargo run</code>
            </AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyAgentState 
            onCreate={() => setIsCreating(true)} 
            onCreateFromTemplate={(template) => {
              // Store template in session storage for the create form to pick up
              sessionStorage.setItem('agentTemplate', JSON.stringify(template));
              setIsCreating(true);
            }}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
            padding: '8px'
          }}>
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <AgentCard 
                  agent={agent} 
                  onClick={() => {
                    console.log('[AgentView] Clicked agent:', agent.id, agent.name);
                    selectAgent(agent.id);
                  }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Card Component - Polished with inline styles
// ============================================================================

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const statusColor = getStatusColor(agent.status);
  const blueprint = parseCharacterBlueprint(agent.config);
  const setupId = blueprint?.setup || "generalist";
  const setupMeta = CHARACTER_SETUPS.find((setup) => setup.id === setupId) || null;
  const agentCharacterStats = useAgentStore((state) => state.characterStats[agent.id]);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  // Get avatar config from agent config or use default
  const avatarConfig = (agent.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);

  useEffect(() => {
    if (!agentCharacterStats) {
      void loadCharacterLayer(agent.id);
    }
  }, [agent.id, agentCharacterStats, loadCharacterLayer]);
  
  const getTypeIcon = () => {
    switch (agent.type) {
      case 'orchestrator': return <Network style={{ width: 14, height: 14 }} />;
      case 'worker': return <Cog style={{ width: 14, height: 14 }} />;
      case 'specialist': return <Star style={{ width: 14, height: 14 }} />;
      case 'reviewer': return <CheckCircle style={{ width: 14, height: 14 }} />;
      default: return <Bot style={{ width: 14, height: 14 }} />;
    }
  };

  const getTypeLabel = () => {
    switch (agent.type) {
      case 'orchestrator': return 'Orchestrator';
      case 'sub-agent': return 'Sub-Agent';
      case 'worker': return 'Worker';
      case 'specialist': return 'Specialist';
      case 'reviewer': return 'Reviewer';
      default: return 'Agent';
    }
  };
  const previewStatDefinitions = getSetupStatDefinitions(setupId)
    .filter((definition) => agentCharacterStats?.relevantStats.includes(definition.key))
    .slice(0, 2);

  const statusColors: Record<string, string> = {
    'online': '#22c55e',
    'offline': '#6b7280',
    'busy': '#f59e0b',
    'error': '#ef4444'
  };
  
  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        cursor: 'pointer',
        borderRadius: '12px',
        border: `1px solid ${isHovered ? `${STUDIO_THEME.accent}50` : STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bgCard,
        overflow: 'hidden',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {/* Avatar */}
            <div style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative'
            }}>
              <AgentAvatar 
                config={avatarConfig}
                size={44}
                emotion="steady"
                isAnimating={isHovered}
              />
              {/* Status indicator */}
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: statusColors[agent.status] || '#6b7280',
                border: `2px solid ${STUDIO_THEME.bgCard}`
              }} />
            </div>
            
            {/* Name & Type */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: isHovered ? STUDIO_THEME.accent : STUDIO_THEME.textPrimary,
                margin: '0 0 6px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'color 0.2s ease'
              }}>
                {agent.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '11px',
                  fontWeight: 500,
                  border: `1px solid ${STUDIO_THEME.accent}25`
                }}>
                  {getTypeIcon()}
                  {getTypeLabel()}
                </span>
                {setupMeta && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.06)',
                    color: STUDIO_THEME.textSecondary,
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {setupMeta.label}
                  </span>
                )}
                {agentCharacterStats && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    Lv{agentCharacterStats.level}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Voice indicator */}
          {agent.voice?.enabled && (
            <div style={{
              padding: '4px 8px',
              borderRadius: '999px',
              background: `${STUDIO_THEME.accent}15`,
              border: `1px solid ${STUDIO_THEME.accent}25`,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Volume2 style={{ width: 14, height: 14, color: STUDIO_THEME.accent }} />
            </div>
          )}
        </div>
        
        {/* Description */}
        <p style={{
          fontSize: '14px',
          color: STUDIO_THEME.textSecondary,
          margin: '12px 0 0 0',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {agent.description || "No description provided"}
        </p>
        
        {/* Skills */}
        {blueprint && blueprint.specialtySkills.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)',
            border: `1px solid ${STUDIO_THEME.borderSubtle}`
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                <span key={skill} style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  {skill}
                  {typeof agentCharacterStats?.specialtyScores?.[skill] === "number" && (
                    <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                      {agentCharacterStats.specialtyScores[skill]}
                    </span>
                  )}
                </span>
              ))}
              {blueprint.specialtySkills.length > 3 && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  color: STUDIO_THEME.textMuted,
                  fontSize: '12px'
                }}>
                  +{blueprint.specialtySkills.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Stats */}
        {agentCharacterStats && previewStatDefinitions.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewStatDefinitions.map((definition) => (
              <div key={definition.key} style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                  {definition.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>
                  {agentCharacterStats.stats[definition.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Capabilities */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {agent.capabilities.slice(0, 3).map(cap => (
            <span key={cap} style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              color: STUDIO_THEME.textSecondary,
              fontSize: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`
            }}>
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'transparent',
              color: STUDIO_THEME.textMuted,
              fontSize: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`
            }}>
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: STUDIO_THEME.textMuted
        }}>
          <Clock style={{ width: 14, height: 14 }} />
          Last run: {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : 'Never'}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Agent Template Types
// ============================================================================

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  setup: AgentSetup;
  capabilities: string[];
  systemPrompt: string;
  color: string;
  mascotTemplate?: MascotTemplate;
  avatarColors?: {
    primary: string;
    secondary: string;
    glow: string;
  };
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  // CORE SPECIALISTS
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Expert in software development, code review, and debugging',
    icon: <Terminal className="w-6 h-6" />,
    setup: 'coding',
    capabilities: ['code-generation', 'file-operations', 'terminal', 'planning', 'reasoning'],
    systemPrompt: 'You are an expert software developer. Help users write, review, and debug code. Always follow best practices and provide clear explanations.',
    color: '#3B82F6',
    mascotTemplate: 'bot',
    avatarColors: { primary: '#3B82F6', secondary: '#60A5FA', glow: '#93C5FD' }
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    description: 'Gathers information, analyzes data, and synthesizes reports',
    icon: <Search className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['web-search', 'memory', 'reasoning', 'planning', 'api-integration'],
    systemPrompt: 'You are a thorough research analyst. Help users gather information, analyze data, and create comprehensive reports with proper citations.',
    color: '#10B981',
    mascotTemplate: 'orb',
    avatarColors: { primary: '#8B5CF6', secondary: '#A78BFA', glow: '#C4B5FD' }
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    description: 'Creates engaging content, stories, and marketing copy',
    icon: <Sparkles className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['planning', 'reasoning', 'memory', 'web-search'],
    systemPrompt: 'You are a creative writer. Help users craft engaging content, stories, and copy. Be imaginative while maintaining clarity and purpose.',
    color: '#F59E0B',
    mascotTemplate: 'creature',
    avatarColors: { primary: '#10B981', secondary: '#34D399', glow: '#6EE7B7' }
  },
  {
    id: 'operations-manager',
    name: 'Ops Manager',
    description: 'Handles deployments, monitoring, and infrastructure tasks',
    icon: <Settings className="w-6 h-6" />,
    setup: 'operations',
    capabilities: ['terminal', 'file-operations', 'planning', 'reasoning', 'database'],
    systemPrompt: 'You are an operations manager. Help users with deployments, monitoring, and infrastructure. Prioritize safety and always confirm before making changes.',
    color: '#EF4444',
    mascotTemplate: 'geometric',
    avatarColors: { primary: '#F59E0B', secondary: '#FBBF24', glow: '#FCD34D' }
  },
  
  // DOMAIN-SPECIFIC TEMPLATES (The 22 Variations)
  {
    id: 'cyber-specialist',
    name: 'Cyber Specialist',
    description: 'Futuristic security and network optimization',
    icon: <Zap className="w-6 h-6" />,
    setup: 'operations',
    capabilities: ['terminal', 'file-operations', 'reasoning'],
    systemPrompt: 'You are a cybersecurity expert. Monitor networks, detect vulnerabilities, and implement security protocols.',
    color: '#06b6d4',
    mascotTemplate: 'cyber',
    avatarColors: { primary: '#06b6d4', secondary: '#0ea5e9', glow: '#3b82f6' }
  },
  {
    id: 'magic-assistant',
    name: 'Magic Assistant',
    description: 'Creative and mystical problem solving',
    icon: <Sparkles className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['planning', 'reasoning', 'memory'],
    systemPrompt: 'You are a creative assistant with a mystical perspective. Approach problems with wonder and imagination.',
    color: '#8b5cf6',
    mascotTemplate: 'magic',
    avatarColors: { primary: '#8b5cf6', secondary: '#d946ef', glow: '#f43f5e' }
  },
  {
    id: 'nature-guide',
    name: 'Nature Guide',
    description: 'Organic and sustainable growth strategies',
    icon: <Leaf className="w-6 h-6" />,
    setup: 'generalist',
    capabilities: ['web-search', 'memory', 'planning'],
    systemPrompt: 'You are an environmental consultant. Help users build sustainable systems and understand ecological impact.',
    color: '#22c55e',
    mascotTemplate: 'nature',
    avatarColors: { primary: '#22c55e', secondary: '#84cc16', glow: '#10b981' }
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    description: 'Matrix nodes, data streams, and pattern recognition',
    icon: <Search className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['database', 'reasoning', 'planning'],
    systemPrompt: 'You are a data scientist. Extract insights from complex datasets and identify hidden patterns.',
    color: '#14b8a6',
    mascotTemplate: 'data',
    avatarColors: { primary: '#14b8a6', secondary: '#0ea5e9', glow: '#6366f1' }
  },
  {
    id: 'security-guardian',
    name: 'Security Guardian',
    description: 'Defensive systems and access control',
    icon: <Shield className="w-6 h-6" />,
    setup: 'operations',
    capabilities: ['terminal', 'file-operations', 'reasoning'],
    systemPrompt: 'You are a security guardian. Protect digital assets and manage strict access controls.',
    color: '#ef4444',
    mascotTemplate: 'security',
    avatarColors: { primary: '#ef4444', secondary: '#f97316', glow: '#f59e0b' }
  },
  {
    id: 'finance-wizard',
    name: 'Finance Wizard',
    description: 'Market analysis and financial planning',
    icon: <Coins className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['database', 'web-search', 'reasoning'],
    systemPrompt: 'You are a financial advisor. Analyze markets, manage portfolios, and provide economic forecasts.',
    color: '#f59e0b',
    mascotTemplate: 'finance',
    avatarColors: { primary: '#f59e0b', secondary: '#eab308', glow: '#22c55e' }
  },
  {
    id: 'healthcare-pro',
    name: 'Health Pro',
    description: 'Medical knowledge and wellness coordination',
    icon: <Heart className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['web-search', 'memory', 'planning'],
    systemPrompt: 'You are a healthcare coordinator. Provide medical information and manage wellness schedules.',
    color: '#ef4444',
    mascotTemplate: 'healthcare',
    avatarColors: { primary: '#ef4444', secondary: '#ec4899', glow: '#3b82f6' }
  },
  {
    id: 'educator',
    name: 'Education Specialist',
    description: 'Learning paths and knowledge sharing',
    icon: <Book className="w-6 h-6" />,
    setup: 'generalist',
    capabilities: ['planning', 'memory', 'web-search'],
    systemPrompt: 'You are an educator. Help users learn new skills and create personalized educational content.',
    color: '#3b82f6',
    mascotTemplate: 'education',
    avatarColors: { primary: '#3b82f6', secondary: '#8b5cf6', glow: '#f59e0b' }
  },
  {
    id: 'legal-advisor',
    name: 'Legal Advisor',
    description: 'Compliance, contracts, and legal research',
    icon: <Scale className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['file-operations', 'web-search', 'reasoning'],
    systemPrompt: 'You are a legal consultant. Review contracts, ensure compliance, and conduct legal research.',
    color: '#64748b',
    mascotTemplate: 'legal',
    avatarColors: { primary: '#64748b', secondary: '#9ca3af', glow: '#cbd5e1' }
  },
  {
    id: 'science-lab',
    name: 'Lab Assistant',
    description: 'Experimental design and scientific analysis',
    icon: <FlaskConical className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['reasoning', 'planning', 'web-search'],
    systemPrompt: 'You are a scientific researcher. Design experiments, analyze results, and synthesize scientific data.',
    color: '#06b6d4',
    mascotTemplate: 'science',
    avatarColors: { primary: '#06b6d4', secondary: '#14b8a6', glow: '#3b82f6' }
  },
  {
    id: 'gaming-buddy',
    name: 'Gaming Guide',
    description: 'Game design, strategy, and retro knowledge',
    icon: <Gamepad2 className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['planning', 'memory', 'web-search'],
    systemPrompt: 'You are a gaming expert. Help with strategy, game design, and retro gaming history.',
    color: '#ec4899',
    mascotTemplate: 'gaming',
    avatarColors: { primary: '#ec4899', secondary: '#8b5cf6', glow: '#06b6d4' }
  },
  {
    id: 'music-producer',
    name: 'Music Producer',
    description: 'Audio theory, composition, and rhythmic motion',
    icon: <Music className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['planning', 'reasoning', 'memory'],
    systemPrompt: 'You are a music producer. Help with composition, audio theory, and rhythmic arrangement.',
    color: '#f43f5e',
    mascotTemplate: 'music',
    avatarColors: { primary: '#f43f5e', secondary: '#d946ef', glow: '#8b5cf6' }
  },
  {
    id: 'sports-coach',
    name: 'Performance Coach',
    description: 'Athletic strategy and energy optimization',
    icon: <Trophy className="w-6 h-6" />,
    setup: 'generalist',
    capabilities: ['planning', 'memory', 'reasoning'],
    systemPrompt: 'You are a performance coach. Help with athletic strategy, training schedules, and energy management.',
    color: '#f97316',
    mascotTemplate: 'sports',
    avatarColors: { primary: '#f97316', secondary: '#ef4444', glow: '#eab308' }
  },
  {
    id: 'travel-planner',
    name: 'Travel Planner',
    description: 'Adventure logic and logistical planning',
    icon: <Plane className="w-6 h-6" />,
    setup: 'generalist',
    capabilities: ['web-search', 'planning', 'memory'],
    systemPrompt: 'You are a travel coordinator. Plan adventurous trips and manage complex travel logistics.',
    color: '#0ea5e9',
    mascotTemplate: 'travel',
    avatarColors: { primary: '#0ea5e9', secondary: '#3b82f6', glow: '#14b8a6' }
  },
  {
    id: 'food-critic',
    name: 'Culinary Expert',
    description: 'Gastronomy and kitchen coordination',
    icon: <Utensils className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['web-search', 'memory', 'planning'],
    systemPrompt: 'You are a culinary expert. Help with recipes, kitchen management, and gastronomic research.',
    color: '#f59e0b',
    mascotTemplate: 'food',
    avatarColors: { primary: '#f59e0b', secondary: '#ef4444', glow: '#84cc16' }
  },
  {
    id: 'fashion-designer',
    name: 'Fashion Designer',
    description: 'Chic aesthetics and elegant composition',
    icon: <Sparkles className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['web-search', 'memory', 'reasoning'],
    systemPrompt: 'You are a fashion designer. Help with aesthetic trends, composition, and chic design patterns.',
    color: '#d946ef',
    mascotTemplate: 'fashion',
    avatarColors: { primary: '#d946ef', secondary: '#f43f5e', glow: '#ec4899' }
  },
  {
    id: 'real-estate-pro',
    name: 'Estate Agent',
    description: 'Property logic and solid foundations',
    icon: <Home className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['database', 'web-search', 'reasoning'],
    systemPrompt: 'You are a real estate expert. Analyze property markets and manage estate logistics.',
    color: '#3b82f6',
    mascotTemplate: 'realEstate',
    avatarColors: { primary: '#3b82f6', secondary: '#14b8a6', glow: '#64748b' }
  },
  {
    id: 'retail-manager',
    name: 'Retail Manager',
    description: 'Commercial flow and store optimization',
    icon: <ShoppingBag className="w-6 h-6" />,
    setup: 'operations',
    capabilities: ['database', 'planning', 'reasoning'],
    systemPrompt: 'You are a retail operations manager. Optimize commercial flow and manage store logistics.',
    color: '#ec4899',
    mascotTemplate: 'retail',
    avatarColors: { primary: '#ec4899', secondary: '#f97316', glow: '#f59e0b' }
  },
];

// ============================================================================
// Empty State - Matching ChatView Style
// ============================================================================

interface EmptyAgentStateProps {
  onCreate: () => void;
  onCreateFromTemplate?: (template: AgentTemplate) => void;
}

function EmptyAgentState({ onCreate, onCreateFromTemplate }: EmptyAgentStateProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const handleTemplateClick = (template: AgentTemplate) => {
    // Clear wizard persistence to ensure template takes precedence
    localStorage.removeItem('agent-wizard-state');
    
    if (onCreateFromTemplate) {
      onCreateFromTemplate(template);
    } else {
      sessionStorage.setItem('agentTemplate', JSON.stringify(template));
      onCreate();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      maxWidth: '1000px', // Wider for the grid
      minHeight: 'calc(100vh - 200px)',
      padding: '48px 24px',
      boxSizing: 'border-box',
      margin: '0 auto'
    }}>
      {/* Logo/Icon Section */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${STUDIO_THEME.accent}20, ${STUDIO_THEME.accent}10)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          border: `1px solid ${STUDIO_THEME.accent}30`
        }}>
          <Bot style={{ width: 40, height: 40, color: STUDIO_THEME.accent }} />
        </div>
        
        <h1 style={{
          fontSize: '42px',
          fontWeight: 500,
          color: STUDIO_THEME.textPrimary,
          margin: '0 0 16px 0',
          fontFamily: 'Georgia, serif',
          letterSpacing: '-0.02em'
        }}>
          Agent Studio
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', background: STUDIO_THEME.borderSubtle }} />
          <p style={{
            fontSize: '14px',
            color: STUDIO_THEME.textSecondary,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.15em'
          }}>
            Create & Manage AI Agents
          </p>
          <div style={{ height: '1px', width: '32px', background: STUDIO_THEME.borderSubtle }} />
        </div>
        
        <p style={{
          fontSize: '16px',
          color: STUDIO_THEME.textSecondary,
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.6,
          margin: '0 auto'
        }}>
          Choose a pre-configured specialist or build your own custom AI agent from scratch.
        </p>
      </div>

      {/* Primary Actions */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
        marginBottom: '48px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={onCreate}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
            color: '#1A1612',
            fontSize: '15px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        >
          <Plus style={{ width: 18, height: 18 }} />
          Create Custom Agent
        </button>
        
        <button 
          onClick={() => setShowTemplates(!showTemplates)}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: 'transparent',
            color: STUDIO_THEME.textPrimary,
            fontSize: '15px',
            fontWeight: 500,
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles style={{ width: 18, height: 18 }} />
          {showTemplates ? 'Hide Templates' : 'Specialist Templates'}
        </button>
      </div>

      {/* Templates Section */}
      {showTemplates && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ width: '100%', marginBottom: '48px' }}
        >
          <div style={{ 
            maxHeight: '500px', 
            overflowY: 'auto', 
            padding: '4px',
            paddingRight: '12px', // Space for scrollbar
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
            // Custom scrollbar styling
            scrollbarWidth: 'thin',
            scrollbarColor: `${STUDIO_THEME.accent}40 transparent`
          }}>
            {AGENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  background: STUDIO_THEME.bgCard,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  cursor: 'pointer',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = STUDIO_THEME.accent;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = `0 12px 24px rgba(0,0,0,0.3), 0 0 0 1px ${STUDIO_THEME.accent}40`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = STUDIO_THEME.borderSubtle;
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ transform: 'scale(0.7)', height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MascotPreview 
                    config={{ 
                      mascotTemplate: template.mascotTemplate, 
                      colors: template.avatarColors 
                    }} 
                    name="" 
                  />
                </div>
                
                <div style={{ width: '100%' }}>
                  <h5 style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 4px 0'
                  }}>
                    {template.name}
                  </h5>
                  <p style={{
                    fontSize: '11px',
                    color: STUDIO_THEME.textSecondary,
                    margin: 0,
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    minHeight: '30px'
                  }}>
                    {template.description}
                  </p>
                </div>

                <div style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '20px',
                  background: `${template.color}15`,
                  color: template.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  {template.setup}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Features */}
      <div style={{
        width: '100%',
        borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
        paddingTop: '32px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '24px',
          justifyContent: 'center'
        }}>
          {[
            { icon: <Cog style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Customizable', desc: 'Configure capabilities' },
            { icon: <Network style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Multi-Agent', desc: 'Orchestrator support' },
            { icon: <Shield style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Secure', desc: 'Built-in guardrails' },
          ].map((feature) => (
            <div key={`feature-${feature.title}`} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flex: 1
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `${STUDIO_THEME.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {feature.icon}
              </div>
              <div>
                <h6 style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 2px 0'
                }}>
                  {feature.title}
                </h6>
                <p style={{
                  fontSize: '12px',
                  color: STUDIO_THEME.textMuted,
                  margin: 0
                }}>
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Create Agent Form
// ============================================================================

type CreationTemperament = "precision" | "exploratory" | "systemic" | "balanced";

interface CreationBlueprintState {
  setup: AgentSetup;
  specialtySkills: string[];
  temperament: CreationTemperament;
}

interface CreationCardSeedState {
  domainFocus: string;
  definitionOfDone: string;
  escalationRules: string;
  voiceStyle: string;
  voiceRules: string;
  voiceMicroBans: string;
  hardBanCategories: HardBanCategory[];
}

const FORGING_STEPS = [
  "Compiling role card",
  "Binding hard bans",
  "Calibrating voice",
  "Indexing specialties",
  "Sealing character layer",
] as const;

const FORGING_STAGE_DETAILS = [
  "Building deterministic ownership contracts and completion criteria.",
  "Wiring ban categories to enforceable runtime gates.",
  "Applying voice directives and micro-ban language constraints.",
  "Projecting setup + specialty skill scores from telemetry signals.",
  "Writing final character config for Runner and Shell UI surfaces.",
] as const;

const SETUP_CAPABILITY_PRESETS: Record<AgentSetup, string[]> = {
  coding: ["code-generation", "file-operations", "terminal", "planning", "reasoning"],
  creative: ["planning", "reasoning", "memory", "web-search", "api-integration"],
  research: ["web-search", "memory", "reasoning", "planning", "api-integration"],
  operations: ["terminal", "file-operations", "planning", "reasoning", "database"],
  generalist: ["planning", "reasoning", "memory", "web-search"],
};

const CREATE_FLOW_STEPS = [
  {
    id: "welcome",
    label: "Welcome",
    description: "Get started with agent creation.",
  },
  {
    id: "identity",
    label: "Identity",
    description: "Name, type, and ownership.",
  },
  {
    id: "personality",
    label: "Personality",
    description: "Creativity and verbosity settings.",
  },
  {
    id: "character",
    label: "Character",
    description: "Setup, specialties, and policy card.",
  },
  {
    id: "avatar",
    label: "Avatar",
    description: "Visual appearance and style.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Model, voice, capabilities, prompt.",
  },
  {
    id: "workspace",
    label: "Workspace",
    description: "Configure 5-layer workspace structure.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate measurable profile before forge.",
  },
] as const;

type CreateFlowStepId = (typeof CREATE_FLOW_STEPS)[number]["id"];

interface SetupTelemetryPreset {
  missions: number;
  success: number;
  stepStarted: number;
  stepCompleted: number;
  memoryWritten: number;
  banTriggered: number;
  escalations: number;
  challengeInteractions: number;
  handoffInteractions: number;
}

type SetupTelemetryDelta = Partial<SetupTelemetryPreset>;

const SETUP_TELEMETRY_BASELINE: Record<AgentSetup, SetupTelemetryPreset> = {
  coding: {
    missions: 10,
    success: 7,
    stepStarted: 64,
    stepCompleted: 52,
    memoryWritten: 16,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 6,
    handoffInteractions: 8,
  },
  creative: {
    missions: 10,
    success: 6,
    stepStarted: 52,
    stepCompleted: 41,
    memoryWritten: 23,
    banTriggered: 1,
    escalations: 3,
    challengeInteractions: 8,
    handoffInteractions: 7,
  },
  research: {
    missions: 10,
    success: 7,
    stepStarted: 58,
    stepCompleted: 46,
    memoryWritten: 26,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 9,
    handoffInteractions: 8,
  },
  operations: {
    missions: 10,
    success: 8,
    stepStarted: 60,
    stepCompleted: 51,
    memoryWritten: 14,
    banTriggered: 0,
    escalations: 2,
    challengeInteractions: 5,
    handoffInteractions: 9,
  },
  generalist: {
    missions: 10,
    success: 7,
    stepStarted: 56,
    stepCompleted: 45,
    memoryWritten: 18,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 7,
    handoffInteractions: 8,
  },
};

const SPECIALTY_TELEMETRY_RULES: Array<{
  pattern: RegExp;
  delta: SetupTelemetryDelta;
}> = [
  {
    pattern: /test|debug|quality|reliability|refactor|regression/i,
    delta: { success: 1, stepCompleted: 4, challengeInteractions: 1 },
  },
  {
    pattern: /security|hardening|policy|safe|compliance/i,
    delta: { escalations: 1, banTriggered: -1, success: 1 },
  },
  {
    pattern: /performance|latency|speed|throughput|optimization/i,
    delta: { stepStarted: 4, stepCompleted: 3, handoffInteractions: 1 },
  },
  {
    pattern: /api|architecture|design|typescript/i,
    delta: { stepStarted: 3, stepCompleted: 2, success: 1 },
  },
  {
    pattern: /story|brand|campaign|copy|visual|creative|community/i,
    delta: { memoryWritten: 3, challengeInteractions: 2, handoffInteractions: 2 },
  },
  {
    pattern: /research|analysis|source|synthesis|risk|memo|data/i,
    delta: { memoryWritten: 3, challengeInteractions: 1, escalations: -1, success: 1 },
  },
  {
    pattern: /incident|runbook|operations|deployment|cost/i,
    delta: { success: 1, handoffInteractions: 2, banTriggered: -1, escalations: 1 },
  },
];

const TEMPERAMENT_TELEMETRY_DELTA: Record<CreationTemperament, SetupTelemetryDelta> = {
  precision: { success: 1, escalations: 1, banTriggered: -1, stepCompleted: 2 },
  exploratory: { memoryWritten: 2, challengeInteractions: 2, success: -1, stepStarted: 2 },
  systemic: { handoffInteractions: 2, escalations: -1, stepCompleted: 2 },
  balanced: { success: 0, handoffInteractions: 1, challengeInteractions: 1 },
};

function applyTelemetryDelta(target: SetupTelemetryPreset, delta: SetupTelemetryDelta): SetupTelemetryPreset {
  const next = { ...target };
  const keys = Object.keys(delta) as Array<keyof SetupTelemetryPreset>;
  for (const key of keys) {
    const value = delta[key];
    if (typeof value !== "number") continue;
    next[key] = (next[key] || 0) + value;
  }
  return next;
}

function setupSeedDefaults(setup: AgentSetup): Omit<CreationCardSeedState, "hardBanCategories"> & { hardBanCategories: HardBanCategory[] } {
  switch (setup) {
    case "coding":
      return {
        domainFocus: "software implementation and regression-safe delivery",
        definitionOfDone: "Change compiles and passes checks.\nRollback path is documented.",
        escalationRules: "Production-impacting changes\nSecurity-sensitive operations",
        voiceStyle: "Technical, explicit, terse.",
        voiceRules: "Every response includes one concrete fact and one next action.\nState uncertainty before proposing risky actions.",
        voiceMicroBans: "No filler acknowledgements.\nNo fabricated metrics.",
        hardBanCategories: ["deploy", "data_exfil", "file_delete"],
      };
    case "creative":
      return {
        domainFocus: "creative campaigns and audience-facing narratives",
        definitionOfDone: "At least two viable directions are produced.\nRecommendation maps to objective + audience.",
        escalationRules: "Brand-sensitive claims\nExternal publishing actions",
        voiceStyle: "Expressive, concrete, and directional.",
        voiceRules: "Every response includes one concrete audience fact and one action.\nDefend one point of view with rationale.",
        voiceMicroBans: "No bland consensus language.\nNo unverifiable numeric claims.",
        hardBanCategories: ["publishing", "data_exfil"],
      };
    case "research":
      return {
        domainFocus: "evidence-backed research and decision support",
        definitionOfDone: "Claims are traceable to sources.\nTradeoffs and confidence are explicit.",
        escalationRules: "Low confidence conclusions\nConflicting critical evidence",
        voiceStyle: "Analytical, source-conscious, uncertainty-aware.",
        voiceRules: "Each response cites one concrete signal and one recommendation.\nExplicitly label confidence level.",
        voiceMicroBans: "No unsourced definitive statements.\nNo vague confidence language.",
        hardBanCategories: ["data_exfil"],
      };
    case "operations":
      return {
        domainFocus: "operational reliability, risk control, and safe execution",
        definitionOfDone: "Operational steps are explicit and reversible.\nSafety checks and rollback path are documented.",
        escalationRules: "Destructive operations\nSecurity or compliance impact",
        voiceStyle: "Operational, risk-aware, procedural.",
        voiceRules: "Include one operational signal and one concrete mitigation/action.\nSurface rollback options for risky actions.",
        voiceMicroBans: "No implicit assumptions about production safety.\nNo skipping guardrails.",
        hardBanCategories: ["deploy", "file_delete", "payments", "data_exfil"],
      };
    case "generalist":
    default:
      return {
        domainFocus: "cross-functional execution and team coordination",
        definitionOfDone: "Objective is complete with validation.\nRisks and handoff details are documented.",
        escalationRules: "Unclear requirements\nHigh-risk operations",
        voiceStyle: "Clear, pragmatic, balanced.",
        voiceRules: "Every response contains one fact and one action.\nEscalate when requirements are ambiguous.",
        voiceMicroBans: "No filler approvals.\nNo invented metrics.",
        hardBanCategories: ["publishing", "data_exfil"],
      };
  }
}

const BAN_CATEGORY_OPTIONS: Array<{
  category: HardBanCategory;
  label: string;
  description: string;
}> = [
  { category: "deploy", label: "Deploy", description: "No direct production deploys." },
  { category: "publishing", label: "Publishing", description: "No direct posting or publishing." },
  { category: "data_exfil", label: "Data Exfiltration", description: "No secret/data export outside policy." },
  { category: "file_delete", label: "Destructive Delete", description: "No destructive delete actions." },
  { category: "payments", label: "Payments", description: "No financial transaction actions." },
  { category: "email_send", label: "Email Send", description: "No outbound email sends." },
];

const BAN_CATEGORY_TEMPLATES: Record<
  HardBanCategory,
  Pick<RoleHardBan, "label" | "description" | "triggerPhrases" | "severity" | "enforcement">
> = {
  deploy: {
    label: "No direct production deploy",
    description: "Deploy actions require human approval.",
    triggerPhrases: ["deploy", "ship to prod", "rollout production"],
    severity: "critical",
    enforcement: "tool-block",
  },
  publishing: {
    label: "No direct publishing",
    description: "External publishing requires human sign-off.",
    triggerPhrases: ["publish", "post", "announce", "tweet"],
    severity: "critical",
    enforcement: "tool-block",
  },
  data_exfil: {
    label: "No data exfiltration",
    description: "Do not export sensitive datasets or secrets.",
    triggerPhrases: ["export all", "dump db", "exfiltrate", "leak"],
    severity: "critical",
    enforcement: "tool-block",
  },
  file_delete: {
    label: "No destructive file deletion",
    description: "Do not run destructive delete commands.",
    triggerPhrases: ["rm -rf", "truncate", "delete all"],
    severity: "critical",
    enforcement: "tool-block",
  },
  payments: {
    label: "No payment execution",
    description: "Payments require explicit human authorization.",
    triggerPhrases: ["pay", "wire", "invoice", "charge"],
    severity: "critical",
    enforcement: "tool-block",
  },
  email_send: {
    label: "No direct email send",
    description: "Outbound email requires review before send.",
    triggerPhrases: ["send email", "mail merge", "email blast"],
    severity: "critical",
    enforcement: "tool-block",
  },
  other: {
    label: "Restricted action",
    description: "Restricted behavior requiring escalation.",
    triggerPhrases: [],
    severity: "warning",
    enforcement: "prompt-only",
  },
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildHardBanSeeds(categories: HardBanCategory[]): RoleHardBan[] {
  return categories.map((category) => {
    const template = BAN_CATEGORY_TEMPLATES[category];
    return {
      id: `seed-${category}`,
      category,
      label: template.label,
      description: template.description,
      severity: template.severity,
      enforcement: template.enforcement,
      triggerPhrases: template.triggerPhrases,
    };
  });
}

function buildSeedTelemetryEvents(blueprint: CreationBlueprintState): CharacterTelemetryEvent[] {
  let base = { ...SETUP_TELEMETRY_BASELINE[blueprint.setup] };
  const specialtyCount = Math.max(1, blueprint.specialtySkills.length);

  base = applyTelemetryDelta(base, {
    stepStarted: specialtyCount * 2,
    stepCompleted: specialtyCount * 2,
    handoffInteractions: specialtyCount,
    challengeInteractions: Math.max(0, specialtyCount - 1),
    memoryWritten: Math.ceil(specialtyCount / 2),
  });

  for (const skill of blueprint.specialtySkills) {
    for (const rule of SPECIALTY_TELEMETRY_RULES) {
      if (rule.pattern.test(skill)) {
        base = applyTelemetryDelta(base, rule.delta);
      }
    }
  }

  base = applyTelemetryDelta(base, TEMPERAMENT_TELEMETRY_DELTA[blueprint.temperament]);

  const missions = Math.max(4, base.missions);
  const success = Math.min(missions, Math.max(1, base.success));
  const failures = Math.max(0, missions - success);
  const stepStarted = Math.max(1, base.stepStarted);
  const stepCompleted = Math.min(stepStarted, Math.max(1, base.stepCompleted));
  const memoryWritten = Math.max(0, base.memoryWritten);
  const banTriggered = Math.max(0, base.banTriggered);
  const escalations = Math.max(0, base.escalations);
  const challengeInteractions = Math.max(0, base.challengeInteractions);
  const handoffInteractions = Math.max(0, base.handoffInteractions);

  const events: CharacterTelemetryEvent[] = [];
  let offset = 0;
  const now = Date.now();
  const push = (
    type: CharacterTelemetryEvent["type"],
    payload: CharacterTelemetryEvent["payload"] = {},
  ) => {
    offset += 1;
    events.push({
      id: `seed-${offset}`,
      type,
      payload,
      timestamp: now - (10_000 - offset * 50),
    });
  };

  for (let i = 0; i < missions; i += 1) {
    push("mission_created", { source: "character_seed" });
  }
  for (let i = 0; i < success; i += 1) {
    push("mission_completed", { source: "character_seed" });
  }
  for (let i = 0; i < failures; i += 1) {
    push("mission_failed", { source: "character_seed" });
  }
  for (let i = 0; i < stepStarted; i += 1) {
    push("step_started", { source: "character_seed" });
  }
  for (let i = 0; i < stepCompleted; i += 1) {
    push("step_completed", { source: "character_seed" });
  }
  for (let i = 0; i < memoryWritten; i += 1) {
    push("memory_written", {
      source: "character_seed",
      memory_type: "lesson",
      confidence: 0.7,
    });
  }
  for (let i = 0; i < banTriggered; i += 1) {
    push("ban_triggered", {
      source: "character_seed",
      category: "other",
    });
  }
  for (let i = 0; i < escalations; i += 1) {
    push("escalation_requested", {
      source: "character_seed",
      reason: "seed-risk-check",
    });
  }
  for (let i = 0; i < challengeInteractions; i += 1) {
    push("interaction", {
      source: "character_seed",
      interaction_type: "challenge",
    });
  }
  for (let i = 0; i < handoffInteractions; i += 1) {
    push("interaction", {
      source: "character_seed",
      interaction_type: "handoff_success",
    });
  }

  return events;
}


export function CreateAgentForm({ 
  onCancel, 
  onShowForge,
  onComplete,
}: { 
  onCancel: () => void;
  onShowForge?: (agentName: string) => void;
  onComplete?: (createdAgent: Agent, workspaceCreated: boolean) => void;
}) {
  const { createAgent, isCreating, error, clearError, agents, recordCharacterTelemetry, setIsCreating } = useAgentStore();
  
  // Reset error and isCreating when form mounts
  useEffect(() => {
    clearError();
    const store = useAgentStore.getState();
    if (store.isCreating) {
      setIsCreating(false);
    }
  }, [clearError, setIsCreating]);
  
  const [formData, setFormData] = useState<CreateAgentInput>({
    name: '',
    description: '',
    type: 'worker',
    parentAgentId: undefined,
    model: 'gpt-4o',
    provider: 'openai',
    capabilities: [],
    systemPrompt: '',
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    voice: {
      voiceId: 'default',
      enabled: false,
    },
  });
  const [blueprint, setBlueprint] = useState<CreationBlueprintState>({
    setup: "coding",
    specialtySkills: CHARACTER_SPECIALTY_OPTIONS.coding.slice(0, 2),
    temperament: "precision",
  });
  const [cardSeed, setCardSeed] = useState<CreationCardSeedState>(setupSeedDefaults("coding"));
  const [activeStep, setActiveStep] = useState<CreateFlowStepId>("welcome");

  // Avatar state - Initialize avatar config - MUST be stable to prevent infinite loops
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => 
    createDefaultAvatarConfig("coding")
  );

  // UPGRADE: New Personality State
  const [personality, setPersonality] = useState({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  communicationStyle: 'direct' as const,
  workStyle: 'independent' as const,
  decisionMaking: 'data-driven' as const,
  });

  // UPGRADE: Wizard Persistence Setup
  const wizardConfig = useMemo(() => ({
  name: formData.name,
  description: formData.description,
  agentType: formData.type,
  model: formData.model,
  provider: formData.provider,
  characterConfig: {
    personality,
    blueprint,
    avatarConfig,
  },
  selectedTools: formData.tools,
  capabilities: formData.capabilities,
  systemPrompt: formData.systemPrompt,
  temperature: formData.temperature,
  maxIterations: formData.maxIterations,
  }), [formData, personality, blueprint, avatarConfig]);

  const {
  loadState,
  saveState,
  clearState,
  hasLocalStorage,
  saveStatus,
  browserCompatibility,
  } = useWizardPersistence(wizardConfig as any, 0, true);

  // Restore state on mount
  useEffect(() => {
  const restoredState = loadState();
  if (restoredState && restoredState.config) {
    const { config } = restoredState;
    setFormData(prev => ({
      ...prev,
      name: config.name || prev.name,
      description: config.description || prev.description,
      type: (config.agentType as any) || prev.type,
      model: config.model || prev.model,
      provider: (config.provider as any) || prev.provider,
      tools: config.selectedTools || prev.tools,
      capabilities: config.capabilities || prev.capabilities,
      systemPrompt: config.systemPrompt || prev.systemPrompt,
      temperature: config.temperature ?? prev.temperature,
      maxIterations: config.maxIterations ?? prev.maxIterations,
    }));
    if (config.characterConfig) {
      const charConfig = config.characterConfig as any;
      if (charConfig.personality) setPersonality(charConfig.personality);
      if (charConfig.blueprint) setBlueprint(charConfig.blueprint);
      if (charConfig.avatarConfig) setAvatarConfig(charConfig.avatarConfig);
    }  }
  }, []);

  // UPGRADE: Template application effect
  useEffect(() => {
    const templateJson = sessionStorage.getItem('agentTemplate');
    if (templateJson) {
      try {
        const template: AgentTemplate = JSON.parse(templateJson);
        sessionStorage.removeItem('agentTemplate');
        
        console.log('[CreateAgentForm] Applying template:', template.id);
        
        // Advance to identity step automatically
        setActiveStep('identity');

        // Update basic form data
        setFormData(prev => ({
          ...prev,
          name: template.name,
          description: template.description,
          type: 'worker',
          setup: template.setup,
          capabilities: template.capabilities,
          systemPrompt: template.systemPrompt,
          color: template.color
        }));
        
        // Update blueprint
        setBlueprint({
          setup: template.setup,
          specialtySkills: template.capabilities.slice(0, 4),
          temperament: 'balanced'
        });
        
        // Update character seed
        setCardSeed(setupSeedDefaults(template.setup));
        
        // Update Avatar Config & Store
        if (template.mascotTemplate) {
          const newAvatarConfig = {
            ...createDefaultAvatarConfig(template.setup),
            mascotTemplate: template.mascotTemplate,
            colors: {
              primary: template.avatarColors?.primary || template.color,
              secondary: template.avatarColors?.secondary || '#60A5FA',
              glow: template.avatarColors?.glow || '#93C5FD',
              outline: 'rgba(0,0,0,0.5)'
            }
          } as any;
          
          setAvatarConfig(newAvatarConfig);
          
          // Force update the avatar store immediately
          const avatarStore = useAvatarCreatorStore.getState();
          avatarStore.setConfig(newAvatarConfig);
          avatarStore.setAgentContext(template.setup, 'balanced');
        }
      } catch (e) {
        console.error('Failed to apply agent template:', e);
      }
    }
  }, []);

  // Use a ref to track if the last change was from the store to avoid loops
  const lastUpdateFromStoreRef = useRef(false);

  // Sync local avatarConfig with Avatar Store
  useEffect(() => {
    if (avatarConfig && !lastUpdateFromStoreRef.current) {
      const store = useAvatarCreatorStore.getState();
      const currentStoreMascot = (store.currentConfig as any).mascotTemplate;
      const localMascot = (avatarConfig as any).mascotTemplate;
      
      if (localMascot !== currentStoreMascot) {
        console.log('[CreateAgentForm] Updating store from local config:', localMascot);
        store.setConfig(avatarConfig);
      }
    }
    lastUpdateFromStoreRef.current = false;
  }, [avatarConfig]);

  // UPGRADE: Enhanced State Variables
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(true);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiCapabilities, setApiCapabilities] = useState<any[]>([]);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isForgeQueued, setIsForgeQueued] = useState(false);
  const [workspaceWarning, setWorkspaceWarning] = useState<string | null>(null);

  // Voice presets state
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch real models and capabilities
  useEffect(() => {
  async function fetchData() {
    try {
      const [providersRes, capabilitiesRes] = await Promise.all([
        fetch(`${GATEWAY_URL}/api/v1/providers`),
        fetch(`${GATEWAY_URL}/api/v1/capabilities`)
      ]);


      if (modelsRes.ok) {
        const data = await modelsRes.json();
        const allModels: any[] = [];
        if (data.providers) {
          Object.entries(data.providers).forEach(([pId, p]: [string, any]) => {
            if (p.models) {
              p.models.forEach((m: any) => allModels.push({ id: m.id, name: m.name || m.id, provider: pId }));
            }
          });
        }
        setApiModels(allModels);
      }

      if (capsRes.ok) {
        const data = await capsRes.json();
        setApiCapabilities(data.capabilities || []);
      }
    } catch (err) {
      console.error('Failed to fetch enhanced data:', err);
    } finally {
      setIsModelsLoading(false);
      setIsCapabilitiesLoading(false);
    }
  }
  fetchData();
  }, []);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  // Workspace layer configuration
  const [workspaceLayers, setWorkspaceLayers] = useState<WorkspaceLayerConfig>(DEFAULT_LAYER_CONFIG);

  // Fetch voices on mount
  useEffect(() => {
    setVoiceLoading(true);
    voiceService
      .listVoices()
      .then((v) => setVoices(v))
      .finally(() => setVoiceLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.remove();
      }
    };
  }, [previewAudio]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[blueprint.setup],
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If not on review step, just go to next step (form submit acts as "Next")
    if (activeStep !== "review") {
      if (!stepValidation[activeStep]) {
        console.log('[CreateAgentForm] Step validation failed for:', activeStep);
        return;
      }
      const nextStep = CREATE_FLOW_STEPS[activeStepIndex + 1];
      if (nextStep) {
        console.log('[CreateAgentForm] Advancing to step:', nextStep.id);
        setActiveStep(nextStep.id);
      }
      return;
    }
    
    console.log('[CreateAgentForm] Submitting from review step');
    
    // SAFETY: Check we're ready and not already creating
    if (!isReadyForCreate) {
      console.log('[CreateAgentForm] Not ready for creation');
      return;
    }

    if (isForgeQueued || isCreating) {
      return;
    }

    // Check for plugin conflicts
    const pluginConflicts = detectPluginConflicts(formData.tools || []);
    if (pluginConflicts.hasConflict && pluginConflicts.severity === 'error') {
      console.warn('[CreateAgentForm] Submission blocked: plugin conflicts detected', pluginConflicts.conflicts);
      setSubmitStatus({ type: 'error', message: `Plugin conflicts detected: ${pluginConflicts.conflicts.join(', ')}` });
      return;
    }

    const definitionOfDone = splitLines(cardSeed.definitionOfDone);
    const escalation = splitLines(cardSeed.escalationRules);
    const voiceRules = splitLines(cardSeed.voiceRules);
    const voiceMicroBans = splitLines(cardSeed.voiceMicroBans);
    const domainFocus = cardSeed.domainFocus.trim();

    const payload: CreateAgentInput = {
      ...formData,
      config: {
        ...(formData.config || {}),
        personality,
        character: {
          setup: blueprint.setup,
          specialtySkills: blueprint.specialtySkills,
          temperament: blueprint.temperament,
          hardBans: (formData.config as any)?.hardBans || [],
          domain: domainFocus,
          definitionOfDone,
          escalation,
        },
        voice: {
          style: cardSeed.voiceStyle.trim(),
          rules: voiceRules,
          microBans: voiceMicroBans,
          tone: {
            formality: 0.5,
            enthusiasm: 0.5,
            empathy: 0.5,
            directness: 0.5
          }
        },
        workspaceLayers,
      },
      avatar: avatarConfig,
    };
    
    console.log('[CreateAgentForm] Creating agent with enhanced payload:', { 
      name: payload.name, 
      type: payload.type,
      activeStep 
    });
    
    // Show forge animation FIRST, then create agent after animation completes
    setWorkspaceWarning(null);
    setSubmitStatus(null);
    setIsForgeQueued(true);
    onShowForge?.(formData.name || 'Your Agent');
    
    // Delay agent creation to let animation play (6 seconds)
    window.setTimeout(async () => {
      let createdAgent: Agent | null = null;
      let workspaceCreated = false;
      try {
        console.log('[CreateAgentForm] Calling createAgent via API...');
        
        // 1. Create the agent in the backend
        const agentResponse = await api.post('/api/v1/agents', {
          name: payload.name,
          description: payload.description,
          agent_type: payload.type,
          model: payload.model,
          provider: payload.provider,
          capabilities: payload.capabilities,
          system_prompt: payload.systemPrompt,
          tools: payload.tools,
          max_iterations: payload.maxIterations,
          temperature: payload.temperature,
          config: payload.config,
        }) as any;

        if (!agentResponse.ok) {
          throw new Error(agentResponse.error || 'Failed to create agent via API');
        }

        createdAgent = {
          id: agentResponse.data.id || `agent-${Date.now()}`,
          ...payload,
          status: 'idle',
          createdAt: Date.now().toString(),
          updatedAt: Date.now().toString(),
        } as unknown as Agent;
        
        // Also update local store for UI purposes if needed
        await createAgent(payload);
        
        // 2. Create agent workspace
        try {
          const workspaceDocs = generateEnhancedWorkspaceDocuments(payload.config, {
            name: payload.name,
            description: payload.description,
            model: payload.model,
            provider: payload.provider
          });
          
          const workspaceResponse = await api.post(`/api/v1/agents/${createdAgent.id}/workspace/initialize`, {
            documents: workspaceDocs,
          }) as any;
          
          if (!workspaceResponse.ok) {
            console.warn('[CreateAgentForm] Workspace initialization via API failed:', workspaceResponse.error);
          }

          await agentWorkspaceService.create({
            ...payload,
            avatar: avatarConfig,
          }, 'a2r-standard', undefined, workspaceLayers);
          workspaceCreated = true;
        } catch (workspaceError) {
          console.error('[CreateAgentForm] Workspace creation failed:', workspaceError);
          setWorkspaceWarning("Agent created, but workspace initialization failed.");
        }
        
        const seededTelemetry = buildSeedTelemetryEvents(blueprint);
        for (const event of seededTelemetry) {
          recordCharacterTelemetry(createdAgent.id, {
            type: event.type,
            runId: event.runId,
            payload: event.payload,
          });
        }
        
        setSubmitStatus({ type: 'success', message: 'Agent created successfully!' });
        setTimeout(() => setSubmitStatus(null), 3000);

        onComplete?.(createdAgent, workspaceCreated);
      } catch (e) {
        console.error('[CreateAgentForm] Failed to create agent:', e);
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        setSubmitStatus({ type: 'error', message: `Failed to create agent: ${errorMsg}` });
        setWorkspaceWarning(`Failed to create agent: ${errorMsg}`);
      } finally {
        setIsForgeQueued(false);
      }
    }, 6000);
  };

  const toggleCapability = (capId: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities?.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...(prev.capabilities || []), capId]
    }));
  };

  const toggleSpecialty = (skill: string) => {
    setBlueprint((prev) => {
      const selected = prev.specialtySkills.includes(skill);
      const nextSkills = selected
        ? prev.specialtySkills.filter((s) => s !== skill)
        : [...prev.specialtySkills, skill].slice(0, 4);
      return {
        ...prev,
        specialtySkills: nextSkills,
      };
    });
  };

  const applySetupDefaults = (setup: AgentSetup) => {
    setBlueprint((prev) => {
      const fallbackTemperament: Record<AgentSetup, CreationTemperament> = {
        coding: "precision",
        creative: "exploratory",
        research: "systemic",
        operations: "precision",
        generalist: "balanced",
      };
      return {
        setup,
        specialtySkills: CHARACTER_SPECIALTY_OPTIONS[setup].slice(0, 2),
        temperament: fallbackTemperament[setup],
      };
    });
    setCardSeed(setupSeedDefaults(setup));
    setFormData((prev) => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[setup],
    }));
  };

  const handleVoicePreview = async () => {
    if (!formData.voice?.voiceId || !formData.voice?.enabled) return;
    
    // Stop any playing audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.remove();
    }
    
    const previewText = `Hello, I'm ${formData.name || 'your AI assistant'}. How can I help you today?`;
    const audioUrl = await voiceService.previewVoice(formData.voice.voiceId, previewText);
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      setPreviewAudio(audio);
      setIsPlaying(true);
      audio.play();
    }
  };

  const orchestrators = agents.filter(a => a.type === 'orchestrator');
  const setupStatDefinitions = useMemo(
    () => getSetupStatDefinitions(blueprint.setup),
    [blueprint.setup],
  );
  const activeStepIndex = useMemo(
    () => CREATE_FLOW_STEPS.findIndex((step) => step.id === activeStep),
    [activeStep],
  );
  const previewCharacterConfig = useMemo(
    () =>
      getDefaultCharacterLayer(
      "preview",
      formData.name.trim() || "Preview Agent",
      blueprint,
    ),
    [blueprint, formData.name],
  );
  const projectedStats = useMemo<CharacterStats>(
    () => computeCharacterStats(previewCharacterConfig, buildSeedTelemetryEvents(blueprint)),
    [blueprint, previewCharacterConfig],
  );
  const projectedFormulaByKey = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(previewCharacterConfig.progression.stats).map(([key, rule]) => [key, (rule as any).formula]),
      ) as Record<string, string>,
    [previewCharacterConfig],
  );
  const projectedStatEntries = useMemo(() => {
    return projectedStats.relevantStats
      .map((key) => ({
        key,
        value: projectedStats.stats[key] ?? 0,
        definition: setupStatDefinitions.find((definition) => definition.key === key) || null,
      }))
      .filter((entry) => entry.definition);
  }, [projectedStats, setupStatDefinitions]);
  const setupMeta =
    CHARACTER_SETUPS.find((setup) => setup.id === blueprint.setup) || null;
  const selectedTypeMeta = AGENT_TYPES.find((type) => type.id === formData.type) || null;
  const identityComplete = Boolean(
    formData.name.trim() &&
      formData.description.trim() &&
      (formData.type !== "sub-agent" || formData.parentAgentId),
  );
  const characterComplete = Boolean(
    blueprint.specialtySkills.length > 0 &&
      cardSeed.hardBanCategories.length > 0 &&
      cardSeed.domainFocus.trim() &&
      splitLines(cardSeed.definitionOfDone).length > 0 &&
      splitLines(cardSeed.escalationRules).length > 0 &&
      cardSeed.voiceStyle.trim() &&
      splitLines(cardSeed.voiceRules).length > 0,
  );
  const runtimeComplete = Boolean(
    formData.model &&
      formData.provider &&
      (formData.capabilities?.length || 0) > 0 &&
      (formData.maxIterations || 0) > 0,
  );
  const personalityComplete = true; // Personality sliders are optional but shown
  const avatarComplete = true; // Avatar is optional
  const workspaceComplete = true; // Workspace layers always have valid default
  
  const stepValidation: Record<CreateFlowStepId, boolean> = {
    welcome: true,
    identity: identityComplete,
    personality: personalityComplete,
    character: characterComplete,
    avatar: avatarComplete,
    runtime: runtimeComplete,
    workspace: workspaceComplete,
    review: identityComplete && characterComplete && runtimeComplete,
  };
  const isReadyForCreate = stepValidation.review;
  const currentStepDescription =
    CREATE_FLOW_STEPS.find((step) => step.id === activeStep)?.description || "";
  const goToPreviousStep = () => {
    if (activeStepIndex <= 0) return;
    setActiveStep(CREATE_FLOW_STEPS[activeStepIndex - 1].id);
  };
  const goToNextStep = () => {
    if (!stepValidation[activeStep]) return;
    const nextStep = CREATE_FLOW_STEPS[activeStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };
  const canJumpToStep = (targetStepId: CreateFlowStepId) => {
    const targetIndex = CREATE_FLOW_STEPS.findIndex((step) => step.id === targetStepId);
    if (targetIndex <= activeStepIndex) return true;
    return CREATE_FLOW_STEPS.slice(0, targetIndex).every((step) => stepValidation[step.id]);
  };

  // Get icon for agent type
  const getTypeIcon = (typeId: string) => {
    switch (typeId) {
      case 'orchestrator': return <Network style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      case 'worker': return <Cog style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      default: return <Bot style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
    }
  };

  // Common styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100vh',
    padding: '24px',
    overflow: 'auto',
    background: 'transparent',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 500,
    color: STUDIO_THEME.textPrimary,
    margin: 0,
    fontFamily: 'Georgia, serif',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: STUDIO_THEME.textSecondary,
    margin: '4px 0 0 0',
  };

  const sectionStyle = (isSelected: boolean, isCompleted: boolean): React.CSSProperties => ({
    borderRadius: '8px',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : isCompleted ? `${STUDIO_THEME.accent}60` : STUDIO_THEME.borderSubtle}`,
    padding: '12px',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    background: isSelected ? `${STUDIO_THEME.accent}15` : isCompleted ? `${STUDIO_THEME.accent}08` : STUDIO_THEME.bgCard,
    cursor: 'pointer',
    opacity: 1,
  });

  const stepLabelStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 500,
    color: isSelected ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary,
  });

  const stepDescriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: STUDIO_THEME.textMuted,
    marginTop: '4px',
  };

  const formSectionStyle: React.CSSProperties = {
    borderRadius: '12px',
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    background: STUDIO_THEME.bgCard,
    padding: '24px',
    marginBottom: '24px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: STUDIO_THEME.textPrimary,
    margin: '0 0 16px 0',
    fontFamily: 'Georgia, serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: STUDIO_THEME.textSecondary,
    margin: '0 0 20px 0',
  };

  const inputLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: STUDIO_THEME.textPrimary,
    marginBottom: '8px',
    display: 'block',
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  };

  const typeCardStyle = (isSelected: boolean): React.CSSProperties => ({
    borderRadius: '10px',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
    padding: '16px',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    background: isSelected ? `${STUDIO_THEME.accent}10` : 'transparent',
    cursor: 'pointer',
  });

  const badgeStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
    background: isSelected ? `${STUDIO_THEME.accent}20` : 'transparent',
    color: isSelected ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
    transition: 'all 0.2s ease',
  });

  const stickyFooterStyle: React.CSSProperties = {
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: `${STUDIO_THEME.bg}f0`,
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    marginTop: '24px',
    gap: '12px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
    color: '#1A1612',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    background: 'transparent',
    color: STUDIO_THEME.textPrimary,
    fontSize: '14px',
    fontWeight: 500,
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    cursor: 'pointer',
  };

  const alertErrorStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const alertWarningStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    color: '#fbbf24',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const isBusy = isCreating || isForgeQueued;

  return (
    <div style={containerStyle}>
      {/* Submit Status Overlay */}
      {submitStatus && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5000,
          padding: '16px 24px',
          borderRadius: '12px',
          background: submitStatus.type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${submitStatus.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {submitStatus.type === 'success' ? <CheckCircle style={{ width: 20, height: 20 }} /> : <AlertCircle style={{ width: 20, height: 20 }} />}
          <span style={{ fontWeight: 500 }}>{submitStatus.message}</span>
        </div>
      )}

      <div style={headerStyle}>
        {/* Centered Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={titleStyle}>Create New Agent</h1>
          <p style={subtitleStyle}>Configure your AI agent with voice, type, and capabilities</p>
        </div>
      </div>

      {error && (
        <div style={alertErrorStyle}>
          <AlertCircle style={{ width: 16, height: 16 }} />
          <span>{error}</span>
        </div>
      )}
      {workspaceWarning && (
        <div style={alertWarningStyle}>
          <AlertCircle style={{ width: 16, height: 16 }} />
          <span>{workspaceWarning}</span>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <BrowserCompatibilityWarningComponent 
          compatibility={browserCompatibility} 
          onDismiss={() => {}} 
        />
        <DuplicateNameWarning agentName={formData.name} />
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '900px', margin: '0 auto', flex: 1, minHeight: 0 }}>
        {/* Step Navigation */}
        <div style={formSectionStyle}>
          <div style={cardGridStyle}>
            {CREATE_FLOW_STEPS.map((step, idx) => {
              const selected = step.id === activeStep;
              const completed = idx < activeStepIndex && stepValidation[step.id];
              const unlocked = canJumpToStep(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    if (unlocked) setActiveStep(step.id);
                  }}
                  style={{
                    ...sectionStyle(selected, completed),
                    opacity: unlocked ? 1 : 0.5,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={stepLabelStyle(selected)}>{step.label}</span>
                    {selected || completed ? (
                      <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />
                    ) : (
                      <Circle style={{ width: 16, height: 16, color: STUDIO_THEME.textMuted }} />
                    )}
                  </div>
                  <p style={stepDescriptionStyle}>{step.description}</p>
                </button>
              );
            })}
          </div>
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
            fontSize: '12px',
            color: STUDIO_THEME.textSecondary,
          }}>
            Step {activeStepIndex + 1} of {CREATE_FLOW_STEPS.length}: {currentStepDescription}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
        {/* WELCOME STEP */}
        {activeStep === "welcome" && (
          <section style={{ padding: '40px 0', position: 'relative', overflow: 'hidden' }}>
            {/* Animated Background Particles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`particle-${i}`}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: `${STUDIO_THEME.accent}30`,
                    left: `${20 + i * 15}%`,
                    top: `${60 + (i % 3) * 10}%`,
                  }}
                  initial={{ 
                    x: Math.random() * 800 - 400, 
                    y: Math.random() * 600 - 300,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: [null, -100, -200],
                    opacity: [0, 0.6, 0],
                    scale: [0.5, 1.5, 0.5]
                  }}
                  transition={{ 
                    duration: 4 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut"
                  }}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
              {/* Animated Icon with Orbiting Elements */}
              <div style={{ position: 'relative', width: 128, height: 128, margin: '0 auto 32px' }}>
                {/* Orbiting dots */}
                <motion.div
                  style={{ position: 'absolute', inset: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: 12,
                    height: 12,
                    background: STUDIO_THEME.accent,
                    borderRadius: '50%',
                    boxShadow: `0 0 10px ${STUDIO_THEME.accent}80`,
                  }} />
                </motion.div>
                <motion.div
                  style={{ position: 'absolute', inset: 8 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                >
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: 8,
                    height: 8,
                    background: '#B08D6E',
                    borderRadius: '50%',
                    boxShadow: '0 0 10px rgba(176, 141, 110, 0.8)',
                  }} />
                </motion.div>
                
                {/* Main Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    duration: 0.8 
                  }}
                  style={{
                    width: 96,
                    height: 96,
                    margin: '0 auto',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${STUDIO_THEME.accent}, #B08D6E)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 40px ${STUDIO_THEME.accent}40`,
                  }}
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Bot style={{ width: 48, height: 48, color: '#fff' }} />
                  </motion.div>
                </motion.div>
              </div>

              {/* Title with staggered animation */}
              <div style={{ marginBottom: '24px' }}>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{
                    fontSize: '36px',
                    fontWeight: 500,
                    fontFamily: 'Georgia, serif',
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 12px 0',
                  }}
                >
                  <span style={{
                    background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    Create Your AI Agent
                  </span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  style={{
                    fontSize: '16px',
                    color: STUDIO_THEME.textSecondary,
                    maxWidth: '480px',
                    margin: '0 auto',
                    lineHeight: 1.6,
                  }}
                >
                  Build intelligent agents that automate tasks, make decisions, and collaborate with your team.
                </motion.p>
              </div>
            </div>

            {/* Feature Cards with Stagger Animation */}
            <motion.div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                maxWidth: '800px',
                margin: '0 auto 32px',
                position: 'relative',
                zIndex: 10,
              }}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.15,
                    delayChildren: 0.6
                  }
                }
              }}
            >
              {[
                { 
                  icon: Sparkles, 
                  title: "Define Personality", 
                  desc: "Configure creativity, verbosity, and temperament to match your workflow." 
                },
                { 
                  icon: Settings, 
                  title: "Equip Tools", 
                  desc: "Grant capabilities like code generation, web search, and file operations." 
                },
                { 
                  icon: Network, 
                  title: "Deploy & Monitor", 
                  desc: "Launch your agent and track progress through checkpoints and telemetry." 
                }
              ].map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={{
                    hidden: { opacity: 0, y: 30, scale: 0.9 },
                    visible: { 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      transition: { type: "spring", stiffness: 200, damping: 20 }
                    }
                  }}
                  whileHover={{ 
                    scale: 1.03, 
                    y: -5,
                    transition: { duration: 0.2 }
                  }}
                  style={{
                    padding: '24px',
                    borderRadius: '12px',
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    background: STUDIO_THEME.bgCard,
                    cursor: 'pointer',
                  }}
                >
                  <motion.div 
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `${STUDIO_THEME.accent}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                    }}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon style={{ width: 24, height: 24, color: STUDIO_THEME.accent }} />
                  </motion.div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 8px 0',
                  }}>{feature.title}</h3>
                  <p style={{
                    fontSize: '13px',
                    color: STUDIO_THEME.textSecondary,
                    lineHeight: 1.5,
                    margin: 0,
                  }}>
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button with enhanced animation */}
            <motion.div 
              style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={goToNextStep}
                style={{
                  ...primaryButtonStyle,
                  padding: '14px 32px',
                  fontSize: '16px',
                }}
              >
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  Get Started
                </motion.span>
                <motion.span
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </motion.button>
            </motion.div>

            {/* Progress indicator */}
            <motion.div 
              style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '24px', position: 'relative', zIndex: 10 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={`dot-${i}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === 0 ? STUDIO_THEME.accent : `${STUDIO_THEME.accent}40`,
                  }}
                  animate={{ 
                    scale: i === 0 ? [1, 1.3, 1] : 1,
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          </section>
        )}

        {/* IDENTITY STEP */}
        {activeStep === "identity" && (
          <section style={formSectionStyle}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Agent Identity
              </h2>
              <p style={sectionSubtitleStyle}>
                Define the ownership boundary and runtime role for this agent.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={inputLabelStyle}>Agent Name</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Code Review Sentinel"
                required
                style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={inputLabelStyle}>Description</label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this agent owns and what it should deliver."
                required
                style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  minHeight: '80px',
                }}
              />
            </div>

            <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
                margin: '0 0 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Network style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                Agent Type
              </h3>
              <div style={cardGridStyle}>
                {AGENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    style={typeCardStyle(formData.type === type.id)}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type: type.id,
                        parentAgentId: type.id === "sub-agent" ? prev.parentAgentId : undefined,
                      }))
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {getTypeIcon(type.id)}
                      <span style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{type.name}</span>
                      {formData.type === type.id && (
                        <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent, marginLeft: 'auto' }} />
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: 0 }}>{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.type === "sub-agent" && (
              <div style={{ marginTop: '20px' }}>
                <label style={inputLabelStyle}>Parent Orchestrator</label>
                <Select
                  value={formData.parentAgentId || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, parentAgentId: value || undefined }))
                  }
                >
                  <SelectTrigger style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}>
                    <SelectValue
                      placeholder={
                        orchestrators.length === 0
                          ? "No orchestrators available"
                          : "Select parent orchestrator"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    {orchestrators.map((orch) => (
                      <SelectItem key={orch.id} value={orch.id}>
                        {orch.name}
                      </SelectItem>
                    ))}
                    {orchestrators.length === 0 && (
                      <SelectItem value="none" disabled>
                        Create an orchestrator first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {orchestrators.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '8px' }}>
                    You need an orchestrator before creating a sub-agent.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* PERSONALITY STEP */}
        {activeStep === "personality" && (
          <section style={formSectionStyle}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Personality Profile
              </h2>
              <p style={sectionSubtitleStyle}>
                Define your agent&apos;s personality and operational style using the Big Five model.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              {/* Big Five Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Big Five Traits</h3>
                
                {[
                  { id: 'openness', label: 'Openness', low: 'Conventional', high: 'Inventive' },
                  { id: 'conscientiousness', label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized' },
                  { id: 'extraversion', label: 'Extraversion', low: 'Reserved', high: 'Outgoing' },
                  { id: 'agreeableness', label: 'Agreeableness', low: 'Critical', high: 'Cooperative' }
                ].map((trait) => (
                  <div key={trait.id} style={{ background: STUDIO_THEME.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <Label style={{ color: STUDIO_THEME.textPrimary }}>{trait.label}</Label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: STUDIO_THEME.accent, background: `${STUDIO_THEME.accent}20`, padding: '2px 8px', borderRadius: '6px' }}>
                        {personality[trait.id as keyof typeof personality] as number}%
                      </span>
                    </div>
                    <Slider
                      value={[personality[trait.id as keyof typeof personality] as number]}
                      onValueChange={([value]) => setPersonality(prev => ({ ...prev, [trait.id]: value }))}
                      min={0}
                      max={100}
                      step={1}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{trait.low}</span>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{trait.high}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Working Styles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Operational Style</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Communication Style</Label>
                  <Select
                    value={personality.communicationStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, communicationStyle: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="direct">Direct & Concise</SelectItem>
                      <SelectItem value="analytical">Analytical & Detailed</SelectItem>
                      <SelectItem value="collaborative">Cooperative & Supportive</SelectItem>
                      <SelectItem value="creative">Expressive & Imaginative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Work Style</Label>
                  <Select
                    value={personality.workStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, workStyle: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="independent">Independent Autonomous</SelectItem>
                      <SelectItem value="collaborative">Team-Oriented</SelectItem>
                      <SelectItem value="guided">Requires Supervision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Decision Making</Label>
                  <Select
                    value={personality.decisionMaking}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, decisionMaking: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="data-driven">Data-Driven & Logical</SelectItem>
                      <SelectItem value="intuitive">Intuitive & Fast</SelectItem>
                      <SelectItem value="consensus">Consensus-Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Personality Traits</Label>
                  <TagInput
                    tags={(formData.config as any)?.personalityTraits || []}
                    onChange={(tags: string[]) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), personalityTraits: tags } }))}
                    placeholder="Add traits (e.g. Stoic, Sarcastic, Highly Technical)..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Backstory & Context</Label>
                  <Textarea
                    value={(formData.config as any)?.backstory || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), backstory: e.target.value } }))}
                    placeholder="Provide background context that shapes this agent's behavior..."
                    rows={4}
                    style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CHARACTER STEP */}
        {activeStep === "character" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Character Profile
                </h2>
                <p style={sectionSubtitleStyle}>
                  Choose setup and specialties. Stats and level are projected from measurable telemetry signals.
                </p>
              </div>

              <div style={cardGridStyle}>
                {CHARACTER_SETUPS.map((setup) => (
                  <button
                    key={setup.id}
                    type="button"
                    style={typeCardStyle(blueprint.setup === setup.id)}
                    onClick={() => applySetupDefaults(setup.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{setup.label}</span>
                      {blueprint.setup === setup.id && <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />}
                    </div>
                    <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: '0 0 8px 0' }}>{setup.description}</p>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${STUDIO_THEME.accent}15`,
                      color: STUDIO_THEME.accent,
                    }}>
                      class: {setup.className}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={formSectionStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Operational Boundaries (Hard Bans)</h3>
              <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>Define critical restrictions for this agent.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
                {Object.entries(ENHANCED_HARD_BAN_CATEGORIES).map(([key, ban]) => {
                  const isSelected = (formData.config as any)?.hardBans?.some((b: any) => b.category === key);
                  const Icon = ban.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const config = (prev.config as any) || {};
                          const hardBans = config.hardBans || [];
                          const exists = hardBans.find((b: any) => b.category === key);
                          const nextBans = exists 
                            ? hardBans.filter((b: any) => b.category !== key)
                            : [...hardBans, { category: key, severity: ban.severity }];
                          return { ...prev, config: { ...config, hardBans: nextBans } };
                        });
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'rgba(239, 68, 68, 0.1)' : STUDIO_THEME.bg,
                        border: `1px solid ${isSelected ? '#ef4444' : STUDIO_THEME.borderSubtle}`,
                      }}
                    >
                      <div style={{ padding: '8px', borderRadius: '8px', background: isSelected ? '#ef444420' : 'rgba(255,255,255,0.05)' }}>
                        <Icon size={18} style={{ color: isSelected ? '#ef4444' : STUDIO_THEME.textSecondary }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: isSelected ? '#ef4444' : STUDIO_THEME.textPrimary, fontSize: '14px' }}>{ban.label}</div>
                        <div style={{ fontSize: '11px', color: STUDIO_THEME.textMuted, marginTop: '2px' }}>{ban.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={formSectionStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Specialties & Domain</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <Label style={{ color: STUDIO_THEME.textPrimary, marginBottom: '8px', display: 'block' }}>Domain Focus</Label>
                    <Input
                      value={cardSeed.domainFocus}
                      onChange={(e) => setCardSeed(prev => ({ ...prev, domainFocus: e.target.value }))}
                      placeholder="e.g. Frontend Architecture, Security Audit"
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Label style={{ color: STUDIO_THEME.textPrimary }}>Specialty Skills</Label>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{blueprint.specialtySkills.length}/4</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {getSpecialtyOptions(blueprint.setup).map((skill) => {
                        const selected = blueprint.specialtySkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSpecialty(skill)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              background: selected ? `${STUDIO_THEME.accent}20` : STUDIO_THEME.bg,
                              color: selected ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
                              border: `1px solid ${selected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                            }}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label style={{ color: STUDIO_THEME.textPrimary, marginBottom: '8px', display: 'block' }}>Escalation Triggers</Label>
                    <TagInput
                      tags={splitLines(cardSeed.escalationRules)}
                      onChange={(tags: string[]) => setCardSeed(prev => ({ ...prev, escalationRules: tags.join('\n') }))}
                      placeholder="Add triggers..."
                    />
                  </div>
                </div>
              </div>

              <div style={formSectionStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Projected Level</h3>
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 12px 0' }}>Based on setup baseline + specialties.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Class</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textPrimary,
                    }}>
                      {projectedStats.class}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Level</span>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>Lv {projectedStats.level}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>XP</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{projectedStats.xp.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                      <div key={skill} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        fontSize: '12px',
                      }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>{skill}</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{projectedStats.specialtyScores[skill] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={formSectionStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Measured Setup Stats</h3>
              <div style={cardGridStyle}>
                {setupStatDefinitions.map((definition) => {
                  const value = projectedStats.stats[definition.key] ?? 0;
                  return (
                    <div key={definition.key} style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      background: STUDIO_THEME.bg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: STUDIO_THEME.textPrimary }}>{definition.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textSecondary,
                          }}>
                            {definition.key}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: STUDIO_THEME.accent }}>{value}</span>
                        </div>
                      </div>
                      <div style={{
                        height: 6,
                        borderRadius: '3px',
                        background: STUDIO_THEME.bgCard,
                        overflow: 'hidden',
                      }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '3px',
                            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                            width: `${Math.max(4, value)}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: STUDIO_THEME.textSecondary, margin: '8px 0 0 0' }}>{definition.description}</p>
                      <p style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, margin: '4px 0 0 0' }}>
                        Signals: {definition.signals.join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={formSectionStyle}>
                <label style={inputLabelStyle}>Temperament</label>
                <Select
                  value={blueprint.temperament}
                  onValueChange={(value) =>
                    setBlueprint((prev) => ({ ...prev, temperament: value as CreationTemperament }))
                  }
                >
                  <SelectTrigger style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    <SelectItem value="precision">precision</SelectItem>
                    <SelectItem value="exploratory">exploratory</SelectItem>
                    <SelectItem value="systemic">systemic</SelectItem>
                    <SelectItem value="balanced">balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={formSectionStyle}>
                <label style={inputLabelStyle}>Setup Capabilities</label>
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  fontSize: '13px',
                  color: STUDIO_THEME.textSecondary,
                  background: STUDIO_THEME.bg,
                }}>
                  {SETUP_CAPABILITY_PRESETS[blueprint.setup].join(", ")}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: STUDIO_THEME.borderSubtle }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Role Domain Focus</label>
                <Input
                  value={cardSeed.domainFocus}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, domainFocus: e.target.value }))}
                  placeholder="Domain ownership boundary"
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Voice Style</label>
                <Input
                  value={cardSeed.voiceStyle}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceStyle: e.target.value }))}
                  placeholder="Technical, direct, skeptical..."
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Definition of Done (one per line)</label>
                <Textarea
                  value={cardSeed.definitionOfDone}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, definitionOfDone: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Escalation Triggers (one per line)</label>
                <Textarea
                  value={cardSeed.escalationRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, escalationRules: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Voice Rules (one per line)</label>
                <Textarea
                  value={cardSeed.voiceRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceRules: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Voice Micro-Bans (one per line)</label>
                <Textarea
                  value={cardSeed.voiceMicroBans}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceMicroBans: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={formSectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={inputLabelStyle}>Hard Ban Categories</label>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: STUDIO_THEME.bg,
                  color: STUDIO_THEME.textSecondary,
                }}>
                  {cardSeed.hardBanCategories.length} selected
                </span>
              </div>
              <div style={cardGridStyle}>
                {BAN_CATEGORY_OPTIONS.map((option) => {
                  const selected = cardSeed.hardBanCategories.includes(option.category);
                  return (
                    <button
                      key={option.category}
                      type="button"
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${selected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                        background: selected ? `${STUDIO_THEME.accent}10` : 'transparent',
                        textAlign: 'left' as const,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onClick={() =>
                        setCardSeed((prev) => {
                          const exists = prev.hardBanCategories.includes(option.category);
                          return {
                            ...prev,
                            hardBanCategories: exists
                              ? prev.hardBanCategories.filter((category) => category !== option.category)
                              : [...prev.hardBanCategories, option.category],
                          };
                        })
                      }
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500, fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{option.label}</span>
                        {selected && <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />}
                      </div>
                      <p style={{ fontSize: '11px', color: STUDIO_THEME.textSecondary, margin: '4px 0 0 0' }}>{option.description}</p>
                    </button>
                  );
                })}
              </div>
              {cardSeed.hardBanCategories.length === 0 && (
                <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '12px' }}>
                  Select at least one hard-ban category so tool blocking is enforceable.
                </p>
              )}
            </div>
          </section>
        )}

        {/* AVATAR STEP */}
        {activeStep === "avatar" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: 0 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Palette style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Avatar Customization
              </h2>
              <p style={sectionSubtitleStyle}>
                Fine-tune your agent&apos;s visual identity.
              </p>
            </div>

            <div style={{ flex: 1, minHeight: '600px' }}>
              <AvatarCreatorStep
                agentSetup={blueprint.setup}
                agentTemperament={blueprint.temperament}
                onAvatarChange={(config) => {
                  lastUpdateFromStoreRef.current = true;
                  setAvatarConfig((prev) => {
                    const current = (config as any) || {};
                    return { ...current, mascotTemplate: (prev as any).mascotTemplate };
                  });
                }}
              />
            </div>
          </section>
        )}
        {/* RUNTIME STEP */}
        {activeStep === "runtime" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <Settings style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Runtime Configuration
                </h2>
                <p style={sectionSubtitleStyle}>
                  Configure model, tooling, and runtime behaviors.
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Bot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Model Configuration
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={inputLabelStyle}>Intelligence Model</label>
                    {isModelsLoading ? (
                      <Skeleton height="42px" borderRadius="8px" />
                    ) : (
                      <Select
                        value={formData.model}
                        onValueChange={(value) => {
                          setFormData((prev) => {
                            const selectedModel = apiModels.find(m => m.id === value);
                            if (selectedModel) {
                              return { ...prev, model: value, provider: selectedModel.provider as CreateAgentInput["provider"] };
                            }
                            return { ...prev, model: value };
                          });
                        }}
                      >
                        <SelectTrigger style={{
                          background: STUDIO_THEME.bg,
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          color: STUDIO_THEME.textPrimary,
                          height: '42px',
                        }}>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent style={{
                          background: STUDIO_THEME.bgCard,
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          zIndex: 1000,
                          maxHeight: '400px',
                          width: '300px'
                        }}>
                          {(apiModels.length > 0 ? apiModels : AGENT_MODELS).map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: model.provider === 'openai' ? '#10a37f' : model.provider === 'anthropic' ? '#d97757' : '#3b82f6'
                                  }} />
                                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{model.name}</span>
                                </div>
                                <span style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginLeft: '16px' }}>
                                  {model.provider.toUpperCase()} • {model.id}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <label style={inputLabelStyle}>Provider</label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          provider: value as CreateAgentInput["provider"],
                        }))
                      }
                    >
                      <SelectTrigger style={{
                        background: STUDIO_THEME.bg,
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textPrimary,
                        height: '42px',
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}`, zIndex: 1000 }}>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={inputLabelStyle}>Max Iterations: {formData.maxIterations}</label>
                    <Slider
                      value={[formData.maxIterations || 10]}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>

                  <div>
                    <label style={inputLabelStyle}>Temperature: {formData.temperature}</label>
                    <Slider
                      value={[formData.temperature || 0.7]}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Headphones style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Voice Settings
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '10px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {formData.voice?.enabled ? (
                      <Volume2 style={{ width: 20, height: 20, color: '#22c55e' }} />
                    ) : (
                      <VolumeX style={{ width: 20, height: 20, color: STUDIO_THEME.textMuted }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Enable Voice</div>
                      <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
                        Allow this agent to speak responses using text-to-speech.
                      </div>
                    </div>
                  </div>
                  <Switch
                    checked={formData.voice?.enabled || false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        voice: { voiceId: "default", ...prev.voice, enabled: checked },
                      }))
                    }
                  />
                </div>

                {formData.voice?.enabled && (
                  <div style={{
                    borderLeft: `2px solid ${STUDIO_THEME.accent}40`,
                    paddingLeft: '16px',
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={inputLabelStyle}>Voice</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <Select
                          value={formData.voice?.voiceId || "default"}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, voiceId: value, ...prev.voice },
                            }))
                          }
                          aria-disabled={voiceLoading}
                        >
                          <SelectTrigger style={{
                            flex: 1,
                            background: STUDIO_THEME.bg,
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textPrimary,
                            height: '42px',
                          }}>
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                          <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}`, zIndex: 1000 }}>
                            {voices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 0' }}>
                                  <div
                                    style={{
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      background: voice.engine === "chatterbox"
                                        ? "#3b82f6"
                                        : voice.engine === "xtts_v2"
                                        ? "#a855f7"
                                        : "#22c55e",
                                      boxShadow: `0 0 8px ${voice.engine === "chatterbox" ? "#3b82f6" : voice.engine === "xtts_v2" ? "#a855f7" : "#22c55e"}40`
                                    }}
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 500 }}>{voice.label}</span>
                                    <span style={{ fontSize: '10px', color: STUDIO_THEME.textMuted }}>
                                      {voice.engine.toUpperCase()} {!voice.assetReady ? " (Download Required)" : ""}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={handleVoicePreview}
                          disabled={!formData.voice?.enabled || isPlaying}
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            background: STUDIO_THEME.bg,
                            color: STUDIO_THEME.textPrimary,
                            cursor: 'pointer',
                          }}
                        >
                          {isPlaying ? (
                            <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Play style={{ width: 16, height: 16 }} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Label style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>Voice Tone Modifiers</Label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        {[
                          { id: 'formality', label: 'Formality' },
                          { id: 'enthusiasm', label: 'Enthusiasm' },
                          { id: 'empathy', label: 'Empathy' },
                          { id: 'directness', label: 'Directness' }
                        ].map((tone) => (
                          <div key={tone.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{tone.label}</span>
                              <span style={{ fontSize: '11px', color: STUDIO_THEME.accent }}>{((formData.config as any)?.voice?.tone?.[tone.id] ?? 0.5) * 100}%</span>
                            </div>
                            <Slider
                              value={[((formData.config as any)?.voice?.tone?.[tone.id] ?? 0.5) * 100]}
                              onValueChange={([val]) => setFormData(prev => ({
                                ...prev,
                                config: {
                                  ...(prev.config || {}),
                                  voice: {
                                    ...(prev.config as any)?.voice || {},
                                    tone: {
                                      ...((prev.config as any)?.voice?.tone || { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 }),
                                      [tone.id]: val / 100
                                    }
                                  }
                                }
                              }))}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Auto-Speak Responses</div>
                          <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Automatically speak all agent responses.</div>
                        </div>
                        <Switch
                          checked={formData.voice?.autoSpeak || false}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, ...prev.voice, autoSpeak: checked },
                            }))
                          }
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Speak on Checkpoint</div>
                          <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Voice summary when reaching checkpoints.</div>
                        </div>
                        <Switch
                          checked={formData.voice?.speakOnCheckpoint || false}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, ...prev.voice, speakOnCheckpoint: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Zap style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Capabilities Marketplace
                </h3>
                <PluginConflictWarning selectedTools={formData.tools || []} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {isCapabilitiesLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {Array(6).fill(0).map((_, i) => <Skeleton key={i} height="60px" borderRadius="10px" />)}
                    </div>
                  ) : (
                    CAPABILITY_CATEGORIES.map((cat) => {
                      const catCaps = (apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED)
                        .filter(cap => (cap as any).category === cat.id || (!cap.category && cat.id === 'core'));
                      
                      if (catCaps.length === 0) return null;
                      
                      const Icon = cat.icon;
                      
                      return (
                        <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Icon size={14} style={{ color: STUDIO_THEME.accent }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: STUDIO_THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                            {catCaps.map((cap) => {
                              const isSelected = formData.capabilities?.includes(cap.id);
                              return (
                                <button
                                  key={cap.id}
                                  type="button"
                                  onClick={() => toggleCapability(cap.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    background: isSelected ? `${STUDIO_THEME.accent}15` : STUDIO_THEME.bg,
                                    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                                  }}
                                >
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isSelected ? STUDIO_THEME.accent : STUDIO_THEME.textMuted
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, color: isSelected ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary, fontSize: '13px' }}>{cap.name}</div>
                                    {cap.description && <div style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginTop: '1px' }}>{cap.description}</div>}
                                  </div>
                                  {isSelected && <Check size={14} style={{ color: STUDIO_THEME.accent }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, marginBottom: '8px', display: 'block' }}>Custom Capabilities</label>
                    <TagInput
                      tags={formData.capabilities?.filter(c => !(apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED).some(ac => ac.id === c)) || []}
                      onChange={(tags: string[]) => {
                        const coreIds = (apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED)
                          .filter(ac => formData.capabilities?.includes(ac.id))
                          .map(ac => ac.id);
                        setFormData(prev => ({ ...prev, capabilities: [...coreIds, ...tags] }));
                      }}
                      placeholder="Type a custom capability and press Enter..."
                    />
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Bot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                    System Prompt
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="file"
                      id="prompt-file"
                      accept=".txt,.md,.prompt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            setFormData((prev) => ({ ...prev, systemPrompt: content }));
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('prompt-file')?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        background: 'transparent',
                        color: STUDIO_THEME.textPrimary,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Paperclip style={{ width: 14, height: 14 }} />
                      Load from File
                    </button>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value) {
                          const templates: Record<string, string> = {
                            'coding': `You are a senior software engineer with expertise in multiple programming languages.

## Core Responsibilities:
- Write clean, maintainable, and well-documented code
- Review code for bugs, security issues, and performance optimizations
- Explain complex technical concepts clearly

## Communication Style:
- Be concise but thorough
- Provide code examples when helpful
- Ask clarifying questions when requirements are unclear`,
                            'creative': `You are a creative strategist and content creator.

## Core Responsibilities:
- Generate innovative ideas and concepts
- Craft compelling narratives and messaging
- Provide feedback on creative work

## Communication Style:
- Be imaginative and inspiring
- Use vivid language and metaphors
- Balance creativity with practical constraints`,
                            'research': `You are a research analyst with expertise in data synthesis and evidence-based reasoning.

## Core Responsibilities:
- Analyze information from multiple sources
- Identify patterns and insights
- Provide well-researched recommendations

## Communication Style:
- Be objective and evidence-based
- Cite sources when possible
- Acknowledge uncertainty and limitations`,
                            'support': `You are a helpful customer support agent.

## Core Responsibilities:
- Answer questions accurately and efficiently
- Troubleshoot issues step by step
- Escalate complex problems appropriately

## Communication Style:
- Be friendly and professional
- Use clear, jargon-free language
- Show empathy and patience`,
                          };
                          setFormData((prev) => ({ 
                            ...prev, 
                            systemPrompt: templates[value] || prev.systemPrompt 
                          }));
                        }
                      }}
                    >
                      <SelectTrigger style={{
                        width: '140px',
                        background: STUDIO_THEME.bg,
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textPrimary,
                      }}>
                        <SelectValue placeholder="Load Template" />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                        <SelectItem value="coding">Coding Assistant</SelectItem>
                        <SelectItem value="creative">Creative Writer</SelectItem>
                        <SelectItem value="research">Research Analyst</SelectItem>
                        <SelectItem value="support">Support Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <A2RSystemPromptEditor
                    value={formData.systemPrompt || ''}
                    onChange={(value) => setFormData((prev) => ({ ...prev, systemPrompt: value }))}
                    modeColors={{
                      bg: STUDIO_THEME.bg,
                      card: STUDIO_THEME.bgCard,
                      border: STUDIO_THEME.borderSubtle,
                      text: STUDIO_THEME.textPrimary,
                      textMuted: STUDIO_THEME.textMuted,
                      accent: STUDIO_THEME.accent,
                      accentSoft: `${STUDIO_THEME.accent}20`,
                    }}
                  />
                </div>
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  Define behavior constraints and runtime expectations. Load from file or choose a template to get started.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* WORKSPACE STEP */}
        {activeStep === "workspace" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <Layers style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Workspace Configuration
                </h2>
                <p style={sectionSubtitleStyle}>
                  Choose which layers to include in your agent&apos;s workspace. Each layer adds markdown files that define how your agent operates.
                </p>
              </div>

              <WorkspaceLayerConfigurator
                config={workspaceLayers}
                onChange={setWorkspaceLayers}
                theme={{
                  textPrimary: STUDIO_THEME.textPrimary,
                  textSecondary: STUDIO_THEME.textSecondary,
                  textMuted: STUDIO_THEME.textMuted,
                  accent: STUDIO_THEME.accent,
                  bgCard: STUDIO_THEME.bgCard,
                  bg: STUDIO_THEME.bg,
                  borderSubtle: STUDIO_THEME.borderSubtle,
                }}
              />

              <div style={{ marginTop: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <FileText style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Configuration Preview
                </h3>
                <div style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  borderRadius: '12px',
                  padding: '20px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: STUDIO_THEME.textSecondary,
                  maxHeight: '300px',
                  overflow: 'auto',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', background: `${STUDIO_THEME.accent}20`, color: STUDIO_THEME.accent, padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                    identity.yaml
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {`# Agent Identity Layer
name: ${formData.name || 'Agent'}
type: ${formData.type}
model: ${formData.model}
provider: ${formData.provider}

# Character Profile
personality:
  openness: ${personality.openness}
  conscientiousness: ${personality.conscientiousness}
  extraversion: ${personality.extraversion}
  agreeableness: ${personality.agreeableness}
  
style:
  communication: ${personality.communicationStyle}
  work: ${personality.workStyle}
  decision_making: ${personality.decisionMaking}

# Layers Enabled
${Object.entries(workspaceLayers).filter(([_, enabled]) => enabled).map(([key]) => `- ${key}`).join('\n')}
`}
                  </pre>
                </div>
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  These configuration files will be automatically generated and committed to your agent's capsule repository upon creation.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* REVIEW STEP */}
        {activeStep === "review" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <ShieldCheck style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Review and Forge
                </h2>
                <p style={sectionSubtitleStyle}>
                  Final validation before creation. This summary is what gets compiled into the Character Layer.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  background: STUDIO_THEME.bg,
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 8px 0' }}>
                    {formData.name || "Unnamed Agent"}
                  </h3>
                  <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>
                    {formData.description || "No description yet."}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      {selectedTypeMeta?.name || formData.type}
                    </span>
                    {setupMeta && (
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        background: `${STUDIO_THEME.accent}15`,
                        color: STUDIO_THEME.accent,
                      }}>
                        {setupMeta.label}
                      </span>
                    )}
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      {projectedStats.class}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      Lv {projectedStats.level}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Operational Style</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Communication</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.communicationStyle}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Work Style</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.workStyle}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Decision</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.decisionMaking.replace('-', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const bigFive = Object.entries(personality).filter(([k]) => ['openness', 'conscientiousness', 'extraversion', 'agreeableness'].includes(k));
                    const customTraits = (formData.config as any)?.personalityTraits || [];
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: STUDIO_THEME.textMuted,
                          marginBottom: '8px',
                          display: 'block',
                        }}>Personality & Style</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: customTraits.length > 0 ? '12px' : 0 }}>
                          {bigFive.map(([key, val]) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '9px', color: STUDIO_THEME.textMuted, textTransform: 'uppercase' }}>{key}</span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: STUDIO_THEME.accent }}>{val}%</span>
                            </div>
                          ))}
                        </div>
                        {customTraits.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {customTraits.map((t: string) => (
                              <span key={t} style={{ fontSize: '10px', background: `${STUDIO_THEME.accent}10`, color: STUDIO_THEME.accent, padding: '2px 6px', borderRadius: '4px' }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {(formData.config as any)?.backstory && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: STUDIO_THEME.textMuted,
                        marginBottom: '4px',
                        display: 'block',
                      }}>Backstory</label>
                      <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: 0, lineClamp: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {(formData.config as any).backstory}
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Specialties</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {blueprint.specialtySkills.map((skill) => (
                        <span key={skill} style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          color: STUDIO_THEME.textSecondary,
                        }}>
                          {skill} {projectedStats.specialtyScores[skill] ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Hard Bans</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {((formData.config as any)?.hardBans || []).map((b: any) => (
                        <span key={b.category} style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}>
                          {b.category}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    background: STUDIO_THEME.bg,
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 8px 0' }}>Professional Effectiveness Metrics</h3>
                    <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>Derived from setup telemetry model.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {projectedStatEntries.map((entry) => (
                        <div key={entry.key}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                              {entry.definition?.label || entry.key}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{entry.value}</span>
                          </div>
                          <div style={{
                            height: 6,
                            borderRadius: '3px',
                            background: STUDIO_THEME.bgCard,
                            overflow: 'hidden',
                          }}>
                            <div
                              style={{
                                height: '100%',
                                borderRadius: '3px',
                                background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                                width: `${Math.max(4, entry.value)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {((avatarConfig as any).mascotTemplate || (avatarConfig as any).type === 'mascot') && (
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      background: STUDIO_THEME.bg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      minHeight: '200px'
                    }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Visual Identity</h3>
                        <span style={{ fontSize: '10px', background: `${STUDIO_THEME.accent}20`, color: STUDIO_THEME.accent, padding: '2px 6px', borderRadius: '4px' }}>
                          {(avatarConfig as any).mascotTemplate || 'Custom'}
                        </span>
                      </div>
                      <div className="transform scale-110 my-2">
                        <MascotPreview 
                          config={{ 
                            type: 'mascot', 
                            style: { 
                              primaryColor: avatarConfig.colors?.primary || '#3B82F6',
                              accentColor: avatarConfig.colors?.glow || '#93C5FD' 
                            }, 
                            mascot: { 
                              template: (avatarConfig as any).mascotTemplate || 'gizzi' 
                            } 
                          } as any} 
                          name={formData.name || 'Agent'} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky Footer */}
        <div style={stickyFooterStyle}>
          {/* Cancel Button - Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              style={{
                ...secondaryButtonStyle,
                opacity: isBusy ? 0.5 : 1,
                cursor: isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            {hasLocalStorage && <DraftSavedIndicator saveStatus={saveStatus} />}
          </div>

          {/* Status Message - Center */}
          <div style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, flex: 1, textAlign: 'center' }}>
            {!stepValidation[activeStep]
              ? "Complete required fields in this step to continue."
              : isForgeQueued
              ? "Preparing forge sequence..."
              : activeStep === "review"
              ? "All checks passed. Forge will animate and compile the character layer."
              : "Step complete. Continue to the next stage."}
          </div>

          {/* Back/Next Buttons - Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={activeStepIndex <= 0 || isBusy}
              style={{
                ...secondaryButtonStyle,
                opacity: activeStepIndex <= 0 || isBusy ? 0.5 : 1,
                cursor: activeStepIndex <= 0 || isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
            {activeStep !== "review" ? (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!stepValidation[activeStep] || isBusy}
                style={{
                  ...primaryButtonStyle,
                  opacity: !stepValidation[activeStep] || isBusy ? 0.5 : 1,
                  cursor: !stepValidation[activeStep] || isBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Next: {CREATE_FLOW_STEPS[activeStepIndex + 1]?.label || "Review"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isBusy || !isReadyForCreate}
                style={{
                  ...primaryButtonStyle,
                  padding: '12px 24px',
                  opacity: isBusy || !isReadyForCreate ? 0.5 : 1,
                  cursor: isBusy || !isReadyForCreate ? 'not-allowed' : 'pointer',
                }}
              >
                {isBusy ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {isForgeQueued ? "Preparing..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Bot style={{ width: 16, height: 16 }} />
                    Create Agent
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Orbital Animation Component for Agent Creation
// ============================================================================

function CreationProgressAnimation({ 
  onComplete, 
  agentName 
}: { 
  onComplete: () => void; 
  agentName: string;
}) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const stages = [
    { percent: 0, message: 'Initializing agent creation...' },
    { percent: 15, message: 'Creating configuration...' },
    { percent: 30, message: 'Setting up personality matrix...' },
    { percent: 45, message: 'Configuring tool integrations...' },
    { percent: 60, message: 'Establishing channel connections...' },
    { percent: 75, message: 'Optimizing parameters...' },
    { percent: 90, message: 'Finalizing agent setup...' },
    { percent: 100, message: 'Agent creation complete!' },
  ];
  
  useEffect(() => {
    console.log('[CreationProgressAnimation] Component mounted, starting animation');
    let currentStage = 0;
    
    const runStage = () => {
      if (currentStage >= stages.length) {
        setIsComplete(true);
        setTimeout(onComplete, 1500);
        return;
      }
      
      const s = stages[currentStage];
      setProgress(s.percent);
      setStage(currentStage);
      currentStage++;
      
      const delay = currentStage === stages.length ? 500 : 600 + Math.random() * 300;
      setTimeout(runStage, delay);
    };
    
    runStage();
  }, []);
  
  return (
    <div className="relative flex flex-col items-center justify-center p-12">
      {/* Orbital Rings */}
      <div className="relative w-64 h-64 mb-8">
        {/* Outer Ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-1.5 left-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
        </motion.div>
        
        {/* Middle Ring */}
        <motion.div
          className="absolute inset-8 rounded-full border-2 border-purple-500/30"
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-1 left-1/2 w-2.5 h-2.5 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.8)]" />
        </motion.div>
        
        {/* Inner Ring */}
        <motion.div
          className="absolute inset-16 rounded-full border-2 border-green-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-0.5 left-1/2 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        </motion.div>
        
        {/* Center Progress */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-white font-mono">
            {progress}%
          </span>
        </div>
      </div>
      
      {/* Stage Message */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-xl text-white/90 mb-6"
        >
          {stages[stage]?.message}
        </motion.div>
      </AnimatePresence>
      
      {/* Progress Bar */}
      <div className="w-80 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {/* Success Celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(16,185,129,0.5)]"
            >
              <CheckCircle className="w-16 h-16 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Agent Created!
            </h2>
            <p className="text-white/60 mt-2">{agentName || 'Your agent'} is ready</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Edit Agent Form
// ============================================================================

function EditAgentForm({ agent, onCancel }: { agent: Agent; onCancel: () => void }) {
  const { updateAgent, isCreating, error, agents } = useAgentStore();
  const [formData, setFormData] = useState<Partial<CreateAgentInput>>({
    name: agent.name,
    description: agent.description,
    type: agent.type || 'worker',
    parentAgentId: agent.parentAgentId,
    model: agent.model,
    provider: agent.provider,
    capabilities: agent.capabilities,
    systemPrompt: agent.systemPrompt,
    maxIterations: agent.maxIterations,
    temperature: agent.temperature,
    voice: agent.voice || { voiceId: 'default', enabled: false },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateAgent(agent.id, formData);
    } catch {
      // Error handled by store
    }
  };

  const toggleCapability = (capId: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities?.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...(prev.capabilities || []), capId]
    }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur z-10 shrink-0">
        <h1 className="text-xl font-bold">Edit Agent</h1>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Agent Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {AGENT_TYPES.map(type => (
              <div
                key={type.id}
                className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === type.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
              >
                <div className="font-medium text-sm">{type.name}</div>
              </div>
            ))}
          </div>
        </div>

        {formData.type === 'sub-agent' && (
          <div className="space-y-2">
            <Label htmlFor="parentAgent">Parent Orchestrator</Label>
            <Select
              value={formData.parentAgentId || ''}
              onValueChange={value => setFormData(prev => ({ ...prev, parentAgentId: value || undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(a => a.type === 'orchestrator' && a.id !== agent.id).map(orch => (
                  <SelectItem key={orch.id} value={orch.id}>
                    {orch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={formData.model}
              onValueChange={value => setFormData(prev => ({ ...prev, model: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={value => setFormData(prev => ({ 
                ...prev, 
                provider: value as CreateAgentInput['provider']
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Capabilities</Label>
          <div className="flex flex-wrap gap-2">
            {AGENT_CAPABILITIES.map(cap => (
              <Badge
                key={cap.id}
                variant={formData.capabilities?.includes(cap.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCapability(cap.id)}
              >
                {cap.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={formData.systemPrompt}
            onChange={e => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="space-y-3">
          <Label>Voice Settings</Label>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {formData.voice?.enabled ? (
                <Volume2 className="w-4 h-4 text-green-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm">Enable Voice</span>
            </div>
            <Switch
              checked={formData.voice?.enabled || false}
              onCheckedChange={checked => setFormData(prev => ({
                ...prev,
                voice: { ...(prev.voice || {}), enabled: checked }
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max Iterations: {formData.maxIterations}</Label>
            <Slider
              value={[formData.maxIterations || 10]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, maxIterations: value }))}
              min={1}
              max={50}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Temperature: {formData.temperature}</Label>
            <Slider
              value={[formData.temperature || 0.7]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" disabled={isCreating} size="lg">
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} size="lg">
            Cancel
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Detail View - STUDIO_THEME Styling
// ============================================================================

// ============================================================================
// Agent Detail View - Overlay with Side-by-Side Cards
// ============================================================================

function AgentDetailView({ agentId }: { agentId: string }) {
  console.log('[AgentDetailView] Rendering for agentId:', agentId);
  
  const {
    agents,
    characterStats,
    selectAgent,
    setIsEditing,
    deleteAgent,
    eventStreamConnected,
  } = useAgentStore();

  const agent = agents.find(a => a.id === agentId);
  console.log('[AgentDetailView] Found agent:', agent?.name);
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  
  if (!agent) {
    console.log('[AgentDetailView] No agent found, returning null');
    return null;
  }

  // Show full Agent Dashboard
  if (showDashboard) {
    console.log('[AgentDetailView] Rendering dashboard for agent:', agentId);
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'center',
          padding: '24px',
        }}
        onClick={() => setShowDashboard(false)}
      >
        <AgentDashboard 
          agentId={agentId} 
          onClose={() => setShowDashboard(false)} 
        />
      </motion.div>
    );
  }

  const blueprint = parseCharacterBlueprint(agent?.config);
  const setupId = blueprint?.setup || "generalist";
  const avatarConfig = (agent?.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);
  const agentCharacterStats = characterStats[agentId];

  const statusColors: Record<string, string> = {
    'online': '#22c55e',
    'offline': '#6b7280',
    'busy': '#f59e0b',
    'error': '#ef4444',
    'running': '#f59e0b',
    'completed': '#22c55e',
    'failed': '#ef4444',
    'idle': '#9B9B9B',
    'pending': '#9B9B9B',
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agentId);
      setShowDeleteConfirm(false);
      selectAgent(null);
    } catch {
      // Error handled by store
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
      onClick={() => selectAgent(null)}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        style={{
          display: 'flex',
          gap: '16px',
          maxWidth: '720px',
          width: '100%',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Agent Info Card */}
        <div style={{
          flex: 1,
          borderRadius: '16px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Header with Close */}
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: STUDIO_THEME.textMuted,
            }}>
              Agent Profile
            </span>
            <button
              onClick={() => selectAgent(null)}
              style={{
                padding: '6px',
                borderRadius: '6px',
                background: 'transparent',
                border: 'none',
                color: STUDIO_THEME.textSecondary,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>

          <div style={{ padding: '20px', flex: 1 }}>
            {/* Avatar & Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{
                width: '64px',
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <AgentAvatar 
                  config={avatarConfig}
                  size={64}
                  emotion={agent.status === 'running' ? 'focused' : agent.status === 'error' ? 'skeptical' : 'steady'}
                  isAnimating={true}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: statusColors[agent.status] || '#6b7280',
                  border: `3px solid ${STUDIO_THEME.bgCard}`,
                }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 6px 0',
                  fontFamily: 'Georgia, serif',
                }}>
                  {agent.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '999px',
                    background: `${STUDIO_THEME.accent}15`,
                    color: STUDIO_THEME.accent,
                    fontSize: '11px',
                    fontWeight: 500,
                    textTransform: 'capitalize',
                  }}>
                    {agent.type || 'worker'}
                  </span>
                  {eventStreamConnected && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${STUDIO_THEME.accent}40`,
                      color: STUDIO_THEME.accent,
                      fontSize: '10px',
                      fontWeight: 500,
                    }}>
                      ● Live
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <p style={{
              fontSize: '14px',
              color: STUDIO_THEME.textSecondary,
              lineHeight: 1.6,
              marginBottom: '20px',
            }}>
              {agent.description}
            </p>

            {/* Key Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Model</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.model}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Provider</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.provider}</span>
              </div>
              {agent.voice?.enabled && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Volume2 style={{ width: 12, height: 12 }} />
                    Voice
                  </span>
                  <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.voice.voiceLabel || agent.voice.voiceId}</span>
                </div>
              )}
            </div>

            {/* Capabilities */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                fontSize: '11px',
                color: STUDIO_THEME.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: '8px',
              }}>
                Capabilities
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {agent.capabilities.map(cap => (
                  <span key={cap} style={{
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: `${STUDIO_THEME.accent}15`,
                    color: STUDIO_THEME.accent,
                    fontSize: '11px',
                    fontWeight: 500,
                  }}>
                    {cap}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
              <button
                onClick={() => setIsEditing(agentId)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Settings style={{ width: 16, height: 16 }} />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Card */}
        <div style={{
          flex: 1,
          borderRadius: '16px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '16px',
            borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: STUDIO_THEME.textMuted,
            }}>
              Character Stats
            </span>
          </div>

          <div style={{ padding: '20px', flex: 1 }}>
            {agentCharacterStats ? (
              <>
                {/* Level & Class */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  marginBottom: '20px',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: `${STUDIO_THEME.accent}10`,
                  border: `1px solid ${STUDIO_THEME.accent}30`,
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Class</div>
                    <div style={{ fontSize: '14px', color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>{agentCharacterStats.class}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginBottom: '2px' }}>Level</div>
                    <div style={{ fontSize: '24px', color: STUDIO_THEME.accent, fontWeight: 700 }}>{agentCharacterStats.level}</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {agentCharacterStats.relevantStats.slice(0, 4).map((statKey) => {
                    const definition = agentCharacterStats.statDefinitions.find((item) => item.key === statKey);
                    return (
                      <div key={statKey} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}>
                        <span style={{
                          fontSize: '12px',
                          color: STUDIO_THEME.textSecondary,
                          width: '80px',
                        }}>
                          {definition?.label || statKey}
                        </span>
                        <div style={{
                          flex: 1,
                          height: '6px',
                          background: 'rgba(255,255,255,0.1)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}>
                          <div style={{
                            width: `${agentCharacterStats.stats[statKey]}%`,
                            height: '100%',
                            background: `linear-gradient(90deg, ${STUDIO_THEME.accent}, #B08D6E)`,
                            borderRadius: '3px',
                          }} />
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: STUDIO_THEME.textPrimary,
                          fontWeight: 600,
                          width: '32px',
                          textAlign: 'right',
                        }}>
                          {agentCharacterStats.stats[statKey]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <Sparkles style={{ width: 32, height: 32, color: STUDIO_THEME.textMuted, margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
                  No character stats available
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Launch Agent Dashboard Button */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('[AgentDetailView] Launch Dashboard clicked');
          setShowDashboard(true);
        }}
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          borderRadius: '999px',
          background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
          border: 'none',
          color: '#1A1612',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        }}
      >
        <Activity style={{ width: 18, height: 18 }} />
        Launch Agent Dashboard
        <ChevronRight style={{ width: 16, height: 16 }} />
      </motion.button>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 101,
        }}
        onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: '100%',
            maxWidth: '400px',
            padding: '24px',
            borderRadius: '16px',
            background: STUDIO_THEME.bgCard,
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
              margin: '0 0 8px 0',
              fontFamily: 'Georgia, serif',
            }}>
              Delete Agent
            </h3>
            <p style={{
              fontSize: '14px',
              color: STUDIO_THEME.textSecondary,
              margin: '0 0 24px 0',
            }}>
              Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}


// ============================================================================
// Sub-components
// ============================================================================

function RunCard({ run, isActive, onClick }: { 
  run: AgentRun;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusIcon = {
    running: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <AlertCircle className="w-4 h-4 text-red-500" />,
    cancelled: <Square className="w-4 h-4 text-[var(--text-tertiary)]" />,
  }[run.status];

  return (
    <Card 
      className={`cursor-pointer transition-colors ${isActive ? 'border-primary' : 'hover:border-primary/50'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{run.input.slice(0, 50)}...</span>
              <Badge variant="outline" className="text-xs capitalize">
                {run.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(run.startedAt)} • {run.checkpointCount} checkpoints
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const statusColors: Record<TaskStatus, string> = {
    pending: 'bg-white/30',
    'in-progress': 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-white/25',
  };

  return (
    <Task>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[task.status]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {task.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
              {task.result && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  {task.result}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Task>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: AgentCheckpoint }) {
  return (
    <Checkpoint>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Save className="w-4 h-4 text-green-500" />
            <div className="flex-1">
              <div className="font-medium">{checkpoint.label}</div>
              {checkpoint.description && (
                <p className="text-sm text-muted-foreground">
                  {checkpoint.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(checkpoint.timestamp)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Checkpoint>
  );
}

function CommitCard({ commit }: { commit: AgentCommit }) {
  return (
    <Commit>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <GitCommit className="w-4 h-4 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">{commit.message}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {commit.author} • {formatRelativeTime(commit.timestamp)}
              </div>
              {commit.changes.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {commit.changes.length} changes
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Commit>
  );
}

// ============================================================================
// Agent Reviews/Gate View Component
// ============================================================================

function AgentReviewsView({ agentId }: { agentId: string }) {
  const {
    reviews,
    isLoadingReviews,
    selectedReviewId,
    fetchReviews,
    submitReviewDecision,
    selectReview,
  } = useAgentStore();

  const [reviewNote, setReviewNote] = useState('');
  const [showDecisionConfirm, setShowDecisionConfirm] = useState<'approve' | 'reject' | null>(null);

  const agentReviews = reviews[agentId] || [];
  const pendingReviews = agentReviews.filter(r => r.status === 'pending');
  const selectedReview = agentReviews.find(r => r.id === selectedReviewId);

  useEffect(() => {
    fetchReviews(agentId);
  }, [agentId, fetchReviews]);

  const handleDecision = async (approved: boolean) => {
    if (!selectedReview) return;
    await submitReviewDecision(selectedReview.id, approved, reviewNote);
    setShowDecisionConfirm(null);
    setReviewNote('');
    selectReview(null);
  };

  if (isLoadingReviews) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Review List */}
      <div className="w-80 border-r pr-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Pending Reviews
          </h3>
          <Badge variant={pendingReviews.length > 0 ? 'destructive' : 'secondary'}>
            {pendingReviews.length}
          </Badge>
        </div>

        {pendingReviews.length === 0 ? (
          <EmptyTabState message="No pending reviews. Agent actions are within policy." />
        ) : (
          <div className="space-y-2">
            {pendingReviews.map(review => (
              <div
                key={review.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedReviewId === review.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => selectReview(review.id)}
              >
                <div className="flex items-start gap-2">
                  {review.severity === 'critical' && <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" />}
                  {review.severity === 'warning' && <Shield className="w-4 h-4 text-orange-500 mt-0.5" />}
                  {review.severity === 'info' && <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{review.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{review.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(review.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Detail */}
      <div className="flex-1">
        {!selectedReview ? (
          <EmptyTabState message="Select a review to view details and make a decision." />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="w-4 h-4" />
                  Review Details
                </CardTitle>
                <Badge 
                  variant={selectedReview.severity === 'critical' ? 'destructive' : 
                          selectedReview.severity === 'warning' ? 'default' : 'secondary'}
                >
                  {selectedReview.severity}
                </Badge>
              </div>
              <CardDescription>
                {selectedReview.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="p-3 rounded-lg border bg-muted/30 text-sm">
                  {selectedReview.description}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Proposed Action</Label>
                <div className="p-3 rounded-lg border bg-muted/30 text-sm font-mono">
                  {selectedReview.proposedAction}
                </div>
              </div>

              {selectedReview.context && (
                <div className="space-y-2">
                  <Label>Context</Label>
                  <pre className="p-3 rounded-lg border bg-muted/30 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedReview.context, null, 2)}
                  </pre>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Review Note (optional)</Label>
                <Textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  onClick={() => setShowDecisionConfirm('approve')}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDecisionConfirm('reject')}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Decision Confirmation Dialog */}
      <Dialog open={!!showDecisionConfirm} onOpenChange={() => setShowDecisionConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showDecisionConfirm === 'approve' ? 'Approve Action' : 'Reject Action'}
            </DialogTitle>
            <DialogDescription>
              {showDecisionConfirm === 'approve' 
                ? 'This will allow the agent to proceed with the proposed action.'
                : 'This will block the agent from proceeding with the proposed action.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant={showDecisionConfirm === 'approve' ? 'default' : 'destructive'}
              onClick={() => handleDecision(showDecisionConfirm === 'approve')}
            >
              {showDecisionConfirm === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Agent Mail View Component
// ============================================================================

function AgentMailView({ agentId }: { agentId: string }) {
  const {
    mail,
    mailThreads,
    isLoadingMail,
    selectedThreadId,
    fetchMail,
    fetchMailThreads,
    sendMail,
    acknowledgeMail,
    selectThread,
    agents,
  } = useAgentStore();

  const fetchUnifiedMailThreads = useUnifiedStore((state) => state.fetchMailThreads);
  const fetchUnifiedMailMessages = useUnifiedStore((state) => state.fetchMailMessages);
  const getSessionAnalytics = useUnifiedStore((state) => state.getSessionAnalytics);

  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const agentMail = mail[agentId] || [];
  const agentThreads = mailThreads[agentId] || [];
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorThreadId, setMonitorThreadId] = useState<string | null>(null);
  const analytics = selectedThreadId ? getSessionAnalytics(selectedThreadId) : null;

  useEffect(() => {
    fetchMail(agentId);
    fetchMailThreads(agentId);
  }, [agentId, fetchMail, fetchMailThreads]);

  useEffect(() => {
    fetchUnifiedMailThreads();
  }, [fetchUnifiedMailThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchUnifiedMailMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchUnifiedMailMessages]);

  const openMonitor = (threadId: string) => {
    fetchUnifiedMailMessages(threadId);
    setMonitorThreadId(threadId);
    setMonitorOpen(true);
  };

  const closeMonitor = () => {
    setMonitorOpen(false);
    setMonitorThreadId(null);
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    await sendMail(agentId, composeTo, composeSubject, composeBody);
    setShowCompose(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  };

  const handleAck = async (messageId: string) => {
    await acknowledgeMail(agentId, messageId);
  };

  if (isLoadingMail) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full gap-4">
      {/* Thread List */}
      <div className="w-64 border-r pr-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Threads
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setShowCompose(true)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {agentThreads.length === 0 ? (
          <EmptyTabState message="No messages yet." />
        ) : (
          <div className="space-y-2">
            {agentThreads.map(thread => (
              <div
                key={thread.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedThreadId === thread.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted border border-transparent'
                }`}
                onClick={() => selectThread(thread.id)}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{thread.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {thread.messageCount} messages
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-2 text-[10px]">
                        {thread.unreadCount} unread
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1">
        {showCompose ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>To Agent</Label>
                <Select value={composeTo} onValueChange={setComposeTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter(a => a.id !== agentId).map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Message subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="Enter your message..."
                  rows={5}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSend}>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
                <Button variant="outline" onClick={() => setShowCompose(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : agentMail.length === 0 ? (
          <EmptyTabState message="No messages in inbox." />
        ) : (
          <div className="space-y-3">
            {selectedThreadId && analytics && (
              <div className="flex items-center justify-between bg-muted/20 px-3 py-2 rounded-lg text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-[11px] text-muted-foreground">
                    Participants: {analytics.participants.length ? analytics.participants.join(", ") : "System"}
                  </p>
                  <p className="text-[11px]">
                    {analytics.totalMessages} messages · {analytics.ledgerEventCount} ledger events
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openMonitor(selectedThreadId)}>
                  <MessageSquare className="w-4 h-4" />
                  Live Monitor
                </Button>
              </div>
            )}
            {agentMail
              .filter(msg => !selectedThreadId || msg.threadId === selectedThreadId)
              .map(message => (
                <MailMessageCard
                  key={message.id}
                  message={message}
                  onAck={() => handleAck(message.id)}
                />
              ))}
          </div>
        )}
      </div>
      </div>
      <MailMonitorDialog
        threadId={monitorThreadId}
        open={monitorOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMonitor();
          }
        }}
      />
    </>
  );
}

function MailMessageCard({
  message,
  onAck,
}: {
  message: AgentMailMessage;
  onAck: () => void;
}) {
  const isUnread = message.status === 'unread';
  const priorityColors: Record<string, string> = {
    low: 'bg-white/30',
    normal: 'bg-blue-400',
    high: 'bg-orange-400',
    urgent: 'bg-red-500',
  };

  return (
    <Card className={isUnread ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[message.priority]}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{message.subject}</span>
              {isUnread && <Badge variant="default" className="text-[10px]">New</Badge>}
              {message.requiresAck && message.status !== 'acknowledged' && (
                <Badge variant="destructive" className="text-[10px]">Ack Required</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              From: {message.fromAgentName || message.fromAgentId}
            </div>
            <p className="text-sm mt-2">{message.body}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(message.timestamp)}
              </span>
              {message.requiresAck && message.status !== 'acknowledged' && (
                <Button size="sm" variant="outline" onClick={onAck}>
                  <CheckCheck className="w-3 h-3 mr-1" />
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MailMonitorDialogProps {
  threadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MailMonitorDialog({ threadId, open, onOpenChange }: MailMonitorDialogProps) {
  const fetchReceipts = useUnifiedStore((state) => state.fetchReceipts);
  const { analytics, messages, relevantEvents, relevantLogs } = useMonitorData(threadId);
  const { shareId, isSharing, shareMonitor } = useMonitorShare(threadId);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (threadId) {
      fetchReceipts({ limit: 50 });
    }
  }, [threadId, fetchReceipts]);

  const handleCopyShare = useCallback(async () => {
    if (!threadId) return;
    let finalShareId = shareId;
    if (!finalShareId) {
      finalShareId = await shareMonitor();
    }
    const link = buildMonitorLink(threadId, finalShareId);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  }, [threadId, shareId, shareMonitor]);

  if (!threadId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card rounded-3xl p-0 max-w-5xl w-full h-[80vh]">
        <div className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Live Monitor</DialogTitle>
            <DialogDescription>
              Observing thread {threadId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6 pt-0">
            <MailMonitorPanel
              threadId={threadId}
              messages={messages}
              analytics={analytics}
              relevantEvents={relevantEvents}
              relevantLogs={relevantLogs}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShare}
              disabled={isSharing}
            >
              {isSharing
                ? "Sharing…"
                : copiedLink
                  ? "Link copied"
                  : "Copy monitor link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <Circle className="w-8 h-8 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ============================================================================
// Agent Trace Sidebar (Runner Integration)
// ============================================================================

function AgentTraceSidebar({ agentId }: { agentId: string }) {
  const { activeRunTrace } = useAgentStore();
  const hasTrace = activeRunTrace.length > 0;

  const statusColors: Record<string, string> = {
    running: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444',
    pending: '#6b7280',
  };

  const kindIcons: Record<string, string> = {
    info: 'ℹ️',
    tool: '🔧',
    error: '❌',
    thought: '💭',
    plan: '📋',
    checkpoint: '💾',
  };

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3 p-3 rounded-xl border bg-card/50 h-full">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Thought Trace
        </div>
        <div className="text-[11px] text-muted-foreground">
          RUNNING
        </div>
      </div>

      {!hasTrace && (
        <div className="text-xs text-muted-foreground italic">
          Waiting for trace events…
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-0">
        {activeRunTrace.map((entry) => (
          <div 
            key={entry.id} 
            className="p-3 rounded-xl border bg-card/70 flex flex-col gap-1.5"
          >
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wide">{kindIcons[entry.kind] || '•'} {entry.kind}</span>
              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm font-semibold">{entry.title}</div>
            {entry.detail && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {entry.detail}
              </div>
            )}
            {entry.status && (
              <div 
                className="text-[11px] font-bold" 
                style={{ color: statusColors[entry.status] || 'var(--text-tertiary)' }}
              >
                {entry.status.toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Capsule View - Interactive Capsule Integration
// ============================================================================

import type { ToolUISurface } from '@a2r/mcp-apps-adapter';
import type { CapsuleEvent } from '@/components/CapsuleFrame';

function AgentCapsuleView({ agentId }: { agentId: string }) {
  const [capsuleId, setCapsuleId] = useState<string | null>(null);
  const [surface, setSurface] = useState<ToolUISurface | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Create capsule when component mounts
  useEffect(() => {
    const createCapsule = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Call API to create capsule
        // Use Gateway for capsules API
        const response = await fetch(`${GATEWAY_URL}/api/mcp-apps/capsules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capsule)
        });



        if (!response.ok) {
          throw new Error(`Failed to create capsule: ${response.status}`);
        }

        const data = await response.json();
        setCapsuleId(data.capsuleId);
        setSurface(data.surface);
        addLog(`Capsule created: ${data.capsuleId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create capsule');
        addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    createCapsule();

    // Cleanup: delete capsule on unmount
    return () => {
      if (capsuleId) {
        // Use Gateway for deletion
        fetch(`${GATEWAY_URL}/api/mcp-apps/capsules/${capsuleId}`, { method: 'DELETE' })
          .then(() => addLog(`Capsule deleted: ${capsuleId}`))
          .catch(err => addLog(`Delete error: ${err.message}`));
      }
    };
  }, [agentId]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleEvent = (event: CapsuleEvent) => {
    addLog(`Event: ${event.type} - ${JSON.stringify(event.payload)}`);
  };

  const handleToolInvoke = async (toolName: string, params: unknown) => {
    addLog(`Tool invoked: ${toolName}(${JSON.stringify(params)})`);
    
    // Simulate tool invocation - in production this would call the actual tool
    switch (toolName) {
      case 'agent.status':
        return { status: 'active', agentId };
      case 'agent.execute':
        return { success: true, result: 'Task executed' };
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Initializing capsule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Capsule Frame */}
      <div className="flex-1 min-w-0">
        {capsuleId && surface ? (
          <CapsuleFrame
            capsuleId={capsuleId}
            surface={surface}
            onEvent={handleEvent}
            onToolInvoke={handleToolInvoke}
            className="h-full"
          />
        ) : (
          <EmptyTabState message="No capsule active. Create one to start interacting." />
        )}
      </div>

      {/* Debug Panel */}
      <div className="w-80 border-l p-4 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Event Log
        </h3>
        <ScrollArea className="h-[400px] border rounded p-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet...</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={`log-${i}-${log.slice(0, 20)}`} className="text-xs font-mono text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Capsule Info</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>ID: {capsuleId || 'N/A'}</div>
            <div>Agent: {agentId}</div>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogs([])}
          className="w-full"
        >
          Clear Logs
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-yellow-500';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
    case 'error':
      return 'bg-red-500';
    case 'paused':
      return 'bg-orange-500';
    case 'idle':
    case 'pending':
      return 'bg-white/30';
    default:
      return 'bg-white/20';
  }
}
