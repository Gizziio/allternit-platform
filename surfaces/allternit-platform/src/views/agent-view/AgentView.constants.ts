import type { MascotTemplate } from "@/lib/agents/agent.types";
import {
  Brain,
  Terminal,
  MagnifyingGlass,
  Globe,
} from '@phosphor-icons/react';

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

export const CAPABILITY_CATEGORIES = [
  { id: 'core', label: 'Core Intelligence', icon: Brain },
  { id: 'system', label: 'System Access', icon: Terminal },
  { id: 'data', label: 'Data & Analysis', icon: MagnifyingGlass },
  { id: 'communication', label: 'Communication', icon: Globe },
];

export const AGENT_CAPABILITIES_ENHANCED = [
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

export const ENHANCED_VOICE_STYLES = [
  { id: 'professional', label: 'Professional', description: 'Formal, business-like communication' },
  { id: 'casual', label: 'Casual', description: 'Relaxed, conversational tone' },
  { id: 'enthusiastic', label: 'Enthusiastic', description: 'High energy, excited' },
  { id: 'analytical', label: 'Analytical', description: 'Precise, data-driven language' },
  { id: 'empathetic', label: 'Empathetic', description: 'Understanding, supportive tone' },
  { id: 'witty', label: 'Witty', description: 'Clever, humorous when appropriate' },
  { id: 'direct', label: 'Direct', description: 'Straightforward, no fluff' },
  { id: 'teaching', label: 'Teaching', description: 'Educational, explanatory' },
];

export const ENHANCED_HARD_BAN_CATEGORIES = {
  publishing: { label: 'Publishing', description: 'No direct posting to public platforms', severity: 'fatal' },
  deploy: { label: 'Deployment', description: 'No production deployments', severity: 'fatal' },
  data_exfil: { label: 'Data Exfiltration', description: 'No unauthorized data export', severity: 'fatal' },
  payments: { label: 'Financial Transactions', description: 'No payment processing', severity: 'fatal' },
  email_send: { label: 'Outbound Email', description: 'No sending emails externally', severity: 'warning' },
  file_delete: { label: 'Destructive Deletion', description: 'No permanent file deletion', severity: 'warning' },
};

// Studio theme for agent creation UI
// NOTE: Heavy components should use useStudioTheme() hook for perf (caches getComputedStyle).
// This export is a lightweight fallback for smaller components that don't warrant a hook.
export const STUDIO_THEME = {
  accent: '#D4B08C',
  bg: '#1A1612',
  bgCard: 'rgba(26, 22, 18, 0.95)',
  border: 'rgba(212, 176, 140, 0.16)',
  borderSubtle: 'rgba(212, 176, 140, 0.10)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6E6E6E',
};
