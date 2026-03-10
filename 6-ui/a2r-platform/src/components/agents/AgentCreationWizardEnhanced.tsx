/**
 * Agent Creation Wizard - Enhanced Comprehensive Edition
 * 
 * Complete agent creation experience covering ALL aspects:
 * - Core Identity (name, description, type, model)
 * - Character Layer (identity, role card, voice, relationships, progression, avatar)
 * - Workspace Documents (auto-generated identity.yaml, role_card.yaml, voice.yaml, etc.)
 * - Avatar/Mascot Builder (custom visual identity with Gizzi-style animations)
 * - Advanced Configuration (tools, capabilities, hard bans, escalation)
 * - Live Preview with mascot visualization
 * 
 * @module AgentCreationWizardEnhanced
 * @version 3.0.0
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Brain,
  Wrench,
  Shield,
  Mic,
  Users,
  Target,
  Zap,
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Palette,
  FileText,
  Cpu,
  MessageSquare,
  Ban,
  TrendingUp,
  Image,
  Box,
  Save,
  Eye,
  RefreshCw,
  Copy,
  Download,
  Upload,
  Trash2,
  Plus,
  X,
  Settings,
  Layers,
  GitBranch,
  AlertTriangle,
  Volume2,
  Smile,
  Frown,
  Meh,
  Activity,
  Terminal,
  Code,
  Globe,
  PenTool,
  Search,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
} from 'lucide-react';

import {
  SAND,
  MODE_COLORS,
  createGlassStyle,
  RADIUS,
  SPACE,
  TEXT,
  SHADOW,
  type AgentMode,
} from '@/design/a2r.tokens';

// Import the original wizard components/types as base
import type { AgentCreationWizardProps as BaseAgentCreationWizardProps } from './AgentCreationWizard';

// ============================================================================
// Comprehensive Types - ALL Agent Aspects
// ============================================================================

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description?: string;
}

export interface ToolOption {
  id: string;
  name: string;
  description?: string;
  category?: string;
}

export interface AgentConfig {
  name: string;
  description: string;
  type: AgentType;
  model: string;
  provider: ModelProvider;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  config?: {
    characterLayer?: CharacterLayerConfig;
    workspaceDocuments?: WorkspaceDocuments | null;
  };
}

export interface AgentCreationWizardProps extends BaseAgentCreationWizardProps {
  /** Enable comprehensive character layer configuration */
  enableCharacterLayer?: boolean;
  /** Enable avatar/mascot builder */
  enableAvatarBuilder?: boolean;
  /** Enable workspace document preview */
  enableWorkspacePreview?: boolean;
  /** Initial character configuration if editing */
  initialCharacterConfig?: CharacterLayerConfig;
  /** Callback when workspace documents are generated */
  onWorkspaceDocumentsGenerated?: (docs: WorkspaceDocuments) => void;
  /** Available avatar templates */
  avatarTemplates?: AvatarTemplate[];
  /** Callback when agent is created */
  onCreateAgent?: (config: AgentConfig) => void | Promise<void>;
  /** Callback when wizard is cancelled */
  onCancel?: () => void;
  /** Available models for selection */
  availableModels?: string[] | ModelOption[];
  /** Available tools for selection */
  availableTools?: string[] | ToolOption[];
  /** Additional CSS class names */
  className?: string;
}

/** Complete Character Layer Configuration */
export interface CharacterLayerConfig {
  identity: CharacterIdentity;
  roleCard: RoleCardConfig;
  voice: VoiceConfigLayer;
  relationships: RelationshipConfig;
  progression: ProgressionConfig;
  avatar: AvatarConfig;
}

export interface CharacterIdentity {
  /** Setup type defines the agent's core specialization */
  setup: AgentSetup;
  /** Class name (auto-generated from setup) */
  className: string;
  /** Specialty skills this agent possesses */
  specialtySkills: string[];
  /** Behavioral temperament */
  temperament: Temperament;
  /** Personality traits */
  personalityTraits: string[];
  /** Backstory/context */
  backstory?: string;
}

export type AgentSetup = 'coding' | 'creative' | 'research' | 'operations' | 'generalist';
export type Temperament = 'precision' | 'exploratory' | 'systemic' | 'balanced';

export interface RoleCardConfig {
  /** Primary domain of expertise */
  domain: string;
  /** Expected inputs */
  inputs: string[];
  /** Expected outputs */
  outputs: string[];
  /** Definition of done criteria */
  definitionOfDone: string[];
  /** Hard bans - what this agent cannot do */
  hardBans: RoleHardBan[];
  /** Escalation triggers */
  escalation: string[];
  /** Success metrics */
  metrics: string[];
}

export interface RoleHardBan {
  category: HardBanCategory;
  description?: string;
  severity: 'fatal' | 'warning' | 'info';
}

export type HardBanCategory = 
  | 'publishing' 
  | 'deploy' 
  | 'data_exfil' 
  | 'payments' 
  | 'email_send' 
  | 'file_delete' 
  | 'system_modify'
  | 'external_communication'
  | 'code_execution'
  | 'other';

export interface VoiceConfigLayer {
  /** Voice style description */
  style: string;
  /** Voice behavior rules */
  rules: string[];
  /** Micro-bans (phrases/approaches to avoid) */
  microBans: string[];
  /** Conflict resolution bias */
  conflictBias: {
    prefersChallengeWith: string[];
    avoidsConflictWith: string[];
  };
  /** Tone modifiers */
  tone: {
    formality: number; // 0-1
    enthusiasm: number; // 0-1
    empathy: number; // 0-1
    directness: number; // 0-1
  };
}

export interface RelationshipConfig {
  /** Default affinity with other agents */
  defaults: {
    initialAffinity: number; // -1 to 1
    trustCurve: 'linear' | 'exponential' | 'logarithmic';
  };
  /** Specific agent relationships */
  pairs: RelationshipPair[];
}

export interface RelationshipPair {
  agentId: string;
  affinity: number; // -1 to 1
  relationship: 'mentor' | 'peer' | 'subordinate' | 'rival' | 'partner' | 'neutral';
  notes?: string;
}

export interface ProgressionConfig {
  /** Stat progression formulas */
  stats: Record<string, ProgressionStatRule>;
  /** Stats relevant to this agent */
  relevantStats: string[];
  /** Level configuration */
  level: {
    maxLevel: number;
    xpFormula: string;
    tierNames: string[];
  };
  /** Class specialization */
  class: string;
  /** Unlockable abilities */
  unlocks: UnlockableAbility[];
}

export interface ProgressionStatRule {
  base: number;
  growth: 'linear' | 'exponential' | 'diminishing';
  formula?: string;
  cap?: number;
}

export interface UnlockableAbility {
  name: string;
  description: string;
  unlockLevel: number;
  effect: string;
}

/** Avatar/Mascot Configuration */
export interface AvatarConfig {
  /** Avatar type */
  type: 'mascot' | 'glb' | 'image' | 'color';
  /** URI for GLB or image */
  uri?: string;
  /** Mascot configuration (for type='mascot') */
  mascot?: MascotConfig;
  /** Fallback color */
  fallbackColor: string;
  /** Visual style */
  style: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    glowColor: string;
  };
}

