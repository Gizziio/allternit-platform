import figures from 'figures';
import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import type { Warning } from './types';
interface WarningsStepProps {
  warnings: Warning[];
  onContinue: () => void;
}
export function WarningsStep({
    warnings,
    onContinue
}: WarningsStepProps) {
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:yes", onContinue, t1);
  const t2 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>{figures.warning} Setup Warnings</Text><Text dimColor={true}>We found some potential issues, but you can continue anyway</Text></Box>;

  const t3 = warnings.map(_temp2);

  const t4 = <Box marginTop={1}><Text bold={true} color="permission">Press Enter to continue anyway, or Ctrl+C to exit and fix issues</Text></Box>;

  const t5 = <Box marginTop={1}><Text dimColor={true}>You can also try the manual setup steps if needed:{" "}<Text color="gizzi">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text></Box>;

  const t6 = <><Box flexDirection="column" borderStyle="round" paddingX={1}>{t2}{t3}{t4}{t5}</Box></>;

  return t6;
}
function _temp2(warning, index) {
  return <Box key={index} flexDirection="column" marginBottom={1}><Text color="warning" bold={true}>{warning.title}</Text><Text>{warning.message}</Text>{warning.instructions.length > 0 && <Box flexDirection="column" marginLeft={2} marginTop={1}>{warning.instructions.map(_temp)}</Box>}</Box>;
}
function _temp(instruction, i) {
  return <Text key={i} dimColor={true}>• {instruction}</Text>;
}
