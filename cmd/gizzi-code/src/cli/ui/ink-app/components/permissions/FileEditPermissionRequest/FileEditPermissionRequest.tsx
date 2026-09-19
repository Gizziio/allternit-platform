import { basename, relative } from 'path';
import React from 'react';
import { FileEditToolDiff } from './../../FileEditToolDiff.tsx';
import { getCwd } from './../../../utils/cwd.ts';
import type { z } from 'zod/v4';
import { Text } from '../../../ink';
import { FileEditTool } from '../../../tools/FileEditTool/FileEditTool';
import { FilePermissionDialog } from '../FilePermissionDialog/FilePermissionDialog';
import { createSingleEditDiffConfig, type FileEdit, type IDEDiffSupport } from '../FilePermissionDialog/ideDiffConfig';
import type { PermissionRequestProps } from '../PermissionRequest';
type FileEditInput = z.infer<typeof FileEditTool.inputSchema>;
const ideDiffSupport: IDEDiffSupport<FileEditInput> = {
  getConfig: (input: FileEditInput) => createSingleEditDiffConfig(input.file_path, input.old_string, input.new_string, input.replace_all),
  applyChanges: (input: FileEditInput, modifiedEdits: FileEdit[]) => {
    const firstEdit = modifiedEdits[0];
    if (firstEdit) {
      return {
        ...input,
        old_string: firstEdit.old_string,
        new_string: firstEdit.new_string,
        replace_all: firstEdit.replace_all
      };
    }
    return input;
  }
};
export function FileEditPermissionRequest(props) {
  const parseInput = _temp;
  let file_path;
  let old_string;
  let new_string;
  let replace_all;
  const parsed = parseInput(props.toolUseConfirm.input);
  ({
      file_path,
      old_string,
      new_string,
      replace_all
    } = parsed);
  const T2 = FilePermissionDialog;
  const t4 = props.toolUseConfirm;
  const t5 = props.toolUseContext;
  const t6 = props.onDone;
  const t7 = props.onReject;
  const t8 = props.workerBadge;
  const t9 = "Edit file";
  const t10 = relative(getCwd(), file_path);
  const T1 = Text;
  const t2 = "Do you want to make this edit to";
  const t3 = " ";
  const T0 = Text;
  const t0 = true;
  const t1 = basename(file_path);

  const t11 = <T0 bold={t0}>{t1}</T0>;

  const t12 = <T1>{t2}{t3}{t11}?</T1>;

  const t13 = replace_all || false;
  const t14 = [{
      old_string,
      new_string,
      replace_all: t13
    }];

  const t15 = <FileEditToolDiff file_path={file_path} edits={t14} />;

  const t16 = <T2 toolUseConfirm={t4} toolUseContext={t5} onDone={t6} onReject={t7} workerBadge={t8} title={t9} subtitle={t10} question={t12} content={t15} path={file_path} completionType="str_replace_single" parseInput={parseInput} ideDiffSupport={ideDiffSupport} />;

  return t16;
}
function _temp(input) {
  return FileEditTool.inputSchema.parse(input);
}
