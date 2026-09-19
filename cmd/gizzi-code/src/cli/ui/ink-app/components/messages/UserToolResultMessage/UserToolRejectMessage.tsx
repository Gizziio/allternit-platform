import * as React from 'react';
import { useTerminalSize } from '../../../hooks/useTerminalSize';
import { useTheme } from '../../../ink';
import { filterToolProgressMessages, type Tool, type Tools } from '../../../Tool';
import type { ProgressMessage } from '../../../types/message';
import type { buildMessageLookups } from '../../../utils/messages';
import { FallbackToolUseRejectedMessage } from '../../FallbackToolUseRejectedMessage';
type Props = {
  input: {
    [key: string]: unknown;
  };
  progressMessagesForMessage: ProgressMessage[];
  style?: 'condensed';
  tool?: Tool;
  tools: Tools;
  lookups: ReturnType<typeof buildMessageLookups>;
  verbose: boolean;
  isTranscriptMode?: boolean;
};
export function UserToolRejectMessage({
    input,
    progressMessagesForMessage,
    style,
    tool,
    tools,
    verbose,
    isTranscriptMode
}: Props) {
  const {
    columns
  } = useTerminalSize();
  const [theme] = useTheme();
  if (!tool || !tool.renderToolUseRejectedMessage) {
    const t1 = <FallbackToolUseRejectedMessage />;

    return t1;
  }
  const t1 = tool.inputSchema;
  const parsedInput = t1.safeParse(input);
  if (!parsedInput.success) {
    const t4 = <FallbackToolUseRejectedMessage />;
    return t4;
  }
  const t2 = tool.renderToolUseRejectedMessage(parsedInput.data, {
    columns,
    messages: [],
    tools,
    verbose,
    progressMessagesForMessage: filterToolProgressMessages(progressMessagesForMessage),
    style,
    theme,
    isTranscriptMode
  }) ?? <FallbackToolUseRejectedMessage />;
  return t2;
}
