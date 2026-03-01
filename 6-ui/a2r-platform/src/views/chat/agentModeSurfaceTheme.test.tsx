import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { AgentModeSurface } from '@/stores/agent-surface-mode.store';

import {
  AgentModeBackdrop,
  getAgentModeSurfaceTheme,
  type AgentModeSurfaceTheme,
} from './agentModeSurfaceTheme';

describe('getAgentModeSurfaceTheme', () => {
  it('returns chat theme by default when no surface is provided', () => {
    const theme = getAgentModeSurfaceTheme();
    
    expect(theme.accent).toBe('#D4956A');
    expect(theme.glow).toBe('rgba(212,149,106,0.28)');
    expect(theme.soft).toBe('rgba(212,149,106,0.14)');
  });

  it('returns chat theme when null surface is provided', () => {
    const theme = getAgentModeSurfaceTheme(null);
    
    expect(theme.accent).toBe('#D4956A');
    expect(theme.glow).toBe('rgba(212,149,106,0.28)');
  });

  it('returns correct theme for chat surface', () => {
    const theme = getAgentModeSurfaceTheme('chat');
    
    expect(theme.accent).toBe('#D4956A');
    expect(theme.glow).toBe('rgba(212,149,106,0.28)');
    expect(theme.soft).toBe('rgba(212,149,106,0.14)');
    expect(theme.wash).toBe('rgba(212,149,106,0.18)');
    expect(theme.fog).toBe('rgba(147,94,53,0.18)');
    expect(theme.edge).toBe('rgba(212,149,106,0.14)');
    expect(theme.panelTint).toBe('rgba(212,149,106,0.08)');
    expect(theme.shadow).toBe('rgba(83,51,24,0.12)');
  });

  it('returns correct theme for cowork surface', () => {
    const theme = getAgentModeSurfaceTheme('cowork');
    
    expect(theme.accent).toBe('#A78BFA');
    expect(theme.glow).toBe('rgba(167,139,250,0.28)');
    expect(theme.soft).toBe('rgba(167,139,250,0.14)');
    expect(theme.wash).toBe('rgba(167,139,250,0.18)');
    expect(theme.fog).toBe('rgba(93,74,166,0.2)');
    expect(theme.edge).toBe('rgba(167,139,250,0.16)');
    expect(theme.panelTint).toBe('rgba(167,139,250,0.08)');
    expect(theme.shadow).toBe('rgba(58,42,113,0.14)');
  });

  it('returns correct theme for code surface', () => {
    const theme = getAgentModeSurfaceTheme('code');
    
    expect(theme.accent).toBe('#79C47C');
    expect(theme.glow).toBe('rgba(121,196,124,0.28)');
    expect(theme.soft).toBe('rgba(121,196,124,0.14)');
    expect(theme.wash).toBe('rgba(121,196,124,0.18)');
    expect(theme.fog).toBe('rgba(67,129,71,0.2)');
    expect(theme.edge).toBe('rgba(121,196,124,0.16)');
    expect(theme.panelTint).toBe('rgba(121,196,124,0.08)');
    expect(theme.shadow).toBe('rgba(34,78,37,0.14)');
  });

  it('returns correct theme for browser surface', () => {
    const theme = getAgentModeSurfaceTheme('browser');
    
    expect(theme.accent).toBe('#69A8C8');
    expect(theme.glow).toBe('rgba(105,168,200,0.26)');
    expect(theme.soft).toBe('rgba(105,168,200,0.14)');
    expect(theme.wash).toBe('rgba(105,168,200,0.18)');
    expect(theme.fog).toBe('rgba(61,106,138,0.2)');
    expect(theme.edge).toBe('rgba(105,168,200,0.16)');
    expect(theme.panelTint).toBe('rgba(105,168,200,0.08)');
    expect(theme.shadow).toBe('rgba(29,62,80,0.14)');
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
    expect(styleElement?.textContent).toContain('@keyframes a2r-agent-surface-glow');
  });
});
