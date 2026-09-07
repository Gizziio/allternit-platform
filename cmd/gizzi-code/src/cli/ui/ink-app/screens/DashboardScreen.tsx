// @ts-nocheck
/**
 * DashboardScreen — full-screen agent dashboard (Grok `/dashboard` parity).
 *
 * Mounted by REPL when AppState.screen === 'dashboard'. Renders the live
 * roster of top-level sessions, peek panel, and dispatch input. Exit back
 * to the prompt via the `dashboard:exit` keybinding (Esc / q / Ctrl+\ when
 * no inner view claims the key) or `app:toggleDashboard` (Ctrl+\ globally).
 */
import * as React from 'react';
import { useRegisterOverlay } from '../context/overlayContext';
import { useTerminalSize } from '../hooks/useTerminalSize';
import { Box, Text, useTheme } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { useAppState, useSetAppState } from '../state/AppState';

export function DashboardScreen(): React.ReactNode {
  const { rows, columns } = useTerminalSize();
  const [theme] = useTheme();
  const setAppState = useSetAppState();
  // Lets CancelRequestHandler / global Esc handlers defer to us while open.
  useRegisterOverlay('dashboard');

  const exitDashboard = React.useCallback(() => {
    setAppState(prev => (prev.screen === 'dashboard' ? { ...prev, screen: 'prompt' } : prev));
  }, [setAppState]);

  useKeybinding('dashboard:exit', exitDashboard, {
    context: 'Dashboard',
    isActive: true
  });

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={rows}
      paddingX={1}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.claude}>
          Gizzi Code · Dashboard
        </Text>
        <Text dimColor>0 agents</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1} marginTop={1}>
        <Text dimColor>No sessions yet.</Text>
        <Text dimColor>Dispatch input lands in a later phase.</Text>
      </Box>
      <Box flexDirection="row" justifyContent="space-between">
        <Text dimColor>Esc / Ctrl+\ exit</Text>
        <Text dimColor>/dashboard</Text>
      </Box>
    </Box>
  );
}

export default DashboardScreen;
