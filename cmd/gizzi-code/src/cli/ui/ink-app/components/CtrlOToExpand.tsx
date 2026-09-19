import chalk from '@/shared/util/chalk'
import React, { useContext } from 'react';
import { Text } from '../ink';
import { getShortcutDisplay } from '../keybindings/shortcutFormat';
import { useShortcutDisplay } from '../keybindings/useShortcutDisplay';
import { KeyboardShortcutHint } from './design-system/KeyboardShortcutHint';
import { InVirtualListContext } from './messageActions';

// Context to track if we're inside a sub agent
// Similar to MessageResponseContext, this helps us avoid showing
// too many "(ctrl+o to expand)" hints in sub agent output
const SubAgentContext = React.createContext(false);
export function SubAgentProvider(t0) {
  const {
    children
  } = t0;
  const t1 = <SubAgentContext.Provider value={true}>{children}</SubAgentContext.Provider>;

  return t1;
}
export function CtrlOToExpand() {
  const isInSubAgent = useContext(SubAgentContext);
  const inVirtualList = useContext(InVirtualListContext);
  const expandShortcut = useShortcutDisplay("app:toggleTranscript", "Global", "ctrl+o");
  if (isInSubAgent || inVirtualList) {
    return null;
  }
  const t0 = <Text dimColor={true}><KeyboardShortcutHint shortcut={expandShortcut} action="expand" parens={true} /></Text>;

  return t0;
}
export function ctrlOToExpand(): string {
  const shortcut = getShortcutDisplay('app:toggleTranscript', 'Global', 'ctrl+o');
  return chalk.dim(`(${shortcut} to expand)`);
}
