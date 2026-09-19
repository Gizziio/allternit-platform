import * as React from 'react';
import { Box, Text } from '../../ink';
import { getAgentName, getTeammateColor, getTeamName } from '../../utils/teammate';
import { Spinner } from '../Spinner';
import { WorkerBadge } from './WorkerBadge';
type Props = {
  toolName: string;
  description: string;
};

/**
 * Visual indicator shown on workers while waiting for leader to approve a permission request.
 * Displays the pending tool with a spinner and information about what's being requested.
 */
export function WorkerPendingPermission({
    toolName,
    description
}: Props) {
  const t1 = getTeamName();

  const teamName = t1;
  const t2 = getAgentName();

  const agentName = t2;
  const t3 = getTeammateColor();

  const agentColor = t3;
  const t4 = <Box marginBottom={1}><Spinner /><Text color="warning" bold={true}>{" "}Waiting for team lead approval</Text></Box>;
  const t5 = agentName && agentColor && <Box marginBottom={1}><WorkerBadge name={agentName} color={agentColor} /></Box>;

  const t6 = <Text dimColor={true}>Tool: </Text>;

  const t7 = <Box>{t6}<Text>{toolName}</Text></Box>;

  const t8 = <Text dimColor={true}>Action: </Text>;

  const t9 = <Box>{t8}<Text>{description}</Text></Box>;

  const t10 = teamName && <Box marginTop={1}><Text dimColor={true}>Permission request sent to team {"\""}{teamName}{"\""} leader</Text></Box>;

  const t11 = <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>{t4}{t5}{t7}{t9}{t10}</Box>;

  return t11;
}
