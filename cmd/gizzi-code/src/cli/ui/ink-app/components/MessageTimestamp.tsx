import React from 'react';
import { stringWidth } from '../ink/stringWidth';
import { Box, Text } from '../ink';
import type { ContentBlock, MessageContent, NormalizedMessage } from '../types/message';
import { getGlobalConfig } from '../utils/config';
type Props = {
  message: NormalizedMessage;
  isTranscriptMode: boolean;
};
export function MessageTimestamp({
    message,
    isTranscriptMode
}: Props) {
  const shouldShowTimestamp = (isTranscriptMode || getGlobalConfig().showMessageTimestamps) && message.timestamp && message.type === "assistant" && (message.message.content as Array<MessageContent | ContentBlock>).some(_temp);
  if (!shouldShowTimestamp) {
    return null;
  }
  const formattedTimestamp = new Date(message.timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  const T0 = Box;
  const t1 = stringWidth(formattedTimestamp);

  const t2 = <Text dimColor={true}>{formattedTimestamp}</Text>;

  const t3 = <T0 minWidth={t1}>{t2}</T0>;

  return t3;
}
function _temp(c) {
  return c.type === "text";
}
