import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModeDock } from './ModeDock';
import { getDefaultFormatSelection } from '@/views/create/presets';

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

  it('renders all visible modes as horizontal tabs separated by pipes', () => {
    render(
      <ModeDock
        selectedMode="docs"
        onSelectMode={() => {}}
        agentModeSurface="chat"
      />
    );

    expect(screen.getByRole('button', { name: /Mode: Docs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Agent Swarm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Deep Research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Websites/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Sheets/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Slides/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Image/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Video/i })).toBeInTheDocument();

    // Eight modes → seven separators
    const separators = screen.getAllByText('|');
    expect(separators).toHaveLength(7);
  });

  it('selects a mode when its tab is clicked', () => {
    const onSelectMode = vi.fn();
    render(
      <ModeDock
        selectedMode="image"
        onSelectMode={onSelectMode}
        agentModeSurface="chat"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Mode: Deep Research/i }));
    expect(onSelectMode).toHaveBeenCalledWith('research');
  });

  it('does not render templates in the tabs', () => {
    render(
      <ModeDock
        selectedMode="docs"
        onSelectMode={() => {}}
        agentModeSurface="chat"
      />
    );

    expect(screen.queryByText(/Featured Docs Cases/i)).not.toBeInTheDocument();
  });

  it('only exposes the eight retained agent modes', () => {
    render(<ModeDock selectedMode="swarms" onSelectMode={() => {}} agentModeSurface="chat" />);

    expect(screen.getByRole('button', { name: /Mode: Agent Swarm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Deep Research/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Websites/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Docs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mode: Sheets/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mode: Code$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mode: Flow$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mode: Computer$/i })).not.toBeInTheDocument();
  });

  it('does not render a format picker for non-creation modes', () => {
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
  });
});
