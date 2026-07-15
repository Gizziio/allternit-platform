import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RailControls } from './FloatingWidgets';

function getCollapsedInner() {
  return screen.getByTestId('shell-rail-controls').firstChild as HTMLElement;
}

describe('RailControls', () => {
  it('does not render mode buttons when collapsed and not hovered', () => {
    render(
      <RailControls
        mode="chat"
        onModeChange={() => {}}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={true}
        onSearchOpen={() => {}}
      />
    );

    expect(screen.queryByTestId('rail-mode-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rail-mode-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rail-mode-browser')).not.toBeInTheDocument();
  });

  it('renders mode buttons when collapsed controls are hovered', () => {
    render(
      <RailControls
        mode="chat"
        onModeChange={() => {}}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={true}
        onSearchOpen={() => {}}
      />
    );

    fireEvent.mouseEnter(getCollapsedInner());

    expect(screen.getByTestId('rail-mode-chat')).toHaveAttribute('title', 'Home');
    expect(screen.getByTestId('rail-mode-code')).toHaveAttribute('title', 'Code');
    expect(screen.getByTestId('rail-mode-browser')).toHaveAttribute('title', 'Browser');
  });

  it('switches mode on hover over a collapsed mode button', () => {
    const onModeChange = vi.fn();
    render(
      <RailControls
        mode="chat"
        onModeChange={onModeChange}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={true}
        onSearchOpen={() => {}}
      />
    );

    fireEvent.mouseEnter(getCollapsedInner());
    fireEvent.mouseEnter(screen.getByTestId('rail-mode-code'));
    expect(onModeChange).toHaveBeenCalledWith('code');

    fireEvent.mouseEnter(screen.getByTestId('rail-mode-browser'));
    expect(onModeChange).toHaveBeenCalledWith('browser');
  });

  it('calls onCollapsedHover when the collapsed controls strip is hovered', () => {
    const onCollapsedHover = vi.fn();
    render(
      <RailControls
        mode="chat"
        onModeChange={() => {}}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={true}
        onSearchOpen={() => {}}
        onCollapsedHover={onCollapsedHover}
      />
    );

    fireEvent.mouseEnter(getCollapsedInner());
    expect(onCollapsedHover).toHaveBeenCalledWith(true);

    fireEvent.mouseLeave(getCollapsedInner());
    expect(onCollapsedHover).toHaveBeenCalledWith(false);
  });

  it('calls onModeHover when a mode button is hovered', () => {
    const onModeHover = vi.fn();
    render(
      <RailControls
        mode="chat"
        onModeChange={() => {}}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={true}
        onSearchOpen={() => {}}
        onModeHover={onModeHover}
      />
    );

    fireEvent.mouseEnter(getCollapsedInner());
    fireEvent.mouseEnter(screen.getByTestId('rail-mode-code'));
    expect(onModeHover).toHaveBeenCalledWith('code');

    fireEvent.mouseLeave(screen.getByTestId('rail-mode-code'));
    expect(onModeHover).toHaveBeenCalledWith(null);
  });

  it('does not render mode buttons when expanded', () => {
    render(
      <RailControls
        mode="chat"
        onModeChange={() => {}}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={false}
        onSearchOpen={() => {}}
      />
    );

    expect(screen.queryByTestId('rail-mode-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rail-mode-code')).not.toBeInTheDocument();
    expect(screen.queryByTestId('rail-mode-browser')).not.toBeInTheDocument();
  });
});
