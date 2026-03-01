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
  ChatTeardropText,
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

export const CODE_RAIL_CONFIG: RailConfigSection[] = [
  // Core Navigation
  {
    id: 'core',
    title: 'Core',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { id: 'cd-workspace', label: 'Workspace', icon: Code, payload: 'code' },
      { id: 'cd-threads', label: 'Threads', icon: ChatTeardropText, payload: 'code-threads' },
      { 
        id: 'cd-new', 
        label: 'New File', 
        icon: Plus, 
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
    icon: Folder,
    defaultExpanded: true,
    collapsible: true,
    items: [
      { id: 'cd-explorer', label: 'Explorer', icon: Folders, payload: 'code-explorer' },
      { id: 'cd-git', label: 'Git Graph', icon: GitBranch, payload: 'code-git' },
      { id: 'cd-search', label: 'Search', icon: FlowArrow, payload: 'search' },
      { id: 'cd-config', label: 'Config', icon: BracketsCurly, payload: 'settings' },
    ]
  },
  
  // Automation
  {
    id: 'automation',
    title: 'Automation',
    icon: Lightning,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-automations', label: 'Automations', icon: Lightning, payload: 'code-automations' },
      { id: 'cd-skills', label: 'Skills/Plugins', icon: Robot, payload: 'code-skills' },
    ]
  },
  
  // Infrastructure
  {
    id: 'infrastructure',
    title: 'Infrastructure',
    icon: Network,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-swarm', label: 'Swarm Monitor', icon: Network, payload: 'swarm' },
      { id: 'cd-policy', label: 'Policy', icon: LockKey, payload: 'policy' },
      { id: 'cd-task-executor', label: 'Task Executor', icon: Engine, payload: 'task-executor' },
      { id: 'cd-ontology', label: 'Ontology', icon: GitMerge, payload: 'ontology' },
    ]
  },
  
  // Security & Governance
  {
    id: 'security',
    title: 'Security',
    icon: Warning,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-security', label: 'Security', icon: Warning, payload: 'security' },
      { id: 'cd-receipts', label: 'Receipts', icon: FileText, payload: 'receipts' },
      { id: 'cd-purpose', label: 'Purpose', icon: Target, payload: 'purpose' },
    ]
  },
  
  // Observability
  {
    id: 'observability',
    title: 'Observability',
    icon: ChartLineUp,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-dashboard', label: 'Dashboard', icon: ChartLineUp, payload: 'observability' },
      { id: 'cd-evaluation', label: 'Evaluation', icon: ChartLineUp, payload: 'evaluation' },
      { id: 'cd-gc-agents', label: 'GC Agents', icon: Engine, payload: 'gc-agents' },
    ]
  },
  
  // DAG & Execution
  {
    id: 'dag',
    title: 'DAG & Execution',
    icon: FlowArrow,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-dag-wih', label: 'DAG/WIH', icon: FlowArrow, payload: 'dag-wih' },
      { id: 'cd-checkpointing', label: 'Checkpointing', icon: ClockCounterClockwise, payload: 'checkpointing' },
      { id: 'cd-directive', label: 'Directive', icon: Cpu, payload: 'directive' },
    ]
  },
  
  // Execution Tools
  {
    id: 'execution',
    title: 'Execution',
    icon: TerminalWindow,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-runs', label: 'Runs', icon: ClockCounterClockwise, payload: 'rails' },
      { id: 'cd-queue', label: 'Work Queue', icon: List, payload: 'rails' },
      { id: 'cd-terminal', label: 'Terminal', icon: TerminalWindow, payload: 'terminal', shortcut: '⌘`'},
      { id: 'cd-debug', label: 'Debug', icon: Bug, payload: 'debug' },
    ]
  },
  
  // System
  {
    id: 'system',
    title: 'System',
    icon: Gear,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cd-openclaw-control', label: 'OpenClaw Control', icon: Gear, payload: 'openclaw' },
      { id: 'cd-settings', label: 'Settings', icon: Gear, payload: 'settings' },
    ]
  }
];
