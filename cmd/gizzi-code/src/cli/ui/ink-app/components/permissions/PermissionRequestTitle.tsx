import * as React from 'react';
import { Box, Text } from '../../ink';
import type { Theme } from '../../utils/theme';
import type { WorkerBadgeProps } from './WorkerBadge';
type Props = {
  title: string;
  subtitle?: React.ReactNode;
  color?: keyof Theme;
  workerBadge?: WorkerBadgeProps;
};
export function PermissionRequestTitle({
    title,
    subtitle,
    color: t1,
    workerBadge
}: Props) {
  const color = t1 === undefined ? "permission" : t1;
  const t2 = <Text bold={true} color={color}>{title}</Text>;

  const t3 = workerBadge && <Text dimColor={true}>{"\xB7 "}@{workerBadge.name}</Text>;

  const t4 = <Box flexDirection="row" gap={1}>{t2}{t3}</Box>;

  const t5 = subtitle != null && (typeof subtitle === "string" ? <Text dimColor={true} wrap="truncate-start">{subtitle}</Text> : subtitle);

  const t6 = <Box flexDirection="column">{t4}{t5}</Box>;

  return t6;
}
