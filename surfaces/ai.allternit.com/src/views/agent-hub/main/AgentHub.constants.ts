import { PaintBrush, Globe, ChatText, Brain, ChartLineUp, Stack } from '@phosphor-icons/react';

export type AgentTab = 'studio' | 'registry' | 'sessions' | 'memory' | 'analytics' | 'workspace';

export const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: PaintBrush },
  { id: 'registry' as AgentTab, label: 'Agent Registry', icon: Globe },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
  { id: 'memory' as AgentTab, label: 'Memory', icon: Brain },
  { id: 'analytics' as AgentTab, label: 'Analytics', icon: ChartLineUp },
  { id: 'workspace' as AgentTab, label: 'Workspace', icon: Stack },
] as const;

export const REGISTRY_CONTEXT = { viewType: 'registry', viewId: 'registry' } as const;
export const CURATED_KEY = 'allternit-labs-curated-courses';