/** Mascot Customization Configuration */
export interface MascotConfig {
  /** Base template */
  template: MascotTemplate;
  /** Custom name */
  name: string;
  /** Eye style */
  eyes: EyeStyle;
  /** Body shape */
  body: BodyShape;
  /** Accessories */
  accessories: MascotAccessory[];
  /** Animation set */
  animations: AnimationSet;
  /** Emotion presets */
  emotionMap: Record<string, MascotEmotion>;
  /** Size scaling */
  scale: number;
}

export type MascotTemplate = 
  | 'gizzi'      // Original Gizzi style
  | 'bot'        // Robot/mechanical
  | 'orb'        // Floating orb
  | 'creature'   // Creature/animal-like
  | 'geometric'  // Abstract geometric
  | 'minimal';   // Minimalist

export type EyeStyle = 
  | 'round' | 'oval' | 'square' | 'diamond' 
  | 'glowing' | 'pixel' | 'line' | 'none';

export type BodyShape = 
  | 'round' | 'square' | 'blob' | 'angular' 
  | 'floating' | 'mechanical' | 'organic';

export interface MascotAccessory {
  id: string;
  type: 'hat' | 'glasses' | 'badge' | 'antenna' | 'wings' | 'tail' | 'aura';
  style: string;
  color: string;
  position: { x: number; y: number };
}

export interface AnimationSet {
  idle: string;
  thinking: string;
  speaking: string;
  happy: string;
  sad: string;
  excited: string;
  curious: string;
  working: string;
}

export interface MascotEmotion {
  animation: string;
  eyePreset: string;
  colorShift?: string;
  particles?: string;
}

/** Avatar Template for Selection */
export interface AvatarTemplate {
  id: string;
  name: string;
  description: string;
  type: 'mascot' | 'glb' | 'image';
  previewUri: string;
  config: Partial<AvatarConfig>;
  tags: string[];
}

/** Generated Workspace Documents */
export interface WorkspaceDocuments {
  identity: string; // YAML content
  roleCard: string; // YAML content
  voice: string; // YAML content
  relationships: string; // YAML content
  progression: string; // YAML content
  avatar: string; // JSON content
  compiled: string; // JSON content
}

/** Agent Type Selection */
export type AgentType = 'orchestrator' | 'sub-agent' | 'worker' | 'specialist' | 'reviewer';

/** Model Provider */
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'local' | 'custom';

// ============================================================================
// Setup Configuration Constants
// ============================================================================

const SETUP_CONFIG: Record<AgentSetup, {
  label: string;
  description: string;
  className: string;
  color: string;
  icon: React.ElementType;
  defaultSkills: string[];
  temperament: Temperament;
  suggestedModels: string[];
}> = {
  coding: {
    label: 'Coding & Development',
    description: 'Builds, reviews, and maintains code across languages',
    className: 'Builder',
    color: '#2563EB',
    icon: Code,
    defaultSkills: ['code_generation', 'code_review', 'debugging', 'refactoring', 'architecture'],
    temperament: 'precision',
    suggestedModels: ['gpt-4', 'claude-3-opus', 'codellama'],
  },
  creative: {
    label: 'Creative & Content',
    description: 'Creates content, designs, and creative assets',
    className: 'Creator',
    color: '#EA580C',
    icon: PenTool,
    defaultSkills: ['writing', 'design', 'brainstorming', 'editing', 'storytelling'],
    temperament: 'exploratory',
    suggestedModels: ['gpt-4', 'claude-3-sonnet', 'midjourney'],
  },
  research: {
    label: 'Research & Analysis',
    description: 'Gathers information, analyzes data, synthesizes insights',
    className: 'Analyst',
    color: '#0F766E',
    icon: Search,
    defaultSkills: ['research', 'analysis', 'synthesis', 'summarization', 'fact_checking'],
    temperament: 'systemic',
    suggestedModels: ['gpt-4', 'claude-3-opus', 'perplexity'],
  },
  operations: {
    label: 'Operations & Automation',
    description: 'Manages workflows, automations, and system operations',
    className: 'Operator',
    color: '#1F2937',
    icon: Settings,
    defaultSkills: ['automation', 'monitoring', 'optimization', 'orchestration', 'maintenance'],
    temperament: 'precision',
    suggestedModels: ['gpt-4', 'claude-3-sonnet', 'function-calling'],
  },
  generalist: {
    label: 'Generalist',
    description: 'Versatile agent adaptable to many contexts',
    className: 'Generalist',
    color: '#475569',
    icon: Layers,
    defaultSkills: ['general_assistance', 'coordination', 'communication', 'learning', 'adaptation'],
    temperament: 'balanced',
    suggestedModels: ['gpt-4', 'claude-3-sonnet'],
  },
};

const HARD_BAN_CATEGORIES: Record<HardBanCategory, {
  label: string;
  description: string;
  icon: React.ElementType;
  severity: 'fatal' | 'warning';
}> = {
  publishing: {
    label: 'Publishing',
    description: 'No direct posting to public platforms',
    icon: Globe,
    severity: 'fatal',
  },
  deploy: {
    label: 'Deployment',
    description: 'No production deployments',
    icon: Upload,
    severity: 'fatal',
  },
  data_exfil: {
    label: 'Data Exfiltration',
    description: 'No unauthorized data export',
    icon: Download,
    severity: 'fatal',
  },
  payments: {
    label: 'Financial Transactions',
    description: 'No payment processing',
    icon: Target,
    severity: 'fatal',
  },
  email_send: {
    label: 'Outbound Email',
    description: 'No sending emails externally',
    icon: MessageSquare,
    severity: 'warning',
  },
  file_delete: {
    label: 'Destructive Deletion',
    description: 'No permanent file deletion',
    icon: Trash2,
    severity: 'warning',
  },
  system_modify: {
    label: 'System Modification',
    description: 'No system-level changes',
    icon: Settings,
    severity: 'fatal',
  },
  external_communication: {
    label: 'External Communication',
    description: 'No communication with external services',
    icon: Globe,
    severity: 'warning',
  },
  code_execution: {
    label: 'Code Execution',
    description: 'No arbitrary code execution',
    icon: Terminal,
    severity: 'fatal',
  },
  other: {
    label: 'Custom Restriction',
    description: 'Other custom restrictions',
    icon: Ban,
    severity: 'warning',
  },
};

const VOICE_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal, business-like communication' },
  { id: 'casual', label: 'Casual', description: 'Relaxed, conversational tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', description: 'High energy, excited' },
  { id: 'analytical', label: 'Analytical', description: 'Precise, data-driven language' },
  { id: 'empathetic', label: 'Empathetic', description: 'Understanding, supportive tone' },
  { id: 'witty', label: 'Witty', description: 'Clever, humorous when appropriate' },
  { id: 'direct', label: 'Direct', description: 'Straightforward, no fluff' },
  { id: 'teaching', label: 'Teaching', description: 'Educational, explanatory' },
];

