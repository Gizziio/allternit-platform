import * as React from 'react';
import { Box, Text, useTheme } from '../../ink';
import { getTheme, type Theme } from '../../utils/theme';
import { getDefaultCharacters, interpolateColor, parseRGB, toRGBColor } from './utils';
const DEFAULT_CHARACTERS = getDefaultCharacters();
const SPINNER_FRAMES = [...DEFAULT_CHARACTERS, ...[...DEFAULT_CHARACTERS].reverse()];
const REDUCED_MOTION_DOT = '●';
const REDUCED_MOTION_CYCLE_MS = 2000; // 2-second cycle: 1s visible, 1s dim
const ERROR_RED = {
  r: 171,
  g: 43,
  b: 63
};
type Props = {
  frame: number;
  messageColor: keyof Theme;
  stalledIntensity?: number;
  reducedMotion?: boolean;
  time?: number;
};
export function SpinnerGlyph({
    frame,
    messageColor,
    stalledIntensity: t1,
    reducedMotion: t2,
    time: t3
}: Props) {
  const stalledIntensity = t1 === undefined ? 0 : t1;
  const reducedMotion = t2 === undefined ? false : t2;
  const time = t3 === undefined ? 0 : t3;
  const [themeName] = useTheme();
  const theme = getTheme(themeName);
  if (reducedMotion) {
    const isDim = Math.floor(time / (REDUCED_MOTION_CYCLE_MS / 2)) % 2 === 1;
    const t4 = <Box flexWrap="wrap" height={1} width={2}><Text color={messageColor} dimColor={isDim}>{REDUCED_MOTION_DOT}</Text></Box>;

    return t4;
  }
  const spinnerChar = SPINNER_FRAMES[frame % SPINNER_FRAMES.length];
  if (stalledIntensity > 0) {
    const baseColorStr = theme[messageColor];
    const baseRGB = baseColorStr ? parseRGB(baseColorStr) : null;
    if (baseRGB) {
      const interpolated = interpolateColor(baseRGB, ERROR_RED, stalledIntensity);
      return <Box flexWrap="wrap" height={1} width={2}><Text color={toRGBColor(interpolated)}>{spinnerChar}</Text></Box>;
    }
    const color = stalledIntensity > 0.5 ? "error" : messageColor;
    const t4 = <Box flexWrap="wrap" height={1} width={2}><Text color={color}>{spinnerChar}</Text></Box>;

    return t4;
  }
  const t4 = <Box flexWrap="wrap" height={1} width={2}><Text color={messageColor}>{spinnerChar}</Text></Box>;

  return t4;
}
