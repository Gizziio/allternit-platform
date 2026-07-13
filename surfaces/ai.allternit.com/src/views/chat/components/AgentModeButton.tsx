
import React from 'react';
import { Robot } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import type { GizziEmotion, GizziAttention } from '@/components/ai-elements/GizziMascot';
import { getAgentModeSurfaceTheme } from '../agentModeSurfaceTheme';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { useSurfaceAgentModeEnabled, useSurfaceAgentSelection } from '@/lib/agents/surface-agent-context';

interface AgentModeButtonProps {
  agentModeSurface: AgentModeSurface;
  onInteractionSignal?: (emotion: GizziEmotion) => void;
  setTrackingAttention: (x: number, y: number, state?: GizziAttention['state']) => void;
}

export function AgentModeButton({
  agentModeSurface,
  onInteractionSignal,
  setTrackingAttention,
}: AgentModeButtonProps) {
  const agentModeEnabled = useSurfaceAgentModeEnabled(agentModeSurface);
  const { selectedAgent } = useSurfaceAgentSelection(agentModeSurface);
  const surfaceTheme = getAgentModeSurfaceTheme(agentModeSurface);

  const accentColor = agentModeEnabled ? surfaceTheme.accent : 'var(--chat-composer-muted)';
  const softColor = agentModeEnabled ? surfaceTheme.soft : 'transparent';
  const glowColor = agentModeEnabled ? surfaceTheme.glow : 'var(--chat-composer-border)';

  const buttonText = agentModeEnabled
    ? selectedAgent
      ? `Agent | ${selectedAgent.name}`
      : 'Agent On'
    : 'Agent Off';

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-bold transition-all ease',
        agentModeEnabled ? 'cursor-default' : 'cursor-default opacity-70'
      )}
      style={{
        border: `1px solid ${glowColor}`,
        background: softColor,
        color: accentColor,
        boxShadow: agentModeEnabled ? `0 0 12px ${glowColor}` : 'none',
      }}
      onMouseEnter={(e) => {
        onInteractionSignal?.('focused');
        setTrackingAttention(0.16, 0.56, 'locked-on');
        if (agentModeEnabled) {
          e.currentTarget.style.boxShadow = `0 0 20px ${glowColor}`;
        }
      }}
      onMouseLeave={(e) => {
        setTrackingAttention(0, 0.44);
        e.currentTarget.style.boxShadow = agentModeEnabled ? `0 0 12px ${glowColor}` : 'none';
      }}
    >
      <Robot size={14} />
      {buttonText}
    </button>
  );
}
