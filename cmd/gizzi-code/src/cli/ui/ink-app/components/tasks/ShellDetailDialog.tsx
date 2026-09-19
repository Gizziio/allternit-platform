import React, { Suspense, use, useDeferredValue, useEffect, useState } from 'react';
import type { DeepImmutable } from './../../types/utils.ts';
import type { CommandResultDisplay } from '../../commands';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import type { LocalShellTaskState } from '../../tasks/LocalShellTask/guards';
import { formatDuration, formatFileSize, truncateToWidth } from '../../utils/format';
import { tailFile } from '../../utils/fsOperations';
import { getTaskOutputPath } from '../../utils/task/diskOutput';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
type Props = {
  shell: DeepImmutable<LocalShellTaskState>;
  onDone: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
  onKillShell?: () => void;
  onBack?: () => void;
};
const SHELL_DETAIL_TAIL_BYTES = 8192;
type TaskOutputResult = {
  content: string;
  bytesTotal: number;
};

/**
 * Read the tail of the task output file. Only reads the last few KB,
 * not the entire file.
 */
async function getTaskOutput(shell: DeepImmutable<LocalShellTaskState>): Promise<TaskOutputResult> {
  const path = getTaskOutputPath(shell.id);
  try {
    const result = await tailFile(path, SHELL_DETAIL_TAIL_BYTES);
    return {
      content: result.content,
      bytesTotal: result.bytesTotal
    };
  } catch {
    return {
      content: '',
      bytesTotal: 0
    };
  }
}
export function ShellDetailDialog({
    shell,
    onDone,
    onKillShell,
    onBack
}: Props) {
  const {
    columns
  } = useTerminalSize();
  const t1 = () => getTaskOutput(shell);

  const [outputPromise, setOutputPromise] = useState(t1);
  const deferredOutputPromise = useDeferredValue(outputPromise);
  const t2 = () => {
      if (shell.status !== "running") {
        return;
      }
      const timer = setInterval(_temp, 1000, setOutputPromise, shell);
      return () => clearInterval(timer);
    };

  const t3 = [shell.id, shell.status];

  useEffect(t2, t3);
  const t4 = () => onDone("Shell details dismissed", {
      display: "system"
    });

  const handleClose = t4;
  const t5 = {
      "confirm:yes": handleClose
    };

  const t6 = {
      context: "Confirmation"
    };

  useKeybindings(t5, t6);
  const t7 = e => {
      if (e.key === " ") {
        e.preventDefault();
        onDone("Shell details dismissed", {
          display: "system"
        });
      } else {
        if (e.key === "left" && onBack) {
          e.preventDefault();
          onBack();
        } else {
          if (e.key === "x" && shell.status === "running" && onKillShell) {
            e.preventDefault();
            onKillShell();
          }
        }
      }
    };

  const handleKeyDown = t7;
  const isMonitor = shell.kind === "monitor";
  const t8 = truncateToWidth(shell.command, 280);

  const displayCommand = t8;
  const t9 = isMonitor ? "Monitor details" : "Shell details";
  const t10 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>{onBack && <KeyboardShortcutHint shortcut={"\u2190"} action="go back" />}<KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />{shell.status === "running" && onKillShell && <KeyboardShortcutHint shortcut="x" action="stop" />}</Byline>;

  const t11 = <Text bold={true}>Status:</Text>;

  const t12 = <Text>{t11}{" "}{shell.status === "running" ? <Text color="background">{shell.status}{shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`}</Text> : shell.status === "completed" ? <Text color="success">{shell.status}{shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`}</Text> : <Text color="error">{shell.status}{shell.result?.code !== undefined && ` (exit code: ${shell.result.code})`}</Text>}</Text>;

  const t13 = <Text bold={true}>Runtime:</Text>;

  const t14 = shell.endTime ?? Date.now();

  const t15 = t14 - shell.startTime;
  const t16 = formatDuration(t15);

  const t17 = <Text>{t13}{" "}{t16}</Text>;

  const t18 = isMonitor ? "Script:" : "Command:";
  const t19 = <Text bold={true}>{t18}</Text>;

  const t20 = <Text wrap="wrap">{t19}{" "}{displayCommand}</Text>;

  const t21 = <Box flexDirection="column">{t12}{t17}{t20}</Box>;

  const t22 = <Text bold={true}>Output:</Text>;

  const t23 = <Text dimColor={true}>Loading output…</Text>;

  const t24 = <Box flexDirection="column">{t22}<Suspense fallback={t23}><ShellOutputContent outputPromise={deferredOutputPromise} columns={columns} /></Suspense></Box>;

  const t25 = <Dialog title={t9} onCancel={handleClose} color="background" inputGuide={t10}>{t21}{t24}</Dialog>;

  const t26 = <Box flexDirection="column" tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t25}</Box>;

  return t26;
}
function _temp(setOutputPromise_0, shell_0) {
  return setOutputPromise_0(getTaskOutput(shell_0));
}
type ShellOutputContentProps = {
  outputPromise: Promise<TaskOutputResult>;
  columns: number;
};
function ShellOutputContent({
    outputPromise,
    columns
}: ShellOutputContentProps) {
  const {
    content,
    bytesTotal
  } = use(outputPromise);
  if (!content) {
    const t1 = <Text dimColor={true}>No output available</Text>;

    return t1;
  }
  const starts = [];
  let pos = content.length;
  for (let i = 0; i < 10 && pos > 0; i++) {
      const prev = content.lastIndexOf("\n", pos - 1);
      starts.push(prev + 1);
      pos = prev;
    }
  starts.reverse();
  const isIncomplete = bytesTotal > content.length;
  const rendered = [];
  for (let i_0 = 0; i_0 < starts.length; i_0++) {
      const start = starts[i_0];
      const end = i_0 < starts.length - 1 ? starts[i_0 + 1] - 1 : content.length;
      const line = content.slice(start, end);
      if (line) {
        rendered.push(line);
      }
    }

  const t1 = columns - 6;
  const t2 = rendered.map(_temp2);

  const t3 = <Box borderStyle="round" paddingX={1} flexDirection="column" height={12} maxWidth={t1}>{t2}</Box>;

  const t4 = `Showing ${rendered.length} lines`;
  const t5 = isIncomplete ? ` of ${formatFileSize(bytesTotal)}` : "";

  const t6 = <Text dimColor={true} italic={true}>{t4}{t5}</Text>;

  const t7 = <>{t3}{t6}</>;

  return t7;
}
function _temp2(line_0, i_1) {
  return <Text key={i_1} wrap="truncate-end">{line_0}</Text>;
}
