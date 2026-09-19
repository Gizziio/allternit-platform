import * as React from 'react';
import { Text, useTheme } from '../../ink';
import { getTheme, type Theme } from '../../utils/theme';
import { interpolateColor, parseRGB, toRGBColor } from './utils';
type Props = {
  char: string;
  flashOpacity: number;
  messageColor: keyof Theme;
  shimmerColor: keyof Theme;
};
export function FlashingChar({
    char,
    flashOpacity,
    messageColor,
    shimmerColor
}: Props) {
  const [themeName] = useTheme();
  let t1;
  t1 = Symbol.for("react.early_return_sentinel");
  bb0: {
      const theme = getTheme(themeName);
      const baseColorStr = theme[messageColor];
      const shimmerColorStr = theme[shimmerColor];
      const baseRGB = baseColorStr ? parseRGB(baseColorStr) : null;
      const shimmerRGB = shimmerColorStr ? parseRGB(shimmerColorStr) : null;
      if (baseRGB && shimmerRGB) {
        const interpolated = interpolateColor(baseRGB, shimmerRGB, flashOpacity);
        t1 = <Text color={toRGBColor(interpolated)}>{char}</Text>;
        break bb0;
      }
    }

  if (t1 !== Symbol.for("react.early_return_sentinel")) {
    return t1;
  }
  const shouldUseShimmer = flashOpacity > 0.5;
  const t2 = shouldUseShimmer ? shimmerColor : messageColor;
  const t3 = <Text color={t2}>{char}</Text>;

  return t3;
}
