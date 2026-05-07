import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CodeRail } from './CodeRail';
import { createCodeModeFixtureState, useCodeModeStore } from './CodeModeStore';

describe('CodeRail', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createCodeModeFixtureState());
  });

  it('renders workspace status and session chips for the active workspace', () => {
    render(<CodeRail />);

    expect(screen.getByTestId('code-workspace-selector')).toHaveValue('ws_allternit');
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('DIRTY')).toBeInTheDocument();
    expect(screen.getByTestId('code-session-sess_code_ui')).toBeInTheDocument();
    expect(screen.getByTestId('code-session-sess_policy_pass')).toBeInTheDocument();
    expect(screen.getByTestId('code-session-sess_diff_review')).toBeInTheDocument();
    expect(screen.getByText('PLAN_READY')).toBeInTheDocument();
    expect(screen.getByText('AWAITING_APPROVAL')).toBeInTheDocument();
    expect(screen.getByText('CHANGESET_READY')).toBeInTheDocument();
  });

  it('switches workspaces and keeps the session list scoped to that workspace', () => {
    render(<CodeRail />);

    fireEvent.change(screen.getByTestId('code-workspace-selector'), {
      target: { value: 'ws_summit_demo' },
    });

    expect(screen.getByText('demo/launch-readiness')).toBeInTheDocument();
    expect(screen.getByText('CLEAN')).toBeInTheDocument();
    expect(screen.getByTestId('code-session-sess_merge_back')).toBeInTheDocument();
    expect(screen.getByTestId('code-session-sess_release_notes')).toBeInTheDocument();
    expect(screen.queryByText('Code Mode Layout Stabilization')).not.toBeInTheDocument();
  });

  it('updates current focus when a different session is selected', () => {
    render(<CodeRail />);

    fireEvent.click(screen.getByTestId('code-session-sess_diff_review'));

    expect(screen.getAllByText('Diff Review Prototype').length).toBeGreaterThan(0);
    expect(screen.getByText('CHANGESET_READY')).toBeInTheDocument();
  });
});
