import React from 'react';
import { Text } from '../../ink';
import { formatDuration } from '../../utils/format';
type Props = {
  elapsedTimeSeconds?: number;
  timeoutMs?: number;
};
export function ShellTimeDisplay({
    elapsedTimeSeconds,
    timeoutMs
}: Props) {
  if (elapsedTimeSeconds === undefined && !timeoutMs) {
    return null;
  }
  const t1 = timeoutMs ? formatDuration(timeoutMs, {
      hideTrailingZeros: true
    }) : undefined;

  const timeout = t1;
  if (elapsedTimeSeconds === undefined) {
    const t2 = `(timeout ${timeout})`;
    const t3 = <Text dimColor={true}>{t2}</Text>;

    return t3;
  }
  const t2 = elapsedTimeSeconds * 1000;
  const t3 = formatDuration(t2);

  const elapsed = t3;
  if (timeout) {
    const t4 = `(${elapsed} · timeout ${timeout})`;
    const t5 = <Text dimColor={true}>{t4}</Text>;

    return t5;
  }
  const t4 = `(${elapsed})`;
  const t5 = <Text dimColor={true}>{t4}</Text>;

  return t5;
}
