/**
 * Code Mode Rail Configuration - Redesigned
 * 
 * Structure (mirrors Chat/Cowork mode):
 * - New Thread (like New Chat/New Task)
 * - Agent Hub (shared with other modes)
 * - Cron (scheduled automations)
 * - Swarm ADE (Agent IDE + Swarm Monitor integrated)
 * > (separator)
 * - Threads (with Threads & Agent Threads sub-tabs)
 * - Projects (where new threads are mounted)
 * 
 * Bottom:
 * - OpenClaw Control
 * - Combined Policy/Security/Purpose
 */

import {
  Plus,
  Robot,
  CalendarCheck,
  Cpu,
  ChatTeardropText,
  Gear,
  ShieldCheck,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

// Type cast for icon compatibility with RailConfigSection
type RailIcon = React.ComponentType<{ size?: number | string; weight?: any; color?: string }>;

export const CODE_RAIL_CONFIG: RailConfigSection[] = [
  // New Thread - Top action (like New Chat/New Task)
  {
    id: 'new-thread',
    title: '',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cd-new-thread', 
        label: 'New Thread', 
        icon: Plus as RailIcon, 
        payload: 'code', 
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },
  
  // Agent Hub - Shared section (same as Chat/Cowork mode)
  {
    id: 'agent-hub',
    title: 'Agent',
    icon: Robot as RailIcon,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cd-agent-hub', 
        label: 'Agent Hub', 
        icon: Robot as RailIcon, 
        payload: 'agent-hub',
        shortcut: '⌘⇧A'
      },
    ]
  },
  
  // Cron - Scheduled automations (like Cowork mode)
  {
    id: 'cron',
    title: 'Cron',
    icon: CalendarCheck as RailIcon,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cd-cron', 
        label: 'Cron', 
        icon: CalendarCheck as RailIcon, 
        payload: 'code-automations',
      },
    ]
  },
  
  // Swarm ADE - Agent IDE + Swarm Monitor integrated
  {
    id: 'swarm-ade',
    title: 'Swarm ADE',
    icon: Cpu as RailIcon,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cd-swarm-ade', 
        label: 'Agent IDE', 
        icon: Cpu as RailIcon, 
        payload: 'code-agent-session',
      },
      { 
        id: 'cd-swarm-monitor', 
        label: 'Swarm Monitor', 
        icon: Cpu as RailIcon, 
        payload: 'swarm',
      },
    ]
  },
  
  // Threads Section - Mirrors Chat's Conversations / Cowork's Tasks
  // Has "Threads" and "Agent Threads" sub-tabs
  {
    id: 'threads',
    title: 'Threads',
    icon: ChatTeardropText as RailIcon,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [],
  },
  
  // Governance - Combined Policy/Security/Purpose
  {
    id: 'governance',
    title: 'Governance',
    icon: ShieldCheck as RailIcon,
    collapsible: true,
    defaultExpanded: false,
    items: [
      { 
        id: 'cd-policy', 
        label: 'Policy', 
        icon: ShieldCheck as RailIcon, 
        payload: 'policy',
      },
      { 
        id: 'cd-security', 
        label: 'Security', 
        icon: ShieldCheck as RailIcon, 
        payload: 'security',
      },
      { 
        id: 'cd-purpose', 
        label: 'Purpose', 
        icon: ShieldCheck as RailIcon, 
        payload: 'purpose',
      },
    ]
  },
  
  // System - OpenClaw Control at bottom
  {
    id: 'system',
    title: 'System',
    icon: Gear as RailIcon,
    collapsible: true,
    defaultExpanded: false,
    items: [
      { 
        id: 'cd-openclaw-control', 
        label: 'OpenClaw Control', 
        icon: Gear as RailIcon, 
        payload: 'openclaw' 
      },
    ]
  }
];
