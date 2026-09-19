import React from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { stringWidth } from '../../ink/stringWidth';
import { Ansi, Text } from '../../ink';
import type { Theme } from '../../utils/theme';
type DividerProps = {
  /**
   * Width of the divider in characters.
   * Defaults to terminal width.
   */
  width?: number;

  /**
   * Theme color for the divider.
   * If not provided, dimColor is used.
   */
  color?: keyof Theme;

  /**
   * Character to use for the divider line.
   * @default '─'
   */
  char?: string;

  /**
   * Padding to subtract from the width (e.g., for indentation).
   * @default 0
   */
  padding?: number;

  /**
   * Title shown in the middle of the divider.
   * May contain ANSI codes (e.g., chalk-styled text).
   *
   * @example
   * // ─────────── Title ───────────
   * <Divider title="Title" />
   */
  title?: string;
};

/**
 * A horizontal divider line.
 *
 * @example
 * // Full-width dimmed divider
 * <Divider />
 *
 * @example
 * // Colored divider
 * <Divider color="suggestion" />
 *
 * @example
 * // Fixed width
 * <Divider width={40} />
 *
 * @example
 * // Full width minus padding (for indented content)
 * <Divider padding={4} />
 *
 * @example
 * // With centered title
 * <Divider title="3 new messages" />
 */
export function Divider({
    width,
    color,
    char: t1,
    padding: t2,
    title
}: DividerProps) {
  const char = t1 === undefined ? "\u2500" : t1;
  const padding = t2 === undefined ? 0 : t2;
  const {
    columns: terminalWidth
  } = useTerminalSize();
  const effectiveWidth = Math.max(0, (width ?? terminalWidth) - padding);
  if (title) {
    const titleWidth = stringWidth(title) + 2;
    const sideWidth = Math.max(0, effectiveWidth - titleWidth);
    const leftWidth = Math.floor(sideWidth / 2);
    const rightWidth = sideWidth - leftWidth;
    const t3 = !color;
    const t4 = char.repeat(leftWidth);

    const t5 = <Text dimColor={true}><Ansi>{title}</Ansi></Text>;

    const t6 = char.repeat(rightWidth);

    const t7 = <Text color={color} dimColor={t3}>{t4}{" "}{t5}{" "}{t6}</Text>;

    return t7;
  }
  const t3 = !color;
  const t4 = char.repeat(effectiveWidth);

  const t5 = <Text color={color} dimColor={t3}>{t4}</Text>;

  return t5;
}
