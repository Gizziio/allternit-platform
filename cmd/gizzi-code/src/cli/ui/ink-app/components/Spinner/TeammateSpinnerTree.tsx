import figures from 'figures';
import * as React from 'react';
import { Box, Text, type TextProps } from '../../ink';
import { useAppState } from '../../state/AppState';
import { getRunningTeammatesSorted } from '../../tasks/InProcessTeammateTask/InProcessTeammateTask';
import { formatNumber } from '../../utils/format';
import { TeammateSpinnerLine } from './TeammateSpinnerLine';
import { TEAMMATE_SELECT_HINT } from './teammateSelectHint';
type Props = {
  selectedIndex?: number;
  isInSelectionMode?: boolean;
  allIdle?: boolean;
  /** Leader's active verb (when leader is actively processing) */
  leaderVerb?: string;
  /** Leader's token count (when leader is actively processing) */
  leaderTokenCount?: number;
  /** Leader's idle status text (when leader is idle, e.g. "✻ Idle for 3s") */
  leaderIdleText?: string;
};
export function TeammateSpinnerTree({
    selectedIndex,
    isInSelectionMode,
    allIdle,
    leaderVerb,
    leaderTokenCount,
    leaderIdleText
}: Props) {
  const tasks = useAppState(_temp);
  const viewingAgentTaskId = useAppState(_temp2);
  const showTeammateMessagePreview = useAppState(_temp3);
  let T0;
  let isHideSelected;
  let t1;
  let t2;
  let t3;
  let t4;
  let t5;
  t5 = Symbol.for("react.early_return_sentinel");
  bb0: {
    const teammateTasks = getRunningTeammatesSorted(tasks);
    if (teammateTasks.length === 0) {
      t5 = null;
      break bb0;
    }
    const isLeaderForegrounded = viewingAgentTaskId === undefined;
    const isLeaderSelected = isInSelectionMode && selectedIndex === -1;
    const isLeaderHighlighted = isLeaderForegrounded || isLeaderSelected;
    isHideSelected = isInSelectionMode === true && selectedIndex === teammateTasks.length;
    T0 = Box;
    t1 = "column";
    t2 = 1;
    const t6 = isLeaderSelected ? "suggestion" : undefined;
    const t7 = isLeaderSelected ? figures.pointer : " ";
    const t8 = <Text color={t6} bold={isLeaderHighlighted}>{t7}</Text>;

    const t9 = !isLeaderHighlighted;
    const t10 = isLeaderHighlighted ? "\u2552\u2550" : "\u250C\u2500";
    const t11 = <Text dimColor={t9} bold={isLeaderHighlighted}>{t10}{" "}</Text>;

    const t12 = isLeaderSelected ? "suggestion" : "cyan_FOR_SUBAGENTS_ONLY";
    const t13 = <Text bold={isLeaderHighlighted} color={t12}>team-lead</Text>;

    const t14 = !isLeaderForegrounded && leaderVerb && <Text dimColor={true}>: {leaderVerb}…</Text>;

    const t15 = !isLeaderForegrounded && !leaderVerb && leaderIdleText && <Text dimColor={true}>: {leaderIdleText}</Text>;

    const t16 = leaderTokenCount !== undefined && leaderTokenCount > 0 && <Text dimColor={!isLeaderHighlighted}>{" "}· {formatNumber(leaderTokenCount)} tokens</Text>;

    const t17 = isLeaderHighlighted && <Text dimColor={true}> · {TEAMMATE_SELECT_HINT}</Text>;

    const t18 = isLeaderSelected && !isLeaderForegrounded && <Text dimColor={true}> · enter to view</Text>;


      t3 = <Box paddingLeft={3}>{t8}{t11}{t13}{t14}{t15}{t16}{t17}{t18}</Box>;
    
    t4 = teammateTasks.map((teammate, index) => <TeammateSpinnerLine key={teammate.id} teammate={teammate} isLast={!isInSelectionMode && index === teammateTasks.length - 1} isSelected={isInSelectionMode && selectedIndex === index} isForegrounded={viewingAgentTaskId === teammate.id} allIdle={allIdle} showPreview={showTeammateMessagePreview} />);
  }
  

  if (t5 !== Symbol.for("react.early_return_sentinel")) {
    return t5;
  }
  const t6 = isInSelectionMode && <HideRow isSelected={isHideSelected} />;

  const t7 = <T0 flexDirection={t1} marginTop={t2}>{t3}{t4}{t6}</T0>;

  return t7;
}
function _temp3(s_1) {
  return s_1.showTeammateMessagePreview;
}
function _temp2(s_0) {
  return s_0.viewingAgentTaskId;
}
function _temp(s) {
  return s.tasks;
}
function HideRow(t0) {
  const {
    isSelected
  } = t0;
  const t1 = isSelected ? "suggestion" : undefined;
  const t2 = isSelected ? figures.pointer : " ";
  const t3 = <Text color={t1} bold={isSelected}>{t2}</Text>;

  const t4 = !isSelected;
  const t5 = isSelected ? "\u2558\u2550" : "\u2514\u2500";
  const t6 = <Text dimColor={t4} bold={isSelected}>{t5}{" "}</Text>;

  const t7 = !isSelected;
  const t8 = <Text dimColor={t7} bold={isSelected}>hide</Text>;

  const t9 = isSelected && <Text dimColor={true}> · enter to collapse</Text>;

  const t10 = <Box paddingLeft={3}>{t3}{t6}{t8}{t9}</Box>;

  return t10;
}
