// @ts-nocheck
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Text } from '../../ink'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const INTERVAL_MS = 120

export function ThinkingSpinner(): React.ReactNode {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(prev => (prev + 1) % FRAMES.length)
    }, INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return <Text color="claude">{FRAMES[frame]}</Text>
}
