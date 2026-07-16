import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { mockStore } = vi.hoisted(() => ({ mockStore: vi.fn() }));

vi.mock('./CodeSessionStore', () => ({
  useCodeSessionStore: (selector: (state: ReturnType<typeof mockStore>) => unknown) =>
    selector(mockStore()),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(() => Promise.resolve(undefined)) },
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
  it('renders session messages and allows copying the transcript', async () => {
    mockStore.mockReturnValue(mockState);

    render(<CodeTranscriptPane sessionId="sess-1" />);

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('You:\nHello'),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('Assistant:\nHi there'),
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
