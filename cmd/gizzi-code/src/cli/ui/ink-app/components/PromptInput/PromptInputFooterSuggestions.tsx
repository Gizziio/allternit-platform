import * as React from 'react';
import { memo, type ReactNode } from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { stringWidth } from '../../ink/stringWidth';
import { Box, Text } from '../../ink';
import { truncatePathMiddle, truncateToWidth } from '../../utils/format';
import type { Theme } from '../../utils/theme';
export type SuggestionItem = {
  id: string;
  displayText: string;
  tag?: string;
  description?: string;
  metadata?: unknown;
  color?: keyof Theme;
};
export type SuggestionType = 'command' | 'file' | 'directory' | 'agent' | 'shell' | 'custom-title' | 'slack-channel' | 'none';
export const OVERLAY_MAX_ITEMS = 8;

/**
 * Get the icon for a suggestion based on its type
 * Icons: + for files, ◇ for MCP resources, * for agents
 */
function getIcon(itemId: string): string {
  if (itemId.startsWith('file-')) return '+';
  if (itemId.startsWith('mcp-resource-')) return '◇';
  if (itemId.startsWith('agent-')) return '*';
  return '+';
}

/**
 * Check if an item is a unified suggestion type (file, mcp-resource, or agent)
 */
function isUnifiedSuggestion(itemId: string): boolean {
  return itemId.startsWith('file-') || itemId.startsWith('mcp-resource-') || itemId.startsWith('agent-');
}
const SuggestionItemRow = memo(function SuggestionItemRow({
    item,
    maxColumnWidth,
    isSelected
  }: {
    item: SuggestionItem;
    maxColumnWidth?: number;
    isSelected: boolean;
  }) {
  const columns = useTerminalSize().columns;
  const isUnified = isUnifiedSuggestion(item.id);
  if (isUnified) {
    const t1 = getIcon(item.id);

    const icon = t1;
    const textColor = isSelected ? "suggestion" : undefined;
    const dimColor = !isSelected;
    const isFile = item.id.startsWith("file-");
    const isMcpResource = item.id.startsWith("mcp-resource-");
    const separatorWidth = item.description ? 3 : 0;
    let displayText;
    if (isFile) {
      const t2 = item.description ? Math.min(20, stringWidth(item.description)) : 0;

      const descReserve = t2;
      const maxPathLength = columns - 2 - 4 - separatorWidth - descReserve;
      const t3 = truncatePathMiddle(item.displayText, maxPathLength);

      displayText = t3;
    } else {
      if (isMcpResource) {
        const t2 = truncateToWidth(item.displayText, 30);

        displayText = t2;
      } else {
        displayText = item.displayText;
      }
    }
    const availableWidth = columns - 2 - stringWidth(displayText) - separatorWidth - 4;
    let lineContent;
    if (item.description) {
      const maxDescLength = Math.max(0, availableWidth);
      const t2 = truncateToWidth(item.description.replace(/\s+/g, " "), maxDescLength);

      const truncatedDesc = t2;
      lineContent = `${icon} ${displayText} – ${truncatedDesc}`;
    } else {
      lineContent = `${icon} ${displayText}`;
    }
    const t2 = <Text color={textColor} dimColor={dimColor} wrap="truncate">{lineContent}</Text>;

    return t2;
  }
  const maxNameWidth = Math.floor(columns * 0.4);
  const displayTextWidth = Math.min(maxColumnWidth ?? stringWidth(item.displayText) + 5, maxNameWidth);
  const textColor_0 = item.color || (isSelected ? "suggestion" : undefined);
  const shouldDim = !isSelected;
  let displayText_0 = item.displayText;
  if (stringWidth(displayText_0) > displayTextWidth - 2) {
    const t1 = displayTextWidth - 2;
    const t2 = truncateToWidth(displayText_0, t1);

    displayText_0 = t2;
  }
  const paddedDisplayText = displayText_0 + " ".repeat(Math.max(0, displayTextWidth - stringWidth(displayText_0)));
  const tagText = item.tag ? `[${item.tag}] ` : "";
  const tagWidth = stringWidth(tagText);
  const descriptionWidth = Math.max(0, columns - displayTextWidth - tagWidth - 4);
  const t1 = item.description ? truncateToWidth(item.description.replace(/\s+/g, " "), descriptionWidth) : "";

  const truncatedDescription = t1;
  const t2 = <Text color={textColor_0} dimColor={shouldDim}>{paddedDisplayText}</Text>;

  const t3 = tagText ? <Text dimColor={true}>{tagText}</Text> : null;

  const t4 = isSelected ? "suggestion" : undefined;
  const t5 = !isSelected;
  const t6 = <Text color={t4} dimColor={t5}>{truncatedDescription}</Text>;

  const t7 = <Text wrap="truncate">{t2}{t3}{t6}</Text>;

  return t7;
});
type Props = {
  suggestions: SuggestionItem[];
  selectedSuggestion: number;
  maxColumnWidth?: number;
  /**
   * When true, the suggestions are rendered inside a position=absolute
   * overlay. We omit minHeight and flex-end so the y-clamp in the
   * renderer doesn't push fewer items down into the prompt area.
   */
  overlay?: boolean;
};
export function PromptInputFooterSuggestions({
    suggestions,
    selectedSuggestion,
    maxColumnWidth: maxColumnWidthProp,
    overlay
}: Props) {
  const {
    rows
  } = useTerminalSize();
  const maxVisibleItems = overlay ? OVERLAY_MAX_ITEMS : Math.min(6, Math.max(1, rows - 3));
  if (suggestions.length === 0) {
    return null;
  }
  const t1 = maxColumnWidthProp ?? Math.max(...suggestions.map(_temp)) + 5;

  const maxColumnWidth = t1;
  const startIndex = Math.max(0, Math.min(selectedSuggestion - Math.floor(maxVisibleItems / 2), suggestions.length - maxVisibleItems));
  const endIndex = Math.min(startIndex + maxVisibleItems, suggestions.length);
  const visibleItems = suggestions.slice(startIndex, endIndex);
  const T0 = Box;
  const t2 = "column";
  const t3 = overlay ? undefined : "flex-end";
  const t5 = item_0 => <SuggestionItemRow key={item_0.id} item={item_0} maxColumnWidth={maxColumnWidth} isSelected={item_0.id === suggestions[selectedSuggestion]?.id} />;

  const t4 = visibleItems.map(t5);

  const t5_2 = <T0 flexDirection={t2} justifyContent={t3}>{t4}</T0>;

  return t5_2;
}
function _temp(item) {
  return stringWidth(item.displayText);
}
export default memo(PromptInputFooterSuggestions);
