import * as React from 'react';
import { Box, Text } from '../ink';
import { useAppState } from '../state/AppState';
import { getViewedTeammateTask } from '../state/selectors';
import { toInkColor } from '../utils/ink';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { OffscreenFreeze } from './OffscreenFreeze';

/**
 * Header shown when viewing a teammate's transcript.
 * Displays teammate name (colored), task description, and exit hint.
 */
export function TeammateViewHeader() {
  const viewedTeammate = useAppState(_temp);
  if (!viewedTeammate) {
    return null;
  }
  const t0 = toInkColor(viewedTeammate.identity.color);

  const nameColor = t0;
  const t1 = <Text>Viewing </Text>;

  const t2 = <Text color={nameColor} bold={true}>@{viewedTeammate.identity.agentName}</Text>;

  const t3 = <Text dimColor={true}>{" \xB7 "}<KeyboardShortcutHint shortcut="esc" action="return" /></Text>;

  const t4 = <Box>{t1}{t2}{t3}</Box>;

  const t5 = <Text dimColor={true}>{viewedTeammate.prompt}</Text>;

  const t6 = <OffscreenFreeze><Box flexDirection="column" marginBottom={1}>{t4}{t5}</Box></OffscreenFreeze>;

  return t6;
}
function _temp(s) {
  return getViewedTeammateTask(s);
}
