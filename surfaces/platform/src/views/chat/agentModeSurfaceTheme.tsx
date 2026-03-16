import React from 'react';
import type { CSSProperties } from 'react';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

export interface AgentModeSurfaceTheme {
  accent: string;
  glow: string;
  soft: string;
  wash: string;
  fog: string;
  edge: string;
  panelTint: string;
  shadow: string;
}

const SURFACE_THEMES: Record<AgentModeSurface, AgentModeSurfaceTheme> = {
  chat: {
    accent: '#D4956A',
    glow: 'rgba(212,149,106,0.28)',
    soft: 'rgba(212,149,106,0.14)',
    wash: 'rgba(212,149,106,0.18)',
    fog: 'rgba(147,94,53,0.18)',
    edge: 'rgba(212,149,106,0.14)',
    panelTint: 'rgba(212,149,106,0.08)',
    shadow: 'rgba(83,51,24,0.12)',
  },
  cowork: {
    accent: '#A78BFA',
    glow: 'rgba(167,139,250,0.28)',
    soft: 'rgba(167,139,250,0.14)',
    wash: 'rgba(167,139,250,0.18)',
    fog: 'rgba(93,74,166,0.2)',
    edge: 'rgba(167,139,250,0.16)',
    panelTint: 'rgba(167,139,250,0.08)',
    shadow: 'rgba(58,42,113,0.14)',
  },
  code: {
    accent: '#79C47C',
    glow: 'rgba(121,196,124,0.28)',
    soft: 'rgba(121,196,124,0.14)',
    wash: 'rgba(121,196,124,0.18)',
    fog: 'rgba(67,129,71,0.2)',
    edge: 'rgba(121,196,124,0.16)',
    panelTint: 'rgba(121,196,124,0.08)',
    shadow: 'rgba(34,78,37,0.14)',
  },
  browser: {
    accent: '#69A8C8',
    glow: 'rgba(105,168,200,0.26)',
    soft: 'rgba(105,168,200,0.14)',
    wash: 'rgba(105,168,200,0.18)',
    fog: 'rgba(61,106,138,0.2)',
    edge: 'rgba(105,168,200,0.16)',
    panelTint: 'rgba(105,168,200,0.08)',
    shadow: 'rgba(29,62,80,0.14)',
  },
};

const backdropAnimationStyles = `
@keyframes a2r-agent-surface-glow {
  0% {
    opacity: 0.48;
  }
  50% {
    opacity: 0.92;
  }
  100% {
    opacity: 0.48;
  }
}

@keyframes a2r-agent-activation-sweep {
  0% {
    opacity: 0;
    transform: scaleX(0);
  }
  10% {
    opacity: 1;
    transform: scaleX(0.1);
  }
  50% {
    opacity: 0.6;
    transform: scaleX(0.5);
  }
  90% {
    opacity: 1;
    transform: scaleX(0.95);
  }
  100% {
    opacity: 0;
    transform: scaleX(1);
  }
}

@keyframes a2r-agent-composer-halo {
  0% {
    box-shadow: 0 0 0 0px currentColor;
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    box-shadow: 0 0 0 8px rgba(212,149,106,0);
    opacity: 0;
  }
}
`;

export function getAgentModeSurfaceTheme(
  surface?: AgentModeSurface | null,
): AgentModeSurfaceTheme {
  return SURFACE_THEMES[surface ?? 'chat'];
}

interface AgentModeBackdropProps {
  active: boolean;
  surface: AgentModeSurface;
  borderRadius?: CSSProperties['borderRadius'];
  inset?: CSSProperties['inset'];
  opacity?: number;
  dataTestId?: string;
}

export function AgentModeBackdrop({
  active,
  surface,
  borderRadius = 'inherit',
  inset = 0,
  opacity = 1,
  dataTestId = 'agent-mode-backdrop',
}: AgentModeBackdropProps) {
  if (!active) {
    return null;
  }

  const theme = getAgentModeSurfaceTheme(surface);

  return (
    <>
      <style>{backdropAnimationStyles}</style>
      <div
        data-testid={dataTestId}
        data-surface={surface}
        style={{
          position: 'absolute',
          inset,
          borderRadius,
          pointerEvents: 'none',
          zIndex: 0,
          opacity,
          background: `radial-gradient(120% 88% at 50% 0%, ${theme.fog} 0%, transparent 58%), linear-gradient(90deg, ${theme.wash} 0%, transparent 18%, transparent 82%, ${theme.wash} 100%), linear-gradient(180deg, ${theme.soft} 0%, transparent 24%, transparent 76%, ${theme.soft} 100%)`,
          boxShadow: `inset 0 0 0 1px ${theme.edge}, inset 0 0 56px ${theme.shadow}`,
          animation: 'a2r-agent-surface-glow 3.2s ease-in-out infinite',
        }}
      />
    </>
  );
}

/**
 * AgentActivationSweep - Perimeter sweep animation when agent mode is activated
 * 
 * This creates a soft perimeter sweep that travels around the full active surface
 * when agent mode is toggled or when the first agent message is sent.
 */
interface AgentActivationSweepProps {
  surface: AgentModeSurface;
  triggerKey: number; // Increment this to re-trigger animation
  inset?: CSSProperties['inset'];
  borderRadius?: CSSProperties['borderRadius'];
}

export function AgentActivationSweep({
  surface,
  triggerKey,
  inset = 0,
  borderRadius = 'inherit',
}: AgentActivationSweepProps) {
  const theme = getAgentModeSurfaceTheme(surface);

  return (
    <>
      <style>{backdropAnimationStyles}</style>
      <div
        key={triggerKey}
        style={{
          position: 'absolute',
          inset,
          borderRadius,
          pointerEvents: 'none',
          zIndex: 50,
          background: `linear-gradient(90deg, transparent 0%, ${theme.accent} 50%, transparent 100%)`,
          opacity: 0,
          animation: 'a2r-agent-activation-sweep 1.2s ease-out forwards',
        }}
      />
    </>
  );
}

/**
 * AgentComposerHalo - Accent halo animation around the composer when agent activates
 */
interface AgentComposerHaloProps {
  surface: AgentModeSurface;
  triggerKey: number;
  className?: string;
}

export function AgentComposerHalo({
  surface,
  triggerKey,
  className,
}: AgentComposerHaloProps) {
  const theme = getAgentModeSurfaceTheme(surface);

  return (
    <>
      <style>{backdropAnimationStyles}</style>
      <div
        key={triggerKey}
        className={className}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          zIndex: 10,
          color: theme.accent,
          animation: 'a2r-agent-composer-halo 0.8s ease-out forwards',
        }}
      />
    </>
  );
}
