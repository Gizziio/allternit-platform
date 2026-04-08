import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ai-elements/GizziMascot', () => ({
  GizziMascot: ({ emotion, attention }: { emotion: string; attention?: { state?: string } | null }) => (
    <div
      data-testid="mock-gizzi"
      data-emotion={emotion}
      data-attention={attention?.state ?? 'none'}
    />
  ),
}));

import { CodeLaunchBranding } from './CodeLaunchBranding';

describe('CodeLaunchBranding', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('shows the thought bubble only while the mascot is engaged', () => {
    render(<CodeLaunchBranding workspaceReady={false} />);

    expect(screen.queryByTestId('gizzi-thought-bubble')).not.toBeInTheDocument();
    expect(screen.getByTestId('mock-gizzi')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByTestId('gizzi-hover-zone'));
    expect(screen.getByTestId('gizzi-thought-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-thought-text').textContent?.length).toBeGreaterThan(12);

    fireEvent.mouseLeave(screen.getByTestId('gizzi-hover-zone'));
    expect(screen.queryByTestId('gizzi-thought-bubble')).not.toBeInTheDocument();
  });

  it('keeps the thought bubble visible and passes attention when nearby controls engage Gizzi', () => {
    render(
      <CodeLaunchBranding
        workspaceReady={false}
        attention={{ state: 'locked-on', target: { x: 0, y: 0.4 } }}
      />,
    );

    expect(screen.getByTestId('gizzi-thought-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('mock-gizzi')).toHaveAttribute('data-attention', 'locked-on');
    expect(screen.getByTestId('gizzi-thought-text').textContent?.length).toBeGreaterThan(12);
  });

  it('rotates Gizzi thought copy on repeated hover entries', () => {
    render(<CodeLaunchBranding workspaceReady={false} />);

    const hoverZone = screen.getByTestId('gizzi-hover-zone');

    fireEvent.mouseEnter(hoverZone);
    const firstThought = screen.getByTestId('gizzi-thought-text').textContent;

    fireEvent.mouseLeave(hoverZone);
    fireEvent.mouseEnter(hoverZone);
    const secondThought = screen.getByTestId('gizzi-thought-text').textContent;

    expect(firstThought).toBeTruthy();
    expect(secondThought).toBeTruthy();
    expect(secondThought).not.toEqual(firstThought);
  });

  it('uses the existing Code mascot for agent-mode pulse states', () => {
    render(
      <CodeLaunchBranding
        workspaceReady={false}
        agentModeEnabled
        agentModePulse={1}
        selectedAgentName="Forge"
      />,
    );

    expect(screen.getByTestId('mock-gizzi')).toHaveAttribute('data-emotion', 'proud');
    expect(screen.getByTestId('mock-gizzi')).toHaveAttribute('data-attention', 'locked-on');
    expect(screen.getByTestId('gizzi-thought-bubble')).toBeInTheDocument();
    expect(screen.getByTestId('gizzi-thought-text').textContent).toContain('Forge');
  });
});
