import { basename, relative } from 'path';
import React, { Suspense, use, useMemo } from 'react';
import { FileEditToolDiff } from './../../FileEditToolDiff.tsx';
import { getCwd } from './../../../utils/cwd.ts';
import { isENOENT } from './../../../utils/errors.ts';
import { detectEncodingForResolvedPath } from './../../../utils/fileRead.ts';
import { getFsImplementation } from './../../../utils/fsOperations.ts';
import { Text } from '../../../ink';
import { BashTool } from '../../../tools/BashTool/BashTool';
import { applySedSubstitution, type SedEditInfo } from '../../../tools/BashTool/sedEditParser';
import { FilePermissionDialog } from '../FilePermissionDialog/FilePermissionDialog';
import type { PermissionRequestProps } from '../PermissionRequest';
type SedEditPermissionRequestProps = PermissionRequestProps & {
  sedInfo: SedEditInfo;
};
type FileReadResult = {
  oldContent: string;
  fileExists: boolean;
};
type SedEditPermissionRequestInnerProps = PermissionRequestProps & {
  sedInfo: SedEditInfo;
  contentPromise: Promise<FileReadResult>;
};
export function SedEditPermissionRequest(t0: SedEditPermissionRequestProps) {
  let sedInfo;
  let props;
  ({
      sedInfo,
      ...props
    } = t0);

  const {
    filePath
  } = sedInfo;
  const t1: Promise<FileReadResult> = (async () => {
      const encoding = detectEncodingForResolvedPath(filePath);
      const raw = await getFsImplementation().readFile(filePath, {
        encoding
      });
      return {
        oldContent: raw.replaceAll("\r\n", "\n"),
        fileExists: true
      };
    })().catch(_temp);

  const contentPromise = t1;
  const t2 = <Suspense fallback={null}><SedEditPermissionRequestInner sedInfo={sedInfo} contentPromise={contentPromise} {...props} /></Suspense>;

  return t2;
}
function _temp(e: unknown): FileReadResult {
  if (!isENOENT(e)) {
    throw e;
  }
  return {
    oldContent: "",
    fileExists: false
  };
}
function SedEditPermissionRequestInner(t0: SedEditPermissionRequestInnerProps) {
  let sedInfo: SedEditInfo;
  let contentPromise: Promise<FileReadResult>;
  let props: PermissionRequestProps;
  ({
      sedInfo,
      contentPromise,
      ...props
    } = t0);

  const {
    filePath
  } = sedInfo;
  const {
    oldContent,
    fileExists
  } = use(contentPromise);
  const t1 = applySedSubstitution(oldContent, sedInfo);

  const newContent = t1;
  let t2;
  bb0: {
    if (oldContent === newContent) {
      const t3 = [];

      t2 = t3;
      break bb0;
    }
    const t3 = [{
        old_string: oldContent,
        new_string: newContent,
        replace_all: false
      }];

    t2 = t3;
  }
  const edits = t2;
  let t3;
  bb1: {
    if (!fileExists) {
      t3 = "File does not exist";
      break bb1;
    }
    t3 = "Pattern did not match any content";
  }
  const noChangesMessage = t3;
  const t4 = input => {
      const parsed = BashTool.inputSchema.parse(input);
      return {
        ...parsed,
        _simulatedSedEdit: {
          filePath,
          newContent
        }
      };
    };

  const parseInput = t4;
  const t5 = props.toolUseConfirm;
  const t6 = props.toolUseContext;
  const t7 = props.onDone;
  const t8 = props.onReject;
  const t9 = relative(getCwd(), filePath);

  const t10 = basename(filePath);

  const t11 = <Text>Do you want to make this edit to{" "}<Text bold={true}>{t10}</Text>?</Text>;

  const t12 = edits.length > 0 ? <FileEditToolDiff file_path={filePath} edits={edits} /> : <Text dimColor={true}>{noChangesMessage}</Text>;

  const t13 = <FilePermissionDialog toolUseConfirm={t5} toolUseContext={t6} onDone={t7} onReject={t8} title="Edit file" subtitle={t9} question={t11} content={t12} path={filePath} completionType="str_replace_single" parseInput={parseInput} workerBadge={props.workerBadge} />;

  return t13;
}
