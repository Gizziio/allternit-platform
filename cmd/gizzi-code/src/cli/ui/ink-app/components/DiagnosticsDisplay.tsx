import { relative } from 'path';
import React from 'react';
import { Box, Text } from '../ink';
import { DiagnosticTrackingService } from '../services/diagnosticTracking';
import type { Attachment } from '../utils/attachments';
import { getCwd } from '../utils/cwd';
import { CtrlOToExpand } from './CtrlOToExpand';
import { MessageResponse } from './MessageResponse';
type DiagnosticsAttachment = Extract<Attachment, {
  type: 'diagnostics';
}>;
type DiagnosticsDisplayProps = {
  attachment: DiagnosticsAttachment;
  verbose: boolean;
};
export function DiagnosticsDisplay({
    attachment,
    verbose
}: DiagnosticsDisplayProps) {
  if (attachment.files.length === 0) {
    return null;
  }
  const t1 = attachment.files.reduce(_temp, 0);

  const totalIssues = t1;
  const fileCount = attachment.files.length;
  if (verbose) {
    const t2 = attachment.files.map(_temp3);

    const t3 = <Box flexDirection="column">{t2}</Box>;

    return t3;
  } else {
    const t2 = <Text bold={true}>{totalIssues}</Text>;

    const t3 = totalIssues === 1 ? "issue" : "issues";
    const t4 = fileCount === 1 ? "file" : "files";
    const t5 = <CtrlOToExpand />;

    const t6 = <MessageResponse><Text dimColor={true} wrap="wrap">Found {t2} new diagnostic{" "}{t3} in {fileCount}{" "}{t4} {t5}</Text></MessageResponse>;

    return t6;
  }
}
function _temp3(file_0, fileIndex) {
  return <React.Fragment key={fileIndex}><MessageResponse><Text dimColor={true} wrap="wrap"><Text bold={true}>{relative(getCwd(), file_0.uri.replace("file://", "").replace("_claude_fs_right:", ""))}</Text>{" "}<Text dimColor={true}>{file_0.uri.startsWith("file://") ? "(file://)" : file_0.uri.startsWith("_claude_fs_right:") ? "(claude_fs_right)" : `(${file_0.uri.split(":")[0]})`}</Text>:</Text></MessageResponse>{file_0.diagnostics.map(_temp2)}</React.Fragment>;
}
function _temp2(diagnostic, diagIndex) {
  return <MessageResponse key={diagIndex}><Text dimColor={true} wrap="wrap">{"  "}{DiagnosticTrackingService.getSeveritySymbol(diagnostic.severity)}{" [Line "}{diagnostic.range.start.line + 1}:{diagnostic.range.start.character + 1}{"] "}{diagnostic.message}{diagnostic.code ? ` [${diagnostic.code}]` : ""}{diagnostic.source ? ` (${diagnostic.source})` : ""}</Text></MessageResponse>;
}
function _temp(sum, file) {
  return sum + file.diagnostics.length;
}
