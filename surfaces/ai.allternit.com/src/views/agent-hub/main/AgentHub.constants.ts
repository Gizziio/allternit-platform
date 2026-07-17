import { PaintBrush, ChatText, ChartLineUp, Folder } from '@phosphor-icons/react';

export type AgentTab = 'studio' | 'sessions' | 'analytics' | 'workspace';

export const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: PaintBrush },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
  { id: 'analytics' as AgentTab, label: 'Analytics', icon: ChartLineUp },
  { id: 'workspace' as AgentTab, label: 'Workspace', icon: Folder },
] as const;
