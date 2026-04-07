/**
 * useTerminalSize hook
 * Tracks terminal dimensions
 */

import { useState, useEffect } from 'react'

export interface TerminalSize {
  width: number
  height: number
}

export function useTerminalSize(): TerminalSize {
  const [size, setSize] = useState<TerminalSize>({
    width: process.stdout.columns || 80,
    height: process.stdout.rows || 24,
  })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: process.stdout.columns || 80,
        height: process.stdout.rows || 24,
      })
    }

    process.stdout.on('resize', handleResize)

    return () => {
      process.stdout.off('resize', handleResize)
    }
  }, [])

  return size
}

export function useTerminalWidth(): number {
  return useTerminalSize().width
}

export function useTerminalHeight(): number {
  return useTerminalSize().height
}

export default {
  useTerminalSize,
  useTerminalWidth,
  useTerminalHeight,
}
