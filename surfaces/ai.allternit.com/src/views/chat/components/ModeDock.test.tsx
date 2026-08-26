import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModeDock } from './ModeDock';

describe('ModeDock', () => {
  it('defaults to the first available mode', () => {
    const onSelectMode = vi.fn();
    render(
      <ModeDock
        selectedMode={null}
        onSelectMode={onSelectMode}
        agentModeSurface="chat"
      />
    );

    expect(onSelectMode).toHaveBeenCalledWith('swarms');
    expect(screen.getByRole('button', { name: /Mode: Agent Swarm/i })).toBeInTheDocument();
  });

  it('renders the selected mode as a compact pill', () => {
    render(
      <ModeDock
        selectedMode="docs"
        onSelectMode={() => {}}
        agentModeSurface="chat"
      />
    );

    expect(screen.getByRole('button', { name: /Mode: Docs/i })).toBeInTheDocument();
  });

  it('opens a compact popover with mode options and selects a mode', async () => {
    const onSelectMode = vi.fn();
    render(
      <ModeDock
        selectedMode="image"
        onSelectMode={onSelectMode}
        agentModeSurface="chat"
      />
    );

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
      />
    );

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
