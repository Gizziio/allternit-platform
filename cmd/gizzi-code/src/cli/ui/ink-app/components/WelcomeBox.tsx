// @ts-nocheck
/**
 * Kimi Code-style compact welcome box for the startup screen.
 * One rounded box: mini sentinel mark + welcome line + info fields
 * (Directory / Session / Model / Version). Replaces the big banner +
 * welcome panel combo with a minimal, top-anchored header.
 */
import * as React from 'react'
import { Box, Text } from '../ink'
import { useMainLoopModel } from '../hooks/useMainLoopModel'
import { renderModelSetting } from '../utils/model/model'
import { getLogoDisplayData } from '../utils/logoV2Utils'
import { getSessionId } from '../bootstrap/state.js'

const SAND = '#D4B08C'
const CORAL = '#D97757'
const STRUCTURAL = '#8F6F56'

// Full "Architectural Sentinel" mascot (BRAND.md), segmented for coloring.
// Rendered inside the welcome box at full size — not clipped.
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Text>
      <Text dimColor={true}>{label}: </Text>
      <Text>{value}</Text>
    </Text>
  )
}

export function WelcomeBox(): React.ReactNode {
  const model = useMainLoopModel()
  const modelDisplayName = renderModelSetting(model)
  const { version, cwd } = getLogoDisplayData()
  const sessionId = getSessionId()

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={SAND} paddingX={1} width="100%">
      <Box flexDirection="column" marginBottom={1}>
        {MASCOT.map((segments, i) => (
          <Text key={i}>
            {segments.map(([text, color], j) => (
              <Text key={j} color={color}>{text}</Text>
            ))}
          </Text>
        ))}
      </Box>
      <Text bold={true}>Welcome to Gizzi Code!</Text>
      <Text dimColor={true}>Send /help for help information.</Text>
      <Text> </Text>
      <Field label="Directory" value={cwd} />
      <Field label="Session" value={sessionId ?? ''} />
      <Field label="Model" value={modelDisplayName} />
      <Field label="Version" value={version} />
    </Box>
  )
}

export default WelcomeBox
