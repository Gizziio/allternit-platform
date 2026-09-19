import type { StructuredPatchHunk } from 'diff';
import { relative } from 'path';
import * as React from 'react';
import { Suspense, use, useMemo } from 'react';
import { Box, NoSelect, Text } from '../../../ink';
import { intersperse } from '../../../utils/array';
import { getCwd } from '../../../utils/cwd';
import { getPatchForDisplay } from '../../../utils/diff';
import { getFsImplementation } from '../../../utils/fsOperations';
import { safeParseJSON } from '../../../utils/json';
import { parseCellId } from '../../../utils/notebook';
import { HighlightedCode } from '../../HighlightedCode';
import { StructuredDiff } from '../../StructuredDiff';
// types/notebook is a stub ("not yet implemented"); restore the minimal
// notebook shape this view needs (mirrors src/runtime/tools/builtins/notebook.ts).
type NotebookCellType = string;
type NotebookCell = {
  id?: string;
  cell_type: NotebookCellType;
  source: string[] | string;
};
type NotebookContent = {
  cells: NotebookCell[];
};
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
  notebook_path: string;
  cell_id: string | undefined;
  new_source: string;
  cell_type?: NotebookCellType;
  edit_mode?: string;
  verbose: boolean;
  width: number;
};
type InnerProps = {
  notebook_path: string;
  cell_id: string | undefined;
  new_source: string;
  cell_type?: NotebookCellType;
  edit_mode?: string;
  verbose: boolean;
  width: number;
  promise: Promise<NotebookContent | null>;
};
export function NotebookEditToolDiff(props: Props) {
  const t0 = getFsImplementation().readFile(props.notebook_path, {
      encoding: "utf-8"
    }).then(_temp).catch(_temp2);

  const notebookDataPromise = t0;
  const t1 = <Suspense fallback={null}><NotebookEditToolDiffInner {...props} promise={notebookDataPromise} /></Suspense>;

  return t1;
}
function _temp2() {
  return null;
}
function _temp(content: string) {
  return safeParseJSON(content) as NotebookContent | null;
}
function NotebookEditToolDiffInner(t0: InnerProps) {
  const {
    notebook_path,
    cell_id,
    new_source,
    cell_type,
    edit_mode: t1,
    verbose,
    width,
    promise
  } = t0;
  const edit_mode = t1 === undefined ? "replace" : t1;
  const notebookData = use(promise);
  let t2;
  bb0: {
    if (!notebookData || !cell_id) {
      t2 = "";
      break bb0;
    }
    const cellIndex = parseCellId(cell_id);
    if (cellIndex !== undefined) {
      if (notebookData.cells[cellIndex]) {
        const source = notebookData.cells[cellIndex].source;
        const t3 = Array.isArray(source) ? source.join("") : source;

        t2 = t3;
        break bb0;
      }
      t2 = "";
      break bb0;
    }
    const t3 = cell => cell.id === cell_id;

    const cell_0 = notebookData.cells.find(t3);
    if (!cell_0) {
      t2 = "";
      break bb0;
    }
    t2 = Array.isArray(cell_0.source) ? cell_0.source.join("") : cell_0.source;
  }
  

  const oldSource = t2;
  let t3;
  bb1: {
    if (!notebookData || edit_mode === "insert" || edit_mode === "delete") {
      t3 = null;
      break bb1;
    }
    const t4 = getPatchForDisplay({
        filePath: notebook_path,
        fileContents: oldSource,
        edits: [{
          old_string: oldSource,
          new_string: new_source,
          replace_all: false
        }],
        ignoreWhitespace: false
      });

    t3 = t4;
  }
  const hunks = t3;
  let editTypeDescription;
  bb2: switch (edit_mode) {
    case "insert":
      {
        editTypeDescription = "Insert new cell";
        break bb2;
      }
    case "delete":
      {
        editTypeDescription = "Delete cell";
        break bb2;
      }
    default:
      {
        editTypeDescription = "Replace cell contents";
      }
  }
  const t4 = verbose ? notebook_path : relative(getCwd(), notebook_path);

  const t5 = <Text bold={true}>{t4}</Text>;

  const t6 = cell_type ? ` (${cell_type})` : "";
  const t7 = <Text dimColor={true}>{editTypeDescription} for cell {cell_id}{t6}</Text>;

  const t8 = <Box paddingBottom={1} flexDirection="column">{t5}{t7}</Box>;

  const t9 = edit_mode === "delete" ? <Box flexDirection="column" paddingLeft={2}><HighlightedCodeView code={oldSource} filePath={notebook_path} /></Box> : edit_mode === "insert" ? <Box flexDirection="column" paddingLeft={2}><HighlightedCodeView code={new_source} filePath={cell_type === "markdown" ? "file.md" : notebook_path} /></Box> : hunks ? intersperse(hunks.map(_ => <StructuredDiffView key={_.newStart} patch={_} dim={false} width={width} filePath={notebook_path} firstLine={new_source.split("\n")[0] ?? null} fileContent={oldSource} />), _temp3) : <HighlightedCodeView code={new_source} filePath={cell_type === "markdown" ? "file.md" : notebook_path} />;

  const t10 = <Box flexDirection="column"><Box borderStyle="round" flexDirection="column" paddingX={1}>{t8}{t9}</Box></Box>;

  return t10;
}
function _temp3(i: number) {
  return <NoSelect fromLeftEdge={true} key={`ellipsis-${i}`}><Text dimColor={true}>...</Text></NoSelect>;
}
