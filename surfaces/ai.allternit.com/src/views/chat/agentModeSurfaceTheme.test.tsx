import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

import {
  AgentModeBackdrop,
  getAgentModeSurfaceTheme,
} from './agentModeSurfaceTheme';

describe('getAgentModeSurfaceTheme', () => {
  // Amber-only law (2026-09-11): chat/cowork/code/browser all resolve to the
  // shared amber surface theme.
  const AMBER = {
    accent: 'var(--accent-primary)',
    glow: 'rgba(176,141,110,0.26)',
    soft: 'rgba(176,141,110,0.14)',
    wash: 'rgba(176,141,110,0.18)',
    fog: 'rgba(122,89,61,0.2)',
    edge: 'rgba(176,141,110,0.16)',
    panelTint: 'rgba(176,141,110,0.08)',
    shadow: 'rgba(83,51,24,0.12)',
  };

  it('returns amber theme by default when no surface is provided', () => {
    const theme = getAgentModeSurfaceTheme();

    expect(theme.accent).toBe(AMBER.accent);
    expect(theme.glow).toBe(AMBER.glow);
    expect(theme.soft).toBe(AMBER.soft);
  });

  it('returns amber theme when null surface is provided', () => {
    const theme = getAgentModeSurfaceTheme(null);

    expect(theme.accent).toBe(AMBER.accent);
    expect(theme.glow).toBe(AMBER.glow);
  });

  it('returns amber theme for chat surface', () => {
    expect(getAgentModeSurfaceTheme('chat')).toEqual(AMBER);
  });

  it('returns amber theme for cowork surface', () => {
    expect(getAgentModeSurfaceTheme('cowork')).toEqual(AMBER);
  });

  it('returns amber theme for code surface', () => {
    expect(getAgentModeSurfaceTheme('code')).toEqual(AMBER);
  });

  it('returns amber theme for browser surface', () => {
    expect(getAgentModeSurfaceTheme('browser')).toEqual(AMBER);
  });

  it('returns a complete theme object for all surface types', () => {
    const surfaces: AgentModeSurface[] = ['chat', 'cowork', 'code', 'browser'];
    
    surfaces.forEach((surface) => {
      const theme = getAgentModeSurfaceTheme(surface);
      
      expect(theme).toHaveProperty('accent');
      expect(theme).toHaveProperty('glow');
      expect(theme).toHaveProperty('soft');
      expect(theme).toHaveProperty('wash');
      expect(theme).toHaveProperty('fog');
      expect(theme).toHaveProperty('edge');
      expect(theme).toHaveProperty('panelTint');
      expect(theme).toHaveProperty('shadow');
      
      // All values should be non-empty strings
      Object.values(theme).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('AgentModeBackdrop', () => {
  it('renders null when active is false', () => {
    const { container } = render(
      <AgentModeBackdrop active={false} surface="chat" dataTestId="test-backdrop" />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('renders backdrop when active is true', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" dataTestId="test-backdrop" />
    );
    
    expect(screen.getByTestId('test-backdrop')).toBeInTheDocument();
  });

  it('applies correct data-surface attribute for chat', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" dataTestId="test-backdrop" />
    );
    
    expect(screen.getByTestId('test-backdrop')).toHaveAttribute('data-surface', 'chat');
  });

  it('applies correct data-surface attribute for cowork', () => {
    render(
      <AgentModeBackdrop active={true} surface="cowork" dataTestId="test-backdrop" />
    );
    
    expect(screen.getByTestId('test-backdrop')).toHaveAttribute('data-surface', 'cowork');
  });

  it('applies correct data-surface attribute for code', () => {
    render(
      <AgentModeBackdrop active={true} surface="code" dataTestId="test-backdrop" />
    );
    
    expect(screen.getByTestId('test-backdrop')).toHaveAttribute('data-surface', 'code');
  });

  it('applies correct data-surface attribute for browser', () => {
    render(
      <AgentModeBackdrop active={true} surface="browser" dataTestId="test-backdrop" />
    );
    
    expect(screen.getByTestId('test-backdrop')).toHaveAttribute('data-surface', 'browser');
  });

  it('uses default test id when dataTestId is not provided', () => {
    render(<AgentModeBackdrop active={true} surface="chat" />);
    
    expect(screen.getByTestId('agent-mode-backdrop')).toBeInTheDocument();
  });

  it('renders with custom opacity when provided', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" opacity={0.5} dataTestId="test-backdrop" />
    );
    
    const backdrop = screen.getByTestId('test-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveStyle({ opacity: '0.5' });
  });

  it('renders with custom borderRadius when provided', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" borderRadius="8px" dataTestId="test-backdrop" />
    );
    
    const backdrop = screen.getByTestId('test-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveStyle({ borderRadius: '8px' });
  });

  it('renders with custom inset when provided', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" inset="4px" dataTestId="test-backdrop" />
    );
    
    const backdrop = screen.getByTestId('test-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop).toHaveStyle({ inset: '4px' });
  });

  it('applies correct positioning styles', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" dataTestId="test-backdrop" />
    );
    
    const backdrop = screen.getByTestId('test-backdrop');
    expect(backdrop).toHaveStyle({
      position: 'absolute',
      pointerEvents: 'none',
      zIndex: '0',
    });
  });

  it('includes animation styles in the document', () => {
    render(
      <AgentModeBackdrop active={true} surface="chat" dataTestId="test-backdrop" />
    );
    
    const styleElement = document.querySelector('style');
    expect(styleElement).toBeInTheDocument();
    expect(styleElement?.textContent).toContain('@keyframes allternit-agent-surface-glow');
  });
});
