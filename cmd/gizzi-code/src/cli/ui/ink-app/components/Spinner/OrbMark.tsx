import * as React from 'react';
import { Box, Text } from '../../ink';
import type { Theme } from '../../utils/theme';
import { ORB_IDLE } from './allternitOrbFrames';

/**
 * The settled AllternitOrb (▞▪▚): marks a finished turn, a collapsed thought,
 * or an idle agent. Same width as the live spinner glyph, so a turn's closing
 * line sits where its spinner was.
 */
export function OrbMark({ dim = true, coreColor = 'gizzi' }: { dim?: boolean; coreColor?: keyof Theme }) {
  return <Box flexShrink={0} width={4}>
      <Text color="text" dimColor={dim}>{ORB_IDLE.left}</Text>
      {/* Dim replaces color in this theme, so the core stays full coral. */}
      <Text color={coreColor}>{ORB_IDLE.core}</Text>
      <Text color="text" dimColor={dim}>{ORB_IDLE.right}</Text>
    </Box>;
}

/** Plain-text form for places that render a string, not a component. */
export const ORB_MARK_TEXT = `${ORB_IDLE.left}${ORB_IDLE.core}${ORB_IDLE.right}`;
