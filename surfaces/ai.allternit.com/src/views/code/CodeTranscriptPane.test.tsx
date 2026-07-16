import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockStore } = vi.hoisted(() => ({ mockStore: vi.fn() }));

vi.mock('./CodeSessionStore', () => ({
  useCodeSessionStore: (selector: (state: ReturnType<typeof mockStore>) => unknown) =>
    selector(mockStore()),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn() },
  writable: true,
});

import { CodeTranscriptPane } from './CodeTranscriptPane';

const mockState = {
  sessions: [
    {
      id: 'sess-1',
      name: 'Test session',
      messages: [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: '2026-07-16T10:00:00Z' },
        { id: 'm2', role: 'assistant', content: 'Hi there', timestamp: '2026-07-16T10:01:00Z' },
      ],
    },
  ],
};

describe('CodeTranscriptPane', () => {
  it('renders session messages and allows copying the transcript', () => {
    mockStore.mockReturnValue(mockState);

    render(<CodeTranscriptPane sessionId="sess-1" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('[10:00 AM] You:\nHello'),
    );
  });

  it('shows an empty state when the session has no messages', () => {
    mockStore.mockReturnValue({
      sessions: [{ id: 'sess-2', name: 'Empty session', messages: [] }],
    });

    render(<CodeTranscriptPane sessionId="sess-2" />);
    expect(screen.getByText('No messages in this session yet.')).toBeInTheDocument();
  });
});
