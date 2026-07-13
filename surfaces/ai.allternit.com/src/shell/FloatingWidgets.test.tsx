import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { RailControls } from './FloatingWidgets';

describe('RailControls', () => {
  it('renders Home, Code, and Browser mode buttons', () => {
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

    expect(screen.getByTestId('rail-mode-chat')).toHaveTextContent('Home');
    expect(screen.getByTestId('rail-mode-code')).toHaveTextContent('Code');
    expect(screen.getByTestId('rail-mode-browser')).toHaveTextContent('Browser');
  });

  it('calls onModeChange when a mode button is clicked', () => {
    const onModeChange = vi.fn();
    render(
      <RailControls
        mode="chat"
        onModeChange={onModeChange}
        onToggleRail={() => {}}
        onNewChat={() => {}}
        onNewAgentSession={() => {}}
        isRailCollapsed={false}
        onSearchOpen={() => {}}
      />
    );

    fireEvent.click(screen.getByTestId('rail-mode-code'));
    expect(onModeChange).toHaveBeenCalledWith('code');

    fireEvent.click(screen.getByTestId('rail-mode-browser'));
    expect(onModeChange).toHaveBeenCalledWith('browser');
  });
});
