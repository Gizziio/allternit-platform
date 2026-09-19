import type { ReactNode } from 'react';
import React from 'react';
import { Text } from './../../ink.ts';
import type { TaskStatus } from './../../Task.ts';
import type { LocalShellTaskState } from './../../tasks/LocalShellTask/guards.ts';
import type { DeepImmutable } from './../../types/utils.ts';
type TaskStatusTextProps = {
  status: TaskStatus;
  label?: string;
  suffix?: string;
};
export function TaskStatusText({
    status,
    label,
    suffix
}: TaskStatusTextProps) {
  const displayLabel = label ?? status;
  const color = status === "completed" ? "success" : status === "failed" ? "error" : status === "killed" ? "warning" : undefined;
  const t1 = <Text color={color} dimColor={true}>({displayLabel}{suffix})</Text>;

  return t1;
}
export function ShellProgress(t0) {
  const {
    shell
  } = t0;
  switch (shell.status) {
    case "completed":
      {
        const t1 = <TaskStatusText status="completed" label="done" />;

        return t1;
      }
    case "failed":
      {
        const t1 = <TaskStatusText status="failed" label="error" />;

        return t1;
      }
    case "killed":
      {
        const t1 = <TaskStatusText status="killed" label="stopped" />;

        return t1;
      }
    case "running":
    case "pending":
      {
        const t1 = <TaskStatusText status="running" />;

        return t1;
      }
  }
}
