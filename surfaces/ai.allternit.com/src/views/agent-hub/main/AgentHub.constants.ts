import { PaintBrush, ChatText, ChartLineUp } from '@phosphor-icons/react';

export type AgentTab = 'studio' | 'sessions' | 'analytics';

export const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: PaintBrush },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
  { id: 'analytics' as AgentTab, label: 'Analytics', icon: ChartLineUp },
] as const;
