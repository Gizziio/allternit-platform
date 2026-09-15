import { createStore } from "solid-js/store"
import { createEffect, createMemo } from "solid-js"

export interface Bookmark {
  messageID: string
  timestamp: number
  note?: string
}

export interface BookmarkStore {
  [sessionID: string]: Bookmark[]
}

const STORAGE_KEY = "gizzi-bookmarks"

function getStorage(): BookmarkStore {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as BookmarkStore
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

function setStorage(state: BookmarkStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

export function useBookmarks(sessionID: string) {
  const [store, setStore] = createStore<BookmarkStore>(getStorage())

  // Persist to localStorage on changes
  createEffect(() => {
    setStorage(store)
  })

  const bookmarks = createMemo(() => store[sessionID] ?? [])

  function toggle(messageID: string) {
    const current = bookmarks()
    const exists = current.find((b) => b.messageID === messageID)

    if (exists) {
      // Remove bookmark
      setStore(sessionID, (prev) =>
        (prev ?? []).filter((b) => b.messageID !== messageID)
      )
    } else {
      // Add bookmark
      setStore(sessionID, (prev) => [
        ...(prev ?? []),
        {
          messageID,
          timestamp: Date.now(),
        },
      ])
    }
  }

  function isBookmarked(messageID: string): boolean {
    return bookmarks().some((b) => b.messageID === messageID)
  }

  function remove(messageID: string) {
    setStore(sessionID, (prev) =>
      (prev ?? []).filter((b) => b.messageID !== messageID)
    )
  }

  function add(messageID: string, note?: string) {
    if (isBookmarked(messageID)) return
    setStore(sessionID, (prev) => [
      ...(prev ?? []),
      {
        messageID,
        timestamp: Date.now(),
        note,
      },
    ])
  }

  function clear() {
    setStore(sessionID, [])
  }

  function getBookmarkedMessageIDs(): string[] {
    return bookmarks().map((b) => b.messageID)
  }

  return {
    bookmarks,
    toggle,
    isBookmarked,
    remove,
    add,
    clear,
    getBookmarkedMessageIDs,
    count: () => bookmarks().length,
  }
}
