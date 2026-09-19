import type { StructuredPatchHunk } from 'diff';
import { resolve } from 'path';
import React, { useMemo } from 'react';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import { Box, Text } from '../../ink';
import { getCwd } from '../../utils/cwd';
import { readFileSafe } from '../../utils/file';
import { Divider } from '../design-system/Divider';
import { StructuredDiff } from '../StructuredDiff';

// TODO(types) StructuredDiff is an unconverted compiler artifact (nocheck
// stub boundary) — cast to its declared Props shape until it is decompiled.
const StructuredDiffComponent = StructuredDiff as unknown as React.ComponentType<{
  patch: StructuredPatchHunk;
  dim: boolean;
  filePath: string;
  firstLine: string | null;
  fileContent?: string;
  width: number;
}>;
type Props = {
  filePath: string;
  hunks: StructuredPatchHunk[];
  isLargeFile?: boolean;
  isBinary?: boolean;
  isTruncated?: boolean;
  isUntracked?: boolean;
};

/**
 * Displays the diff content for a single file.
 * Uses StructuredDiff for word-level diffing and syntax highlighting.
 * No scrolling - renders all lines (max 400 due to parsing limits).
 */
export function DiffDetailView({
    filePath,
    hunks,
    isLargeFile,
    isBinary,
    isTruncated,
    isUntracked
}: Props) {
  const {
    columns
  } = useTerminalSize();
  let t1;
  bb0: {
    if (!filePath) {
      const t2 = {
          firstLine: null,
          fileContent: undefined
        };

      t1 = t2;
      break bb0;
    }
    const fullPath = resolve(getCwd(), filePath);
    const content = readFileSafe(fullPath);
    const t2 = content?.split("\n")[0] ?? null;

    const t3 = content ?? undefined;
    const t4 = {
        firstLine: t2,
        fileContent: t3
      };

    t1 = t4;
  }
  const {
    firstLine,
    fileContent
  } = t1;
  if (isUntracked) {
    const t2 = <Text bold={true}>{filePath}</Text>;

    const t3 = <Text dimColor={true}> (untracked)</Text>;

    const t4 = <Box>{t2}{t3}</Box>;

    const t5 = <Divider padding={4} />;

    const t6 = <Text dimColor={true} italic={true}>New file not yet staged.</Text>;

    const t7 = <Box flexDirection="column">{t6}<Text dimColor={true} italic={true}>Run `git add {filePath}` to see line counts.</Text></Box>;

    const t8 = <Box flexDirection="column" width="100%">{t4}{t5}{t7}</Box>;

    return t8;
  }
  if (isBinary) {
    const t2 = <Box><Text bold={true}>{filePath}</Text></Box>;

    const t3 = <Divider padding={4} />;

    const t4 = <Box flexDirection="column"><Text dimColor={true} italic={true}>Binary file - cannot display diff</Text></Box>;

    const t5 = <Box flexDirection="column" width="100%">{t2}{t3}{t4}</Box>;

    return t5;
  }
  if (isLargeFile) {
    const t2 = <Box><Text bold={true}>{filePath}</Text></Box>;

    const t3 = <Divider padding={4} />;

    const t4 = <Box flexDirection="column"><Text dimColor={true} italic={true}>Large file - diff exceeds 1 MB limit</Text></Box>;

    const t5 = <Box flexDirection="column" width="100%">{t2}{t3}{t4}</Box>;

    return t5;
  }
  const t2 = <Text bold={true}>{filePath}</Text>;

  const t3 = isTruncated && <Text dimColor={true}> (truncated)</Text>;

  const t4 = <Box>{t2}{t3}</Box>;

  const t5 = <Divider padding={4} />;

  const t6 = hunks.length === 0 ? <Text dimColor={true}>No diff content</Text> : hunks.map((hunk, index) => <StructuredDiffComponent key={index} patch={hunk} filePath={filePath} firstLine={firstLine} fileContent={fileContent} dim={false} width={columns - 2 - 2} />);

  const t7 = <Box flexDirection="column">{t6}</Box>;

  const t8 = isTruncated && <Text dimColor={true} italic={true}>… diff truncated (exceeded 400 line limit)</Text>;

  const t9 = <Box flexDirection="column" width="100%">{t4}{t5}{t7}{t8}</Box>;

  return t9;
}
