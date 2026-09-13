import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModeDock, MODE_TABS } from './ModeDock';

describe('ModeDeck persistence', () => {
  it('shows all mode tabs on the bot surface even when no bot is mounted', () => {
    render(
      <ModeDock
        selectedMode="swarms"
        onSelectMode={() => {}}
        agentModeSurface="bot"
        selectedSurfaceAgent={null}
      />
    );

    for (const tab of MODE_TABS) {
      expect(screen.getByRole('button', { name: `Mode: ${tab.label}` })).toBeInTheDocument();
    }
  });

  it('shows the unmounted-bot hint on the bot surface when no bot is selected', () => {
    render(
      <ModeDock
        selectedMode="swarms"
        onSelectMode={() => {}}
        agentModeSurface="bot"
        selectedSurfaceAgent={null}
      />
    );

    expect(screen.getByText(/Select or create a bot/)).toBeInTheDocument();
  });

  it('hides the unmounted-bot hint once a bot is bound', () => {
    render(
      <ModeDock
        selectedMode="swarms"
        onSelectMode={() => {}}
        agentModeSurface="bot"
        selectedSurfaceAgent={{ name: 'Helper' }}
      />
    );

    expect(screen.queryByText(/Select or create a bot/)).not.toBeInTheDocument();
  });

  it('does not show the unmounted-bot hint on non-bot surfaces', () => {
    render(
      <ModeDock
        selectedMode="swarms"
        onSelectMode={() => {}}
        agentModeSurface="cowork"
        selectedSurfaceAgent={null}
      />
    );

    expect(screen.queryByText(/Select or create a bot/)).not.toBeInTheDocument();
  });

  it('defaults the selection to the first visible tab when none is valid', () => {
    const onSelectMode = vi.fn();
    render(
      <ModeDock
        selectedMode={null}
        onSelectMode={onSelectMode}
        agentModeSurface="bot"
        selectedSurfaceAgent={null}
      />
    );

    expect(onSelectMode).toHaveBeenCalledWith(MODE_TABS[0].id);
  });
});
