import * as React from 'react';
import { Box, Text } from '../../ink';
import { Markdown } from '../Markdown';
type Props = {
  addMargin: boolean;
  planContent: string;
};
export function UserPlanMessage({
    addMargin,
    planContent
}: Props) {
  const t1 = addMargin ? 1 : 0;
  const t2 = <Box marginBottom={1}><Text bold={true} color="planMode">Plan to implement</Text></Box>;

  const t3 = <Markdown>{planContent}</Markdown>;

  const t4 = <Box flexDirection="column" borderStyle="round" borderColor="planMode" marginTop={t1} paddingX={1}>{t2}{t3}</Box>;

  return t4;
}
