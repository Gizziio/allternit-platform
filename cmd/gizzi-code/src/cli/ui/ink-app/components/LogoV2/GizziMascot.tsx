// @ts-nocheck
/**
 * Gizzi "Architectural Sentinel" mascot for the ink logo screens.
 * Replaces the Claude "Clawd" mascot — same drop-in role as ./Clawd.tsx.
 * ASCII art and Obsidian & Sand palette per src/cli/ui/components/gizzi/BRAND.md.
 */
import * as React from 'react';
import { Box, Text } from '../../ink';

const SAND = '#D4B08C';
const CORAL = '#D97757';
const STRUCTURAL = '#8F6F56';

const MASCOT: Array<Array<[string, string]>> = [
  [['      ▄▄       ', CORAL]],
  [['   ▄▄▄  ▄▄▄    ', SAND]],
  [[' ▄██████████▄  ', SAND]],
  [[' █  ', SAND], ['●    ●', CORAL], ['  █ ', SAND]],
  [[' █  ', SAND], ['A : / /', CORAL], [' █ ', SAND]],
  [['  ▀████████▀   ', SAND]],
  [['   █ █  █ █    ', STRUCTURAL]],
  [['   ▀ ▀  ▀ ▀    ', STRUCTURAL]],
];

export function GizziMascot(): React.ReactNode {
  return (
    <Box flexDirection="column">
      {MASCOT.map((segments, i) => (
        <Text key={i}>
          {segments.map(([text, color], j) => (
            <Text key={j} color={color}>{text}</Text>
          ))}
        </Text>
      ))}
    </Box>
  );
}
