import React from 'react';
import { Box, Text } from '../ink';
import { formatTokens } from '../utils/format';
import { Select } from './CustomSelect/index';
import { Dialog } from './design-system/Dialog';
type IdleReturnAction = 'continue' | 'clear' | 'dismiss' | 'never';
type Props = {
  idleMinutes: number;
  totalInputTokens: number;
  onDone: (action: IdleReturnAction) => void;
};
export function IdleReturnDialog({
    idleMinutes,
    totalInputTokens,
    onDone
}: Props) {
  const t1 = formatIdleDuration(idleMinutes);

  const formattedIdle = t1;
  const t2 = formatTokens(totalInputTokens);

  const formattedTokens = t2;
  const t3 = `You've been away ${formattedIdle} and this conversation is ${formattedTokens} tokens.`;
  const t4 = () => onDone("dismiss");

  const t5 = <Box flexDirection="column"><Text>If this is a new task, clearing context will save usage and be faster.</Text></Box>;

  const t6 = {
      value: "continue" as const,
      label: "Continue this conversation"
    };

  const t7 = {
      value: "clear" as const,
      label: "Send message as a new conversation"
    };

  const t8 = [t6, t7, {
      value: "never" as const,
      label: "Don't ask me again"
    }];

  const t9 = <Select options={t8} onChange={value => onDone(value)} />;

  const t10 = <Dialog title={t3} onCancel={t4}>{t5}{t9}</Dialog>;

  return t10;
}
function formatIdleDuration(minutes: number): string {
  if (minutes < 1) {
    return '< 1m';
  }
  if (minutes < 60) {
    return `${Math.floor(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.floor(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}
