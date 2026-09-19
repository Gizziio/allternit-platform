import * as React from 'react';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay';
// ../keybindings/types is a stub in this fork (never exported these);
// local mirrors per the house pattern (see permissions/PermissionPrompt.tsx).
type KeybindingAction = string;
type KeybindingContextName = string;
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
type Props = {
  /** The keybinding action (e.g., 'app:toggleTranscript') */
  action: KeybindingAction;
  /** The keybinding context (e.g., 'Global') */
  context: KeybindingContextName;
  /** Default shortcut if keybinding not configured */
  fallback: string;
  /** The action description text (e.g., 'expand') */
  description: string;
  /** Whether to wrap in parentheses */
  parens?: boolean;
  /** Whether to show in bold */
  bold?: boolean;
};

/**
 * KeyboardShortcutHint that displays the user-configured shortcut.
 * Falls back to default if keybinding context is not available.
 *
 * @example
 * <ConfigurableShortcutHint
 *   action="app:toggleTranscript"
 *   context="Global"
 *   fallback="ctrl+o"
 *   description="expand"
 * />
 */
export function ConfigurableShortcutHint({
    action,
    context,
    fallback,
    description,
    parens,
    bold
}: Props) {
  const shortcut = useShortcutDisplay(action, context, fallback);
  const t1 = <KeyboardShortcutHint shortcut={shortcut} action={description} parens={parens} bold={bold} />;

  return t1;
}
