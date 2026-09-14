import React from 'react';
import { render, screen } from '@testing-library/react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModeDock, MODE_TABS } from './ModeDock';
import { ModeDock } from './ModeDock';
import { getDefaultFormatSelection } from '@/views/create/presets';

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

  it('does not render a format picker for non-creation modes', () => {
  it('renders the selected mode as a compact pill', () => {
    render(
      <ModeDock
        selectedMode="research"
        onSelectMode={() => {}}
        agentModeSurface="chat"
        onFormatChange={() => {}}
      />
    );

    expect(screen.queryByRole('button', { name: /Type/i })).not.toBeInTheDocument();
  });

  it('renders a format picker when a creation mode is selected', () => {
    expect(screen.getByRole('button', { name: /Mode: Docs/i })).toBeInTheDocument();
  });

  it('opens a compact popover with mode options and selects a mode', async () => {
    const onSelectMode = vi.fn();
    render(
      <ModeDock
        selectedMode="docs"
        onSelectMode={() => {}}
        agentModeSurface="chat"
        formatSelection={getDefaultFormatSelection('docs')}
        onFormatChange={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /Format: Type · Proposal/i })).toBeInTheDocument();
  });

  it('opens the format picker and selects a different option', async () => {
    const onFormatChange = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: /Mode: Image/i }));

    await waitFor(() => {
      expect(screen.getByText('Bot mode')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Deep Research/i }));
    expect(onSelectMode).toHaveBeenCalledWith('research');
  });

  it('does not render templates in the popover', async () => {
    render(
      <ModeDock
        selectedMode="docs"
        onSelectMode={() => {}}
        agentModeSurface="chat"
        formatSelection={getDefaultFormatSelection('docs')}
        onFormatChange={onFormatChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Format: Type · Proposal/i }));

    await waitFor(() => {
      expect(screen.getByText('Report')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Report'));
    expect(onFormatChange).toHaveBeenCalled();
    const lastCall = onFormatChange.mock.calls[onFormatChange.mock.calls.length - 1][0];
    expect(lastCall.tabId).toBe('type');
    expect(lastCall.optionId).toBe('report');
    fireEvent.click(screen.getByRole('button', { name: /Mode: Docs/i }));

    await waitFor(() => {
      expect(screen.getByText('Bot mode')).toBeInTheDocument();
    });

    expect(screen.queryByText(/Featured Docs Cases/i)).not.toBeInTheDocument();
  });

  it('exposes all nine canonical bot modes', async () => {
    render(<ModeDock selectedMode="swarms" onSelectMode={() => {}} agentModeSurface="chat" />);
    fireEvent.click(screen.getByRole('button', { name: /Mode: Agent Swarm/i }));

    await waitFor(() => expect(screen.getByText('Bot mode')).toBeInTheDocument());
    const popover = screen.getByRole('dialog');
    expect(within(popover).getByRole('button', { name: /Agent Swarm/i })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: /Deep Research/i })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: /Websites/i })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: /Docs/i })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: /Sheets/i })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: /^Code$/i })).toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /^Flow$/i })).not.toBeInTheDocument();
    expect(within(popover).queryByRole('button', { name: /^Computer$/i })).not.toBeInTheDocument();
  });
});
