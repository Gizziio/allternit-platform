import { createEffect, onCleanup } from "solid-js"
import type { ScrollBoxRenderable } from "@opentui/core"

interface ScrollState {
  y: number
  timestamp: number
}

const STORAGE_KEY = "gizzi-scroll-memory"
const MAX_ENTRIES = 50 // Limit stored sessions

function getStorage(): Record<string, ScrollState> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function setStorage(state: Record<string, ScrollState>) {
  try {
    // Limit entries to prevent unbounded growth
    const entries = Object.entries(state)
    if (entries.length > MAX_ENTRIES) {
      // Sort by timestamp and keep most recent
      const sorted = entries.sort((a, b) => b[1].timestamp - a[1].timestamp)
      const trimmed = sorted.slice(0, MAX_ENTRIES)
      state = Object.fromEntries(trimmed)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

export function useScrollMemory(
  sessionID: string,
  scrollbox: (() => ScrollBoxRenderable | undefined) | ScrollBoxRenderable | undefined,
) {
  const getScrollbox = (): ScrollBoxRenderable | undefined => {
    if (typeof scrollbox === "function") {
      return scrollbox()
    }
    return scrollbox
  }

  // Save scroll position when leaving session
  createEffect(() => {
    const id = sessionID
    const scroll = getScrollbox()

    if (!scroll || scroll.isDestroyed) return

    const savePosition = () => {
      const s = getScrollbox()
      if (!s || s.isDestroyed) return
      const state = getStorage()
      state[id] = {
        y: s.y,
        timestamp: Date.now(),
      }
      setStorage(state)
    }

    // Save on scroll (throttled)
    let timeout: ReturnType<typeof setTimeout> | null = null
    const handleScroll = () => {
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(savePosition, 500)
    }

    scroll.on("scroll", handleScroll)

    onCleanup(() => {
      scroll.off("scroll", handleScroll)
      if (timeout) clearTimeout(timeout)
      // Final save on cleanup
      savePosition()
    })
  })

  // Restore scroll position when session changes
  createEffect(() => {
    const id = sessionID
    const scroll = getScrollbox()

    if (!scroll || scroll.isDestroyed) return

    // Small delay to ensure content is rendered
    const timeout = setTimeout(() => {
      const s = getScrollbox()
      if (!s || s.isDestroyed) return
      const state = getStorage()
      const saved = state[id]
      if (saved && saved.y > 0) {
        // Check if we're already near the bottom (new message scenario)
        const nearBottom = s.scrollHeight - s.y - s.height < 100
        if (!nearBottom) {
          s.scrollTo(saved.y)
        }
      }
    }, 100)

    onCleanup(() => {
      clearTimeout(timeout)
    })
  })

  // Clear memory for this session
  function clear() {
    const state = getStorage()
    delete state[sessionID]
    setStorage(state)
  }

  // Clear all memory
  function clearAll() {
    setStorage({})
  }

  return { clear, clearAll }
}
