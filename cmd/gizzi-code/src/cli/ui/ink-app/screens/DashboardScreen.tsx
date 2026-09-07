// @ts-nocheck
/**
 * DashboardScreen — full-screen agent dashboard (Grok `/dashboard` parity).
 *
 * Mounted by REPL when AppState.screen === 'dashboard'. Renders the live
 * roster of top-level sessions from the DashboardSource, plus a dispatch
 * input for spawning new ones.
 *
 * Key map (list focus): ↑/↓ select · Tab dispatch input · x stop (again
 * within 2s removes) · p pin · Esc/q/Ctrl+\ exit. (input focus): Enter
 * dispatch (stays) · Ctrl+S dispatch → list · Esc blur.
 *
 * Exit back to the prompt via the `dashboard:exit` keybinding (gated to
 * list focus so inner inputs can claim Esc first) or `app:toggleDashboard`.
 */

import * as React from 'react';
import { useRegisterOverlay } from '../context/overlayContext';
import { useTerminalSize } from '../hooks/useTerminalSize';
import { Box, Text, useInput, useTheme } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { useAppState, useSetAppState } from '../state/AppState';
import type { DashboardRow, DashboardSource } from '../dashboard/types';

const STATE_ORDER: Record<string, number> = {
  working: 0,
  'needs-input': 1,
  idle: 2,
  completed: 3,
  failed: 4,
  inactive: 5,
};

function sortRows(rows: DashboardRow[]): DashboardRow[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const byState = (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9);
    if (byState !== 0) return byState;
    return b.updatedAt - a.updatedAt;
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function stateGlyph(row: DashboardRow): { glyph: string; color: string } {
  switch (row.state) {
    case 'working':
      return { glyph: '●', color: 'warning' };
    case 'needs-input':
      return { glyph: '●', color: 'warning' };
    case 'completed':
      return { glyph: '●', color: 'success' };
    case 'failed':
      return { glyph: '●', color: 'error' };
    case 'idle':
      return { glyph: '○', color: 'inactive' };
    default:
      return { glyph: '○', color: 'inactive' };
  }
}

export function DashboardScreen({ source }: { source: DashboardSource }): React.ReactNode {
  const { rows, columns } = useTerminalSize();
  const [theme] = useTheme();
  const setAppState = useSetAppState();
  // Subscribe to the store so task progress triggers re-renders; rows are
  // read from the source during render (same pattern as TasksDialog).
  useAppState();

  const [focus, setFocus] = React.useState<'list' | 'input'>('list');
  const [selected, setSelected] = React.useState(0);
  const [draft, setDraft] = React.useState('');
  const [stopArmedAt, setStopArmedAt] = React.useState(0);

  // Lets CancelRequestHandler / global Esc handlers defer to us while open.
  useRegisterOverlay('dashboard');

  const exitDashboard = React.useCallback(() => {
    setAppState(prev => (prev.screen === 'dashboard' ? { ...prev, screen: 'prompt' } : prev));
  }, [setAppState]);

  useKeybinding('dashboard:exit', exitDashboard, {
    context: 'Dashboard',
    isActive: focus === 'list'
  });

  const allRows = sortRows(source.list());
  const sel = allRows.length === 0 ? -1 : Math.min(selected, allRows.length - 1);
  const selectedRow = sel >= 0 ? allRows[sel] : undefined;
  const workingCount = allRows.filter(r => r.state === 'working').length;
  const awaitingCount = allRows.filter(r => r.state === 'needs-input').length;

  const dispatch = React.useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    source.dispatch(trimmed);
  }, [source]);

  const handleStopOrRemove = React.useCallback(() => {
    if (!selectedRow) return;
    const now = Date.now();
    if (selectedRow.state === 'working' || selectedRow.state === 'needs-input') {
      source.stop(selectedRow.id);
      setStopArmedAt(now);
      return;
    }
    // Idle/finished rows: first press arms, second press within 2s removes.
    if (now - stopArmedAt < 2000) {
      source.remove(selectedRow.id);
      setStopArmedAt(0);
      setSelected(s => Math.max(0, s - 1));
    } else {
      source.stop(selectedRow.id);
      setStopArmedAt(now);
    }
  }, [selectedRow, stopArmedAt, source]);

  useInput((input, key) => {
    if (focus === 'input') {
      if (key.escape) {
        setFocus('list');
        return;
      }
      if (key.return) {
        dispatch(draft);
        setDraft('');
        return;
      }
      if (key.ctrl && input === 's') {
        dispatch(draft);
        setDraft('');
        setFocus('list');
        return;
      }
      if (key.backspace || key.delete) {
        setDraft(d => d.slice(0, -1));
        return;
      }
      if (key.ctrl || key.meta) return;
      if (input) setDraft(d => d + input);
      return;
    }

    // List focus
    if (key.upArrow) {
      setSelected(s => Math.max(0, s - 1));
      return;
    }
    if (key.downArrow) {
      setSelected(s => Math.min(Math.max(0, allRows.length - 1), s + 1));
      return;
    }
    if (key.tab) {
      setFocus('input');
      return;
    }
    if (input === 'x' && !key.ctrl && !key.meta) {
      handleStopOrRemove();
      return;
    }
    if (input === 'p' && !key.ctrl && !key.meta && selectedRow) {
      source.setPinned(selectedRow.id, !selectedRow.pinned);
      return;
    }
    if (key.return && selectedRow) {
      // Peek/reply panel lands with the full dashboard UI; focus the
      // dispatch input prefilled for a follow-up as a stopgap.
      setFocus('input');
    }
  });

  const titleWidth = Math.max(10, Math.floor(columns * 0.55));
  const activityWidth = Math.max(10, columns - titleWidth - 8);

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      paddingX={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.gizzi}>
          Gizzi Code · Dashboard
        </Text>
        <Text dimColor>
          {workingCount} agent{workingCount === 1 ? '' : 's'}
          {awaitingCount > 0 ? ` · ${awaitingCount} awaiting` : ''}
        </Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        {allRows.length === 0 ? (
          <Text dimColor>No sessions yet — describe a task below to dispatch one.</Text>
        ) : (
          allRows.map((row, i) => {
            const { glyph, color } = stateGlyph(row);
            const isSelected = i === sel;
            return (
              <Box key={row.id} flexDirection="row" paddingLeft={1}>
                <Text color={theme[color] ?? color}>
                  {glyph}
                  {row.pinned ? ' ⌖' : '  '}
                </Text>
                <Text
                  bold={isSelected}
                  color={isSelected ? theme.text : theme.subtle}
                  wrap="truncate-end"
                >
                  {` ${truncate(row.title, titleWidth)}`}
                </Text>
                <Box flexGrow={1} />
                <Text dimColor wrap="truncate-end">
                  {truncate(row.activityLine || row.state, activityWidth)}
                </Text>
              </Box>
            );
          })
        )}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        <Box flexDirection="row">
          <Text color={theme.gizzi}>{'❯ '}</Text>
          <Text color={focus === 'input' ? theme.text : theme.inactive}>
            {draft}
            {focus === 'input' ? '▌' : ''}
          </Text>
        </Box>
        <Box flexDirection="row" justifyContent="space-between">
          <Text dimColor>
            {focus === 'input'
              ? 'Enter dispatch · Ctrl+S dispatch → list · Esc back'
              : 'Tab dispatch · ↑/↓ select · x stop/remove · p pin · Esc exit'}
          </Text>
          <Text dimColor>/dashboard</Text>
        </Box>
      </Box>
    </Box>
  );
}

export default DashboardScreen;