const DEFAULT_STATS = [
  { id: 'efficiency', name: 'Efficiency', description: 'Task completion speed' },
  { id: 'quality', name: 'Quality', description: 'Output quality score' },
  { id: 'reliability', name: 'Reliability', description: 'Consistency in performance' },
  { id: 'creativity', name: 'Creativity', description: 'Novel solution generation' },
  { id: 'collaboration', name: 'Collaboration', description: 'Teamwork effectiveness' },
  { id: 'adaptability', name: 'Adaptability', description: 'Handling new situations' },
];

const MASCOT_TEMPLATES: Record<MascotTemplate, {
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
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateWorkspaceDocuments(
  config: CharacterLayerConfig,
  basicInfo: { name: string; description: string; model: string }
): WorkspaceDocuments {
  const slug = basicInfo.name.toLowerCase().replace(/\s+/g, '-');
  
  return {
    identity: `# Agent Identity: ${basicInfo.name}
setup: ${config.identity.setup}
class: ${config.identity.className}
specialty_skills:
${config.identity.specialtySkills.map(s => `  - ${s}`).join('\n')}
temperament: ${config.identity.temperament}
personality_traits:
${config.identity.personalityTraits.map(t => `  - ${t}`).join('\n')}
backstory: |
  ${config.identity.backstory || 'No backstory provided'}
`,
    
    roleCard: `# Role Card: ${basicInfo.name}
domain: ${config.roleCard.domain}
inputs:
${config.roleCard.inputs.map(i => `  - ${i}`).join('\n')}
outputs:
${config.roleCard.outputs.map(o => `  - ${o}`).join('\n')}
definition_of_done:
${config.roleCard.definitionOfDone.map(d => `  - ${d}`).join('\n')}
hard_bans:
${config.roleCard.hardBans.map(b => `  - category: ${b.category}\n    severity: ${b.severity}\n    ${b.description ? `description: ${b.description}` : ''}`).join('\n')}
escalation:
${config.roleCard.escalation.map(e => `  - ${e}`).join('\n')}
metrics:
${config.roleCard.metrics.map(m => `  - ${m}`).join('\n')}
`,
    
    voice: `# Voice Configuration: ${basicInfo.name}
style: ${config.voice.style}
rules:
${config.voice.rules.map(r => `  - ${r}`).join('\n')}
micro_bans:
${config.voice.microBans.map(b => `  - ${b}`).join('\n')}
conflict_bias:
  prefers_challenge_with:
${config.voice.conflictBias.prefersChallengeWith.map(c => `    - ${c}`).join('\n')}
  avoids_conflict_with:
${config.voice.conflictBias.avoidsConflictWith.map(c => `    - ${c}`).join('\n')}
tone:
  formality: ${config.voice.tone.formality}
  enthusiasm: ${config.voice.tone.enthusiasm}
  empathy: ${config.voice.tone.empathy}
  directness: ${config.voice.tone.directness}
`,
    
    relationships: `# Relationships: ${basicInfo.name}
defaults:
  initial_affinity: ${config.relationships.defaults.initialAffinity}
  trust_curve: ${config.relationships.defaults.trustCurve}
pairs:
${config.relationships.pairs.map(p => `  - agent: ${p.agentId}\n    affinity: ${p.affinity}\n    relationship: ${p.relationship}\n    ${p.notes ? `notes: ${p.notes}` : ''}`).join('\n')}
`,
    
    progression: `# Progression: ${basicInfo.name}
class: ${config.progression.class}
relevant_stats:
${config.progression.relevantStats.map(s => `  - ${s}`).join('\n')}
level:
  max_level: ${config.progression.level.maxLevel}
  xp_formula: ${config.progression.level.xpFormula}
  tier_names:
${config.progression.level.tierNames.map((t, i) => `    - tier_${i + 1}: ${t}`).join('\n')}
unlocks:
${config.progression.unlocks.map(u => `  - name: ${u.name}\n    level: ${u.unlockLevel}\n    description: ${u.description}\n    effect: ${u.effect}`).join('\n')}
`,
    
    avatar: JSON.stringify({
      type: config.avatar.type,
      uri: config.avatar.uri,
      mascot: config.avatar.mascot,
      fallbackColor: config.avatar.fallbackColor,
      style: config.avatar.style,
    }, null, 2),
    
    compiled: JSON.stringify({
      slug,
      name: basicInfo.name,
      description: basicInfo.description,
      model: basicInfo.model,
      character: config,
      version: '1.0.0',
      generatedAt: new Date().toISOString(),
    }, null, 2),
  };
}

function generateDefaultCharacterConfig(setup: AgentSetup): CharacterLayerConfig {
  const setupConfig = SETUP_CONFIG[setup];
  
  return {
    identity: {
      setup,
      className: setupConfig.className,
      specialtySkills: [...setupConfig.defaultSkills],
      temperament: setupConfig.temperament,
      personalityTraits: [],
      backstory: '',
    },
    roleCard: {
      domain: setupConfig.label,
      inputs: ['task_requests', 'context', 'requirements'],
      outputs: ['deliverables', 'analysis', 'recommendations'],
      definitionOfDone: ['quality_verified', 'requirements_met'],
      hardBans: [],
      escalation: ['ambiguous_requirements', 'scope_violation'],
      metrics: ['completion_rate', 'quality_score'],
    },
    voice: {
      style: setup === 'creative' ? 'witty' : setup === 'research' ? 'analytical' : 'professional',
      rules: [
        'Be concise but thorough',
        'Ask clarifying questions when needed',
        'Provide actionable outputs',
      ],
      microBans: [
        'Avoid saying "I think" when stating facts',
        'Never use "just" to minimize',
      ],
      conflictBias: {
        prefersChallengeWith: [],
        avoidsConflictWith: [],
      },
      tone: {
        formality: setup === 'operations' ? 0.8 : setup === 'creative' ? 0.4 : 0.6,
        enthusiasm: setup === 'creative' ? 0.8 : 0.5,
        empathy: setup === 'creative' ? 0.7 : 0.4,
        directness: setup === 'coding' || setup === 'operations' ? 0.8 : 0.5,
      },
    },
    relationships: {
      defaults: {
        initialAffinity: 0.5,
        trustCurve: 'linear',
      },
      pairs: [],
    },
    progression: {
      stats: {
        efficiency: { base: 50, growth: 'linear' },
        quality: { base: 50, growth: 'linear' },
        reliability: { base: 50, growth: 'linear' },
      },
      relevantStats: ['efficiency', 'quality', 'reliability'],
      level: {
        maxLevel: 50,
        xpFormula: 'level * 100',
        tierNames: ['Novice', 'Apprentice', 'Practitioner', 'Expert', 'Master'],
      },
      class: setupConfig.className,
      unlocks: [
        { name: 'Enhanced Analysis', description: 'Advanced pattern recognition', unlockLevel: 5, effect: '+10% analysis speed' },
        { name: 'Expert Mode', description: 'Access to expert-level features', unlockLevel: 20, effect: 'Unlock expert tools' },
      ],
    },
    avatar: {
      type: 'mascot',
      mascot: {
        template: 'gizzi',
        name: setupConfig.className,
        eyes: 'round',
        body: 'round',
        accessories: [],
        animations: {
          idle: 'breathe',
          thinking: 'pulse',
          speaking: 'bounce',
          happy: 'jump',
          sad: 'droop',
          excited: 'spin',
          curious: 'tilt',
          working: 'tap',
        },
        emotionMap: {
          alert: { animation: 'bounce', eyePreset: 'wide' },
          curious: { animation: 'tilt', eyePreset: 'curious' },
          focused: { animation: 'pulse', eyePreset: 'narrow' },
          pleased: { animation: 'jump', eyePreset: 'pleased' },
        },
        scale: 1,
      },
      fallbackColor: setupConfig.color,
      style: {
        primaryColor: setupConfig.color,
        secondaryColor: setupConfig.color + '80',
        accentColor: setupConfig.color,
        glowColor: setupConfig.color + '40',
      },
    },
  };
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentCreationWizardEnhanced({
  onCreateAgent,
  onCancel,
  availableModels = [],
  availableTools = [],
  enableCharacterLayer = true,
  enableAvatarBuilder = true,
  enableWorkspacePreview = true,
  initialCharacterConfig,
  avatarTemplates = [],
  onWorkspaceDocumentsGenerated,
  className,
}: AgentCreationWizardProps) {
  const modeColors = MODE_COLORS.chat as typeof MODE_COLORS.chat;
  
  // Wizard State
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentType, setAgentType] = useState<AgentType>('worker');
  const [model, setModel] = useState('');
  const [provider, setProvider] = useState<ModelProvider>('openai');
  
  // Character Layer
  const [characterConfig, setCharacterConfig] = useState<CharacterLayerConfig>(
    initialCharacterConfig || generateDefaultCharacterConfig('generalist')
  );
  
  // Tools & Capabilities
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.7);
  const [maxIterations, setMaxIterations] = useState(5);
  
  // Generated documents
  const [workspaceDocs, setWorkspaceDocs] = useState<WorkspaceDocuments | null>(null);
  
  // Steps configuration
  const steps = useMemo(() => {
    const baseSteps = [
      { id: 'identity', label: 'Identity', icon: User },
      { id: 'character', label: 'Character', icon: Sparkles },
      ...(enableAvatarBuilder ? [{ id: 'avatar', label: 'Avatar', icon: Palette }] : []),
      { id: 'role', label: 'Role Card', icon: Shield },
      { id: 'voice', label: 'Voice', icon: Mic },
      ...(enableCharacterLayer ? [{ id: 'advanced', label: 'Advanced', icon: Settings }] : []),
      { id: 'tools', label: 'Tools', icon: Wrench },
      { id: 'review', label: 'Review', icon: Check },
    ];
    return baseSteps;
  }, [enableAvatarBuilder, enableCharacterLayer]);
  
  // Generate workspace docs when reviewing
  useEffect(() => {
    if (currentStep === steps.length - 1 && enableWorkspacePreview) {
      const docs = generateWorkspaceDocuments(characterConfig, { name, description, model });
      setWorkspaceDocs(docs);
      onWorkspaceDocumentsGenerated?.(docs);
    }
  }, [currentStep, steps.length, enableWorkspacePreview, characterConfig, name, description, model, onWorkspaceDocumentsGenerated]);
  
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(curr => curr + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(curr => curr - 1);
    }
  };
  
  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onCreateAgent?.({
        name,
        description,
        type: agentType,
        model,
        provider,
        capabilities,
        systemPrompt,
        tools: selectedTools,
        maxIterations,
        temperature,
        config: {
          characterLayer: characterConfig,
          workspaceDocuments: workspaceDocs,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0: // Identity
        return name.trim().length >= 2 && description.trim().length >= 10 && model !== '';
      case 1: // Character
        return characterConfig.identity.specialtySkills.length > 0;
      default:
        return true;
    }
  }, [currentStep, name, description, model, characterConfig]);
  
  const CurrentStepIcon = steps[currentStep].icon;
  
  return (
    <div 
      className={`h-screen flex flex-col overflow-hidden ${className || ''}`}
      style={{ background: '#0D0B09' }}
    >
      {/* Header */}
      <WizardHeader
        steps={steps}
        currentStep={currentStep}
        onClose={onCancel}
        modeColors={modeColors}
      />
      
      {/* Progress Bar */}
      <div className="px-8 py-4">
        <div className="flex items-center gap-2">
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <motion.div
                className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
                style={{
                  background: idx <= currentStep ? modeColors.soft : 'rgba(255,255,255,0.05)',
                  color: idx <= currentStep ? modeColors.accent : TEXT.tertiary,
                  border: `1px solid ${idx <= currentStep ? modeColors.border : 'transparent'}`,
                }}
                animate={{ scale: idx === currentStep ? 1.05 : 1 }}
              >
                <step.icon size={14} />
                <span className="hidden sm:inline">{step.label}</span>
              </motion.div>
              {idx < steps.length - 1 && (
                <ChevronRight size={14} style={{ color: TEXT.tertiary }} />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Progress Line */}
        <div className="mt-4 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: modeColors.accent }}
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStep === 0 && (
                <IdentityStep
                  name={name}
                  setName={setName}
                  description={description}
                  setDescription={setDescription}
                  agentType={agentType}
                  setAgentType={setAgentType}
                  model={model}
                  setModel={setModel}
                  provider={provider}
                  setProvider={setProvider}
                  availableModels={availableModels as string[]}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === 1 && (
                <CharacterStep
                  config={characterConfig}
                  setConfig={setCharacterConfig}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === 2 && enableAvatarBuilder && (
                <AvatarBuilderStep
                  config={characterConfig.avatar}
                  setConfig={(avatar) => setCharacterConfig({ ...characterConfig, avatar })}
                  mascotName={name || 'My Agent'}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === (enableAvatarBuilder ? 3 : 2) && (
                <RoleCardStep
                  config={characterConfig.roleCard}
                  setConfig={(roleCard) => setCharacterConfig({ ...characterConfig, roleCard })}
                  agentSetup={characterConfig.identity.setup}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === (enableAvatarBuilder ? 4 : 3) && (
                <VoiceStep
                  config={characterConfig.voice}
                  setConfig={(voice) => setCharacterConfig({ ...characterConfig, voice })}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === (enableAvatarBuilder ? 5 : 4) && enableCharacterLayer && (
                <AdvancedStep
                  config={characterConfig}
                  setConfig={setCharacterConfig}
                  capabilities={capabilities}
                  setCapabilities={setCapabilities}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === steps.length - 2 && (
                <ToolsStep
                  selectedTools={selectedTools}
                  setSelectedTools={setSelectedTools}
                  systemPrompt={systemPrompt}
                  setSystemPrompt={setSystemPrompt}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  maxIterations={maxIterations}
                  setMaxIterations={setMaxIterations}
                  availableTools={availableTools as string[]}
                  modeColors={modeColors}
                />
              )}
              
              {currentStep === steps.length - 1 && (
                <ReviewStep
                  name={name}
                  description={description}
                  agentType={agentType}
                  model={model}
                  characterConfig={characterConfig}
                  selectedTools={selectedTools}
                  systemPrompt={systemPrompt}
                  temperature={temperature}
                  maxIterations={maxIterations}
                  workspaceDocs={workspaceDocs ?? ({} as WorkspaceDocuments)}
                  modeColors={modeColors}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Live Preview Panel */}
        <AnimatePresence>
          {showPreview && (
            <AgentPreviewPanel
              name={name}
              characterConfig={characterConfig}
              onClose={() => setShowPreview(false)}
              modeColors={modeColors}
            />
          )}
        </AnimatePresence>
      </div>
      
      {/* Footer */}
      <WizardFooter
        currentStep={currentStep}
        totalSteps={steps.length}
        canProceed={canProceed}
        isSubmitting={isSubmitting}
        onBack={handleBack}
        onNext={handleNext}
        onSubmit={handleSubmit}
        showPreview={showPreview}
        onTogglePreview={() => setShowPreview(!showPreview)}
        modeColors={modeColors}
      />
    </div>
  );
}

// ============================================================================
// Sub-Component Definitions
// ============================================================================

interface WizardHeaderProps {
  steps: { id: string; label: string; icon: React.ElementType }[];
  currentStep: number;
  onClose?: () => void;
  modeColors: typeof MODE_COLORS.chat;
}

function WizardHeader({ steps, currentStep, onClose, modeColors }: WizardHeaderProps) {
  return (
    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: modeColors.border }}>
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg" style={{ background: modeColors.soft }}>
          <Sparkles size={20} style={{ color: modeColors.accent }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>Create Agent</h2>
          <p className="text-sm" style={{ color: TEXT.secondary }}>
            Step {currentStep + 1} of {steps.length}: {steps[currentStep]?.label}
          </p>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
          <X size={20} style={{ color: TEXT.tertiary }} />
        </button>
      )}
    </div>
  );
}

interface WizardFooterProps {
  currentStep: number;
  totalSteps: number;
  canProceed: boolean;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  modeColors: typeof MODE_COLORS.chat;
}

function WizardFooter({
  currentStep,
  totalSteps,
  canProceed,
  isSubmitting,
  onBack,
  onNext,
  onSubmit,
  showPreview,
  onTogglePreview,
  modeColors,
}: WizardFooterProps) {
  const isLastStep = currentStep === totalSteps - 1;
  
  return (
    <div className="px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: modeColors.border }}>
      <div className="flex items-center gap-2">
        <button
          onClick={onTogglePreview}
          className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ 
            background: showPreview ? modeColors.soft : 'rgba(255,255,255,0.05)',
            color: showPreview ? modeColors.accent : TEXT.secondary,
          }}
        >
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>
      
      <div className="flex items-center gap-3">
        {currentStep > 0 && (
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ color: TEXT.secondary }}
          >
            Back
          </button>
        )}
        
        {isLastStep ? (
          <button
            onClick={onSubmit}
            disabled={!canProceed || isSubmitting}
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ 
              background: modeColors.accent,
              color: '#1A1612',
            }}
          >
            {isSubmitting ? 'Creating...' : 'Create Agent'}
          </button>
        ) : (
          <button
            onClick={onNext}
            disabled={!canProceed}
            className="px-6 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ 
              background: modeColors.accent,
              color: '#1A1612',
            }}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}

