import type { TextBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import { Box, Text } from '../../ink';
import { extractTag } from '../../utils/extractTag.js';
type Props = {
  addMargin: boolean;
  param: TextBlockParam;
};
export function UserBashInputMessage({
    param: t1,
    addMargin
}: Props) {
  const {
    text
  } = t1;
  const t2 = extractTag(text, "bash-input");

  const input = t2;
  if (!input) {
    return null;
  }
  const t3 = addMargin ? 1 : 0;
  const t4 = <Text color="bashBorder">! </Text>;

  const t5 = <Text color="text">{input}</Text>;

  const t6 = <Box flexDirection="row" marginTop={t3} backgroundColor="bashMessageBackgroundColor" paddingRight={1}>{t4}{t5}</Box>;

  return t6;
}
