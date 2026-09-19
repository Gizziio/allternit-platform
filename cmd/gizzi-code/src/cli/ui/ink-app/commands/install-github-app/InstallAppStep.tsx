import figures from 'figures';
import React from 'react';
import { GITHUB_ACTION_SETUP_DOCS_URL } from '../../constants/github-app';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
interface InstallAppStepProps {
  repoUrl: string;
  onSubmit: () => void;
}
export function InstallAppStep({
    repoUrl,
    onSubmit
}: InstallAppStepProps) {
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:yes", onSubmit, t1);
  const t2 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install the Claude GitHub App</Text></Box>;

  const t3 = <Box marginBottom={1}><Text>Opening browser to install the Claude GitHub App…</Text></Box>;

  const t4 = <Box marginBottom={1}><Text>If your browser doesn't open automatically, visit:</Text></Box>;

  const t5 = <Box marginBottom={1}><Text underline={true}>https://docs.gizziio.com</Text></Box>;

  const t6 = <Box marginBottom={1}><Text>Please install the app for repository: <Text bold={true}>{repoUrl}</Text></Text></Box>;

  const t7 = <Box marginBottom={1}><Text dimColor={true}>Important: Make sure to grant access to this specific repository</Text></Box>;

  const t8 = <Box><Text bold={true} color="permission">Press Enter once you've installed the app{figures.ellipsis}</Text></Box>;

  const t9 = <Box marginTop={1}><Text dimColor={true}>Having trouble? See manual setup instructions at:{" "}<Text color="gizzi">{GITHUB_ACTION_SETUP_DOCS_URL}</Text></Text></Box>;

  const t10 = <Box flexDirection="column" borderStyle="round" borderDimColor={true} paddingX={1}>{t2}{t3}{t4}{t5}{t6}{t7}{t8}{t9}</Box>;

  return t10;
}
