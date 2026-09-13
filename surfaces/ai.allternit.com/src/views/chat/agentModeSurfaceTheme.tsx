import React from 'react';
import type { CSSProperties } from 'react';
import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';
import { useResolvedTheme, useThemeStore } from '@/design/ThemeStore';

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

// Amber-only law (locked 2026-09-11): chat/cowork/code/browser no longer carry
// their own accent colors — every surface resolves to the amber identity
// values below. Bot keeps its dedicated token (teal dark / sand light) and
// design keeps its identity sand; both are outside the removed four palettes.
const AMBER_SURFACE_THEME: AgentModeSurfaceTheme = {
  accent: 'var(--accent-primary)',
  glow: 'rgba(176,141,110,0.26)',
  soft: 'rgba(176,141,110,0.14)',
  wash: 'rgba(176,141,110,0.18)',
  fog: 'rgba(122,89,61,0.2)',
  edge: 'rgba(176,141,110,0.16)',
  panelTint: 'rgba(176,141,110,0.08)',
  shadow: 'rgba(83,51,24,0.12)',
};

const SURFACE_THEMES: Record<AgentModeSurface, AgentModeSurfaceTheme> = {
  chat: AMBER_SURFACE_THEME,
  cowork: AMBER_SURFACE_THEME,
  bot: {
    accent: '#2DD4BF',
    glow: 'rgba(45,212,191,0.26)',
    soft: 'rgba(45,212,191,0.14)',
    wash: 'rgba(45,212,191,0.18)',
    fog: 'rgba(18,110,98,0.2)',
    edge: 'rgba(45,212,191,0.16)',
    panelTint: 'rgba(45,212,191,0.08)',
    shadow: 'rgba(10,74,66,0.14)',
  },
  code: AMBER_SURFACE_THEME,
  browser: AMBER_SURFACE_THEME,
  design: {
    accent: '#E879A0',
    glow: 'rgba(232,121,160,0.26)',
    soft: 'rgba(232,121,160,0.14)',
    wash: 'rgba(232,121,160,0.18)',
    fog: 'rgba(160,60,100,0.2)',
    edge: 'rgba(232,121,160,0.16)',
    panelTint: 'rgba(232,121,160,0.08)',
    shadow: 'rgba(100,30,60,0.14)',
  },
};

// Light-theme bot surface: neutral warm sand (matches --accent-bot #B08D6E in
// the light :root). Dark theme keeps the teal SURFACE_THEMES.bot values.
const BOT_SURFACE_THEME_LIGHT: AgentModeSurfaceTheme = {
  accent: '#B08D6E',
  glow: 'rgba(176,141,110,0.26)',
  soft: 'rgba(176,141,110,0.14)',
  wash: 'rgba(176,141,110,0.18)',
  fog: 'rgba(122,89,61,0.2)',
  edge: 'rgba(176,141,110,0.16)',
  panelTint: 'rgba(176,141,110,0.08)',
  shadow: 'rgba(83,51,24,0.12)',
};

const backdropAnimationStyles = `
@keyframes allternit-agent-surface-glow {
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

@keyframes allternit-agent-activation-sweep {
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

@keyframes allternit-agent-composer-halo {
  0% {
    box-shadow: 0 0 0 0px currentColor;
    opacity: 0;
  }
  30% {
    opacity: 1;
  }
  100% {
    box-shadow: 0 0 0 8px rgba(176,141,110,0);
    opacity: 0;
  }
}
`;

export function getAgentModeSurfaceTheme(
  surface?: AgentModeSurface | null,
): AgentModeSurfaceTheme {
  return SURFACE_THEMES[surface ?? 'chat'];
}

/**
 * Theme-aware variant of getAgentModeSurfaceTheme for React components.
 * The bot surface swaps to neutral warm values in the light theme and keeps
 * its teal values in dark; all other surfaces are unchanged. Re-renders on
 * live theme switches.
 */
export function useAgentModeSurfaceTheme(
  surface?: AgentModeSurface | null,
): AgentModeSurfaceTheme {
  const theme = useThemeStore((state) => state.theme);
  const resolvedTheme = useResolvedTheme(theme);
  const resolvedSurface = surface ?? 'chat';
  if (resolvedSurface === 'bot' && resolvedTheme === 'light') {
    return BOT_SURFACE_THEME_LIGHT;
  }
  return SURFACE_THEMES[resolvedSurface];
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
  const theme = useAgentModeSurfaceTheme(surface);

  if (!active) {
    return null;
  }

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
          animation: 'allternit-agent-surface-glow 3.2s ease-in-out infinite',
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

function AgentActivationSweep({
  surface,
  triggerKey,
  inset = 0,
  borderRadius = 'inherit',
}: AgentActivationSweepProps) {
  const theme = useAgentModeSurfaceTheme(surface);

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
          animation: 'allternit-agent-activation-sweep 1.2s ease-out forwards',
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

function AgentComposerHalo({
  surface,
  triggerKey,
  className,
}: AgentComposerHaloProps) {
  const theme = useAgentModeSurfaceTheme(surface);

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
          animation: 'allternit-agent-composer-halo 0.8s ease-out forwards',
        }}
      />
    </>
  );
}
