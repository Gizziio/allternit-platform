
import React from 'react';
import { Robot } from '@phosphor-icons/react';
import type { GizziEmotion, GizziAttention } from '@/components/ai-elements/GizziMascot';
import { getAgentModeSurfaceTheme } from '../agentModeSurfaceTheme';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

const THEME = {
  textSecondary: 'var(--chat-composer-muted)',
  inputBorder: 'var(--chat-composer-border)',
};

interface AgentModeButtonProps {
  agentModeEnabled: boolean;
  selectedModeId: string | null;
  agentModeSurface: AgentModeSurface;
  onToggle: () => void;
  onInteractionSignal?: (emotion: GizziEmotion) => void;
  setTrackingAttention: (x: number, y: number, state?: GizziAttention['state']) => void;
}

const MODE_COLORS: Record<string, { accent: string; soft: string; glow: string; label: string }> = {
  research: { accent: 'var(--status-info)', soft: 'rgba(59,130,246,0.15)', glow: 'rgba(59,130,246,0.4)', label: 'Research' },
  data: { accent: 'var(--status-success)', soft: 'rgba(16,185,129,0.15)', glow: 'rgba(16,185,129,0.4)', label: 'Data' },
  slides: { accent: 'var(--status-warning)', soft: 'rgba(245,158,11,0.15)', glow: 'rgba(245,158,11,0.4)', label: 'Slides' },
  flow: { accent: 'var(--status-info)', soft: 'rgba(6,182,212,0.15)', glow: 'rgba(6,182,212,0.4)', label: 'Flow' },
  web: { accent: '#6366f1', soft: 'rgba(99,102,241,0.15)', glow: 'rgba(99,102,241,0.4)', label: 'Websites' },
  'computer-use': { accent: '#a855f7', soft: 'rgba(168,85,247,0.15)', glow: 'rgba(168,85,247,0.4)', label: 'Computer Use' },
};

export function AgentModeButton({
  agentModeEnabled,
  selectedModeId,
  agentModeSurface,
  onToggle,
  onInteractionSignal,
  setTrackingAttention,
}: AgentModeButtonProps) {
  const modeColors = agentModeEnabled && selectedModeId ? MODE_COLORS[selectedModeId] : null;
  const surfaceTheme = getAgentModeSurfaceTheme(agentModeSurface);

  const accentColor = modeColors?.accent || (agentModeEnabled ? surfaceTheme.accent : THEME.textSecondary);
  const softColor = modeColors?.soft || (agentModeEnabled ? surfaceTheme.soft : 'transparent');
  const glowColor = modeColors?.glow || (agentModeEnabled ? surfaceTheme.glow : THEME.inputBorder);

  const buttonText = agentModeEnabled
    ? selectedModeId
      ? `Agent | ${modeColors?.label || 'Mode'}`
      : 'Agent On'
    : 'Agent Off';

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-full text-xs font-bold cursor-pointer transition-all ease"
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
        if (agentModeEnabled) {
          e.currentTarget.style.boxShadow = `0 0 12px ${glowColor}`;
        }
      }}
    >
      <Robot size={14} />
      {buttonText}
    </button>
  );
}
