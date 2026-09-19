import React, { useMemo } from 'react';
import type { DeepImmutable } from './../../types/utils.ts';
import { useElapsedTime } from '../../hooks/useElapsedTime';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text, useTheme } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import { getEmptyToolPermissionContext } from '../../Tool';
import type { LocalAgentTaskState } from '../../tasks/LocalAgentTask/LocalAgentTask';
import { getTools } from '../../tools';
import { formatNumber } from '../../utils/format';
import { extractTag } from '../../utils/extractTag.js';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
import { UserPlanMessage } from '../messages/UserPlanMessage';
import { renderToolActivity } from './renderToolActivity';
import { getTaskStatusColor, getTaskStatusIcon } from './taskStatusUtils';
type Props = {
  agent: DeepImmutable<LocalAgentTaskState>;
  onDone: () => void;
  onKillAgent?: () => void;
  onBack?: () => void;
};
export function AsyncAgentDetailDialog({
    agent,
    onDone,
    onKillAgent,
    onBack
}: Props) {
  const [theme] = useTheme();
  const t1 = getTools(getEmptyToolPermissionContext());

  const tools = t1;
  const elapsedTime = useElapsedTime(agent.startTime, agent.status === "running", 1000, agent.totalPausedMs ?? 0);
  const t2 = {
      "confirm:yes": onDone
    };

  const t3 = {
      context: "Confirmation"
    };

  useKeybindings(t2, t3);
  const t4 = e => {
      if (e.key === " ") {
        e.preventDefault();
        onDone();
      } else {
        if (e.key === "left" && onBack) {
          e.preventDefault();
          onBack();
        } else {
          if (e.key === "x" && agent.status === "running" && onKillAgent) {
            e.preventDefault();
            onKillAgent();
          }
        }
      }
    };

  const handleKeyDown = t4;
  const t5 = extractTag(agent.prompt, "plan");

  const planContent = t5;
  const displayPrompt = agent.prompt.length > 300 ? agent.prompt.substring(0, 297) + "\u2026" : agent.prompt;
  const tokenCount = agent.result?.totalTokens ?? agent.progress?.tokenCount;
  const toolUseCount = agent.result?.totalToolUseCount ?? agent.progress?.toolUseCount;
  const t6 = agent.selectedAgent?.agentType ?? "agent";
  const t7 = agent.description || "Async agent";
  const t8 = <Text>{t6} ›{" "}{t7}</Text>;

  const title = t8;
  const t9 = agent.status !== "running" && <Text color={getTaskStatusColor(agent.status)}>{getTaskStatusIcon(agent.status)}{" "}{agent.status === "completed" ? "Completed" : agent.status === "failed" ? "Failed" : "Stopped"}{" \xB7 "}</Text>;

  const t10 = tokenCount !== undefined && tokenCount > 0 && <> · {formatNumber(tokenCount)} tokens</>;

  const t11 = toolUseCount !== undefined && toolUseCount > 0 && <>{" "}· {toolUseCount} {toolUseCount === 1 ? "tool" : "tools"}</>;

  const t12 = <Text dimColor={true}>{elapsedTime}{t10}{t11}</Text>;

  const t13 = <Text>{t9}{t12}</Text>;

  const subtitle = t13;
  const t14 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>{onBack && <KeyboardShortcutHint shortcut={"\u2190"} action="go back" />}<KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />{agent.status === "running" && onKillAgent && <KeyboardShortcutHint shortcut="x" action="stop" />}</Byline>;

  const t15 = agent.status === "running" && agent.progress?.recentActivities && agent.progress.recentActivities.length > 0 && <Box flexDirection="column"><Text bold={true} dimColor={true}>Progress</Text>{agent.progress.recentActivities.map((activity, i) => <Text key={i} dimColor={i < agent.progress.recentActivities.length - 1} wrap="truncate-end">{i === agent.progress.recentActivities.length - 1 ? "\u203A " : "  "}{renderToolActivity(activity, tools, theme)}</Text>)}</Box>;

  const t16 = planContent ? <Box marginTop={1}><UserPlanMessage addMargin={false} planContent={planContent} /></Box> : <Box flexDirection="column" marginTop={1}><Text bold={true} dimColor={true}>Prompt</Text><Text wrap="wrap">{displayPrompt}</Text></Box>;

  const t17 = agent.status === "failed" && agent.error && <Box flexDirection="column" marginTop={1}><Text bold={true} color="error">Error</Text><Text color="error" wrap="wrap">{agent.error}</Text></Box>;

  const t18 = <Box flexDirection="column">{t15}{t16}{t17}</Box>;

  const t19 = <Dialog title={title} subtitle={subtitle} onCancel={onDone} color="background" inputGuide={t14}>{t18}</Dialog>;

  const t20 = <Box flexDirection="column" tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t19}</Box>;

  return t20;
}
