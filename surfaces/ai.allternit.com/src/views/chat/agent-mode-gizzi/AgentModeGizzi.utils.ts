import { SURFACE_THOUGHTS } from './AgentModeGizzi.types';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

export function resolveThoughts(surface: AgentModeSurface, selectedAgentName?: string | null): string[] {
  const base = SURFACE_THOUGHTS[surface] || SURFACE_THOUGHTS.chat;
  if (!selectedAgentName) return base;

  const agentName = selectedAgentName.split(' ')[0] || selectedAgentName;
  return [
    `Analyzing with ${agentName}...`,
    `${agentName} is on the case!`,
    `Context shared with ${agentName}.`,
    `Optimizing for ${agentName}'s capabilities.`,
    ...base,
  ];
}
