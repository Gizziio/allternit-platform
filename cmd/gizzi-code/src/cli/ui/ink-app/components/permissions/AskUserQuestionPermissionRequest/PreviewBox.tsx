import React, { Suspense, use, useMemo } from 'react';
import { useSettings } from '../../../hooks/useSettings';
import { useTerminalSize } from '../../../hooks/useTerminalSize';
import { stringWidth } from '../../../ink/stringWidth';
import { Ansi, Box, Text, useTheme } from '../../../ink';
import { type CliHighlight, getCliHighlightPromise } from '../../../utils/cliHighlight';
import { applyMarkdown } from '../../../utils/markdown';
import sliceAnsi from '../../../utils/sliceAnsi';
type PreviewBoxProps = {
  /** The preview content to display. Markdown is rendered with syntax highlighting
   * for code blocks (```ts, ```py, etc.). Also supports plain multi-line text. */
  content: string;
  /** Maximum number of lines to display before truncating. @default 20 */
  maxLines?: number;
  /** Minimum height (in lines) for the preview box. Content will be padded if shorter. */
  minHeight?: number;
  /** Minimum width for the preview box. @default 40 */
  minWidth?: number;
  /** Maximum width available for this box (e.g., the container width). */
  maxWidth?: number;
};
const BOX_CHARS = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  teeLeft: '├',
  teeRight: '┤'
};

/**
 * A bordered monospace box for displaying preview content.
 * Truncates content that exceeds maxLines with an indicator.
 * The parent component should pass maxLines based on its available height budget.
 */
export function PreviewBox(props) {
  const settings = useSettings();
  if (settings.syntaxHighlightingDisabled) {
    const t0 = <PreviewBoxBody {...props} highlight={null} />;

    return t0;
  }
  const t0 = <Suspense fallback={<PreviewBoxBody {...props} highlight={null} />}><PreviewBoxWithHighlight {...props} /></Suspense>;

  return t0;
}
function PreviewBoxWithHighlight(props) {
  const t0 = getCliHighlightPromise();

  const highlight = use(t0);
  const t1 = <PreviewBoxBody {...props} highlight={highlight} />;

  return t1;
}
function PreviewBoxBody(t0) {
  const {
    content,
    maxLines,
    minHeight,
    minWidth: t1,
    maxWidth,
    highlight
  } = t0;
  const minWidth = t1 === undefined ? 40 : t1;
  const {
    columns: terminalWidth
  } = useTerminalSize();
  const [theme] = useTheme();
  const effectiveMaxWidth = maxWidth ?? terminalWidth - 4;
  const effectiveMaxLines = maxLines ?? 20;
  const t2 = applyMarkdown(content, theme, highlight);

  const rendered = t2;
  const contentLines = rendered.split("\n");
  const isTruncated = contentLines.length > effectiveMaxLines;
  const truncatedLines = isTruncated ? contentLines.slice(0, effectiveMaxLines) : contentLines;
  const effectiveMinHeight = Math.min(minHeight ?? 0, effectiveMaxLines);
  const paddingNeeded = Math.max(0, effectiveMinHeight - truncatedLines.length - (isTruncated ? 1 : 0));
  const lines = paddingNeeded > 0 ? [...truncatedLines, ...Array(paddingNeeded).fill("")] : truncatedLines;
  const contentWidth = Math.max(minWidth, ...lines.map(_temp));
  const boxWidth = Math.min(contentWidth + 4, effectiveMaxWidth);
  const innerWidth = boxWidth - 4;
  const topFill = BOX_CHARS.horizontal.repeat(boxWidth - 2);

  const topBorder = `${BOX_CHARS.topLeft}${topFill}${BOX_CHARS.topRight}`;
  const bottomFill = BOX_CHARS.horizontal.repeat(boxWidth - 2);

  const bottomBorder = `${BOX_CHARS.bottomLeft}${bottomFill}${BOX_CHARS.bottomRight}`;
  const truncationBar = isTruncated ? (() => {
    const hiddenCount = contentLines.length - effectiveMaxLines;
    const label = `${BOX_CHARS.horizontal.repeat(3)} ✂ ${BOX_CHARS.horizontal.repeat(3)} ${hiddenCount} lines hidden `;
    const labelWidth = stringWidth(label);
    const fillWidth = Math.max(0, boxWidth - 2 - labelWidth);
    return `${BOX_CHARS.teeLeft}${label}${BOX_CHARS.horizontal.repeat(fillWidth)}${BOX_CHARS.teeRight}`;
  })() : null;
  const T0 = Box;
  const t3 = "column";
  const t4 = <Text dimColor={true}>{topBorder}</Text>;
  const t5 = lines.map((line_0, index) => {
    const lineWidth = stringWidth(line_0);
    const displayLine = lineWidth > innerWidth ? sliceAnsi(line_0, 0, innerWidth) : line_0;
    const padding = " ".repeat(Math.max(0, innerWidth - stringWidth(displayLine)));
    return <Box key={index} flexDirection="row"><Text dimColor={true}>{BOX_CHARS.vertical} </Text><Ansi>{displayLine}</Ansi><Text dimColor={true}>{padding} {BOX_CHARS.vertical}</Text></Box>;
  });
  const t6 = truncationBar && <Text color="warning">{truncationBar}</Text>;

  const t7 = <Text dimColor={true}>{bottomBorder}</Text>;

  const t8 = <T0 flexDirection={t3}>{t4}{t5}{t6}{t7}</T0>;

  return t8;
}
function _temp(line) {
  return stringWidth(line);
}
