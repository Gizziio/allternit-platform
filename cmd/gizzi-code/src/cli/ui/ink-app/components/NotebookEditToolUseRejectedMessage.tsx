import { relative } from 'path';
import * as React from 'react';
import { getCwd } from './../utils/cwd.ts';
import { Box, Text } from '../ink';
import { HighlightedCode } from './HighlightedCode';
// HighlightedCode is still a compiler artifact whose untyped memo wrappers
// infer `object` props; cast restores intent until its own conversion lands.
const HighlightedCodeView = HighlightedCode as React.ComponentType<{
  code: string;
  filePath: string;
  dim?: boolean;
}>;
import { MessageResponse } from './MessageResponse';
type Props = {
  notebook_path: string;
  cell_id: string | undefined;
  new_source: string;
  cell_type?: 'code' | 'markdown';
  edit_mode?: 'replace' | 'insert' | 'delete';
  verbose: boolean;
};
export function NotebookEditToolUseRejectedMessage({
    notebook_path,
    cell_id,
    new_source,
    cell_type,
    edit_mode: t1,
    verbose
}: Props) {
  const edit_mode = t1 === undefined ? "replace" : t1;
  const operation = edit_mode === "delete" ? "delete" : `${edit_mode} cell in`;
  const t2 = <Text color="subtle">User rejected {operation} </Text>;

  const t3 = verbose ? notebook_path : relative(getCwd(), notebook_path);

  const t4 = <Text bold={true} color="subtle">{t3}</Text>;

  const t5 = <Text color="subtle"> at cell {cell_id}</Text>;

  const t6 = <Box flexDirection="row">{t2}{t4}{t5}</Box>;

  const t7 = edit_mode !== "delete" && <Box marginTop={1} flexDirection="column"><HighlightedCodeView code={new_source} filePath={cell_type === "markdown" ? "file.md" : "file.py"} dim={true} /></Box>;

  const t8 = <MessageResponse><Box flexDirection="column">{t6}{t7}</Box></MessageResponse>;

  return t8;
}
