// @ts-nocheck
// TODO(types): the switch handles 'local_workflow' and 'monitor_mcp' task
// variants whose state types don't exist in this tree (BackgroundTaskState
// omits them), so those branches narrow task to never. Runtime handles them
// defensively; the union needs the missing variants before nocheck can drop.
import * as React from 'react';
import { Text } from './../../ink.ts';
import type { BackgroundTaskState } from './../../tasks/types.ts';
import type { DeepImmutable } from './../../types/utils.ts';
import { truncate } from './../../utils/format.ts';
import { toInkColor } from './../../utils/ink.ts';
import { plural } from './../../utils/stringUtils.ts';
import { DIAMOND_FILLED, DIAMOND_OPEN } from '../../constants/figures';
import { RemoteSessionProgress } from './RemoteSessionProgress';
import { ShellProgress, TaskStatusText } from './ShellProgress';
import { describeTeammateActivity } from './taskStatusUtils';
type Props = {
  task: DeepImmutable<BackgroundTaskState>;
  maxActivityWidth?: number;
};
export function BackgroundTask({
    task,
    maxActivityWidth
}: Props) {
  const activityLimit = maxActivityWidth ?? 40;
  switch (task.type) {
    case "local_bash":
      {
        const t1 = task.kind === "monitor" ? task.description : task.command;
        const t2 = truncate(t1, activityLimit, true);

        const t3 = <ShellProgress shell={task} />;

        const t4 = <Text>{t2}{" "}{t3}</Text>;

        return t4;
      }
    case "remote_agent":
      {
        if (task.isRemoteReview) {
          const t1 = <Text><RemoteSessionProgress session={task} /></Text>;

          return t1;
        }
        const running = task.status === "running" || task.status === "pending";
        const t1 = running ? DIAMOND_OPEN : DIAMOND_FILLED;
        const t2 = <Text dimColor={true}>{t1} </Text>;

        const t3 = truncate(task.title, activityLimit, true);

        const t4 = <Text dimColor={true}> · </Text>;

        const t5 = <RemoteSessionProgress session={task} />;

        const t6 = <Text>{t2}{t3}{t4}{t5}</Text>;

        return t6;
      }
    case "local_agent":
      {
        const t1 = truncate(task.description, activityLimit, true);

        const t2 = task.status === "completed" ? "done" : undefined;
        const t3 = task.status === "completed" && !task.notified ? ", unread" : undefined;
        const t4 = <TaskStatusText status={task.status} label={t2} suffix={t3} />;

        const t5 = <Text>{t1}{" "}{t4}</Text>;

        return t5;
      }
    case "in_process_teammate":
      {
        let T0;
        let T1;
        let t1;
        let t2;
        let t3;
        let t4;
        const activity = describeTeammateActivity(task);
        T1 = Text;
        const t5 = toInkColor(task.identity.color);


          t4 = <Text color={t5}>@{task.identity.agentName}</Text>;
        
        T0 = Text;
        t1 = true;
        t2 = ": ";
        t3 = truncate(activity, activityLimit, true);
        

        const t5_2 = <T0 dimColor={t1}>{t2}{t3}</T0>;

        const t6 = <T1>{t4}{t5_2}</T1>;

        return t6;
      }
    case "local_workflow":
      {
        const t1 = task.workflowName ?? task.summary ?? task.description;
        const t2 = truncate(t1, activityLimit, true);

        const t3 = task.status === "running" ? `${task.agentCount} ${plural(task.agentCount, "agent")}` : task.status === "completed" ? "done" : undefined;

        const t4 = task.status === "completed" && !task.notified ? ", unread" : undefined;
        const t5 = <TaskStatusText status={task.status} label={t3} suffix={t4} />;

        const t6 = <Text>{t2}{" "}{t5}</Text>;

        return t6;
      }
    case "monitor_mcp":
      {
        const t1 = truncate(task.description, activityLimit, true);

        const t2 = task.status === "completed" ? "done" : undefined;
        const t3 = task.status === "completed" && !task.notified ? ", unread" : undefined;
        const t4 = <TaskStatusText status={task.status} label={t2} suffix={t3} />;

        const t5 = <Text>{t1}{" "}{t4}</Text>;

        return t5;
      }
    case "dream":
      {
        const n = task.filesTouched.length;
        const t1 = task.phase === "updating" && n > 0 ? `${n} ${plural(n, "file")}` : `${task.sessionsReviewing} ${plural(task.sessionsReviewing, "session")}`;

        const detail = t1;
        const t2 = <Text dimColor={true}>· {task.phase} · {detail}</Text>;

        const t3 = task.status === "completed" ? "done" : undefined;
        const t4 = task.status === "completed" && !task.notified ? ", unread" : undefined;
        const t5 = <TaskStatusText status={task.status} label={t3} suffix={t4} />;

        const t6 = <Text>{task.description}{" "}{t2}{" "}{t5}</Text>;

        return t6;
      }
  }
}
