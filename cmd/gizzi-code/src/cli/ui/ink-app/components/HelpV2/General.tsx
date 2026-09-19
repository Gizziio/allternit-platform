import * as React from 'react';
import { Box, Text } from '../../ink';
import { PromptInputHelpMenu } from '../PromptInput/PromptInputHelpMenu';
export function General() {
  const t0 = <Box><Text>Gizzi understands your codebase, makes edits with your permission, and executes commands — right from your terminal.</Text></Box>;

  const t1 = <Box flexDirection="column" paddingY={1} gap={1}>{t0}<Box flexDirection="column"><Box><Text bold={true}>Shortcuts</Text></Box><PromptInputHelpMenu gap={2} fixedWidth={true} /></Box></Box>;

  return t1;
}
