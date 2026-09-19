import type { TextBlockParam } from '@allternit/gizzi-sdk/providers/allternit/resources/index.mjs';
import * as React from 'react';
import { BLACK_CIRCLE } from '../../constants/figures';
import { Box, Text, type TextProps } from '../../ink';
import { extractTag } from '../../utils/extractTag.js';
type Props = {
  addMargin: boolean;
  param: TextBlockParam;
};
function getStatusColor(status: string | null): TextProps['color'] {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'killed':
      return 'warning';
    default:
      return 'text';
  }
}
export function UserAgentNotificationMessage({
    addMargin,
    param: t1
}: Props) {
  const {
    text
  } = t1;
  const t2 = extractTag(text, "summary");

  const summary = t2;
  if (!summary) {
    return null;
  }
  const status = extractTag(text, "status");
  const t3 = getStatusColor(status);

  const color = t3;
  const t4 = addMargin ? 1 : 0;
  const t5 = <Text color={color}>{BLACK_CIRCLE}</Text>;

  const t6 = <Text>{t5} {summary}</Text>;

  const t7 = <Box marginTop={t4}>{t6}</Box>;

  return t7;
}
