/**
 * useExitOnCtrlCDWithKeybindings hook
 * Production implementation for Ctrl+C/D exit handling with keybinding integration
 */

import { useEffect, useRef, useCallback } from 'react'
import { useInput } from 'ink'

export interface UseExitOnCtrlCDOptions {
  enabled?: boolean
  onExit?: () => void
  bypassKeybindings?: boolean
  confirmationRequired?: boolean
}

export function useExitOnCtrlCDWithKeybindings(options: UseExitOnCtrlCDOptions = {}): void {
  const {
    enabled = true,
    onExit,
    bypassKeybindings,
    confirmationRequired = false,
  } = options

  const pendingRef = useRef(false)

  const handleExit = useCallback(() => {
    if (confirmationRequired && !pendingRef.current) {
      pendingRef.current = true
      // Second press required within 2s
      setTimeout(() => {
        pendingRef.current = false
      }, 2000)
      return
    }
    if (onExit) {
      onExit()
    } else {
      process.exit(0)
    }
  }, [confirmationRequired, onExit])

  useInput(
    (input, key) => {
      if (!enabled) return

      // Ctrl+C
      if (key.ctrl && input === 'c') {
        handleExit()
        return
      }

      // Ctrl+D
      if (key.ctrl && input === 'd') {
        handleExit()
        return
      }

      // Escape with Ctrl meta (Cmd+Q on macOS)
      if (key.escape && key.meta) {
        handleExit()
        return
      }
    },
    { always: true },
  )
}

export default useExitOnCtrlCDWithKeybindings
