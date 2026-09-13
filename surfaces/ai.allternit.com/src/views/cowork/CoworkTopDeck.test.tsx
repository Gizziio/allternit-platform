/**
 * Tests for the CoworkTopDeck permission dropdown wiring:
 * - the selection initializes from the active session's persisted
 *   metadata.codePermissionMode (the same field the runtime reads);
 * - choosing an option writes back through updateSession with the mapped
 *   code permission mode;
 * - with no active session the write is skipped.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CoworkTopDeck } from './CoworkTopDeck';

const h = vi.hoisted(() => ({
  updateSession: vi.fn(() => Promise.resolve()),
  sessions: [] as Array<{ id: string; metadata: Record<string, unknown> }>,
  activeSessionId: null as string | null,
  projects: [] as Array<{ id: string; title: string }>,
  activeProjectId: null as string | null,
  setActiveProject: vi.fn(),
}));

vi.mock('./CoworkStore', () => ({
  useCoworkStore: (selector: (s: unknown) => unknown) =>
    selector({
      projects: h.projects,
      activeProjectId: h.activeProjectId,
      setActiveProject: h.setActiveProject,
    }),
}));

vi.mock('./CoworkSessionStore', () => ({
  useCoworkSessionStore: (selector: (s: unknown) => unknown) =>
    selector({
      activeSessionId: h.activeSessionId,
      sessions: h.sessions,
      updateSession: h.updateSession,
    }),
}));

function setActiveSession(codePermissionMode?: string) {
  h.activeSessionId = 'ses_1';
  h.sessions = [
    { id: 'ses_1', metadata: codePermissionMode ? { codePermissionMode } : {} },
  ];
}

describe('CoworkTopDeck permission dropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.activeSessionId = null;
    h.sessions = [];
    h.projects = [];
    h.activeProjectId = null;
  });

  it('initializes the dropdown label from metadata.codePermissionMode', () => {
    setActiveSession('plan');
    render(<CoworkTopDeck />);
    expect(screen.getByRole('button', { name: 'Read-only' })).toBeInTheDocument();

    setActiveSession('acceptEdits');
    render(<CoworkTopDeck />);
    expect(screen.getAllByRole('button', { name: 'Auto-approve' }).length).toBeGreaterThan(0);
  });

  it('defaults to "Ask before actions" when the session has no persisted mode', () => {
    setActiveSession(undefined);
    render(<CoworkTopDeck />);
    expect(screen.getByRole('button', { name: 'Ask before actions' })).toBeInTheDocument();
  });

  it('writes the mapped code mode back via updateSession on select', () => {
    setActiveSession('plan');
    render(<CoworkTopDeck />);

    fireEvent.click(screen.getByRole('button', { name: 'Read-only' }));
    fireEvent.click(screen.getByRole('button', { name: /Auto-approve/ }));

    expect(h.updateSession).toHaveBeenCalledWith('ses_1', {
      metadata: { codePermissionMode: 'acceptEdits' },
    });
  });

  it('maps each dropdown option to the code-surface mode vocabulary', () => {
    setActiveSession('default');
    render(<CoworkTopDeck />);

    // Trigger stays "Ask before actions" (the mocked store doesn't re-render),
    // so within an open menu the option is the second button with that name.
    fireEvent.click(screen.getByRole('button', { name: 'Ask before actions' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Read-only/ })[0]!);
    expect(h.updateSession).toHaveBeenCalledWith('ses_1', {
      metadata: { codePermissionMode: 'plan' },
    });

    h.updateSession.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Ask before actions' }));
    fireEvent.click(screen.getAllByRole('button', { name: /Ask before actions/ })[1]!);
    expect(h.updateSession).toHaveBeenCalledWith('ses_1', {
      metadata: { codePermissionMode: 'default' },
    });
  });

  it('does not write back when there is no active session', () => {
    render(<CoworkTopDeck />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask before actions' }));
    fireEvent.click(screen.getByRole('button', { name: /Auto-approve/ }));

    expect(h.updateSession).not.toHaveBeenCalled();
  });
});
