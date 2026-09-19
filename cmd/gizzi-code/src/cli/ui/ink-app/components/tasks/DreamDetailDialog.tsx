import React from 'react';
import type { DeepImmutable } from './../../types/utils.ts';
import { useElapsedTime } from '../../hooks/useElapsedTime';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text } from '../../ink';
import { useKeybindings } from '../../keybindings/useKeybinding';
import type { DreamTaskState } from '../../tasks/DreamTask/DreamTask';
import { plural } from '../../utils/stringUtils';
import { Byline } from '../design-system/Byline';
import { Dialog } from '../design-system/Dialog';
import { KeyboardShortcutHint } from '../design-system/KeyboardShortcutHint';
type Props = {
  task: DeepImmutable<DreamTaskState>;
  onDone: () => void;
  onBack?: () => void;
  onKill?: () => void;
};

// How many recent turns to render. Earlier turns collapse to a count.
const VISIBLE_TURNS = 6;
export function DreamDetailDialog({
    task,
    onDone,
    onBack,
    onKill
}: Props) {
  const elapsedTime = useElapsedTime(task.startTime, task.status === "running", 1000, 0);
  const t1 = {
      "confirm:yes": onDone
    };

  const t2 = {
      context: "Confirmation"
    };

  useKeybindings(t1, t2);
  const t3 = e => {
      if (e.key === " ") {
        e.preventDefault();
        onDone();
      } else {
        if (e.key === "left" && onBack) {
          e.preventDefault();
          onBack();
        } else {
          if (e.key === "x" && task.status === "running" && onKill) {
            e.preventDefault();
            onKill();
          }
        }
      }
    };

  const handleKeyDown = t3;
  let T0;
  let T1;
  let T2;
  let t10;
  let t11;
  let t12;
  let t13;
  let t14;
  let t15;
  let t16;
  let t4;
  let t5;
  let t6;
  let t7;
  let t8;
  let t9;
  const visibleTurns = task.turns.filter(_temp);
  const shown = visibleTurns.slice(-VISIBLE_TURNS);
  const hidden = visibleTurns.length - shown.length;
  T2 = Box;
  t13 = "column";
  t14 = 0;
  t15 = true;
  t16 = handleKeyDown;
  T1 = Dialog;
  t8 = "Memory consolidation";
  const t17 = task.sessionsReviewing;
  const t18 = plural(task.sessionsReviewing, "session");

  const t19 = task.filesTouched.length > 0 && <>{" "}· {task.filesTouched.length}{" "}{plural(task.filesTouched.length, "file")} touched</>;


    t9 = <Text dimColor={true}>{elapsedTime} · reviewing {t17}{" "}{t18}{t19}</Text>;
  
  t10 = onDone;
  t11 = "background";

    t12 = exitState => exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline>{onBack && <KeyboardShortcutHint shortcut={"\u2190"} action="go back" />}<KeyboardShortcutHint shortcut="Esc/Enter/Space" action="close" />{task.status === "running" && onKill && <KeyboardShortcutHint shortcut="x" action="stop" />}</Byline>;
  
  T0 = Box;
  t4 = "column";
  t5 = 1;
  const t20 = <Text bold={true}>Status:</Text>;


    t6 = <Text>{t20}{" "}{task.status === "running" ? <Text color="background">running</Text> : task.status === "completed" ? <Text color="success">{task.status}</Text> : <Text color="error">{task.status}</Text>}</Text>;
  
  t7 = shown.length === 0 ? <Text dimColor={true}>{task.status === "running" ? "Starting\u2026" : "(no text output)"}</Text> : <>{hidden > 0 && <Text dimColor={true}>({hidden} earlier {plural(hidden, "turn")})</Text>}{shown.map(_temp2)}</>;
  

  const t17_2 = <T0 flexDirection={t4} gap={t5}>{t6}{t7}</T0>;

  const t18_2 = <T1 title={t8} subtitle={t9} onCancel={t10} color={t11} inputGuide={t12}>{t17_2}</T1>;

  const t19_2 = <T2 flexDirection={t13} tabIndex={t14} autoFocus={t15} onKeyDown={t16}>{t18_2}</T2>;

  return t19_2;
}
function _temp2(turn, i) {
  return <Box key={i} flexDirection="column"><Text wrap="wrap">{turn.text}</Text>{turn.toolUseCount > 0 && <Text dimColor={true}>{"  "}({turn.toolUseCount}{" "}{plural(turn.toolUseCount, "tool")})</Text>}</Box>;
}
function _temp(t) {
  return t.text !== "";
}
