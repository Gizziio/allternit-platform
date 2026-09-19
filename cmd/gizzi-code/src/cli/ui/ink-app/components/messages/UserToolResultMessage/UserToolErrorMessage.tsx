import { feature } from 'bun:bundle';
import type { ToolResultBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import { BULLET_OPERATOR } from '../../../constants/figures';
import { Text } from '../../../ink';
import { filterToolProgressMessages, type Tool, type Tools } from '../../../Tool';
import type { ProgressMessage } from '../../../types/message';
import { INTERRUPT_MESSAGE_FOR_TOOL_USE, isClassifierDenial, PLAN_REJECTION_PREFIX, REJECT_MESSAGE_WITH_REASON_PREFIX } from '../../../utils/messages';
import { FallbackToolUseErrorMessage } from '../../FallbackToolUseErrorMessage';
import { InterruptedByUser } from '../../InterruptedByUser';
import { MessageResponse } from '../../MessageResponse';
import { RejectedPlanMessage } from './RejectedPlanMessage';
import { RejectedToolUseMessage } from './RejectedToolUseMessage';
type Props = {
  progressMessagesForMessage: ProgressMessage[];
  tool?: Tool; // undefined when resuming an old conversation that uses an old tool
  tools: Tools;
  param: ToolResultBlockParam;
  verbose: boolean;
  isTranscriptMode?: boolean;
};
export function UserToolErrorMessage({
    progressMessagesForMessage,
    tool,
    tools,
    param,
    verbose,
    isTranscriptMode
}: Props) {
  if (typeof param.content === "string" && param.content.includes(INTERRUPT_MESSAGE_FOR_TOOL_USE)) {
    const t1 = <MessageResponse height={1}><InterruptedByUser /></MessageResponse>;

    return t1;
  }
  if (typeof param.content === "string" && param.content.startsWith(PLAN_REJECTION_PREFIX)) {
    const t1 = param.content.substring(PLAN_REJECTION_PREFIX.length);

    const planContent = t1;
    const t2 = <RejectedPlanMessage plan={planContent} />;

    return t2;
  }
  if (typeof param.content === "string" && param.content.startsWith(REJECT_MESSAGE_WITH_REASON_PREFIX)) {
    const t1 = <RejectedToolUseMessage />;

    return t1;
  }
  if (feature("TRANSCRIPT_CLASSIFIER") && typeof param.content === "string" && isClassifierDenial(param.content)) {
    const t1 = <MessageResponse height={1}><Text dimColor={true}>Denied by auto mode classifier {BULLET_OPERATOR} /feedback if incorrect</Text></MessageResponse>;

    return t1;
  }
  const t1 = tool?.renderToolUseErrorMessage?.(param.content, {
      progressMessagesForMessage: filterToolProgressMessages(progressMessagesForMessage),
      tools,
      verbose,
      isTranscriptMode
    }) ?? <FallbackToolUseErrorMessage result={param.content} verbose={verbose} />;

  return t1;
}
