/**
 * GIZZI ShimmeringBanner
 * 
 * Boot animation component for GIZZI Code.
 * Reimplementation of Gizzi's ShimmeringBanner in Ink/React.
 */

import React, { useEffect, useState } from "react"
import { Box, Text } from "ink"

// Boot animation phases
type BootPhase = "cli" | "transition" | "matrix" | "tower" | "logo" | "splash"

// Official GIZZI Mascot - Vacuum Tube style
const GIZZI_MASCOT = [
  "      ▄▄      ", // 0: Floating Beacon
  "   ▄▄▄  ▄▄▄   ", // 1: Antenna Blocks
  " ▄██████████▄ ", // 2: Head Top
  " █  ●    ●  █ ", // 3: Eye Panel
  " █  A : / / █ ", // 4: Mouth Panel
  "  ▀████████▀  ", // 5: Head Bottom
  "   █ █  █ █   ", // 6: 4 Legs
  "   ▀ ▀  ▀ ▀   ", // 7: Feet
]

// GIZZI Logo Text (Blocky version)
const GIZZI_LOGO = [
  " ▄████▄  ▄█  ██████  ██████  ▄█  ▄█  ▄████▄ ",
  " ██  ▀▀  ██     ▄█▀     ▄█▀  ██  ██  ██  ██ ",
  " ██  ▄▄  ██   ▄█▀     ▄█▀    ██  ██  ██  ██ ",
  " ▀████▀  ▀█  ██████  ██████  ▀█  ▀█  ▀████▀ ",
]

interface ShimmeringBannerProps {
  onComplete?: () => void
  autoPlay?: boolean
}

export function ShimmeringBanner({ onComplete, autoPlay = true }: ShimmeringBannerProps) {
  const [phase, setPhase] = useState<BootPhase>("cli")
  const [tick, setTick] = useState(0)
  const [typedText, setTypedText] = useState("")

  useEffect(() => {
    if (!autoPlay) return

    // Phase transition timing
    const phaseTiming: Record<BootPhase, number> = {
      cli: 500,
      transition: 300,
      matrix: 800,
      tower: 600,
      logo: 1000,
      splash: 1500,
    }

    const timer = setTimeout(() => {
      switch (phase) {
        case "cli":
          setPhase("transition")
          break
        case "transition":
          setPhase("matrix")
          break
        case "matrix":
          setPhase("tower")
          break
        case "tower":
          setPhase("logo")
          break
        case "logo":
          setPhase("splash")
          break
        case "splash":
          onComplete?.()
          return
      }
      setTick((t) => t + 1)
    }, phaseTiming[phase])

    return () => clearTimeout(timer)
  }, [phase, tick, autoPlay, onComplete])

  // Typewriter effect for splash
  useEffect(() => {
    if (phase === "splash") {
      const fullText = "GIZZI CODE"
      let i = 0
      const timer = setInterval(() => {
        if (i <= fullText.length) {
          setTypedText(fullText.slice(0, i))
          i++
        } else {
          clearInterval(timer)
        }
      }, 100)
      return () => clearInterval(timer)
    }
  }, [phase])

  const renderPhase = () => {
    switch (phase) {
      case "cli":
      case "transition":
        return (
          <Box flexDirection="column">
            <Text color="gray">Booting GIZZI kernel...</Text>
          </Box>
        )
      case "matrix":
        return (
          <Box flexDirection="column">
            {GIZZI_MASCOT.map((line, i) => (
              <Text key={i} color="green">
                {line}
              </Text>
            ))}
          </Box>
        )
      case "tower":
        return (
          <Box flexDirection="column">
            <Text color="yellow">⚡ Powering up...</Text>
            {GIZZI_MASCOT.map((line, i) => (
              <Text key={i} color={i % 2 === 0 ? "green" : "yellow"}>
                {line}
              </Text>
            ))}
          </Box>
        )
      case "logo":
        return (
          <Box flexDirection="column">
            {GIZZI_LOGO.map((line, i) => (
              <Text key={i} color="cyan">
                {line}
              </Text>
            ))}
          </Box>
        )
      case "splash":
        return (
          <Box flexDirection="column" alignItems="center">
            {GIZZI_LOGO.map((line, i) => (
              <Text key={i} color="cyan">
                {line}
              </Text>
            ))}
            <Box marginTop={1}>
              <Text color="yellow" bold>
                {typedText}
                <Text color="gray">|</Text>
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text color="gray">[ AGENT | BRAIN | CODE ]</Text>
            </Box>
          </Box>
        )
    }
  }

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" padding={2}>
      {renderPhase()}
    </Box>
  )
}
