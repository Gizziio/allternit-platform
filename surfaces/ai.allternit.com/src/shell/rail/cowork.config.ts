/**
 * Cowork Mode Rail Configuration - Redesigned
 * 
 * Structure (mirrors Chat mode):
 * - New Task (like New Chat)
 * - Agent Hub (shared with Chat mode)
 * - Cron (scheduled tasks)
 * - Tasks (like Conversations - has Tasks & Agent Tasks tabs)
 */

import {
  Plus,
  Robot,
  CalendarCheck,
  Clock,
  List,
  Lightning,
  CheckSquare,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

export const COWORK_RAIL_CONFIG: RailConfigSection[] = [
  // New Task - Top action (like New Chat)
  {
    id: 'new-task',
    title: '',
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cw-new-task', 
        label: 'New Task', 
        icon: Plus, 
        payload: 'cowork-new-task', 
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },
  
  // Agent Hub - Shared section (same as Chat mode)
  {
    id: 'agent-hub',
    title: 'Agent',
    icon: Robot,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'cw-agent-hub',
        label: 'Agent | Bot Hub',
        icon: Robot,
        payload: 'agent-hub',
        shortcut: '⌘⇧A'
      },
    ]
  },

  // Automation Tasks - Right underneath Agent Hub
  {
    id: 'cron',
    title: 'Automation Tasks',
    icon: CalendarCheck,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'cw-cron', 
        label: 'Automation Tasks', 
        icon: CalendarCheck, 
        payload: 'cowork-cron',
      },
    ]
  },
  // Tasks Section
  {
    id: 'tasks',
    title: 'Tasks',
    icon: CheckSquare,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [],
  },
];
