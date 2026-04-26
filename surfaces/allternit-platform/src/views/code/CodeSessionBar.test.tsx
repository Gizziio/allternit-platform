import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { CodeSessionBar } from './CodeSessionBar';
import { createCodeModeFixtureState, useCodeModeStore } from './CodeModeStore';

describe('CodeSessionBar', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createCodeModeFixtureState());
  });

  it('renders compact workspace and session controls for the active code session', () => {
    render(<CodeSessionBar />);

    expect(screen.getByTestId('code-sessionbar-workspace-selector')).toHaveValue(
      'ws_allternit',
    );
    expect(screen.getByTestId('code-sessionbar-session-selector')).toHaveValue(
      'sess_code_ui',
    );
    expect(screen.getByTestId('code-sessionbar-workspace-pill')).toHaveTextContent(
      'mainDIRTY',
    );
    expect(screen.getByTestId('code-sessionbar-state-pill')).toHaveTextContent(
      'PLANPLAN_READY',
    );
  });

  it('switches workspace without needing a dedicated left pane', () => {
    render(<CodeSessionBar />);

    fireEvent.change(screen.getByTestId('code-sessionbar-workspace-selector'), {
      target: { value: 'ws_summit_demo' },
    });

    expect(screen.getByTestId('code-sessionbar-session-selector')).toHaveValue(
      'sess_merge_back',
    );
    expect(screen.getByTestId('code-sessionbar-workspace-pill')).toHaveTextContent(
      'demo/launch-readinessCLEAN',
    );
    expect(screen.getByTestId('code-sessionbar-state-pill')).toHaveTextContent(
      'SAFEVERIFYING',
    );
  });

  it('updates the active session summary when a different session is chosen', () => {
    render(<CodeSessionBar />);

    fireEvent.change(screen.getByTestId('code-sessionbar-session-selector'), {
      target: { value: 'sess_diff_review' },
    });

    expect(screen.getByTestId('code-sessionbar-state-pill')).toHaveTextContent(
      'AUTOCHANGESET_READY',
    );
  });
});
