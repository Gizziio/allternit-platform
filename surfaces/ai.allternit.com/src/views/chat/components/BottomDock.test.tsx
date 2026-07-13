import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomDock } from './BottomDock';
import { ModeProvider } from '@/providers/mode-provider';

function Wrapper({ children, mode = 'chat' as const }: { children: React.ReactNode; mode?: 'chat' | 'cowork' }) {
  return <ModeProvider defaultMode={mode}>{children}</ModeProvider>;
}

describe('BottomDock Chat/Cowork toggle', () => {
  it('renders Chat and Cowork buttons in chat mode', () => {
    render(
      <Wrapper>
        <BottomDock
          selectedModeId={null}
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
          setShowAgentMenu={() => {}}
          showAgentMenu={false}
          selectedSurfaceAgent={null}
        />
      </Wrapper>
    );

    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cowork/i })).toBeInTheDocument();
  });

  it('does not render the toggle in code or browser mode', () => {
    render(
      <ModeProvider defaultMode="code">
        <BottomDock
          selectedModeId={null}
          agentModeEnabled={false}
          agentModeTheme={{ glow: '', soft: '', accent: '' }}
          setShowAgentMenu={() => {}}
          showAgentMenu={false}
          selectedSurfaceAgent={null}
        />
      </ModeProvider>
    );

    expect(screen.queryByRole('button', { name: /Chat/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cowork/i })).not.toBeInTheDocument();
  });
});