interface AdvancedStepProps {
  config: CharacterLayerConfig;
  setConfig: (config: CharacterLayerConfig) => void;
  capabilities: string[];
  setCapabilities: (caps: string[]) => void;
  modeColors: typeof MODE_COLORS.chat;
}

function AdvancedStep({ config, setConfig, capabilities, setCapabilities, modeColors }: AdvancedStepProps) {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>Advanced Configuration</h2>
        <p style={{ color: TEXT.secondary }}>Fine-tune your agent's behavior and capabilities</p>
      </div>
      
      {/* Relationships */}
      <FormField label="Default Relationship Settings">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1 block" style={{ color: TEXT.tertiary }}>Initial Affinity</label>
            <input
              type="range"
              min={-1}
              max={1}
              step={0.1}
              value={config.relationships.defaults.initialAffinity}
              onChange={(e) => setConfig({
                ...config,
                relationships: {
                  ...config.relationships,
                  defaults: { ...config.relationships.defaults, initialAffinity: parseFloat(e.target.value) }
                }
              })}
              className="w-full"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: TEXT.tertiary }}>Trust Curve</label>
            <select
              value={config.relationships.defaults.trustCurve}
              onChange={(e) => setConfig({
                ...config,
                relationships: {
                  ...config.relationships,
                  defaults: { ...config.relationships.defaults, trustCurve: e.target.value as 'linear' | 'exponential' | 'logarithmic' }
                }
              })}
              className="w-full px-3 py-2 rounded-lg"
              style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${modeColors.border}`, color: TEXT.primary }}
            >
              <option value="linear">Linear</option>
              <option value="exponential">Exponential</option>
              <option value="logarithmic">Logarithmic</option>
            </select>
          </div>
        </div>
      </FormField>
      
      {/* Progression Stats */}
      <FormField label="Relevant Stats">
        <TagInput
          tags={config.progression.relevantStats}
          onChange={(stats) => setConfig({ ...config, progression: { ...config.progression, relevantStats: stats } })}
          placeholder="Add stats (e.g., efficiency, quality)..."
          modeColors={modeColors}
        />
      </FormField>
      
      {/* Capabilities */}
      <FormField label="Agent Capabilities">
        <TagInput
          tags={capabilities}
          onChange={setCapabilities}
          placeholder="Add capabilities..."
          modeColors={modeColors}
        />
      </FormField>
    </div>
  );
}

// ============================================================================
// Step Components
// ============================================================================

function IdentityStep({
  name, setName,
  description, setDescription,
  agentType, setAgentType,
  model, setModel,
  provider, setProvider,
  availableModels,
  modeColors,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  agentType: AgentType; setAgentType: (v: AgentType) => void;
  model: string; setModel: (v: string) => void;
  provider: ModelProvider; setProvider: (v: ModelProvider) => void;
  availableModels: string[];
  modeColors: typeof MODE_COLORS.chat;
}) {
  const agentTypes: { id: AgentType; label: string; description: string; icon: React.ElementType }[] = [
    { id: 'orchestrator', label: 'Orchestrator', description: 'Coordinates multiple agents', icon: Target },
    { id: 'specialist', label: 'Specialist', description: 'Deep expertise in one area', icon: Sparkles },
    { id: 'worker', label: 'Worker', description: 'General task execution', icon: Wrench },
    { id: 'reviewer', label: 'Reviewer', description: 'Reviews and validates work', icon: Check },
    { id: 'sub-agent', label: 'Sub-Agent', description: 'Works under an orchestrator', icon: Users },
  ];
  
  const models = availableModels.length > 0 ? availableModels : [
    'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo',
    'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    'gemini-pro', 'gemini-ultra',
  ];
  
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Agent Identity
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Define the core identity of your agent
        </p>
      </div>
      
      {/* Name & Description */}
      <div className="space-y-4">
        <FormField label="Name" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Code Reviewer Pro"
            className="w-full px-4 py-3 rounded-xl outline-none transition-all"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </FormField>
        
        <FormField label="Description" required>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this agent does and when to use it..."
            rows={3}
            className="w-full px-4 py-3 rounded-xl outline-none transition-all resize-none"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </FormField>
      </div>
      
      {/* Agent Type */}
      <FormField label="Agent Type" required>
        <div className="grid grid-cols-2 gap-3">
          {agentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setAgentType(type.id)}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition-all"
              style={{
                background: agentType === type.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${agentType === type.id ? modeColors.border : 'transparent'}`,
              }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: agentType === type.id ? modeColors.accent : 'rgba(255,255,255,0.05)',
                }}
              >
                <type.icon size={20} color={agentType === type.id ? '#0D0B09' : modeColors.accent} />
              </div>
              <div>
                <div className="font-medium" style={{ color: agentType === type.id ? TEXT.primary : TEXT.secondary }}>
                  {type.label}
                </div>
                <div className="text-xs" style={{ color: TEXT.tertiary }}>
                  {type.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </FormField>
      
      {/* Model Selection */}
      <FormField label="Model" required>
        <div className="grid grid-cols-2 gap-3">
          {models.map((m) => (
            <button
              key={m}
              onClick={() => {
                setModel(m);
                // Auto-set provider based on model
                if (m.includes('claude')) setProvider('anthropic');
                else if (m.includes('gemini')) setProvider('google');
                else if (m.includes('local')) setProvider('local');
                else setProvider('openai');
              }}
              className="p-3 rounded-xl text-left transition-all"
              style={{
                background: model === m ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${model === m ? modeColors.border : 'transparent'}`,
              }}
            >
              <div className="font-medium capitalize" style={{ color: model === m ? TEXT.primary : TEXT.secondary }}>
                {m}
              </div>
            </button>
          ))}
        </div>
      </FormField>
    </div>
  );
}

function CharacterStep({
  config,
  setConfig,
  modeColors,
}: {
  config: CharacterLayerConfig;
  setConfig: (c: CharacterLayerConfig) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const setups = Object.entries(SETUP_CONFIG);
  
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Character Blueprint
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Define your agent's core character and specialization
        </p>
      </div>
      
      {/* Setup Selection */}
      <FormField label="Specialization Setup" required>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {setups.map(([key, setup]) => (
            <button
              key={key}
              onClick={() => {
                const newConfig = generateDefaultCharacterConfig(key as AgentSetup);
                setConfig({ ...newConfig, avatar: config.avatar }); // Preserve avatar
              }}
              className="p-4 rounded-xl text-left transition-all relative overflow-hidden"
              style={{
                background: config.identity.setup === key ? `${setup.color}15` : 'rgba(255,255,255,0.03)',
                border: `2px solid ${config.identity.setup === key ? setup.color : 'transparent'}`,
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${setup.color}30` }}
                >
                  <setup.icon size={20} color={setup.color} />
                </div>
                <div className="flex-1">
                  <div className="font-semibold" style={{ color: TEXT.primary }}>
                    {setup.label}
                  </div>
                  <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                    {setup.description}
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${setup.color}30`, color: setup.color }}>
                      {setup.className}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: TEXT.tertiary }}>
                      {setup.temperament}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </FormField>
      
      {/* Specialty Skills */}
      <FormField label="Specialty Skills">
        <div className="flex flex-wrap gap-2">
          {config.identity.specialtySkills.map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-2"
              style={{ background: modeColors.soft, color: modeColors.accent }}
            >
              {skill}
              <button
                onClick={() => {
                  const skills = [...config.identity.specialtySkills];
                  skills.splice(idx, 1);
                  setConfig({
                    ...config,
                    identity: { ...config.identity, specialtySkills: skills },
                  });
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={() => {
              const skill = prompt('Enter skill name:');
              if (skill) {
                setConfig({
                  ...config,
                  identity: { ...config.identity, specialtySkills: [...config.identity.specialtySkills, skill] },
                });
              }
            }}
            className="px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
            style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.secondary }}
          >
            <Plus size={14} />
            Add Skill
          </button>
        </div>
      </FormField>
      
      {/* Temperament */}
      <FormField label="Temperament">
        <div className="grid grid-cols-4 gap-3">
          {(['precision', 'exploratory', 'systemic', 'balanced'] as Temperament[]).map((t) => (
            <button
              key={t}
              onClick={() => setConfig({
                ...config,
                identity: { ...config.identity, temperament: t },
              })}
              className="p-3 rounded-xl text-center capitalize transition-all"
              style={{
                background: config.identity.temperament === t ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${config.identity.temperament === t ? modeColors.border : 'transparent'}`,
                color: config.identity.temperament === t ? modeColors.accent : TEXT.secondary,
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </FormField>
      
      {/* Personality Traits */}
      <FormField label="Personality Traits">
        <TagInput
          tags={config.identity.personalityTraits}
          onChange={(traits) => setConfig({
            ...config,
            identity: { ...config.identity, personalityTraits: traits },
          })}
          placeholder="Add traits (e.g., 'detail-oriented', 'creative')..."
          modeColors={modeColors}
        />
      </FormField>
      
      {/* Backstory */}
      <FormField label="Backstory / Context">
        <textarea
          value={config.identity.backstory}
          onChange={(e) => setConfig({
            ...config,
            identity: { ...config.identity, backstory: e.target.value },
          })}
          placeholder="Provide background context that shapes this agent's behavior..."
          rows={4}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
          }}
        />
      </FormField>
    </div>
  );
}



