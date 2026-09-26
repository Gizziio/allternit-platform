import * as React from 'react';
import { Box, Text, useTheme } from '../../ink';
import { getTheme, type Theme } from '../../utils/theme';
import { type AllternitOrbState, ORB_IDLE, orbFrameAt } from './allternitOrbFrames';
import { interpolateColor, parseRGB, toRGBColor } from './utils';

// The glyph is the AllternitOrb (see allternitOrbFrames.ts): three braille
// cells plus a trailing space, so the message after it never shifts.
const GLYPH_WIDTH = 4;
// The strokes are ink (the terminal's text color); the core carries the
// spinner color — Allternit coral by default, a teammate's color when overridden.
const INK: keyof Theme = 'text';
const FRAME_MS = 120; // legacy clock for callers that only pass `frame`
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
  orbState?: AllternitOrbState;
};
export function SpinnerGlyph({
    frame,
    messageColor,
    stalledIntensity = 0,
    reducedMotion = false,
    time,
    orbState = 'thinking'
}: Props) {
  const [themeName] = useTheme();
  const theme = getTheme(themeName);
  const clock = time ?? frame * FRAME_MS;

  if (reducedMotion) {
    const isDim = Math.floor(clock / (REDUCED_MOTION_CYCLE_MS / 2)) % 2 === 1;
    return <Box flexWrap="wrap" height={1} width={GLYPH_WIDTH}>
        <Text color={INK} dimColor={isDim}>{ORB_IDLE.left}</Text>
        <Text color={messageColor} dimColor={isDim}>{ORB_IDLE.core}</Text>
        <Text color={INK} dimColor={isDim}>{ORB_IDLE.right}</Text>
      </Box>;
  }

  const orb = orbFrameAt(orbState, clock);
  // A stalled stream bleeds both the ink and the core toward error red.
  const tint = (key: keyof Theme): keyof Theme | ReturnType<typeof toRGBColor> => {
    if (stalledIntensity <= 0) return key;
    const rgb = theme[key] ? parseRGB(theme[key]) : null;
    if (rgb) return toRGBColor(interpolateColor(rgb, ERROR_RED, stalledIntensity));
    return stalledIntensity > 0.5 ? 'error' : key;
  };
  return <Box flexWrap="wrap" height={1} width={GLYPH_WIDTH}>
      <Text color={tint(INK)}>{orb.left}</Text>
      <Text color={tint(messageColor)}>{orb.core}</Text>
      <Text color={tint(INK)}>{orb.right}</Text>
    </Box>;
}
