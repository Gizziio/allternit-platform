import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCodeModeFixtureState, useCodeModeStore } from './CodeModeStore';

vi.mock('@/components/ai-elements/GizziMascot', () => ({
  GizziMascot: () => <div data-testid="mock-gizzi-mascot" />,
}));

import { CodePreviewPane } from './CodePreviewPane';

describe('CodePreviewPane', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createCodeModeFixtureState());
  });

  it('shows an empty state when there is no preview session', () => {
    render(<CodePreviewPane />);

    expect(screen.getByText('No preview session')).toBeInTheDocument();
    expect(screen.getByTestId('code-preview-url-input')).toHaveValue('');
  });

  it('loads the configured preview URL when a session has one', () => {
    const state = useCodeModeStore.getState();
    useCodeModeStore.setState({
      ...state,
      sessions: state.sessions.map((s) =>
        s.session_id === state.activeSessionId
          ? { ...s, preview_sessions: ['http://localhost:5173'] }
          : s,
      ),
    });

    render(<CodePreviewPane />);

    expect(screen.getByTestId('code-preview-url-input')).toHaveValue('http://localhost:5173');
    expect(screen.getByTestId('code-preview-frame')).toHaveAttribute('src', 'http://localhost:5173');
  });

  it('loads a custom URL entered in the URL bar', () => {
    render(<CodePreviewPane />);

    const input = screen.getByTestId('code-preview-url-input');
    fireEvent.change(input, { target: { value: 'http://example.com' } });
    fireEvent.click(screen.getByTestId('code-preview-url-go'));

    expect(screen.getByTestId('code-preview-frame')).toHaveAttribute('src', 'http://example.com');
  });
});
