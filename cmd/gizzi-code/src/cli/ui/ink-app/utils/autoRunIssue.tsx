// @ts-nocheck
// TODO(types): compiler-artifact decompile kept nocheck — see inline type errors (dead "external"/"ant" constant comparisons, unknown-typed tool result access, keybindings/types re-export drift).
import * as React from 'react';
import { useEffect, useRef } from 'react';
import { KeyboardShortcutHint } from '../components/design-system/KeyboardShortcutHint';
import { Box, Text } from '../ink';
import { useKeybinding } from '../keybindings/useKeybinding';
type Props = {
  onRun: () => void;
  onCancel: () => void;
  reason: string;
};

/**
 * Component that shows a notification about running /issue command
 * with the ability to cancel via ESC key
 */
export function AutoRunIssueNotification({
    onRun,
    onCancel,
    reason
}: Props) {
  const hasRunRef = useRef(false);
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onCancel, t1);
  const t2 = () => {
      if (!hasRunRef.current) {
        hasRunRef.current = true;
        onRun();
      }
    };
  const t3 = [onRun];

  useEffect(t2, t3);
  const t4 = <Box><Text bold={true}>Running feedback capture...</Text></Box>;

  const t5 = <Box><Text dimColor={true}>Press <KeyboardShortcutHint shortcut="Esc" action="cancel" /> anytime</Text></Box>;

  const t6 = <Box flexDirection="column" marginTop={1}>{t4}{t5}<Box><Text dimColor={true}>Reason: {reason}</Text></Box></Box>;

  return t6;
}
export type AutoRunIssueReason = 'feedback_survey_bad' | 'feedback_survey_good';

/**
 * Determines if /issue should auto-run for Ant users
 */
export function shouldAutoRunIssue(reason: AutoRunIssueReason): boolean {
  // Only for Ant users
  if ("external" !== 'ant') {
    return false;
  }
  switch (reason) {
    case 'feedback_survey_bad':
      return false;
    case 'feedback_survey_good':
      return false;
    default:
      return false;
  }
}

/**
 * Returns the appropriate command to auto-run based on the reason
 * ANT-ONLY: good-claude command only exists in ant builds
 */
export function getAutoRunCommand(reason: AutoRunIssueReason): string {
  // Only ant builds have the /good-claude command
  if ("external" === 'ant' && reason === 'feedback_survey_good') {
    return '/good-claude';
  }
  return '/issue';
}

/**
 * Gets a human-readable description of why /issue is being auto-run
 */
export function getAutoRunIssueReasonText(reason: AutoRunIssueReason): string {
  switch (reason) {
    case 'feedback_survey_bad':
      return 'You responded "Bad" to the feedback survey';
    case 'feedback_survey_good':
      return 'You responded "Good" to the feedback survey';
    default:
      return 'Unknown reason';
  }
}
