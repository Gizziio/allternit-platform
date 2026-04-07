/**
 * useExitOnCtrlCD hook
 * Handles Ctrl+C and Ctrl+D for exit
 */

import { useEffect } from 'react'

export function useExitOnCtrlCD(callback?: () => void): void {
  useEffect(() => {
    const handleKeypress = (str: string, key: { ctrl: boolean; name: string }) => {
      if (key.ctrl && (key.name === 'c' || key.name === 'd')) {
        if (callback) {
          callback()
        } else {
          process.exit(0)
        }
      }
    }

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true)
    }
    process.stdin.on('keypress', handleKeypress)

    return () => {
      process.stdin.off('keypress', handleKeypress)
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false)
      }
    }
  }, [callback])
}

export function useExitOnCtrlC(callback?: () => void): void {
  useEffect(() => {
    const handleSigint = () => {
      if (callback) {
        callback()
      } else {
        process.exit(0)
      }
    }

    process.on('SIGINT', handleSigint)

    return () => {
      process.off('SIGINT', handleSigint)
    }
  }, [callback])
}

export default {
  useExitOnCtrlCD,
  useExitOnCtrlC,
}
