import * as React from 'react';
import { Markdown } from './../../Markdown.tsx';
import { MessageResponse } from './../../MessageResponse.tsx';
import { Box, Text } from '../../../ink';
type Props = {
  plan: string;
};
export function RejectedPlanMessage({
    plan
}: Props) {
  const t1 = <Text color="subtle">User rejected Gizzi's plan:</Text>;

  const t2 = <MessageResponse><Box flexDirection="column">{t1}<Box borderStyle="round" borderColor="planMode" paddingX={1} overflow="hidden"><Markdown>{plan}</Markdown></Box></Box></MessageResponse>;

  return t2;
}
