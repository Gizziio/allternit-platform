import { basename } from 'path';
import React from 'react';
import type { z } from 'zod/v4';
import { Text } from '../../../ink';
import { NotebookEditTool } from '../../../tools/NotebookEditTool/NotebookEditTool';
import { logError } from '../../../utils/log';
import { FilePermissionDialog } from '../FilePermissionDialog/FilePermissionDialog';
import type { PermissionRequestProps } from '../PermissionRequest';
import { NotebookEditToolDiff } from './NotebookEditToolDiff';
type NotebookEditInput = z.infer<typeof NotebookEditTool.inputSchema>;
export function NotebookEditPermissionRequest(props) {
  const parseInput = _temp;
  const parsed = parseInput(props.toolUseConfirm.input);
  const {
      notebook_path: t11,
      edit_mode,
      cell_type
    } = parsed;
  const notebook_path = t11;
  const language = cell_type === "markdown" ? "markdown" : "python";
  const editTypeText = edit_mode === "insert" ? "insert this cell into" : edit_mode === "delete" ? "delete this cell from" : "make this edit to";
  const T2 = FilePermissionDialog;
  const t5 = props.toolUseConfirm;
  const t6 = props.toolUseContext;
  const t7 = props.onDone;
  const t8 = props.onReject;
  const t9 = props.workerBadge;
  const t10 = "Edit notebook";
  const T1 = Text;
  const t2 = "Do you want to ";
  const t3 = editTypeText;
  const t4 = " ";
  const T0 = Text;
  const t0 = true;
  const t1 = basename(notebook_path);

  const t11_2 = <T0 bold={t0}>{t1}</T0>;

  const t12 = <T1>{t2}{t3}{t4}{t11_2}?</T1>;

  const t13 = props.verbose ? 120 : 80;
  const t14 = <NotebookEditToolDiff notebook_path={parsed.notebook_path} cell_id={parsed.cell_id} new_source={parsed.new_source} cell_type={parsed.cell_type} edit_mode={parsed.edit_mode} verbose={props.verbose} width={t13} />;

  const t15 = <T2 toolUseConfirm={t5} toolUseContext={t6} onDone={t7} onReject={t8} workerBadge={t9} title={t10} question={t12} content={t14} path={notebook_path} completionType="tool_use_single" languageName={language} parseInput={parseInput} />;

  return t15;
}
function _temp(input) {
  const result = NotebookEditTool.inputSchema.safeParse(input);
  if (!result.success) {
    logError(new Error(`Failed to parse notebook edit input: ${result.error.message}`));
    return {
      notebook_path: "",
      new_source: "",
      cell_id: ""
    } as NotebookEditInput;
  }
  return result.data;
}
