// @ts-nocheck
/**
 * Gizzi brand logo for the ink welcome screen.
 *
 * Ports the legacy TUI branding (GIZZIBanner + mascot) to React/ink so
 * the ink TUI shows the same identity as the previous build.
 * ASCII art and palette per src/cli/ui/components/gizzi/BRAND.md.
 */
import React from 'react'
import { Box, Text } from '../ink'

// Obsidian & Sand palette (BRAND.md)
const SAND = '#D4B08C'
const CORAL = '#D97757'
const STRUCTURAL = '#8F6F56'

const GIZZIIO_LOGO = [
  ' ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ ',
  ' ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ ',
  ' ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ ',
  ' ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ ',
]

const TAGLINE = 'AGENT | BRAIN | CODE'

// The "Architectural Sentinel" mascot (BRAND.md), segmented for coloring
const MASCOT: Array<Array<[string, string]>> = [
  [['      ▄▄       ', CORAL]],
  [['   ▄▄▄  ▄▄▄    ', SAND]],
  [[' ▄██████████▄  ', SAND]],
  [[' █  ', SAND], ['●    ●', CORAL], ['  █ ', SAND]],
  [[' █  ', SAND], ['A : / /', CORAL], [' █ ', SAND]],
  [['  ▀████████▀   ', SAND]],
  [['   █ █  █ █    ', STRUCTURAL]],
  [['   ▀ ▀  ▀ ▀    ', STRUCTURAL]],
]

export function GizziLogo(): React.ReactNode {
  return (
    <Box flexDirection="column" alignItems="center">
      <Box flexDirection="column">
        {MASCOT.map((segments, i) => (
          <Text key={i}>
            {segments.map(([text, color], j) => (
              <Text key={j} color={color}>{text}</Text>
            ))}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" marginTop={1}>
        {GIZZIIO_LOGO.map((line, i) => (
          <Text key={i} color={SAND} bold={true}>{line}</Text>
        ))}
      </Box>
      <Text color={CORAL} dimColor={false}>{TAGLINE}</Text>
    </Box>
  )
}

export default GizziLogo
