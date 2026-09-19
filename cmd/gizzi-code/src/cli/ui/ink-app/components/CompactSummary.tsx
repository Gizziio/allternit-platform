import * as React from 'react';
import { BLACK_CIRCLE } from '../constants/figures';
import { Box, Text } from '../ink';
import type { Screen } from '../screens/REPL';
import type { NormalizedUserMessage } from '../types/message';
import { getUserMessageText } from '../utils/messages';
import { ConfigurableShortcutHint } from './ConfigurableShortcutHint';
import { MessageResponse } from './MessageResponse';
type Props = {
  message: NormalizedUserMessage;
  screen: Screen;
};
export function CompactSummary({
    message,
    screen
}: Props) {
  const isTranscriptMode = screen === "transcript";
  const t1 = getUserMessageText(message) || "";

  const textContent = t1;
  const metadata = message.summarizeMetadata;
  if (metadata) {
    const t2 = <Box minWidth={2}><Text color="text">{BLACK_CIRCLE}</Text></Box>;

    const t3 = <Text bold={true}>Summarized conversation</Text>;

    const t4 = !isTranscriptMode && <MessageResponse><Box flexDirection="column"><Text dimColor={true}>Summarized {metadata.messagesSummarized} messages{" "}{metadata.direction === "up_to" ? "up to this point" : "from this point"}</Text>{metadata.userContext && <Text dimColor={true}>Context: {"\u201C"}{metadata.userContext}{"\u201D"}</Text>}<Text dimColor={true}><ConfigurableShortcutHint action="app:toggleTranscript" context="Global" fallback="ctrl+o" description="expand history" parens={true} /></Text></Box></MessageResponse>;

    const t5 = isTranscriptMode && <MessageResponse><Text>{textContent}</Text></MessageResponse>;

    const t6 = <Box flexDirection="column" marginTop={1}><Box flexDirection="row">{t2}<Box flexDirection="column">{t3}{t4}{t5}</Box></Box></Box>;

    return t6;
  }
  const t2 = <Box minWidth={2}><Text color="text">{BLACK_CIRCLE}</Text></Box>;

  const t3 = !isTranscriptMode && <Text dimColor={true}>{" "}<ConfigurableShortcutHint action="app:toggleTranscript" context="Global" fallback="ctrl+o" description="expand" parens={true} /></Text>;

  const t4 = <Box flexDirection="row">{t2}<Box flexDirection="column"><Text bold={true}>Compact summary{t3}</Text></Box></Box>;

  const t5 = isTranscriptMode && <MessageResponse><Text>{textContent}</Text></MessageResponse>;

  const t6 = <Box flexDirection="column" marginTop={1}>{t4}{t5}</Box>;

  return t6;
}
