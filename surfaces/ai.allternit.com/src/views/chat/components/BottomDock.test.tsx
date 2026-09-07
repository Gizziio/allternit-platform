import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomDock } from './BottomDock';
import { ModeProvider } from '@/providers/mode-provider';

function Wrapper({ children, mode = 'chat' as const }: { children: React.ReactNode; mode?: 'chat' | 'cowork' | 'bot' }) {
  return <ModeProvider defaultMode={mode}>{children}</ModeProvider>;
}

describe('BottomDock mode toggle', () => {
  it('renders Chat, Cowork, and Bots buttons in chat mode', () => {
    render(
      <Wrapper>
        <BottomDock
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
        />
      </Wrapper>
    );

    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cowork/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bots/i })).toBeInTheDocument();
  });

  it('renders all three mode buttons in bot mode', () => {
    render(
      <Wrapper mode="bot">
        <BottomDock
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
        />
      </Wrapper>
    );

    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cowork/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bots/i })).toBeInTheDocument();
  });

  it('dispatches allternit:switch-mode when a segment is clicked', () => {
    const handler = vi.fn();
    window.addEventListener('allternit:switch-mode', handler);
    try {
      render(
        <Wrapper>
          <BottomDock
            agentModeEnabled={false}
            agentModeTheme={{ glow: '', soft: '', accent: '' }}
          />
        </Wrapper>
      );

      fireEvent.click(screen.getByRole('button', { name: /Bots/i }));
      expect(handler).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('allternit:switch-mode', handler);
    }
  });

  it('does not render the toggle when showModeToggle is false (in-session composer)', () => {
    render(
      <Wrapper>
        <BottomDock
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
          showModeToggle={false}
        />
      </Wrapper>
    );

    expect(screen.queryByRole('button', { name: /Chat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cowork/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bots/i })).not.toBeInTheDocument();
  });

  it('does not render the toggle in code or browser mode', () => {
    render(
      <ModeProvider defaultMode="code">
        <BottomDock
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
        />
      </ModeProvider>
    );

    expect(screen.queryByRole('button', { name: /Chat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cowork/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Bots/i })).not.toBeInTheDocument();
  });
});
