import React, { useMemo } from 'react';
import type { DeepImmutable } from './../../types/utils.ts';
import { useElapsedTime } from '../../hooks/useElapsedTime';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text, useTheme } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import { getEmptyToolPermissionContext } from '../../Tool';
import type { InProcessTeammateTaskState } from '../../tasks/InProcessTeammateTask/types';
import { getTools } from '../../tools';
import { formatNumber, truncateToWidth } from '../../utils/format';
import { toInkColor } from '../../utils/ink';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
import { renderToolActivity } from './renderToolActivity';
import { describeTeammateActivity } from './taskStatusUtils';
type Props = {
  teammate: DeepImmutable<InProcessTeammateTaskState>;
  onDone: () => void;
  onKill?: () => void;
  onBack?: () => void;
  onForeground?: () => void;
};
export function InProcessTeammateDetailDialog({
    teammate,
    onDone,
    onKill,
    onBack,
    onForeground
}: Props) {
  const [theme] = useTheme();
  const t1 = getTools(getEmptyToolPermissionContext());

  const tools = t1;
  const elapsedTime = useElapsedTime(teammate.startTime, teammate.status === "running", 1000, teammate.totalPausedMs ?? 0);
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
          if (e.key === "x" && teammate.status === "running" && onKill) {
            e.preventDefault();
            onKill();
          } else {
            if (e.key === "f" && teammate.status === "running" && onForeground) {
              e.preventDefault();
              onForeground();
            }
          }
        }
      }
    };

  const handleKeyDown = t4;
  const t5 = describeTeammateActivity(teammate);

  const activity = t5;
  const tokenCount = teammate.result?.totalTokens ?? teammate.progress?.tokenCount;
  const toolUseCount = teammate.result?.totalToolUseCount ?? teammate.progress?.toolUseCount;
  const t6 = truncateToWidth(teammate.prompt, 300);

  const displayPrompt = t6;
  const t7 = toInkColor(teammate.identity.color);

  const t8 = <Text color={t7}>@{teammate.identity.agentName}</Text>;

  const t9 = activity && <Text dimColor={true}> ({activity})</Text>;

  const t10 = <Text>{t8}{t9}</Text>;

  const title = t10;
  const t11 = teammate.status !== "running" && <Text color={teammate.status === "completed" ? "success" : teammate.status === "killed" ? "warning" : "error"}>{teammate.status === "completed" ? "Completed" : teammate.status === "failed" ? "Failed" : "Stopped"}{" \xB7 "}</Text>;

  const t12 = tokenCount !== undefined && tokenCount > 0 && <> · {formatNumber(tokenCount)} tokens</>;

  const t13 = toolUseCount !== undefined && toolUseCount > 0 && <>{" "}· {toolUseCount} {toolUseCount === 1 ? "tool" : "tools"}</>;

  const t14 = <Text dimColor={true}>{elapsedTime}{t12}{t13}</Text>;

  const t15 = <Text>{t11}{t14}</Text>;

  const subtitle = t15;
  const t16 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>{onBack && <KeyboardShortcutHint shortcut={"\u2190"} action="go back" />}<KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />{teammate.status === "running" && onKill && <KeyboardShortcutHint shortcut="x" action="stop" />}{teammate.status === "running" && onForeground && <KeyboardShortcutHint shortcut="f" action="foreground" />}</Byline>;

  const t17 = teammate.status === "running" && teammate.progress?.recentActivities && teammate.progress.recentActivities.length > 0 && <Box flexDirection="column"><Text bold={true} dimColor={true}>Progress</Text>{teammate.progress.recentActivities.map((activity_0, i) => <Text key={i} dimColor={i < teammate.progress.recentActivities.length - 1} wrap="truncate-end">{i === teammate.progress.recentActivities.length - 1 ? "\u203A " : "  "}{renderToolActivity(activity_0, tools, theme)}</Text>)}</Box>;

  const t18 = <Text bold={true} dimColor={true}>Prompt</Text>;

  const t19 = <Box flexDirection="column" marginTop={1}>{t18}<Text wrap="wrap">{displayPrompt}</Text></Box>;

  const t20 = teammate.status === "failed" && teammate.error && <Box flexDirection="column" marginTop={1}><Text bold={true} color="error">Error</Text><Text color="error" wrap="wrap">{teammate.error}</Text></Box>;

  const t21 = <Dialog title={title} subtitle={subtitle} onCancel={onDone} color="background" inputGuide={t16}>{t17}{t19}{t20}</Dialog>;

  const t22 = <Box flexDirection="column" tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t21}</Box>;

  return t22;
}
