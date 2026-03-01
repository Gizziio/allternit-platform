/**
 * Cowork Mode Rail Configuration
 * 
 * Organized structure:
 * - header: Logo/brand, Mode switcher
 * - core: Main navigation
 * - workstreams: Runs, Drafts, Tasks
 * - artifacts: Docs, Tables, Files, Exports
 * - plugins: Installed, Skills, Commands, MCPs
 * - context: Projects, Sessions, Sources
 * - system: Settings
 */

import { 
  House, 
  Files, 
  PlugsConnected, 
  Robot, 
  Toolbox, 
  Gear,
  Note,
  Table,
  Kanban,
  Globe,
  Database,
  ShieldCheck,
  Brain,
  ChatTeardropText,
  ClockCounterClockwise,
  ArrowSquareOut,
  Plus,
  // Additional icons
  FileText,
  ChartLineUp,
  Target,
  Lightbulb,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

export const COWORK_RAIL_CONFIG: RailConfigSection[] = [
  // Core Navigation
  {
    id: 'core',
    title: 'Core',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cw-new', 
        label: 'New Document', 
        icon: Plus, 
        payload: 'new-document', 
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },
  
  // Workstreams
  {
    id: 'workstreams',
    title: 'Workstreams',
    icon: Kanban,
    defaultExpanded: true,
    collapsible: true,
    items: [
      { id: 'cw-runs', label: 'Runs', icon: ClockCounterClockwise, payload: 'cowork-runs', badge: 3 },
      { id: 'cw-drafts', label: 'Drafts', icon: Note, payload: 'cowork-drafts' },
      { id: 'cw-tasks', label: 'Tasks', icon: Kanban, payload: 'cowork-tasks', badge: 7 },
    ]
  },
  
  // Artifacts
  {
    id: 'artifacts',
    title: 'Artifacts',
    icon: Files,
    defaultExpanded: true,
    collapsible: true,
    items: [
      { id: 'cw-docs', label: 'Documents', icon: FileText, payload: 'cowork-documents' },
      { id: 'cw-tables', label: 'Tables', icon: Table, payload: 'cowork-tables' },
      { id: 'cw-files', label: 'Files', icon: Files, payload: 'cowork-files' },
      { id: 'cw-exports', label: 'Exports', icon: ArrowSquareOut, payload: 'cowork-exports' },
    ]
  },
  
  // Plugins
  {
    id: 'plugins',
    title: 'Plugins',
    icon: PlugsConnected,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cw-installed', label: 'Installed', icon: PlugsConnected, payload: 'plugins' },
      { id: 'cw-skills', label: 'Skills', icon: Brain, payload: 'plugins' },
      { id: 'cw-commands', label: 'Commands', icon: ShieldCheck, payload: 'plugins' },
      { id: 'cw-mcp', label: 'MCPs', icon: Globe, payload: 'plugins' },
    ]
  },
  
  // Context
  {
    id: 'context',
    title: 'Context',
    icon: Database,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cw-projects', label: 'Projects', icon: Toolbox, payload: 'workspace' },
      { id: 'cw-sessions', label: 'Sessions', icon: ChatTeardropText, payload: 'chat' },
      { id: 'cw-insights', label: 'Insights', icon: Lightbulb, payload: 'insights' },
      { id: 'cw-sources', label: 'Sources', icon: Database, payload: 'workspace' },
    ]
  },
  
  // Analytics
  {
    id: 'analytics',
    title: 'Analytics',
    icon: ChartLineUp,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cw-activity', label: 'Activity', icon: ClockCounterClockwise, payload: 'activity' },
      { id: 'cw-goals', label: 'Goals', icon: Target, payload: 'goals' },
    ]
  },
  
  // System
  {
    id: 'system',
    title: 'Settings',
    icon: Gear,
    defaultExpanded: false,
    collapsible: true,
    items: [
      { id: 'cw-settings', label: 'Settings', icon: Gear, payload: 'settings' },
      { id: 'cw-openclaw', label: 'OpenClaw', icon: Robot, payload: 'openclaw' },
    ]
  }
];
