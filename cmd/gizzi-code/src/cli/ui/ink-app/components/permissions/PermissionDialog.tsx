import * as React from 'react';
import { Box } from '../../ink';
import type { Theme } from '../../utils/theme';
import { PermissionRequestTitle } from './PermissionRequestTitle';
import type { WorkerBadgeProps } from './WorkerBadge';
type Props = {
  title: string;
  subtitle?: React.ReactNode;
  color?: keyof Theme;
  titleColor?: keyof Theme;
  innerPaddingX?: number;
  workerBadge?: WorkerBadgeProps;
  titleRight?: React.ReactNode;
  children: React.ReactNode;
};
export function PermissionDialog({
    title,
    subtitle,
    color: t1,
    titleColor,
    innerPaddingX: t2,
    workerBadge,
    titleRight,
    children
}: Props) {
  const color = t1 === undefined ? "permission" : t1;
  const innerPaddingX = t2 === undefined ? 1 : t2;
  const t3 = <PermissionRequestTitle title={title} subtitle={subtitle} color={titleColor} workerBadge={workerBadge} />;

  const t4 = <Box paddingX={1} flexDirection="column"><Box justifyContent="space-between">{t3}{titleRight}</Box></Box>;

  const t5 = <Box flexDirection="column" paddingX={innerPaddingX}>{children}</Box>;

  const t6 = <Box flexDirection="column" borderStyle="round" borderColor={color} borderLeft={false} borderRight={false} borderBottom={false} marginTop={1}>{t4}{t5}</Box>;

  return t6;
}
