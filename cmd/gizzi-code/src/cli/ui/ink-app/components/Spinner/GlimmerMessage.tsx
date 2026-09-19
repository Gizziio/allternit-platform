import * as React from 'react';
import { stringWidth } from '../../ink/stringWidth';
import { Text, useTheme } from '../../ink';
import { getGraphemeSegmenter } from '../../utils/intl';
import { getTheme, type Theme } from '../../utils/theme';
import type { SpinnerMode } from './types';
import { interpolateColor, parseRGB, toRGBColor } from './utils';
type Props = {
  message: string;
  mode: SpinnerMode;
  messageColor: keyof Theme;
  glimmerIndex: number;
  flashOpacity: number;
  shimmerColor: keyof Theme;
  stalledIntensity?: number;
};
const ERROR_RED = {
  r: 171,
  g: 43,
  b: 63
};
export function GlimmerMessage({
    message,
    mode,
    messageColor,
    glimmerIndex,
    flashOpacity,
    shimmerColor,
    stalledIntensity: t1
}: Props) {
  const stalledIntensity = t1 === undefined ? 0 : t1;
  const [themeName] = useTheme();
  let messageWidth;
  let segments;
  let t2;
  t2 = Symbol.for("react.early_return_sentinel");
  bb0: {
    const theme = getTheme(themeName);
    const segs = [];
    for (const {
        segment
      } of getGraphemeSegmenter().segment(message)) {
        segs.push({
          segment,
          width: stringWidth(segment)
        });
      }

    const t3 = stringWidth(message);

    const t4 = {
        segments: segs,
        messageWidth: t3
      };

    ({
      segments,
      messageWidth
    } = t4);
    if (!message) {
      t2 = null;
      break bb0;
    }
    if (stalledIntensity > 0) {
      const baseColorStr = theme[messageColor];
      const baseRGB = baseColorStr ? parseRGB(baseColorStr) : null;
      if (baseRGB) {
        const interpolated = interpolateColor(baseRGB, ERROR_RED, stalledIntensity);
        const color = toRGBColor(interpolated);
        const t5 = <Text color={color}> </Text>;

        t2 = <><Text color={color}>{message}</Text>{t5}</>;
        break bb0;
      }
      const color_0 = stalledIntensity > 0.5 ? "error" : messageColor;
      const t5 = <Text color={color_0}>{message}</Text>;

      const t6 = <Text color={color_0}> </Text>;

      const t7 = <>{t5}{t6}</>;

      t2 = t7;
      break bb0;
    }
    if (mode === "tool-use") {
      const baseColorStr_0 = theme[messageColor];
      const shimmerColorStr = theme[shimmerColor];
      const baseRGB_0 = baseColorStr_0 ? parseRGB(baseColorStr_0) : null;
      const shimmerRGB = shimmerColorStr ? parseRGB(shimmerColorStr) : null;
      if (baseRGB_0 && shimmerRGB) {
        const interpolated_0 = interpolateColor(baseRGB_0, shimmerRGB, flashOpacity);
        const t5 = <Text color={toRGBColor(interpolated_0)}>{message}</Text>;
        const t6 = <Text color={messageColor}> </Text>;

        const t7 = <>{t5}{t6}</>;

        t2 = t7;
        break bb0;
      }
      const color_1 = flashOpacity > 0.5 ? shimmerColor : messageColor;
      const t5 = <Text color={color_1}>{message}</Text>;

      const t6 = <Text color={messageColor}> </Text>;

      const t7 = <>{t5}{t6}</>;

      t2 = t7;
      break bb0;
    }
  }
  

  if (t2 !== Symbol.for("react.early_return_sentinel")) {
    return t2;
  }
  const shimmerStart = glimmerIndex - 1;
  const shimmerEnd = glimmerIndex + 1;
  if (shimmerStart >= messageWidth || shimmerEnd < 0) {
    const t3 = <Text color={messageColor}>{message}</Text>;

    const t4 = <Text color={messageColor}> </Text>;

    const t5 = <>{t3}{t4}</>;

    return t5;
  }
  const clampedStart = Math.max(0, shimmerStart);
  let colPos = 0;
  let before = "";
  let shim = "";
  let after = "";
  for (const {
    segment: segment_0,
    width
  } of segments) {
    if (colPos + width <= clampedStart) {
      before = before + segment_0;
    } else {
      if (colPos > shimmerEnd) {
        after = after + segment_0;
      } else {
        shim = shim + segment_0;
      }
    }
    colPos = colPos + width;
  }
  const t3 = before && <Text color={messageColor}>{before}</Text>;

  const t4 = <Text color={shimmerColor}>{shim}</Text>;

  const t5 = after && <Text color={messageColor}>{after}</Text>;

  const t6 = <Text color={messageColor}> </Text>;

  const t7 = <>{t3}{t4}{t5}{t6}</>;

  return t7;
}
