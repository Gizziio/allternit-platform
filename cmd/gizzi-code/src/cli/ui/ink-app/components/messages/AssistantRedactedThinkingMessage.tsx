import React from 'react';
import { Box, Text } from '../../ink';
type Props = {
  addMargin: boolean;
};
export function AssistantRedactedThinkingMessage({
    addMargin: t1
}: Props) {
  const addMargin = t1 === undefined ? false : t1;
  const t2 = addMargin ? 1 : 0;
  const t3 = <Text dimColor={true} italic={true}>✻ Thinking…</Text>;

  const t4 = <Box marginTop={t2}>{t3}</Box>;

  return t4;
}
