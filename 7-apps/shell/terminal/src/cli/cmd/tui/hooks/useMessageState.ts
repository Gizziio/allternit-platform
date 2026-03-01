import { createStore } from "solid-js/store"
import { createEffect } from "solid-js"

export interface MessageState {
  collapsed?: boolean
}

export interface MessageStateStore {
  [messageID: string]: MessageState
}

function getStorageKey(sessionID: string): string {
  return `a2r-msg-state-${sessionID}`
}

function loadState(sessionID: string): MessageStateStore {
  try {
    const key = getStorageKey(sessionID)
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as MessageStateStore
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function saveState(sessionID: string, state: MessageStateStore) {
  try {
    const key = getStorageKey(sessionID)
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

export function useMessageState(sessionID: string) {
  const [state, setState] = createStore<MessageStateStore>(loadState(sessionID))

  // Persist to localStorage on changes
  createEffect(() => {
    saveState(sessionID, state)
  })

  function toggle(messageID: string) {
    setState(messageID, "collapsed", (prev) => !prev)
  }

  function isCollapsed(messageID: string): boolean {
    return state[messageID]?.collapsed ?? false
  }

  function expand(messageID: string) {
    setState(messageID, "collapsed", false)
  }

  function collapse(messageID: string) {
    setState(messageID, "collapsed", true)
  }

  function expandAll() {
    const next: MessageStateStore = {}
    for (const [id, msgState] of Object.entries(state)) {
      next[id] = { ...msgState, collapsed: false }
    }
    setState(next)
  }

  function collapseAll(messageIDs: string[]) {
    const next: MessageStateStore = { ...state }
    for (const id of messageIDs) {
      next[id] = { ...(next[id] ?? {}), collapsed: true }
    }
    setState(next)
  }

  return {
    state,
    toggle,
    isCollapsed,
    expand,
    collapse,
    expandAll,
    collapseAll,
  }
}
