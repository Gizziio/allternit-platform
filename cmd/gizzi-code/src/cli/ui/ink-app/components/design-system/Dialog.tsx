import React from 'react';
import { type ExitState, useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import type { Theme } from '../../utils/theme';
import { ConfigurableShortcutHint } from '../ConfigurableShortcutHint';
import { Byline } from './Byline';
import { KeyboardShortcutHint } from './KeyboardShortcutHint';
import { Pane } from './Pane';
type DialogProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  onCancel: () => void;
  color?: keyof Theme;
  hideInputGuide?: boolean;
  hideBorder?: boolean;
  /** Custom input guide content. Receives exitState for Ctrl+C/D pending display. */
  inputGuide?: (exitState: ExitState) => React.ReactNode;
  /**
   * Controls whether Dialog's built-in confirm:no (Esc/n) and app:exit/interrupt
   * (Ctrl-C/D) keybindings are active. Set to `false` while an embedded text
   * field is being edited so those keys reach the field instead of being
   * consumed by Dialog. TextInput has its own ctrl+c/d handlers (cancel on
   * press, delete-forward on ctrl+d with text). Defaults to `true`.
   */
  isCancelActive?: boolean;
};
export function Dialog({
    title,
    subtitle,
    children,
    onCancel,
    color: t1,
    hideInputGuide,
    hideBorder,
    inputGuide,
    isCancelActive: t2
}: DialogProps) {
  const color = t1 === undefined ? "permission" : t1;
  const isCancelActive = t2 === undefined ? true : t2;
  const exitState = useExitOnCtrlCDWithKeybindings(undefined, undefined, isCancelActive);
  const t3 = {
      context: "Confirmation",
      isActive: isCancelActive
    };

  useKeybinding("confirm:no", onCancel, t3);
  const t4 = exitState.pending ? <Text>Press {exitState.keyName} again to exit</Text> : <Byline><KeyboardShortcutHint shortcut="Enter" action="confirm" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline>;

  const defaultInputGuide = t4;
  const t5 = <Text bold={true} color={color}>{title}</Text>;

  const t6 = subtitle && <Text dimColor={true}>{subtitle}</Text>;

  const t7 = <Box flexDirection="column">{t5}{t6}</Box>;

  const t8 = <Box flexDirection="column" gap={1}>{t7}{children}</Box>;

  const t9 = !hideInputGuide && <Box marginTop={1}><Text dimColor={true} italic={true}>{inputGuide ? inputGuide(exitState) : defaultInputGuide}</Text></Box>;

  const t10 = <>{t8}{t9}</>;

  const content = t10;
  if (hideBorder) {
    return content;
  }
  const t11 = <Pane color={color}>{content}</Pane>;

  return t11;
}
