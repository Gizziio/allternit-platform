import type { StructuredPatchHunk } from 'diff';
import * as React from 'react';
import { useMemo } from 'react';
import { useTerminalSize } from '../../../hooks/useTerminalSize';
import { Box, NoSelect, Text } from '../../../ink';
import { intersperse } from '../../../utils/array';
import { getPatchForDisplay } from '../../../utils/diff';
import { HighlightedCode } from '../../HighlightedCode';
import { StructuredDiff } from '../../StructuredDiff';
// StructuredDiff and HighlightedCode are still compiler artifacts whose
// untyped memo wrappers infer `object` props; cast restores intent until
// their own conversion lands.
const StructuredDiffView = StructuredDiff as React.ComponentType<{
  patch: StructuredPatchHunk;
  dim: boolean;
  filePath: string;
  firstLine: string | null;
  fileContent?: string;
  width: number;
}>;
const HighlightedCodeView = HighlightedCode as React.ComponentType<{
  code: string;
  filePath: string;
}>;
type Props = {
  file_path: string;
  content: string;
  fileExists: boolean;
  oldContent: string;
};
export function FileWriteToolDiff({
    file_path,
    content,
    fileExists,
    oldContent
}: Props) {
  const {
    columns
  } = useTerminalSize();
  let t1;
  bb0: {
    if (!fileExists) {
      t1 = null;
      break bb0;
    }
    const t2 = getPatchForDisplay({
        filePath: file_path,
        fileContents: oldContent,
        edits: [{
          old_string: oldContent,
          new_string: content,
          replace_all: false
        }]
      });

    t1 = t2;
  }
  const hunks = t1;
  const t2 = content.split("\n")[0] ?? null;

  const firstLine = t2;
  const t3 = hunks ? intersperse(hunks.map(_ => <StructuredDiffView key={_.newStart} patch={_} dim={false} filePath={file_path} firstLine={firstLine} fileContent={oldContent} width={columns - 2} />), _temp) : <HighlightedCodeView code={content || "(No content)"} filePath={file_path} />;

  const t4 = <Box flexDirection="column"><Box borderColor="subtle" borderStyle="dashed" flexDirection="column" borderLeft={false} borderRight={false} paddingX={1}>{t3}</Box></Box>;

  return t4;
}
function _temp(i) {
  return <NoSelect fromLeftEdge={true} key={`ellipsis-${i}`}><Text dimColor={true}>...</Text></NoSelect>;
}
