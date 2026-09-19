import type { StructuredPatchHunk } from 'diff';
import { relative } from 'path';
import * as React from 'react';
import { useTerminalSize } from './../hooks/useTerminalSize.ts';
import { getCwd } from './../utils/cwd.ts';
import { Box, Text } from '../ink';
import { HighlightedCode } from './HighlightedCode';
// HighlightedCode is still a compiler artifact whose untyped memo wrappers
// infer `object` props; cast restores intent until its own conversion lands.
const HighlightedCodeView = HighlightedCode as React.ComponentType<{
  code: string;
  filePath: string;
  width?: number;
  dim?: boolean;
}>;
import { MessageResponse } from './MessageResponse';
import { StructuredDiffList } from './StructuredDiffList';
const MAX_LINES_TO_RENDER = 10;
type Props = {
  file_path: string;
  operation: 'write' | 'update';
  // For updates - show diff
  patch?: StructuredPatchHunk[];
  firstLine: string | null;
  fileContent?: string;
  // For new file creation - show content preview
  content?: string;
  style?: 'condensed';
  verbose: boolean;
};
export function FileEditToolUseRejectedMessage({
    file_path,
    operation,
    patch,
    firstLine,
    fileContent,
    content,
    style,
    verbose
}: Props) {
  const {
    columns
  } = useTerminalSize();
  const t1 = <Text color="subtle">User rejected {operation} to </Text>;

  const t2 = verbose ? file_path : relative(getCwd(), file_path);

  const t3 = <Text bold={true} color="subtle">{t2}</Text>;

  const t4 = <Box flexDirection="row">{t1}{t3}</Box>;

  const text = t4;
  if (style === "condensed" && !verbose) {
    const t5 = <MessageResponse>{text}</MessageResponse>;

    return t5;
  }
  if (operation === "write" && content !== undefined) {
    const lines = content.split("\n");
    const numLines = lines.length;
    const plusLines = numLines - MAX_LINES_TO_RENDER;
    const t5 = verbose ? content : lines.slice(0, MAX_LINES_TO_RENDER).join("\n");

    const truncatedContent = t5;
    const t6 = truncatedContent || "(No content)";
    const t7 = columns - 12;
    const t8 = <HighlightedCodeView code={t6} filePath={file_path} width={t7} dim={true} />;

    const t9 = !verbose && plusLines > 0 && <Text dimColor={true}>… +{plusLines} lines</Text>;

    const t10 = <MessageResponse><Box flexDirection="column">{text}{t8}{t9}</Box></MessageResponse>;

    return t10;
  }
  if (!patch || patch.length === 0) {
    const t5 = <MessageResponse>{text}</MessageResponse>;

    return t5;
  }
  const t5 = columns - 12;
  const t6 = <StructuredDiffList hunks={patch} dim={true} width={t5} filePath={file_path} firstLine={firstLine} fileContent={fileContent} />;

  const t7 = <MessageResponse><Box flexDirection="column">{text}{t6}</Box></MessageResponse>;

  return t7;
}
