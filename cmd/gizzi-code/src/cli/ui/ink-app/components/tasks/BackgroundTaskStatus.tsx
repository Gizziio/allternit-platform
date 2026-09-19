import figures from 'figures';
import * as React from 'react';
import { useMemo, useState } from 'react';
import { useTerminalSize } from './../../hooks/useTerminalSize.ts';
import { stringWidth } from './../../ink/stringWidth.ts';
import { useAppState, useSetAppState } from './../../state/AppState.tsx';
import { enterTeammateView, exitTeammateView } from './../../state/teammateViewHelpers.ts';
import { isPanelAgentTask } from './../../tasks/LocalAgentTask/LocalAgentTask.tsx';
import { getPillLabel, pillNeedsCta } from './../../tasks/pillLabel.ts';
import { type BackgroundTaskState, isBackgroundTask, type TaskState } from './../../tasks/types.ts';
import { calculateHorizontalScrollWindow } from './../../utils/horizontalScroll.ts';
import { Box, Text } from '../../ink';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS, type AgentColorName } from '../../tools/AgentTool/agentColorManager';
import type { Theme } from '../../utils/theme';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
import { shouldHideTasksFooter } from './taskStatusUtils';
type Props = {
  tasksSelected: boolean;
  isViewingTeammate?: boolean;
  teammateFooterIndex?: number;
  isLeaderIdle?: boolean;
  onOpenDialog?: (taskId?: string) => void;
};
export function BackgroundTaskStatus({
    tasksSelected,
    isViewingTeammate,
    teammateFooterIndex: t1,
    isLeaderIdle: t2,
    onOpenDialog
}: Props) {
  const teammateFooterIndex = t1 === undefined ? 0 : t1;
  const isLeaderIdle = t2 === undefined ? false : t2;
  const setAppState = useSetAppState();
  const {
    columns
  } = useTerminalSize();
  const tasks = useAppState(_temp);
  const viewingAgentTaskId = useAppState(_temp2);
  const t3 = (Object.values(tasks ?? {}) as TaskState[]).filter(_temp3);

  const runningTasks = t3;
  const expandedView = useAppState(_temp4);
  const showSpinnerTree = expandedView === "teammates";
  const allTeammates = !showSpinnerTree && runningTasks.length > 0 && runningTasks.every(_temp5);
  const t4 = runningTasks.filter(_temp6).sort(_temp7);

  const teammateEntries = t4;
  const t5 = {
      name: "main",
      color: undefined as keyof Theme | undefined,
      isIdle: isLeaderIdle,
      taskId: undefined as string | undefined
    };

  const mainPill = t5;
  const teammatePills = teammateEntries.map(_temp8);
  if (!tasksSelected) {
      teammatePills.sort(_temp9);
    }
  const pills = [mainPill, ...teammatePills];
  const t6 = pills.map(_temp0);

  const allPills = t6;
  const t7 = allPills.map(_temp1);

  const pillWidths = t7;
  if (allTeammates || !showSpinnerTree && isViewingTeammate) {
    const selectedIdx = tasksSelected ? teammateFooterIndex : -1;
    const t8 = viewingAgentTaskId ? teammateEntries.findIndex(t_3 => t_3.id === viewingAgentTaskId) + 1 : 0;

    const viewedIdx = t8;
    const availableWidth = Math.max(20, columns - 20 - 4);
    const t9 = selectedIdx >= 0 ? selectedIdx : 0;
    const t10 = calculateHorizontalScrollWindow(pillWidths, availableWidth, 2, t9);

    const {
      startIndex,
      endIndex,
      showLeftArrow,
      showRightArrow
    } = t10;
    const t11 = allPills.slice(startIndex, endIndex);

    const visiblePills = t11;
    const t12 = showLeftArrow && <Text dimColor={true}>{figures.arrowLeft} </Text>;

    const t13 = visiblePills.map((pill_1, i_1) => {
        const needsSeparator = i_1 > 0;
        return <React.Fragment key={pill_1.name}>{needsSeparator && <Text> </Text>}<AgentPill name={pill_1.name} color={pill_1.color} isSelected={selectedIdx === pill_1.idx} isViewed={viewedIdx === pill_1.idx} isIdle={pill_1.isIdle} onClick={() => pill_1.taskId ? enterTeammateView(pill_1.taskId, setAppState) : exitTeammateView(setAppState)} /></React.Fragment>;
      });

    const t14 = showRightArrow && <Text dimColor={true}> {figures.arrowRight}</Text>;

    const t15 = <Text dimColor={true}>{" \xB7 "}<KeyboardShortcutHint shortcut={"shift + \u2193"} action="expand" /></Text>;

    const t16 = <>{t12}{t13}{t14}{t15}</>;

    return t16;
  }
  if (shouldHideTasksFooter(tasks ?? {}, showSpinnerTree)) {
    return null;
  }
  if (runningTasks.length === 0) {
    return null;
  }
  const t8 = getPillLabel(runningTasks);

  const t9 = <SummaryPill selected={tasksSelected} onClick={onOpenDialog}>{t8}</SummaryPill>;

  const t10 = pillNeedsCta(runningTasks) && <Text dimColor={true}> · {figures.arrowDown} to view</Text>;

  const t11 = <>{t9}{t10}</>;

  return t11;
}
function _temp1(pill_0, i_0) {
  const pillText = `@${pill_0.name}`;
  return stringWidth(pillText) + (i_0 > 0 ? 1 : 0);
}
function _temp0(pill, i) {
  return {
    ...pill,
    idx: i
  };
}
function _temp9(a_0, b_0) {
  if (a_0.isIdle !== b_0.isIdle) {
    return a_0.isIdle ? 1 : -1;
  }
  return 0;
}
function _temp8(t_2) {
  return {
    name: t_2.identity.agentName,
    color: getAgentThemeColor(t_2.identity.color),
    isIdle: t_2.isIdle,
    taskId: t_2.id
  };
}
function _temp7(a, b) {
  return a.identity.agentName.localeCompare(b.identity.agentName);
}
function _temp6(t_1) {
  return t_1.type === "in_process_teammate";
}
function _temp5(t_0) {
  return t_0.type === "in_process_teammate";
}
function _temp4(s_1) {
  return s_1.expandedView;
}
function _temp3(t) {
  return isBackgroundTask(t) && !(false && isPanelAgentTask(t));
}
function _temp2(s_0) {
  return s_0.viewingAgentTaskId;
}
function _temp(s) {
  return s.tasks;
}
type AgentPillProps = {
  name: string;
  color?: keyof Theme;
  isSelected: boolean;
  isViewed: boolean;
  isIdle: boolean;
  onClick?: () => void;
};
function AgentPill({
    name,
    color,
    isSelected,
    isViewed,
    isIdle,
    onClick
}: AgentPillProps) {
  const [hover, setHover] = useState(false);
  const highlighted = isSelected || hover;
  let label;
  if (highlighted) {
    const t1 = color ? <Text backgroundColor={color} color="inverseText" bold={isViewed}>@{name}</Text> : <Text color="background" inverse={true} bold={isViewed}>@{name}</Text>;

    label = t1;
  } else {
    if (isIdle) {
      const t1 = <Text dimColor={true} bold={isViewed}>@{name}</Text>;

      label = t1;
    } else {
      if (isViewed) {
        const t1 = <Text color={color} bold={true}>@{name}</Text>;

        label = t1;
      } else {
        const t1 = !color;
        const t2 = <Text color={color} dimColor={t1}>@{name}</Text>;

        label = t2;
      }
    }
  }
  if (!onClick) {
    return label;
  }
  const t1 = () => setHover(true);
  const t2 = () => setHover(false);

  const t3 = <Box onClick={onClick} onMouseEnter={t1} onMouseLeave={t2}>{label}</Box>;

  return t3;
}
function SummaryPill(t0) {
  const {
    selected,
    onClick,
    children
  } = t0;
  const [hover, setHover] = useState(false);
  const t1 = selected || hover;
  const t2 = <Text color="background" inverse={t1}>{children}</Text>;

  const label = t2;
  if (!onClick) {
    return label;
  }
  const t3 = () => setHover(true);
  const t4 = () => setHover(false);

  const t5 = <Box onClick={onClick} onMouseEnter={t3} onMouseLeave={t4}>{label}</Box>;

  return t5;
}
function getAgentThemeColor(colorName: string | undefined): keyof Theme | undefined {
  if (!colorName) return undefined;
  if (AGENT_COLORS.includes(colorName as AgentColorName)) {
    return AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName];
  }
  return undefined;
}
