import React from 'react';
import { Select } from './../../components/CustomSelect/index.ts';
import { Box, Text } from '../../ink';
interface ExistingWorkflowStepProps {
  repoName: string;
  onSelectAction: (action: 'update' | 'skip' | 'exit') => void;
}
export function ExistingWorkflowStep({
    repoName,
    onSelectAction
}: ExistingWorkflowStepProps) {
  const t1 = [{
      label: "Update workflow file with latest version",
      value: "update"
    }, {
      label: "Skip workflow update (configure secrets only)",
      value: "skip"
    }, {
      label: "Exit without making changes",
      value: "exit"
    }];

  const options = t1;
  const t2 = value => {
      onSelectAction(value as 'update' | 'skip' | 'exit');
    };

  const handleSelect = t2;
  const t3 = () => {
      onSelectAction("exit");
    };

  const handleCancel = t3;
  const t4 = <Text bold={true}>Existing Workflow Found</Text>;

  const t5 = <Box flexDirection="column" marginBottom={1}>{t4}<Text dimColor={true}>Repository: {repoName}</Text></Box>;

  const t6 = <Box flexDirection="column" marginBottom={1}><Text>A Gizzi workflow file already exists at{" "}<Text color="gizzi">.github/workflows/gizzi.yml</Text></Text><Text dimColor={true}>What would you like to do?</Text></Box>;

  const t7 = <Box flexDirection="column"><Select options={options} onChange={handleSelect} onCancel={handleCancel} /></Box>;

  const t8 = <Box marginTop={1}><Text dimColor={true}>View the latest workflow template at:{" "}<Text color="gizzi">https://docs.gizziio.com</Text></Text></Box>;

  const t9 = <Box flexDirection="column" borderStyle="round" borderDimColor={true} paddingX={1}>{t5}{t6}{t7}{t8}</Box>;

  return t9;
}