// Continue with remaining step components

function AvatarBuilderStep({ config, setConfig, mascotName, modeColors }: {
  config: AvatarConfig;
  setConfig: (c: AvatarConfig) => void;
  mascotName: string;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const templates = Object.entries(MASCOT_TEMPLATES);
  
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Avatar Builder
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Create a custom mascot that represents your agent across all views
        </p>
      </div>
      
      <FormField label="Avatar Type">
        <div className="grid grid-cols-4 gap-3">
          {(['mascot', 'glb', 'image', 'color'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setConfig({ ...config, type })}
              className="p-4 rounded-xl text-center capitalize transition-all"
              style={{
                background: config.type === type ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${config.type === type ? modeColors.border : 'transparent'}`,
                color: config.type === type ? modeColors.accent : TEXT.secondary,
              }}
            >
              {type === 'glb' ? '3D Model' : type}
            </button>
          ))}
        </div>
      </FormField>
      
      {config.type === 'mascot' && (
        <>
          <FormField label="Mascot Template">
            <div className="grid grid-cols-3 gap-4">
              {templates.map(([key, template]) => (
                <button
                  key={key}
                  onClick={() => setConfig({
                    ...config,
                    mascot: {
                      ...config.mascot!,
                      template: key as MascotTemplate,
                    },
                  })}
                  className="p-4 rounded-xl text-left transition-all"
                  style={{
                    background: config.mascot?.template === key ? modeColors.soft : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${config.mascot?.template === key ? modeColors.border : 'transparent'}`,
                  }}
                >
                  <div className="font-medium" style={{ color: TEXT.primary }}>
                    {template.name}
                  </div>
                  <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                    {template.description}
                  </div>
                  <div className="flex gap-1 mt-2">
                    {template.defaultColors.map((c, i) => (
                      <div key={i} className="w-4 h-4 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </FormField>
          
          <FormField label="Color Scheme">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs mb-1 block" style={{ color: TEXT.tertiary }}>Primary</label>
                <input
                  type="color"
                  value={config.style.primaryColor}
                  onChange={(e) => setConfig({
                    ...config,
                    style: { ...config.style, primaryColor: e.target.value },
                  })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
              <div>
                <label className="text-xs mb-1 block" style={{ color: TEXT.tertiary }}>Accent</label>
                <input
                  type="color"
                  value={config.style.accentColor}
                  onChange={(e) => setConfig({
                    ...config,
                    style: { ...config.style, accentColor: e.target.value },
                  })}
                  className="w-full h-10 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </FormField>
        </>
      )}
      
      {/* Live Preview */}
      <div 
        className="p-8 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.3)', border: `1px dashed ${modeColors.border}` }}
      >
        <MascotPreview config={config} name={mascotName} />
      </div>
    </div>
  );
}

function MascotPreview({ config, name }: { config: AvatarConfig; name: string }) {
  return (
    <div className="text-center">
      <div
        className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{
          background: config.style.primaryColor,
          boxShadow: `0 0 30px ${config.style.glowColor}`,
        }}
      >
        <Sparkles size={40} color="#fff" />
      </div>
      <div className="font-medium" style={{ color: TEXT.primary }}>
        {name}
      </div>
      <div className="text-xs" style={{ color: TEXT.tertiary }}>
        {config.mascot?.template || 'Default'} Style
      </div>
    </div>
  );
}

function RoleCardStep({ config, setConfig, modeColors }: {
  config: RoleCardConfig;
  setConfig: (c: RoleCardConfig) => void;
  agentSetup: AgentSetup;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const bans = Object.entries(HARD_BAN_CATEGORIES);
  
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Role Card
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Define boundaries, responsibilities, and escalation rules
        </p>
      </div>
      
      <FormField label="Domain">
        <input
          type="text"
          value={config.domain}
          onChange={(e) => setConfig({ ...config, domain: e.target.value })}
          placeholder="e.g., Frontend Development"
          className="w-full px-4 py-3 rounded-xl outline-none"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
          }}
        />
      </FormField>
      
      <FormField label="Hard Bans (Restrictions)">
        <div className="grid grid-cols-2 gap-3">
          {bans.map(([key, ban]) => {
            const isSelected = config.hardBans.some((b) => b.category === key);
            return (
              <button
                key={key}
                onClick={() => {
                  if (isSelected) {
                    setConfig({
                      ...config,
                      hardBans: config.hardBans.filter((b) => b.category !== key),
                    });
                  } else {
                    setConfig({
                      ...config,
                      hardBans: [...config.hardBans, { category: key as HardBanCategory, severity: ban.severity }],
                    });
                  }
                }}
                className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                style={{
                  background: isSelected ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(248,113,113,0.3)' : 'transparent'}`,
                }}
              >
                <ban.icon size={18} style={{ color: isSelected ? '#f87171' : TEXT.tertiary }} />
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: isSelected ? '#f87171' : TEXT.secondary }}>
                    {ban.label}
                  </div>
                  <div className="text-xs" style={{ color: TEXT.tertiary }}>
                    {ban.description}
                  </div>
                </div>
                {isSelected && <Check size={16} color="#f87171" />}
              </button>
            );
          })}
        </div>
      </FormField>
      
      <FormField label="Escalation Triggers">
        <TagInput
          tags={config.escalation}
          onChange={(tags) => setConfig({ ...config, escalation: tags })}
          placeholder="Add escalation triggers..."
          modeColors={modeColors}
        />
      </FormField>
    </div>
  );
}

