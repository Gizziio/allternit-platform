/**
 * Tests for RecentSessionsStrip's guarded checkpoint parsing:
 * - parseCheckpoint yields the parsed object for valid JSON and null for
 *   invalid/empty/non-object payloads;
 * - rendering shows the message count + excerpt for valid checkpoints and
 *   omits them for corrupt ones instead of crashing or leaking raw JSON.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RecentSessionsStrip, parseCheckpoint } from './RecentSessionsStrip';
import type { CoworkSessionRecord } from '@/lib/cowork/useCoworkSession';

const h = vi.hoisted(() => ({
  sessions: [] as CoworkSessionRecord[],
  createCoworkSession: vi.fn(() => Promise.resolve('ses_new')),
  updateSession: vi.fn(() => Promise.resolve()),
  setActiveSession: vi.fn(),
}));

vi.mock('@/lib/cowork/useCoworkSession', () => ({
  useCoworkSessionList: () => ({
    sessions: h.sessions,
    loading: false,
    error: null,
    refresh: vi.fn(),
    deleteSession: vi.fn(),
    saveCheckpoint: vi.fn(),
  }),
  extractCheckpointContext: vi.fn(() => 'checkpoint context'),
}));

vi.mock('@/lib/cowork/useRuntimeAvailable', () => ({
  useRuntimeAvailable: () => ({ runtimeAvailable: true, runtimeUnavailableReason: null }),
  openRuntimeSettings: vi.fn(),
}));

vi.mock('./CoworkSessionStore', () => ({
  createCoworkSession: h.createCoworkSession,
  useCoworkSessionStore: {
    getState: () => ({ updateSession: h.updateSession, setActiveSession: h.setActiveSession }),
  },
}));

function makeRecord(overrides: Partial<CoworkSessionRecord> = {}): CoworkSessionRecord {
  return {
    id: 's1',
    userId: 'u1',
    projectId: null,
    title: 'Session One',
    status: 'paused',
    mode: 'regular',
    checkpoint: null,
    metadata: null,
    startedAt: '2026-09-13T00:00:00.000Z',
    completedAt: null,
    createdAt: '2026-09-13T00:00:00.000Z',
    updatedAt: '2026-09-13T00:00:00.000Z',
    ...overrides,
  };
}

describe('parseCheckpoint', () => {
  it('parses valid checkpoint JSON into the typed shape', () => {
    expect(
      parseCheckpoint(JSON.stringify({ summary: 's', lastMessage: 'm', messageCount: 3 })),
    ).toEqual({ summary: 's', lastMessage: 'm', messageCount: 3 });
  });

  it('returns null for invalid JSON, empty input, and non-object payloads', () => {
    expect(parseCheckpoint('{not json')).toBeNull();
    expect(parseCheckpoint('')).toBeNull();
    expect(parseCheckpoint(null)).toBeNull();
    expect(parseCheckpoint('42')).toBeNull();
    expect(parseCheckpoint('"str"')).toBeNull();
    expect(parseCheckpoint('null')).toBeNull();
  });
});

describe('RecentSessionsStrip checkpoint rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.sessions = [];
  });

  it('renders the message count and excerpt for a valid checkpoint', () => {
    h.sessions = [
      makeRecord({
        checkpoint: JSON.stringify({
          summary: 'drafted the plan',
          lastMessage: 'see you tomorrow',
          messageCount: 12,
        }),
      }),
    ];

    render(<RecentSessionsStrip onResume={() => {}} />);

    expect(screen.getByText('Session One')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Previous session summary: drafted the plan/)).toBeInTheDocument();
    expect(screen.getByText('saved')).toBeInTheDocument();
  });

  it('omits the count and excerpt for a corrupt checkpoint without leaking raw JSON', () => {
    h.sessions = [
      makeRecord({ id: 's1', title: 'Broken Session', checkpoint: '{corrupt' }),
      makeRecord({
        id: 's2',
        title: 'Good Session',
        checkpoint: JSON.stringify({ summary: 'ok', messageCount: 2 }),
      }),
    ];

    render(<RecentSessionsStrip onResume={() => {}} />);

    // Both sessions still render; only the good one shows its excerpt.
    expect(screen.getByText('Broken Session')).toBeInTheDocument();
    expect(screen.getByText('Good Session')).toBeInTheDocument();
    expect(screen.getAllByText(/Previous session summary/)).toHaveLength(1);
    // The corrupt JSON string never reaches the DOM.
    expect(screen.queryByText(/\{corrupt/)).not.toBeInTheDocument();
  });

  it('renders nothing when there are no sessions to show', () => {
    h.sessions = [];
    render(<RecentSessionsStrip onResume={() => {}} />);
    expect(screen.queryByText('Recent Sessions')).not.toBeInTheDocument();
  });
});
