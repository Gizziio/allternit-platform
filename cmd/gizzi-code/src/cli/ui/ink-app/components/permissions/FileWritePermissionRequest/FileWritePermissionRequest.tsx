import { basename, relative } from 'path';
import React, { useMemo } from 'react';
import type { z } from 'zod/v4';
import { Text } from '../../../ink';
import { FileWriteTool } from '../../../tools/FileWriteTool/FileWriteTool';
import { getCwd } from '../../../utils/cwd';
import { isENOENT } from '../../../utils/errors';
import { readFileSync } from '../../../utils/fileRead';
import { FilePermissionDialog } from '../FilePermissionDialog/FilePermissionDialog';
import { createSingleEditDiffConfig, type FileEdit, type IDEDiffSupport } from '../FilePermissionDialog/ideDiffConfig';
import type { PermissionRequestProps } from '../PermissionRequest';
import { FileWriteToolDiff } from './FileWriteToolDiff';
type FileWriteToolInput = z.infer<typeof FileWriteTool.inputSchema>;
const ideDiffSupport: IDEDiffSupport<FileWriteToolInput> = {
  getConfig: (input: FileWriteToolInput) => {
    let oldContent: string;
    try {
      oldContent = readFileSync(input.file_path);
    } catch (e) {
      if (!isENOENT(e)) throw e;
      oldContent = '';
    }
    return createSingleEditDiffConfig(input.file_path, oldContent, input.content, false // For file writes, we replace the entire content
    );
  },
  applyChanges: (input: FileWriteToolInput, modifiedEdits: FileEdit[]) => {
    const firstEdit = modifiedEdits[0];
    if (firstEdit) {
      return {
        ...input,
        content: firstEdit.new_string
      };
    }
    return input;
  }
};
export function FileWritePermissionRequest(props) {
  const parseInput = _temp;
  const t0 = parseInput(props.toolUseConfirm.input);

  const parsed = t0;
  const {
    file_path,
    content
  } = parsed;
  let t1: {
    fileExists: boolean;
    oldContent: string;
  };
  try {
    t1 = {
      fileExists: true,
      oldContent: readFileSync(file_path)
    };
  } catch (t2) {
    const e = t2;
    if (!isENOENT(e)) {
      throw e;
    }
    t1 = {
      fileExists: false,
      oldContent: ""
    };
  }
  const {
    fileExists,
    oldContent
  } = t1;
  const actionText = fileExists ? "overwrite" : "create";
  const t2 = props.toolUseConfirm;
  const t3 = props.toolUseContext;
  const t4 = props.onDone;
  const t5 = props.onReject;
  const t6 = props.workerBadge;
  const t7 = fileExists ? "Overwrite file" : "Create file";
  const t8 = relative(getCwd(), file_path);

  const t9 = basename(file_path);

  const t10 = <Text bold={true}>{t9}</Text>;

  const t11 = <Text>Do you want to {actionText} {t10}?</Text>;

  const t12 = <FileWriteToolDiff file_path={file_path} content={content} fileExists={fileExists} oldContent={oldContent} />;

  const t13 = <FilePermissionDialog toolUseConfirm={t2} toolUseContext={t3} onDone={t4} onReject={t5} workerBadge={t6} title={t7} subtitle={t8} question={t11} content={t12} path={file_path} completionType="write_file_single" parseInput={parseInput} ideDiffSupport={ideDiffSupport} />;

  return t13;
}
function _temp(input) {
  return FileWriteTool.inputSchema.parse(input);
}