function VoiceStep({ config, setConfig, modeColors }: {
  config: VoiceConfigLayer;
  setConfig: (c: VoiceConfigLayer) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Voice & Tone
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Configure how your agent communicates
        </p>
      </div>
      
      <FormField label="Voice Style">
        <div className="grid grid-cols-2 gap-3">
          {VOICE_STYLES.map((style) => (
            <button
              key={style.id}
              onClick={() => setConfig({ ...config, style: style.id })}
              className="p-4 rounded-xl text-left transition-all"
              style={{
                background: config.style === style.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${config.style === style.id ? modeColors.border : 'transparent'}`,
              }}
            >
              <div className="font-medium" style={{ color: config.style === style.id ? TEXT.primary : TEXT.secondary }}>
                {style.label}
              </div>
              <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                {style.description}
              </div>
            </button>
          ))}
        </div>
      </FormField>
      
      <FormField label="Tone Modifiers">
        <div className="space-y-4">
          {[
            { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal' },
            { key: 'enthusiasm', label: 'Enthusiasm', low: 'Reserved', high: 'Energetic' },
            { key: 'empathy', label: 'Empathy', low: 'Direct', high: 'Supportive' },
            { key: 'directness', label: 'Directness', low: 'Nuanced', high: 'Blunt' },
          ].map(({ key, label, low, high }) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: TEXT.secondary }}>{label}</span>
                <span style={{ color: TEXT.tertiary }}>{low} → {high}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={config.tone[key as keyof typeof config.tone]}
                onChange={(e) => setConfig({
                  ...config,
                  tone: { ...config.tone, [key]: parseFloat(e.target.value) },
                })}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </FormField>
      
      <FormField label="Voice Rules">
        <TagInput
          tags={config.rules}
          onChange={(tags) => setConfig({ ...config, rules: tags })}
          placeholder="Add voice behavior rules..."
          modeColors={modeColors}
        />
      </FormField>
    </div>
  );
}

function ToolsStep({
  selectedTools, setSelectedTools,
  systemPrompt, setSystemPrompt,
  temperature, setTemperature,
  maxIterations, setMaxIterations,
  availableTools,
  modeColors,
}: {
  selectedTools: string[]; setSelectedTools: (t: string[]) => void;
  systemPrompt: string; setSystemPrompt: (s: string) => void;
  temperature: number; setTemperature: (t: number) => void;
  maxIterations: number; setMaxIterations: (n: number) => void;
  availableTools: string[];
  modeColors: typeof MODE_COLORS.chat;
}) {
  const tools = availableTools.length > 0 ? availableTools : [
    'read_file', 'write_file', 'search_code', 'run_command',
    'ask_user', 'web_search', 'memory_query',
  ];
  
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Tools & Configuration
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Configure tools, capabilities, and runtime settings
        </p>
      </div>
      
      <FormField label="Available Tools">
        <div className="flex flex-wrap gap-2">
          {tools.map((tool) => (
            <button
              key={tool}
              onClick={() => {
                if (selectedTools.includes(tool)) {
                  setSelectedTools(selectedTools.filter((t) => t !== tool));
                } else {
                  setSelectedTools([...selectedTools, tool]);
                }
              }}
              className="px-3 py-1.5 rounded-lg text-sm transition-all"
              style={{
                background: selectedTools.includes(tool) ? modeColors.soft : 'rgba(255,255,255,0.05)',
                color: selectedTools.includes(tool) ? modeColors.accent : TEXT.secondary,
                border: `1px solid ${selectedTools.includes(tool) ? modeColors.border : 'transparent'}`,
              }}
            >
              {tool}
            </button>
          ))}
        </div>
      </FormField>
      
      <FormField label="System Prompt">
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Enter system instructions..."
          rows={6}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none font-mono text-sm"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
          }}
        />
      </FormField>
      
      <div className="grid grid-cols-2 gap-6">
        <FormField label={`Temperature: ${temperature}`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="w-full"
          />
        </FormField>
        
        <FormField label="Max Iterations">
          <input
            type="number"
            min={1}
            max={20}
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
            className="w-full px-4 py-3 rounded-xl outline-none"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </FormField>
      </div>
    </div>
  );
}

function ReviewStep({
  name, description, agentType, model,
  characterConfig, selectedTools, systemPrompt,
  temperature, maxIterations, workspaceDocs, modeColors,
}: {
  name: string; description: string; agentType: string; model: string;
  characterConfig: CharacterLayerConfig;
  selectedTools: string[]; systemPrompt: string;
  temperature: number; maxIterations: number;
  workspaceDocs: WorkspaceDocuments;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const [activeTab, setActiveTab] = useState<'summary' | 'documents'>('summary');
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2" style={{ color: TEXT.primary }}>
          Review & Create
        </h2>
        <p style={{ color: TEXT.secondary }}>
          Review your agent configuration
        </p>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('summary')}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: activeTab === 'summary' ? modeColors.soft : 'transparent',
            color: activeTab === 'summary' ? modeColors.accent : TEXT.secondary,
          }}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className="px-4 py-2 rounded-lg text-sm font-medium"
          style={{
            background: activeTab === 'documents' ? modeColors.soft : 'transparent',
            color: activeTab === 'documents' ? modeColors.accent : TEXT.secondary,
          }}
        >
          Workspace Documents
        </button>
      </div>
      
      {activeTab === 'summary' ? (
        <div className="grid grid-cols-2 gap-4">
          <ReviewCard title="Identity" icon={User} modeColors={modeColors}>
            <div className="space-y-1 text-sm">
              <div><span style={{ color: TEXT.tertiary }}>Name:</span> <span style={{ color: TEXT.primary }}>{name}</span></div>
              <div><span style={{ color: TEXT.tertiary }}>Type:</span> <span style={{ color: TEXT.primary }}>{agentType}</span></div>
              <div><span style={{ color: TEXT.tertiary }}>Model:</span> <span style={{ color: TEXT.primary }}>{model}</span></div>
            </div>
          </ReviewCard>
          
          <ReviewCard title="Character" icon={Sparkles} modeColors={modeColors}>
            <div className="space-y-1 text-sm">
              <div><span style={{ color: TEXT.tertiary }}>Setup:</span> <span style={{ color: TEXT.primary }}>{characterConfig.identity.setup}</span></div>
              <div><span style={{ color: TEXT.tertiary }}>Class:</span> <span style={{ color: TEXT.primary }}>{characterConfig.identity.className}</span></div>
              <div><span style={{ color: TEXT.tertiary }}>Skills:</span> <span style={{ color: TEXT.primary }}>{characterConfig.identity.specialtySkills.length}</span></div>
            </div>
          </ReviewCard>
        </div>
      ) : (
        <div className="space-y-4">
          <DocumentPreview title="identity.yaml" content={workspaceDocs.identity} modeColors={modeColors} />
          <DocumentPreview title="role_card.yaml" content={workspaceDocs.roleCard} modeColors={modeColors} />
          <DocumentPreview title="voice.yaml" content={workspaceDocs.voice} modeColors={modeColors} />
        </div>
      )}
    </div>
  );
}

function ReviewCard({ title, icon: Icon, children, modeColors }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${modeColors.border}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} style={{ color: modeColors.accent }} />
        <span className="font-medium" style={{ color: TEXT.primary }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function DocumentPreview({ title, content, modeColors }: {
  title: string; content: string; modeColors: typeof MODE_COLORS.chat;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div 
      className="rounded-xl overflow-hidden"
      style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${modeColors.border}` }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: modeColors.accent }} />
          <span className="font-medium text-sm" style={{ color: TEXT.primary }}>{title}</span>
        </div>
        {expanded ? <ChevronRight size={16} style={{ color: TEXT.tertiary, transform: 'rotate(90deg)' }} /> : <ChevronRight size={16} style={{ color: TEXT.tertiary }} />}
      </button>
      {expanded && (
        <pre 
          className="p-3 text-xs overflow-auto max-h-64"
          style={{ color: TEXT.secondary, borderTop: `1px solid ${modeColors.border}` }}
        >
          {content}
        </pre>
      )}
    </div>
  );
}

function AgentPreviewPanel({ name, characterConfig, onClose, modeColors }: {
  name: string;
  characterConfig: CharacterLayerConfig;
  onClose: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="w-80 border-l flex flex-col"
      style={{ borderColor: modeColors.border, background: 'rgba(0,0,0,0.3)' }}
    >
      <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: modeColors.border }}>
        <h3 className="font-semibold" style={{ color: TEXT.primary }}>Live Preview</h3>
        <button onClick={onClose}><X size={18} style={{ color: TEXT.tertiary }} /></button>
      </div>
      
      <div className="flex-1 p-4 space-y-6 overflow-y-auto">
        {/* Avatar Preview */}
        <div className="text-center">
          <div
            className="w-32 h-32 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{
              background: characterConfig.avatar.style.primaryColor,
              boxShadow: `0 0 40px ${characterConfig.avatar.style.glowColor}`,
            }}
          >
            <Sparkles size={48} color="#fff" />
          </div>
          <div className="font-semibold" style={{ color: TEXT.primary }}>
            {name || 'Unnamed Agent'}
          </div>
          <div className="text-sm" style={{ color: TEXT.secondary }}>
            {characterConfig.identity.className}
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-lg font-semibold" style={{ color: modeColors.accent }}>
              {characterConfig.identity.specialtySkills.length}
            </div>
            <div className="text-[10px]" style={{ color: TEXT.tertiary }}>Skills</div>
          </div>
          <div className="p-2 rounded-lg text-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-lg font-semibold" style={{ color: modeColors.accent }}>
              {characterConfig.roleCard.hardBans.length}
            </div>
            <div className="text-[10px]" style={{ color: TEXT.tertiary }}>Restrictions</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Utility Components
function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
        {label}
        {required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder, modeColors }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder: string;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const [input, setInput] = useState('');
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      onChange([...tags, input.trim()]);
      setInput('');
    }
  };
  
  const removeTag = (idx: number) => {
    const newTags = [...tags];
    newTags.splice(idx, 1);
    onChange(newTags);
  };
  
  return (
    <div 
      className="flex flex-wrap gap-2 p-2 rounded-xl"
      style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${modeColors.border}` }}
    >
      {tags.map((tag, idx) => (
        <span
          key={idx}
          className="px-2 py-1 rounded-lg text-sm flex items-center gap-1"
          style={{ background: modeColors.soft, color: modeColors.accent }}
        >
          {tag}
          <button onClick={() => removeTag(idx)}><X size={12} /></button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[100px] bg-transparent outline-none text-sm"
        style={{ color: TEXT.primary }}
      />
    </div>
  );
}
