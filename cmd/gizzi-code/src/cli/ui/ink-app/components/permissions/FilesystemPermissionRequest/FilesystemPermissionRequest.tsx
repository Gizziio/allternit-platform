import React from 'react';
import { Box, Text, useTheme } from '../../../ink';
import { FallbackPermissionRequest } from '../FallbackPermissionRequest';
import { FilePermissionDialog } from '../FilePermissionDialog/FilePermissionDialog';
import type { ToolInput } from '../FilePermissionDialog/useFilePermissionDialog';
import type { PermissionRequestProps, ToolUseConfirm } from '../PermissionRequest';
function pathFromToolUse(toolUseConfirm: ToolUseConfirm): string | null {
  const tool = toolUseConfirm.tool;
  if ('getPath' in tool && typeof tool.getPath === 'function') {
    try {
      return tool.getPath(toolUseConfirm.input);
    } catch {
      return null;
    }
  }
  return null;
}
export function FilesystemPermissionRequest(t0) {
  const {
    toolUseConfirm,
    onDone,
    onReject,
    verbose,
    toolUseContext,
    workerBadge
  } = t0;
  const [theme] = useTheme();
  const t1 = pathFromToolUse(toolUseConfirm);

  const path = t1;
  const t2 = toolUseConfirm.tool.userFacingName(toolUseConfirm.input as never);

  const userFacingName = t2;
  const isReadOnly = toolUseConfirm.tool.isReadOnly(toolUseConfirm.input);
  const userFacingReadOrEdit = isReadOnly ? "Read" : "Edit";
  const title = `${userFacingReadOrEdit} file`;
  const parseInput = _temp;
  if (!path) {
    const t3 = <FallbackPermissionRequest toolUseConfirm={toolUseConfirm} toolUseContext={toolUseContext} onDone={onDone} onReject={onReject} verbose={verbose} workerBadge={workerBadge} />;

    return t3;
  }
  const t3 = toolUseConfirm.tool.renderToolUseMessage(toolUseConfirm.input as never, {
      theme,
      verbose
    });

  const t4 = <Box flexDirection="column" paddingX={2} paddingY={1}><Text>{userFacingName}({t3})</Text></Box>;

  const content = t4;
  const t5 = isReadOnly ? "read" : "write";
  const t6 = <FilePermissionDialog toolUseConfirm={toolUseConfirm} toolUseContext={toolUseContext} onDone={onDone} onReject={onReject} workerBadge={workerBadge} title={title} content={content} path={path} parseInput={parseInput} operationType={t5} completionType="tool_use_single" />;

  return t6;
}
function _temp(input) {
  return input as ToolInput;
}
