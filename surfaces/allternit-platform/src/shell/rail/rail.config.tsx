/**
 * Chat Mode Rail Configuration
 */

import type { Icon } from '@phosphor-icons/react';
import {
  ChatTeardropText,
  Robot,
  Plus,
  Lightning,
  Palette,
  Code,
  Globe,
} from '@phosphor-icons/react';

export interface RailConfigItem {
  id: string;
  label: string;
  icon: Icon;
  payload: string;
  isAction?: boolean;
  shortcut?: string;
  badge?: number;
  disabled?: boolean;
}

export interface RailConfigSection {
  id: string;
  title: string;
  icon?: Icon | React.FC<{ size?: number | string }>;
  items: RailConfigItem[];
  isDynamic?: boolean;
  defaultExpanded?: boolean;
  collapsible?: boolean;
}

export function MatrixLogo({ size = 20 }: { size?: number | string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="4" height="4" fill="currentColor" />
      <rect x="8" y="8" width="4" height="4" fill="currentColor" />
      <rect x="12" y="4" width="4" height="4" fill="currentColor" />
      <rect x="16" y="8" width="4" height="4" fill="currentColor" />
      <rect x="8" y="12" width="4" height="4" fill="currentColor" />
      <rect x="12" y="12" width="4" height="4" fill="currentColor" />
      <rect x="8" y="16" width="4" height="4" fill="currentColor" />
      <rect x="12" y="16" width="4" height="4" fill="currentColor" />
    </svg>
  );
}

export const RAIL_CONFIG: RailConfigSection[] = [
  {
    id: 'primary',
    title: 'Home',
    items: [
      { 
        id: 'chat', 
        label: 'Chat', 
        icon: ChatTeardropText, 
        payload: 'chat',
        shortcut: '⌘⇧C'
      },
      { 
        id: 'allternit-design',
        label: 'Allternit Design',
        icon: Palette, 
        payload: 'design',
        shortcut: '⌘⇧D'
      },
      { 
        id: 'code', 
        label: 'Code', 
        icon: Code, 
        payload: 'code',
        shortcut: '⌘⇧K'
      },
      { 
        id: 'browser', 
        label: 'Browser', 
        icon: Globe, 
        payload: 'browser',
        shortcut: '⌘⇧B'
      },
    ]
  },
  {
    id: 'chat-tools',
    title: 'Chat Controls',
    icon: MatrixLogo,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'new-chat', 
        label: 'New Chat', 
        icon: Plus, 
        payload: 'chat', 
        isAction: true,
        shortcut: '⌘N'
      },
    ]
  },
  {
    id: 'agent',
    title: 'Agent',
    icon: Robot,
    collapsible: false,
    defaultExpanded: true,
    items: [
      { 
        id: 'agent-hub', 
        label: 'Agent Hub', 
        icon: Robot, 
        payload: 'agent-hub',
        shortcut: '⌘⇧A'
      },
    ]
  },
  {
    id: 'sessions',
    title: 'Sessions',
    icon: ChatTeardropText,
    isDynamic: true,
    defaultExpanded: true,
    collapsible: true,
    items: [],
  },
];

export const getRailSection = (sectionId: string): RailConfigSection | undefined => {
  return RAIL_CONFIG.find((s) => s.id === sectionId);
};

export const getRailItem = (itemId: string): RailConfigItem | undefined => {
  for (const section of RAIL_CONFIG) {
    const item = section.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
};
