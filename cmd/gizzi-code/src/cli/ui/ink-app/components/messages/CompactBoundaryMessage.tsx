import * as React from 'react';
import { Box, Text } from '../../ink';
import { useShortcutDisplay } from '../../keybindings/useShortcutDisplay';
export function CompactBoundaryMessage() {
  const historyShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  const t0 = <Box marginY={1}><Text dimColor={true}>✻ Conversation compacted ({historyShortcut} for history)</Text></Box>;

  return t0;
}
