import React from 'react';
import { stringWidth } from '../ink/stringWidth';
import { Box, Text } from '../ink';
import type { ContentBlock, MessageContent, NormalizedMessage } from '../types/message';
type Props = {
  message: NormalizedMessage;
  isTranscriptMode: boolean;
};
export function MessageModel({
    message,
    isTranscriptMode
}: Props) {
  const shouldShowModel = isTranscriptMode && message.type === "assistant" && message.message.model && (message.message.content as Array<MessageContent | ContentBlock>).some(_temp);
  if (!shouldShowModel) {
    return null;
  }
  const t1 = stringWidth(message.message.model) + 8;
  const t2 = <Text dimColor={true}>{message.message.model}</Text>;

  const t3 = <Box minWidth={t1}>{t2}</Box>;

  return t3;
}
function _temp(c) {
  return c.type === "text";
}
