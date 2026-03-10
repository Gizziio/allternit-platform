/**
 * Code Mode Rail Configuration
 * 
 * Organized structure:
 * - header: Logo/brand, Mode switcher
 * - core: Main navigation
 * - automation: Automations, Skills
 * - infrastructure: Swarm, Policy, Task Executor, Ontology
 * - security: Security, Receipts, Purpose
 * - observability: Dashboard, Evaluation, GC Agents
 * - dag: DAG/WIH, Checkpointing, Directive
 * - execution: Runs, Queue, OpenClaw, Terminal
 * - repo: Git Graph, Config
 */

import {
  ChatText,
  Code,
  Lightning,
  Robot,
  ClockCounterClockwise,
  Gear,
  GitBranch,
  TerminalWindow,
  BracketsCurly,
  List,
  Cpu,
  // Infrastructure icons
  Network,
  LockKey,
  Engine,
  GitMerge,
  // Security icons
  FileText,
  Warning,
  Target,
  // Observability icons
  ChartLineUp,
  FlowArrow,
  // Additional icons
  Plus,
  Folder,
  Bug,
  Folders,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

// Type cast for icon compatibility with RailConfigSection
type RailIcon = React.ComponentType<{ size?: number | string; weight?: any; color?: string }>;

export const CODE_RAIL_CONFIG: RailConfigSection[] = [
  // Core Navigation
  {
    id: 'core',
    title: 'Core',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { id: 'cd-workspace', label: 'Workspace', icon: Code as RailIcon, payload: 'code' },
      { id: 'cd-threads', label: 'Threads', icon: ChatText as RailIcon, payload: 'code-threads' },
      { 
        id: 'cd-new', 
        label: 'New File', 
        icon: Plus as RailIcon, 
        payload: 'new-file', 
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },
  
  // Repository
  {
    id: 'repo',
    title: 'Repository',
    icon: Folder as RailIcon,
    defaultExpanded: true,
    collapsible: true,
    items: [
      { id: 'cd-explorer', label: 'Explorer', icon: Folders as RailIcon, payload: 'code-explorer' },
      { id: 'cd-git', label: 'Git Graph', icon: GitBranch as RailIcon, payload: 'code-git' },
      { id: 'cd-search', label: 'Search', icon: FlowArrow as RailIcon, payload: 'search' },
      { id: 'cd-config', label: 'Config', icon: BracketsCurly as RailIcon, payload: 'settings' },
    ]
  },
  
  // Automation
  {
    id: 'automation',
    title: 'Automation',
    icon: Lightning as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'code-agent-session', label: 'Agent IDE', icon: Robot as RailIcon, payload: 'code-agent-session' },
      { id: 'cd-automations', label: 'Automations', icon: Lightning as RailIcon, payload: 'code-automations' },
      { id: 'cd-skills', label: 'Skills/Plugins', icon: Robot as RailIcon, payload: 'code-skills' },
    ]
  },
  
  // Infrastructure
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    icon: Network as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-swarm', label: 'Swarm Monitor', icon: Network as RailIcon, payload: 'swarm' },
      { id: 'cd-policy', label: 'Policy', icon: LockKey as RailIcon, payload: 'policy' },
      { id: 'cd-task-executor', label: 'Task Executor', icon: Engine as RailIcon, payload: 'task-executor' },
      { id: 'cd-ontology', label: 'Ontology', icon: GitMerge as RailIcon, payload: 'ontology' },
    ]
  },
  
  // Security & Governance
  {
    id: 'security',
    title: 'Security',
    icon: Warning as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-security', label: 'Security', icon: Warning as RailIcon, payload: 'security' },
      { id: 'cd-receipts', label: 'Receipts', icon: FileText as RailIcon, payload: 'receipts' },
      { id: 'cd-purpose', label: 'Purpose', icon: Target as RailIcon, payload: 'purpose' },
    ]
  },
  
  // Observability
  {
    id: 'observability',
    title: 'Observability',
    icon: ChartLineUp as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-dashboard', label: 'Dashboard', icon: ChartLineUp as RailIcon, payload: 'observability' },
      { id: 'cd-evaluation', label: 'Evaluation', icon: ChartLineUp as RailIcon, payload: 'evaluation' },
      { id: 'cd-gc-agents', label: 'GC Agents', icon: Engine as RailIcon, payload: 'gc-agents' },
    ]
  },
  
  // DAG & Execution
  {
    id: 'dag',
    title: 'DAG & Execution',
    icon: FlowArrow as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-dag-wih', label: 'DAG/WIH', icon: FlowArrow as RailIcon, payload: 'dag-wih' },
      { id: 'cd-checkpointing', label: 'Checkpointing', icon: ClockCounterClockwise as RailIcon, payload: 'checkpointing' },
      { id: 'cd-directive', label: 'Directive', icon: Cpu as RailIcon, payload: 'directive' },
    ]
  },
  
  // Execution Tools
  {
    id: 'execution',
    title: 'Execution',
    icon: TerminalWindow as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-runs', label: 'Runs', icon: ClockCounterClockwise as RailIcon, payload: 'rails' },
      { id: 'cd-queue', label: 'Work Queue', icon: List as RailIcon, payload: 'rails' },
      { id: 'cd-terminal', label: 'Terminal', icon: TerminalWindow as RailIcon, payload: 'terminal', shortcut: '⌘`'},
      { id: 'cd-debug', label: 'Debug', icon: Bug as RailIcon, payload: 'debug' },
    ]
  },
  
  // System
  {
    id: 'system',
    title: 'System',
    icon: Gear as RailIcon,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-openclaw-control', label: 'OpenClaw Control', icon: Gear as RailIcon, payload: 'openclaw' },
      { id: 'cd-settings', label: 'Settings', icon: Gear as RailIcon, payload: 'settings' },
    ]
  }
];
