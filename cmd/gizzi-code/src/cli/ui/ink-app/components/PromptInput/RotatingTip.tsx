// @ts-nocheck
import * as React from 'react'
import { useEffect, useState } from 'react'
import { Text } from '../../ink'

const TIPS = [
  'Type / for commands',
  'Use @ to mention files',
  'Try /dash for a session overview',
  'Ctrl+O expands collapsed thinking',
  'Use /usage to check token spend',
  'Shift+Tab cycles permission mode',
  'Type ? for keyboard shortcuts',
]

const TIP_INTERVAL_MS = 20_000

export function RotatingTip(): React.ReactNode {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex(prev => (prev + 1) % TIPS.length)
    }, TIP_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return (
    <Text dimColor wrap="truncate">
      {TIPS[index]}
    </Text>
  )
}
