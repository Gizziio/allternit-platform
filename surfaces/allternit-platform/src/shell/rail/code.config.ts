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

  // Swarm ADE - Opens unified Swarm Monitor with Thread Weave, Episodes, and Health tabs
  {
    id: 'swarm-ade',
    title: 'Swarm ADE',
    icon: Cpu as RailIcon,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'cd-swarm-ade',
        label: 'Swarm ADE',
        icon: Cpu as RailIcon,
        payload: 'swarm',  // Opens SwarmMonitor with Slate-style tabs
      },
    ]
  },

  // Threads Section
  {
    id: 'threads',
    title: 'Threads',
    icon: ChatTeardropText as RailIcon,
    collapsible: false,
    defaultExpanded: true,
    items: [],
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
