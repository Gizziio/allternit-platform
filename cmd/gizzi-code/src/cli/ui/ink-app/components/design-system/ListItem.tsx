import figures from 'figures';
import type { ReactNode } from 'react';
import React from 'react';
import { useDeclaredCursor } from '../../ink/hooks/use-declared-cursor';
import { Box, Text } from '../../ink';
type ListItemProps = {
  /**
   * Whether this item is currently focused (keyboard selection).
   * Shows the pointer indicator (❯) when true.
   */
  isFocused: boolean;

  /**
   * Whether this item is selected (chosen/checked).
   * Shows the checkmark indicator (✓) when true.
   * @default false
   */
  isSelected?: boolean;

  /**
   * The content to display for this item.
   */
  children: ReactNode;

  /**
   * Optional description text displayed below the main content.
   */
  description?: string;

  /**
   * Show a down arrow indicator instead of pointer (for scroll hints).
   * Only applies when not focused.
   */
  showScrollDown?: boolean;

  /**
   * Show an up arrow indicator instead of pointer (for scroll hints).
   * Only applies when not focused.
   */
  showScrollUp?: boolean;

  /**
   * Whether to apply automatic styling to the children based on focus/selection state.
   * - When true (default): children are wrapped in Text with state-based colors
   * - When false: children are rendered as-is, allowing custom styling
   * @default true
   */
  styled?: boolean;

  /**
   * Whether this item is disabled. Disabled items show dimmed text and no indicators.
   * @default false
   */
  disabled?: boolean;

  /**
   * Whether this ListItem should declare the terminal cursor position.
   * Set false when a child (e.g. BaseTextInput) declares its own cursor.
   * @default true
   */
  declareCursor?: boolean;
};

/**
 * A list item component for selection UIs (dropdowns, multi-selects, menus).
 *
 * Handles the common pattern of:
 * - Pointer indicator (❯) for focused items
 * - Checkmark indicator (✓) for selected items
 * - Scroll indicators (↓↑) for truncated lists
 * - Color states for focus/selection
 *
 * @example
 * // Basic usage in a selection list
 * {options.map((option, i) => (
 *   <ListItem
 *     key={option.id}
 *     isFocused={focusIndex === i}
 *     isSelected={selectedId === option.id}
 *   >
 *     {option.label}
 *   </ListItem>
 * ))}
 *
 * @example
 * // With scroll indicators
 * <ListItem isFocused={false} showScrollUp>First visible item</ListItem>
 * ...
 * <ListItem isFocused={false} showScrollDown>Last visible item</ListItem>
 *
 * @example
 * // With description
 * <ListItem isFocused isSelected={false} description="Secondary text here">
 *   Primary text
 * </ListItem>
 *
 * @example
 * // Custom children styling (styled=false)
 * <ListItem isFocused styled={false}>
 *   <Text color="gizzi">Custom styled content</Text>
 * </ListItem>
 */
export function ListItem({
    isFocused,
    isSelected: t1,
    children,
    description,
    showScrollDown,
    showScrollUp,
    styled: t2,
    disabled: t3,
    declareCursor
}: ListItemProps) {
  const isSelected = t1 === undefined ? false : t1;
  const styled = t2 === undefined ? true : t2;
  const disabled = t3 === undefined ? false : t3;
  const t4 = function renderIndicator() {
      if (disabled) {
        return <Text> </Text>;
      }
      if (isFocused) {
        return <Text color="suggestion">{figures.pointer}</Text>;
      }
      if (showScrollDown) {
        return <Text dimColor={true}>{figures.arrowDown}</Text>;
      }
      if (showScrollUp) {
        return <Text dimColor={true}>{figures.arrowUp}</Text>;
      }
      return <Text> </Text>;
    };

  const renderIndicator = t4;
  const getTextColor = function getTextColor() {
      if (disabled) {
        return "inactive";
      }
      if (!styled) {
        return;
      }
      if (isSelected) {
        return "success";
      }
      if (isFocused) {
        return "suggestion";
      }
    };
  const t5 = getTextColor();

  const textColor = t5;
  const t6 = isFocused && !disabled && declareCursor !== false;
  const t7 = {
      line: 0,
      column: 0,
      active: t6
    };

  const cursorRef = useDeclaredCursor(t7);
  const t8 = renderIndicator();

  const t9 = styled ? <Text color={textColor} dimColor={disabled}>{children}</Text> : children;

  const t10 = isSelected && !disabled && <Text color="success">{figures.tick}</Text>;

  const t11 = <Box flexDirection="row" gap={1}>{t8}{t9}{t10}</Box>;

  const t12 = description && <Box paddingLeft={2}><Text color="inactive">{description}</Text></Box>;

  const t13 = <Box ref={cursorRef} flexDirection="column">{t11}{t12}</Box>;

  return t13;
}
