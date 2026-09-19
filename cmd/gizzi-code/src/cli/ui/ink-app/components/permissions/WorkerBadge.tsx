import * as React from 'react';
import { BLACK_CIRCLE } from '../../constants/figures';
import { Box, Text } from '../../ink';
import { toInkColor } from '../../utils/ink';
export type WorkerBadgeProps = {
  name: string;
  color: string;
};

/**
 * Renders a colored badge showing the worker's name for permission prompts.
 * Used to indicate which swarm worker is requesting the permission.
 */
export function WorkerBadge({
    name,
    color
}: WorkerBadgeProps) {
  const t1 = toInkColor(color);

  const inkColor = t1;
  const t2 = <Text bold={true}>@{name}</Text>;

  const t3 = <Box flexDirection="row" gap={1}><Text color={inkColor}>{BLACK_CIRCLE} {t2}</Text></Box>;

  return t3;
}
