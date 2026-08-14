import { PaintBrush, ChatText, ChartLineUp, Folder, Robot } from '@phosphor-icons/react';

export type AgentTab = 'studio' | 'sessions' | 'analytics' | 'workspace' | 'bots';

export const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: PaintBrush },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
  { id: 'analytics' as AgentTab, label: 'Analytics', icon: ChartLineUp },
  { id: 'workspace' as AgentTab, label: 'Workspace', icon: Folder },
  { id: 'bots' as AgentTab, label: 'Bots', icon: Robot },
] as const;
