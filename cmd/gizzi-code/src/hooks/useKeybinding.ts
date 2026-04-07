/**
 * useKeybinding hook
 * Registers keyboard shortcuts
 */

import { useEffect, useCallback } from 'react'
import { useInput } from 'ink'

export type KeyHandler = (input: string, key: Key) => void

export interface Key {
  upArrow: boolean
  downArrow: boolean
  leftArrow: boolean
  rightArrow: boolean
  pageDown: boolean
  pageUp: boolean
  return: boolean
  escape: boolean
  ctrl: boolean
  shift: boolean
  tab: boolean
  backspace: boolean
  delete: boolean
  meta: boolean
}

export function useKeybinding(key: string, handler: () => void, deps: React.DependencyList = []): void {
  const memoizedHandler = useCallback(handler, deps)

  useInput((input, keyEvent) => {
    const keyMatch = key.toLowerCase()
    
    if (keyMatch === 'ctrl+c' && keyEvent.ctrl && input === 'c') {
      memoizedHandler()
    } else if (keyMatch === 'ctrl+d' && keyEvent.ctrl && input === 'd') {
      memoizedHandler()
    } else if (keyMatch === 'ctrl+z' && keyEvent.ctrl && input === 'z') {
      memoizedHandler()
    } else if (keyMatch === 'escape' && keyEvent.escape) {
      memoizedHandler()
    } else if (keyMatch === 'return' && keyEvent.return) {
      memoizedHandler()
    } else if (keyMatch === 'tab' && keyEvent.tab) {
      memoizedHandler()
    } else if (keyMatch === 'up' && keyEvent.upArrow) {
      memoizedHandler()
    } else if (keyMatch === 'down' && keyEvent.downArrow) {
      memoizedHandler()
    } else if (keyMatch === 'left' && keyEvent.leftArrow) {
      memoizedHandler()
    } else if (keyMatch === 'right' && keyEvent.rightArrow) {
      memoizedHandler()
    } else if (keyMatch === input.toLowerCase()) {
      memoizedHandler()
    }
  })
}

export function useGlobalKeybinding(key: string, handler: () => void): void {
  useEffect(() => {
    const keyHandler = (str: string, keyEvent: { ctrl: boolean; name: string }) => {
      const keyMatch = key.toLowerCase()
      
      if (keyMatch === 'ctrl+c' && keyEvent.ctrl && keyEvent.name === 'c') {
        handler()
      } else if (keyMatch === 'escape' && keyEvent.name === 'escape') {
        handler()
      } else if (keyMatch === keyEvent.name) {
        handler()
      }
    }

    process.stdin.on('keypress', keyHandler)

    return () => {
      process.stdin.off('keypress', keyHandler)
    }
  }, [key, handler])
}

export default {
  useKeybinding,
  useGlobalKeybinding,
}
