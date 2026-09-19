import figures from 'figures';
import React from 'react';
import { Markdown } from '../../components/Markdown';
import { BLACK_CIRCLE } from '../../constants/figures';
import { Box, Text } from '../../ink';
import type { ProgressMessage } from '../../types/message';
import { getDisplayPath } from '../../utils/file';
import { formatFileSize } from '../../utils/format';
import { formatBriefTimestamp } from '../../utils/formatBriefTimestamp';
import type { Output } from './BriefTool';
export function renderToolUseMessage(): React.ReactNode {
  return '';
}
export function renderToolResultMessage(output: Output, _progressMessages: ProgressMessage[], options?: {
  isTranscriptMode?: boolean;
  isBriefOnly?: boolean;
}): React.ReactNode {
  const hasAttachments = (output.attachments?.length ?? 0) > 0;
  if (!output.message && !hasAttachments) {
    return null;
  }

  // In transcript mode (ctrl+o), model text is NOT filtered — keep the ⏺ so
  // SendUserMessage is visually distinct from the surrounding text blocks.
  if (options?.isTranscriptMode) {
    return <Box flexDirection="row" marginTop={1}>
        <Box minWidth={2}>
          <Text color="text">{BLACK_CIRCLE}</Text>
        </Box>
        <Box flexDirection="column">
          {output.message ? <Markdown>{output.message}</Markdown> : null}
          <AttachmentList attachments={output.attachments} />
        </Box>
      </Box>;
  }

  // Brief-only (chat) view: "Gizzi" label + 2-col indent, matching the "You"
  // label UserPromptMessage applies to user input (#20889). The "N in background"
  // spinner status lives in BriefSpinner (Spinner.tsx) — stateless label here.
  if (options?.isBriefOnly) {
    const ts = output.sentAt ? formatBriefTimestamp(output.sentAt) : '';
    return <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Box flexDirection="row">
          <Text color="briefLabelGizzi">Gizzi</Text>
          {ts ? <Text dimColor> {ts}</Text> : null}
        </Box>
        <Box flexDirection="column">
          {output.message ? <Markdown>{output.message}</Markdown> : null}
          <AttachmentList attachments={output.attachments} />
        </Box>
      </Box>;
  }

  // Default view: dropTextInBriefTurns (Messages.tsx) hides the redundant
  // assistant text that would otherwise precede this — SendUserMessage is the
  // only text-like content in its turn. No gutter mark; read as plain text.
  // userFacingName() returns '' so UserToolSuccessMessage drops its columns-5
  // width constraint and AssistantToolUseMessage renders null (no tool chrome).
  // Empty minWidth={2} box mirrors AssistantTextMessage's ⏺ gutter spacing.
  return <Box flexDirection="row" marginTop={1}>
      <Box minWidth={2} />
      <Box flexDirection="column">
        {output.message ? <Markdown>{output.message}</Markdown> : null}
        <AttachmentList attachments={output.attachments} />
      </Box>
    </Box>;
}
type AttachmentListProps = {
  attachments: Output['attachments'];
};
export function AttachmentList({
    attachments
}: AttachmentListProps) {
  if (!attachments || attachments.length === 0) {
    return null;
  }
  const t1 = attachments.map(_temp);

  const t2 = <Box flexDirection="column" marginTop={1}>{t1}</Box>;

  return t2;
}
function _temp(att) {
  return <Box key={att.path} flexDirection="row"><Text dimColor={true}>{figures.pointerSmall} {att.isImage ? "[image]" : "[file]"}{" "}</Text><Text>{getDisplayPath(att.path)}</Text><Text dimColor={true}> ({formatFileSize(att.size)})</Text></Box>;
}
