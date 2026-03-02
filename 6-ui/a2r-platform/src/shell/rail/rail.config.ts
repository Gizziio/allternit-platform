/**
 * Chat Mode Rail Configuration
 * 
 * Organized structure:
 * - header: Logo/brand, Mode switcher
 * - core: Main navigation actions
 * - sessions: Unified conversations lane (regular sessions, agent sessions, projects, history)
 * - agents: Agent customization and control
 * - workspace: Workspace tools
 * - ai_vision: AI & Vision tools
 * - infrastructure: DAG Infrastructure
 * - security: Security & Governance
 * - execution: Execution tools
 * - observability: Observability tools
 * - services: External services
 */

import {
  House,
  Browser,
  Layout,
  Robot,
  Brain,
  Storefront,
  ShieldCheck,
  SquaresFour,
  Gear,
  Train,
  ChatTeardropText,
  Gauge,
  // AI & Vision icons
  Eye,
  Palette,
  Image,
  // Infrastructure icons
  Users,
  Shield,
  ListChecks,
  TreeStructure,
  FileCode,
  ChartBar,
  Recycle,
  Receipt,
  Lock,
  Target,
  Globe,
  HardDrives,
  Flag,
  Cloud,
} from '@phosphor-icons/react';

export interface RailConfigItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  payload: string;
  isAction?: boolean;
  shortcut?: string;
  badge?: number;
  disabled?: boolean;
}

export interface RailConfigSection {
  id: string;
  title: string;
  icon?: React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
  items: RailConfigItem[];
  isDynamic?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

export const RAIL_CONFIG: RailConfigSection[] = [
  // Core Navigation
  {
    id: 'core',
    title: 'Core',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { id: 'browser', label: 'Browser', icon: Browser, payload: 'browser' },
      { id: 'elements', label: 'Elements Lab', icon: SquaresFour, payload: 'elements' },
      // Note: 'playground' is injected dynamically by ShellRail when the Playground feature plugin is enabled
    ]
  },
  
  // Dynamic Sessions Section (populated from ChatStore)
  {
    id: 'sessions',
    title: 'Conversations',
    icon: ChatTeardropText,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: []
  },
  
  // Agents
  {
    id: 'agents',
    title: 'Agents',
    icon: Robot,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'chat-agent-session', label: 'Agent Sessions', icon: ChatTeardropText, payload: 'chat-agent-session' },
      { id: 'agent', label: 'Agent Studio', icon: Robot, payload: 'agent' },
      { id: 'rails', label: 'Agent System', icon: Train, payload: 'rails' },
      { id: 'registry', label: 'Agent Registry', icon: ShieldCheck, payload: 'registry' },
      { id: 'memory', label: 'Memory', icon: Brain, payload: 'memory' },
      { id: 'operator', label: 'Operator Browser', icon: Browser, payload: 'operator' },
      { id: 'capsules', label: 'Capsule Manager', icon: HardDrives, payload: 'capsules' },
    ]
  },

  // Workspace Tools
  {
    id: 'workspace',
    title: 'Workspace',
    icon: Layout,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'studio', label: 'Studio', icon: Layout, payload: 'studio' },
      { id: 'marketplace', label: 'Marketplace', icon: Storefront, payload: 'marketplace' },
    ]
  },
  
  // AI & Vision
  {
    id: 'ai_vision',
    title: 'AI & Vision',
    icon: Eye,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'ivkge', label: 'IVKGE', icon: Eye, payload: 'ivkge' },
      { id: 'multimodal', label: 'Multimodal', icon: Image, payload: 'multimodal' },
      { id: 'tambo', label: 'Tambo UI Gen', icon: Palette, payload: 'tambo' },
      { id: 'a2r-ix', label: 'A2R-IX Renderer', icon: Layout, payload: 'a2r-ix' },
      { id: 'canvas', label: 'Canvas Protocol', icon: SquaresFour, payload: 'canvas' },
    ]
  },
  
  // Control Plane (P3/P4)
  {
    id: 'control_plane',
    title: 'Control Plane',
    icon: Gear,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'deploy', label: 'Cloud Deploy', icon: Cloud, payload: 'deploy' },
      { id: 'nodes', label: 'Node Management', icon: HardDrives, payload: 'nodes' },
      { id: 'context-control', label: 'Context Control', icon: Target, payload: 'context-control' },
      { id: 'hooks', label: 'Hooks System', icon: ListChecks, payload: 'hooks' },
      { id: 'form-surfaces', label: 'Form Surfaces', icon: FileCode, payload: 'form-surfaces' },
    ]
  },

  // Evolution & Memory (P4)
  {
    id: 'evolution_layer',
    title: 'Evolution',
    icon: Recycle,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'evolution', label: 'Evolution Layer', icon: Recycle, payload: 'evolution' },
      { id: 'memory-kernel', label: 'Memory Kernel', icon: Brain, payload: 'memory-kernel' },
      { id: 'acf', label: 'Autonomous Code Factory', icon: FileCode, payload: 'acf' },
    ]
  },

  // DAG Infrastructure
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    icon: HardDrives,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'swarm', label: 'Swarm Monitor', icon: Users, payload: 'swarm' },
      { id: 'policy', label: 'Policy Manager', icon: Shield, payload: 'policy' },
      { id: 'task-executor', label: 'Task Executor', icon: ListChecks, payload: 'task-executor' },
      { id: 'ontology', label: 'Ontology Viewer', icon: TreeStructure, payload: 'ontology' },
      { id: 'directive', label: 'Directive Compiler', icon: FileCode, payload: 'directive' },
      { id: 'evaluation', label: 'Evaluation', icon: ChartBar, payload: 'evaluation' },
      { id: 'gc-agents', label: 'GC Agents', icon: Recycle, payload: 'gc-agents' },
    ]
  },
  
  // Security & Governance
  {
    id: 'security',
    title: 'Security',
    icon: Lock,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'receipts', label: 'Receipts', icon: Receipt, payload: 'receipts' },
      { id: 'policy-gating', label: 'Policy Gating', icon: Lock, payload: 'policy-gating' },
      { id: 'security', label: 'Security', icon: ShieldCheck, payload: 'security' },
      { id: 'purpose', label: 'Purpose Binding', icon: Target, payload: 'purpose' },
    ]
  },
  
  // Execution
  {
    id: 'execution',
    title: 'Execution',
    icon: Flag,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'runtime-ops', label: 'Runtime Ops', icon: Gauge, payload: 'runtime-ops' },
      { id: 'browserview', label: 'Browser View', icon: Globe, payload: 'browserview' },
      { id: 'dag-wih', label: 'DAG WIH', icon: HardDrives, payload: 'dag-wih' },
      { id: 'checkpointing', label: 'Checkpointing', icon: Flag, payload: 'checkpointing' },
    ]
  },
  
  // Observability
  {
    id: 'observability',
    title: 'Observability',
    icon: Gauge,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'observability', label: 'Dashboard', icon: Gauge, payload: 'observability' },
    ]
  },
  
  // Services
  {
    id: 'services',
    title: 'Services',
    icon: Cloud,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'openclaw', label: 'OpenClaw Control', icon: Gear, payload: 'openclaw' },
      { id: 'dag', label: 'DAG Integration', icon: Gauge, payload: 'dag' },
    ]
  }
];

// Helper to find section by ID
export const getRailSection = (sectionId: string): RailConfigSection | undefined => {
  return RAIL_CONFIG.find((s) => s.id === sectionId);
};

// Helper to find item by ID
export const getRailItem = (itemId: string): RailConfigItem | undefined => {
  for (const section of RAIL_CONFIG) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
};
