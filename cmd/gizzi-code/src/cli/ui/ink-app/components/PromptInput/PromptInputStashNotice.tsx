import figures from 'figures';
import * as React from 'react';
import { Box, Text } from './../../ink.ts';
type Props = {
  hasStash: boolean;
};
export function PromptInputStashNotice({
    hasStash
}: Props) {
  if (!hasStash) {
    return null;
  }
  const t1 = <Box paddingLeft={2}><Text dimColor={true}>{figures.pointerSmall} Stashed (auto-restores after submit)</Text></Box>;

  return t1;
}
