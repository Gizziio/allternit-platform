import * as React from 'react';
import { Text } from '../../ink';
import { useAppState } from '../../state/AppState';
type Props = {
  teamsSelected: boolean;
  showHint: boolean;
};

/**
 * Footer status indicator showing teammate count
 * Similar to BackgroundTaskStatus but for teammates
 */
export function TeamStatus({
    teamsSelected,
    showHint
}: Props) {
  const teamContext = useAppState(_temp);
  const t1 = teamContext ? Object.values(teamContext.teammates).filter(_temp2).length : 0;

  const totalTeammates = t1;
  if (totalTeammates === 0) {
    return null;
  }
  const t2 = showHint && teamsSelected ? <><Text dimColor={true}>· </Text><Text dimColor={true}>Enter to view</Text></> : null;

  const hint = t2;
  const statusText = `${totalTeammates} ${totalTeammates === 1 ? "teammate" : "teammates"}`;
  const t3 = teamsSelected ? "selected" : "normal";
  const t4 = <Text key={t3} color="background" inverse={teamsSelected}>{statusText}</Text>;

  const t5 = hint ? <Text> {hint}</Text> : null;

  const t6 = <>{t4}{t5}</>;

  return t6;
}
function _temp2(t) {
  return t.name !== "team-lead";
}
function _temp(s) {
  return s.teamContext;
}
