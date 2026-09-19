import chalk from '@/shared/util/chalk'
import * as React from 'react';
import { LIGHTNING_BOLT } from '../constants/figures';
import { Text } from '../ink';
import { getGlobalConfig } from '../utils/config';
import { resolveThemeSetting } from '../utils/systemTheme';
import { color } from './design-system/color';
type Props = {
  cooldown?: boolean;
};
export function FastIcon({
    cooldown
}: Props) {
  if (cooldown) {
    const t1 = <Text color="promptBorder" dimColor={true}>{LIGHTNING_BOLT}</Text>;

    return t1;
  }
  const t1 = <Text color="fastMode">{LIGHTNING_BOLT}</Text>;

  return t1;
}
export function getFastIconString(applyColor = true, cooldown = false): string {
  if (!applyColor) {
    return LIGHTNING_BOLT;
  }
  const themeName = resolveThemeSetting(getGlobalConfig().theme);
  if (cooldown) {
    return chalk.dim(color('promptBorder', themeName)(LIGHTNING_BOLT));
  }
  return color('fastMode', themeName)(LIGHTNING_BOLT);
}
