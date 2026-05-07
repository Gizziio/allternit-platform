/**
 * Code Mode Rail Configuration
 */

import {
  Plus,
  Robot,
  CalendarCheck,
  ChatTeardropText,
} from '@phosphor-icons/react';
import { RailConfigSection } from './rail.config';

export const CODE_RAIL_CONFIG: RailConfigSection[] = [
  // New Thread - Top action
  {
    id: 'new-thread',
    title: '',
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'cd-new-thread',
        label: 'New Thread',
        icon: Plus,
        payload: 'code',
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },

  // Agent Hub
  {
    id: 'agent-hub',
    title: 'Agent',
    icon: Robot,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'cd-agent-hub',
        label: 'Agent Hub',
        icon: Robot,
        payload: 'agent-hub',
        shortcut: '⌘⇧A'
      },
    ]
  },

  // Cron
  {
    id: 'cron',
    title: 'Cron',
    icon: CalendarCheck,
    collapsible: false,
    defaultExpanded: true,
    items: [
      {
        id: 'cd-cron',
        label: 'Cron',
        icon: CalendarCheck,
        payload: 'code-automations',
      },
    ]
  },

  // Threads Section (dynamic)
  {
    id: 'threads',
    title: 'Threads',
    icon: ChatTeardropText,
    collapsible: false,
    defaultExpanded: true,
    items: [],
  },
];
