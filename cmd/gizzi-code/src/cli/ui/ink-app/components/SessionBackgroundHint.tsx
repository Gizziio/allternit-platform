import * as React from 'react';
import { useCallback, useState } from 'react';
import { useDoublePress } from '../hooks/useDoublePress';
import { Box, Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay';
import { useAppState, useAppStateStore, useSetAppState } from '../state/AppState';
import { backgroundAll, hasForegroundTasks } from '../tasks/LocalShellTask/LocalShellTask';
import { getGlobalConfig, saveGlobalConfig } from '../utils/config';
import { env } from '../utils/env';
import { isEnvTruthy } from '../utils/envUtils';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
type Props = {
  onBackgroundSession: () => void;
  isLoading: boolean;
};

/**
 * Shows a hint when user presses Ctrl+B to background the current session.
 * Uses double-press pattern: first press shows hint, second press within 800ms backgrounds.
 *
 * Only activates when:
 * 1. isLoading is true (a query is in progress)
 * 2. No foreground tasks (bash/agent) are running (those take priority for Ctrl+B)
 */
export function SessionBackgroundHint({
    onBackgroundSession,
    isLoading
}: Props) {
  const setAppState = useSetAppState();
  const appStateStore = useAppStateStore();
  const [showSessionHint, setShowSessionHint] = useState(false);
  const handleDoublePress = useDoublePress(setShowSessionHint, onBackgroundSession, _temp);
  const t1 = () => {
      if (isEnvTruthy(process.env.GIZZI_CODE_DISABLE_BACKGROUND_TASKS)) {
        return;
      }
      const state = appStateStore.getState();
      if (hasForegroundTasks(state)) {
        backgroundAll(() => appStateStore.getState(), setAppState);
        if (!getGlobalConfig().hasUsedBackgroundTask) {
          saveGlobalConfig(_temp2);
        }
      } else {
        if (isEnvTruthy("false") && isLoading) {
          handleDoublePress();
        }
      }
    };

  const handleBackground = t1;
  const hasForeground = useAppState(hasForegroundTasks);
  const t2 = isEnvTruthy("false");

  const sessionBgEnabled = t2;
  const t3 = hasForeground || sessionBgEnabled && isLoading;
  const t4 = {
      context: "Task",
      isActive: t3
    };

  useKeybinding("task:background", handleBackground, t4);
  const baseShortcut = useShortcutDisplay("task:background", "Task", "ctrl+b");
  const shortcut = env.terminal === "tmux" && baseShortcut === "ctrl+b" ? "ctrl+b ctrl+b" : baseShortcut;
  if (!isLoading || !showSessionHint) {
    return null;
  }
  const t5 = <Box paddingLeft={2}><Text dimColor={true}><KeyboardShortcutHint shortcut={shortcut} action="background" /></Text></Box>;

  return t5;
}
function _temp2(c) {
  return c.hasUsedBackgroundTask ? c : {
    ...c,
    hasUsedBackgroundTask: true
  };
}
function _temp() {}
