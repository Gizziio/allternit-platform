import React from 'react';
import { useIsInsideModal } from '../../context/modalContext';
import { Box } from '../../ink';
import type { Theme } from '../../utils/theme';
import { Divider } from './Divider';
type PaneProps = {
  children: React.ReactNode;
  /**
   * Theme color for the top border line.
   */
  color?: keyof Theme;
};

/**
 * A pane — a region of the terminal that appears below the REPL prompt,
 * bounded by a colored top line with a one-row gap above and horizontal
 * padding. Used by all slash-command screens: /config, /help, /plugins,
 * /sandbox, /stats, /permissions.
 *
 * For confirm/cancel dialogs (Esc to dismiss, Enter to confirm), use
 * `<Dialog>` instead — it registers its own keybindings. For a full
 * rounded-border card, use `<Panel>`.
 *
 * Submenus rendered inside a Pane should use `hideBorder` on their Dialog
 * so the Pane's border remains the single frame.
 *
 * @example
 * <Pane color="permission">
 *   <Tabs title="Sandbox:">...</Tabs>
 * </Pane>
 */
export function Pane({
    children,
    color
}: PaneProps) {
  if (useIsInsideModal()) {
    const t1 = <Box flexDirection="column" paddingX={1} flexShrink={0}>{children}</Box>;

    return t1;
  }
  const t1 = <Divider color={color} />;

  const t2 = <Box flexDirection="column" paddingX={2}>{children}</Box>;

  const t3 = <Box flexDirection="column" paddingTop={1}>{t1}{t2}</Box>;

  return t3;
}
