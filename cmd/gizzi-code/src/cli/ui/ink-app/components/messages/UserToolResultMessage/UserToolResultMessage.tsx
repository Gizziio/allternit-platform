import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import type { Tools } from '../../../Tool';
import type { NormalizedUserMessage, ProgressMessage } from '../../../types/message';
import { type buildMessageLookups, CANCEL_MESSAGE, INTERRUPT_MESSAGE_FOR_TOOL_USE, REJECT_MESSAGE } from '../../../utils/messages';
import { UserToolCanceledMessage } from './UserToolCanceledMessage';
import { UserToolErrorMessage } from './UserToolErrorMessage';
import { UserToolRejectMessage } from './UserToolRejectMessage';
import { UserToolSuccessMessage } from './UserToolSuccessMessage';
import { useGetToolFromMessages } from './utils';
type Props = {
  param: ToolResultBlockParam;
  message: NormalizedUserMessage;
  lookups: ReturnType<typeof buildMessageLookups>;
  progressMessagesForMessage: ProgressMessage[];
  style?: 'condensed';
  tools: Tools;
  verbose: boolean;
  width: number | string;
  isTranscriptMode?: boolean;
};
export function UserToolResultMessage({
    param,
    message,
    lookups,
    progressMessagesForMessage,
    style,
    tools,
    verbose,
    width,
    isTranscriptMode
}: Props) {
  const toolUse = useGetToolFromMessages(param.tool_use_id, tools, lookups);
  if (!toolUse) {
    return null;
  }
  if (typeof param.content === "string" && param.content.startsWith(CANCEL_MESSAGE)) {
    const t1 = <UserToolCanceledMessage />;

    return t1;
  }
  if (typeof param.content === "string" && param.content.startsWith(REJECT_MESSAGE) || param.content === INTERRUPT_MESSAGE_FOR_TOOL_USE) {
    const t1 = toolUse.toolUse.input as {
      [key: string]: unknown;
    };
    const t2 = <UserToolRejectMessage input={t1} progressMessagesForMessage={progressMessagesForMessage} tool={toolUse.tool} tools={tools} lookups={lookups} style={style} verbose={verbose} isTranscriptMode={isTranscriptMode} />;

    return t2;
  }
  if (param.is_error) {
    const t1 = <UserToolErrorMessage progressMessagesForMessage={progressMessagesForMessage} tool={toolUse.tool} tools={tools} param={param} verbose={verbose} isTranscriptMode={isTranscriptMode} />;

    return t1;
  }
  const t1 = <UserToolSuccessMessage message={message} lookups={lookups} toolUseID={toolUse.toolUse.id} progressMessagesForMessage={progressMessagesForMessage} style={style} tool={toolUse.tool} tools={tools} verbose={verbose} width={width} isTranscriptMode={isTranscriptMode} />;

  return t1;
}
