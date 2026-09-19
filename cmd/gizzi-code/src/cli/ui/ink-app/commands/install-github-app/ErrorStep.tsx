import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app';
import { Box, Text } from '../../ink';
interface ErrorStepProps {
  error: string | undefined;
  errorReason?: string;
  errorInstructions?: string[];
}
export function ErrorStep(t0) {
  const {
    error,
    errorReason,
    errorInstructions
  } = t0;
  const t1 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text></Box>;

  const t2 = <Text color="error">Error: {error}</Text>;

  const t3 = errorReason && <Box marginTop={1}><Text dimColor={true}>Reason: {errorReason}</Text></Box>;

  const t4 = errorInstructions && errorInstructions.length > 0 && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>How to fix:</Text>{errorInstructions.map(_temp)}</Box>;

  const t5 = <Box marginTop={1}><Text dimColor={true}>For manual setup instructions, see:{" "}<Text color="gizzi">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text></Box>;

  const t6 = <Box flexDirection="column" borderStyle="round" paddingX={1}>{t1}{t2}{t3}{t4}{t5}</Box>;

  const t7 = <Box marginLeft={3}><Text dimColor={true}>Press any key to exit</Text></Box>;

  const t8 = <>{t6}{t7}</>;

  return t8;
}
function _temp(instruction, index) {
  return <Box key={index} marginLeft={2}><Text dimColor={true}>• </Text><Text>{instruction}</Text></Box>;
}
