import * as React from 'react';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from '../../ink';
type Props = {
  instructions?: string;
};
export function AgentNavigationFooter({
    instructions: t1
}: Props) {
  const instructions = t1 === undefined ? "Press \u2191\u2193 to navigate \xB7 Enter to select \xB7 Esc to go back" : t1;
  const exitState = useExitOnCtrlCDWithKeybindings();
  const t2 = exitState.pending ? `Press ${exitState.keyName} again to exit` : instructions;
  const t3 = <Box marginLeft={2}><Text dimColor={true}>{t2}</Text></Box>;

  return t3;
}
