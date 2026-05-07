/**
 * Agentation React Hooks
 */

import { useContext } from 'react';
import { AgentationContext } from './provider';
import type { AgentationContextValue, AgentRole } from './types';

export function useAgentation(): AgentationContextValue {
  const context = useContext(AgentationContext);
  if (!context) {
    throw new Error('useAgentation must be used within AgentationProvider');
  }
  return context;
}

export function useAgentRole(): AgentRole | null {
  const { config } = useAgentation();
  return config.enabled ? config.role : null;
}

export function useCanModifyCode(): boolean {
  const role = useAgentRole();
  return role === 'UI_IMPLEMENTER' || role === 'UI_ARCHITECT';
}

export function useCanReview(): boolean {
  const role = useAgentRole();
  return role === 'UI_REVIEWER';
}

export function useCanTest(): boolean {
  const role = useAgentRole();
  return role === 'UI_TESTER';
}
