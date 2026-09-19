import React from 'react';
import { Box, Text } from '../../ink';
type SuccessStepProps = {
  secretExists: boolean;
  useExistingSecret: boolean;
  secretName: string;
  skipWorkflow?: boolean;
};
export function SuccessStep({
    secretExists,
    useExistingSecret,
    secretName,
    skipWorkflow: t1
}: SuccessStepProps) {
  const skipWorkflow = t1 === undefined ? false : t1;
  const t2 = <Box flexDirection="column" marginBottom={1}><Text bold={true}>Install GitHub App</Text><Text dimColor={true}>Success</Text></Box>;

  const t3 = !skipWorkflow && <Text color="success">✓ GitHub Actions workflow created!</Text>;

  const t4 = secretExists && useExistingSecret && <Box marginTop={1}><Text color="success">✓ Using existing ALLTERNIT_API_KEY secret</Text></Box>;

  const t5 = (!secretExists || !useExistingSecret) && <Box marginTop={1}><Text color="success">✓ API key saved as {secretName} secret</Text></Box>;

  const t6 = <Box marginTop={1}><Text>Next steps:</Text></Box>;

  const t7 = skipWorkflow ? <><Text>1. Install the Claude GitHub App if you haven't already</Text><Text>2. Your workflow file was kept unchanged</Text><Text>3. API key is configured and ready to use</Text></> : <><Text>1. A pre-filled PR page has been created</Text><Text>2. Install the Claude GitHub App if you haven't already</Text><Text>3. Merge the PR to enable Gizzi PR assistance</Text></>;

  const t8 = <Box flexDirection="column" borderStyle="round" paddingX={1}>{t2}{t3}{t4}{t5}{t6}{t7}</Box>;

  const t9 = <Box marginLeft={3}><Text dimColor={true}>Press any key to exit</Text></Box>;

  const t10 = <>{t8}{t9}</>;

  return t10;
}
