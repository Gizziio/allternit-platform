import sample from 'lodash-es/sample';
import * as React from 'react';
import { useMemo } from 'react';
import { Box, Text } from '../../ink';
import { extractTag } from '../../utils/extractTag.js';
import { MessageResponse } from '../MessageResponse';
function getSavingMessage(): string {
  return sample(['Got it.', 'Good to know.', 'Noted.']);
}
type Props = {
  addMargin: boolean;
  text: string;
};
export function UserMemoryInputMessage({
    text,
    addMargin
}: Props) {
  const t1 = extractTag(text, "user-memory-input");

  const input = t1;
  const t2 = getSavingMessage();

  const savingText = t2;
  if (!input) {
    return null;
  }
  const t3 = addMargin ? 1 : 0;
  const t4 = <Text color="remember" backgroundColor="memoryBackgroundColor">#</Text>;

  const t5 = <Box>{t4}<Text backgroundColor="memoryBackgroundColor" color="text">{" "}{input}{" "}</Text></Box>;

  const t6 = <MessageResponse height={1}><Text dimColor={true}>{savingText}</Text></MessageResponse>;

  const t7 = <Box flexDirection="column" marginTop={t3} width="100%">{t5}{t6}</Box>;

  return t7;
}
