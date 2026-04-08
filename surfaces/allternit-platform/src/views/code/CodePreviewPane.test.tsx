import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialCodeModeState, useCodeModeStore } from './CodeModeStore';
import { CodePreviewPane } from './CodePreviewPane';

vi.mock('@/components/ai-elements/GizziMascot', () => ({
  GizziMascot: () => <div data-testid="mock-gizzi-mascot" />,
}));

describe('CodePreviewPane', () => {
  beforeEach(() => {
    useCodeModeStore.setState(createInitialCodeModeState());
  });

  it('renders the placeholder state when preview sessions are absent from persisted session data', () => {
    const initialState = createInitialCodeModeState();
    useCodeModeStore.setState({
      ...initialState,
      sessions: initialState.sessions.map((session) =>
        session.session_id === initialState.activeSessionId
          ? ({ ...session, preview_sessions: undefined } as any)
          : session,
      ),
    });

    render(<CodePreviewPane />);

    expect(screen.getByTestId('code-preview-pane')).toBeInTheDocument();
    expect(screen.getByTestId('mock-gizzi-mascot')).toBeInTheDocument();
    expect(screen.getByText('Setting up preview')).toBeInTheDocument();
  });
});
