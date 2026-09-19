import type { ThinkingBlock, ThinkingBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import React from 'react';
import { Box, Text } from '../../ink';
import { CtrlOToExpand } from '../CtrlOToExpand';
import { Markdown } from '../Markdown';
import { ThinkingSpinner } from './ThinkingSpinner';
type Props = {
  // Accept either full ThinkingBlock/ThinkingBlockParam or a minimal shape with just type and thinking
  param: ThinkingBlock | ThinkingBlockParam | {
    type: 'thinking';
    thinking: string;
  };
  addMargin: boolean;
  isTranscriptMode: boolean;
  verbose: boolean;
  /** When true, hide this thinking block entirely (used for past thinking in transcript mode) */
  hideInTranscript?: boolean;
};
export function AssistantThinkingMessage({
    param: t1,
    addMargin: t2,
    isTranscriptMode,
    verbose,
    hideInTranscript: t3
}: Props) {
  const {
    thinking
  } = t1;
  const addMargin = t2 === undefined ? false : t2;
  const hideInTranscript = t3 === undefined ? false : t3;
  if (!thinking) {
    return null;
  }
  if (hideInTranscript) {
    return null;
  }
  const shouldShowFullThinking = isTranscriptMode || verbose;
  if (!shouldShowFullThinking) {
    const t4 = addMargin ? 1 : 0;
    const previewLines = thinking.split('\n').slice(0, 2).join('\n');
    const preview = previewLines.length > 0 ? `${previewLines}\u2026` : '';
    const cacheKey = `${thinking}\0${preview}`;
    const t5 = <Box flexDirection="column" gap={0}>
          <Text dimColor={true} italic={true}><ThinkingSpinner /> Thinking\u2026 <CtrlOToExpand /></Text>
          {preview && <Text dimColor={true} wrap="truncate">{preview}</Text>}
        </Box>;

    const t6 = <Box marginTop={t4}>{t5}</Box>;

    return t6;
  }
  const t4 = addMargin ? 1 : 0;
  const t5 = <Text dimColor={true} italic={true}><ThinkingSpinner /> Thinking\u2026 (ctrl+o to collapse)</Text>;

  const t6 = <Box paddingLeft={2}><Markdown dimColor={true}>{thinking}</Markdown></Box>;

  const t7 = <Box flexDirection="column" gap={1} marginTop={t4} width="100%">{t5}{t6}</Box>;

  return t7;
}
