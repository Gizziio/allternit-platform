import React from 'react';
import { BLACK_CIRCLE } from '../constants/figures';
import { useBlink } from '../hooks/useBlink';
import { Box, Text } from '../ink';
type Props = {
  isError: boolean;
  isUnresolved: boolean;
  shouldAnimate: boolean;
};
export function ToolUseLoader({
    isError,
    isUnresolved,
    shouldAnimate
}: Props) {
  const [ref, isBlinking] = useBlink(shouldAnimate);
  const color = isUnresolved ? undefined : isError ? "error" : "success";
  const t1 = !shouldAnimate || isBlinking || isError || !isUnresolved ? BLACK_CIRCLE : " ";
  const t2 = <Text color={color} dimColor={isUnresolved}>{t1}</Text>;

  const t3 = <Box ref={ref} minWidth={2}>{t2}</Box>;

  return t3;
}
