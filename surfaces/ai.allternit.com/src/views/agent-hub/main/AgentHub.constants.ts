import { Robot, ChatText } from '@phosphor-icons/react';

export type AgentTab = 'bots' | 'sessions';

export const TABS = [
  { id: 'bots' as AgentTab, label: 'Bots', icon: Robot },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
] as const;
