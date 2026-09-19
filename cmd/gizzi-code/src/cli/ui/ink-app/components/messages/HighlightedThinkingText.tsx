import figures from 'figures';
import * as React from 'react';
import { useContext } from 'react';
import { useQueuedMessage } from '../../context/QueuedMessageContext';
import { Box, Text } from '../../ink';
import { formatBriefTimestamp } from '../../utils/formatBriefTimestamp';
import { findThinkingTriggerPositions, getRainbowColor, isUltrathinkEnabled } from '../../utils/thinking';
import { MessageActionsSelectedContext } from '../messageActions';
type Props = {
  text: string;
  useBriefLayout?: boolean;
  timestamp?: string;
};
export function HighlightedThinkingText({
    text,
    useBriefLayout,
    timestamp
}: Props) {
  const isQueued = useQueuedMessage()?.isQueued ?? false;
  const isSelected = useContext(MessageActionsSelectedContext);
  const pointerColor = isSelected ? "suggestion" : "subtle";
  if (useBriefLayout) {
    const t1 = timestamp ? formatBriefTimestamp(timestamp) : "";

    const ts = t1;
    const t2 = isQueued ? "subtle" : "briefLabelYou";
    const t3 = <Text color={t2}>You</Text>;

    const t4 = ts ? <Text dimColor={true}> {ts}</Text> : null;

    const t5 = <Box flexDirection="row">{t3}{t4}</Box>;

    const t6 = isQueued ? "subtle" : "text";
    const t7 = <Text color={t6}>{text}</Text>;

    const t8 = <Box flexDirection="column" paddingLeft={2}>{t5}{t7}</Box>;

    return t8;
  }
  const triggers = isUltrathinkEnabled() ? findThinkingTriggerPositions(text) : [];
  if (triggers.length === 0) {
    return (
      <Text>
        <Text color={pointerColor}>{figures.pointer} </Text>
        <Text color="text">{text}</Text>
      </Text>
    );
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const t of triggers) {
    if (t.start > cursor) {
      parts.push(<Text key={`plain-${cursor}`} color="text">{text.slice(cursor, t.start)}</Text>);
    }
    for (let i = t.start; i < t.end; i++) {
      parts.push(<Text key={`rb-${i}`} color={getRainbowColor(i - t.start)}>{text[i]}</Text>);
    }
    cursor = t.end;
  }
  if (cursor < text.length) {
    parts.push(<Text key={`plain-${cursor}`} color="text">{text.slice(cursor)}</Text>);
  }
  const t2 = <Text color={pointerColor}>{figures.pointer} </Text>;

  const t3 = <Text>{t2}{parts}</Text>;

  return t3;
}
