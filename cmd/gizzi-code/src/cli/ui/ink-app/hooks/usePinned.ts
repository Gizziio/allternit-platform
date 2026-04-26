import { createSignal, createMemo } from "solid-js"
import { createStore } from "solid-js/store"
import { useKV } from "@/cli/ui/ink-app/context/kv"

export interface PinnedMessage {
  messageID: string
  sessionID: string
  pinnedAt: number
  note?: string
}

export function usePinned(sessionID: string) {
  const kv = useKV()
  const storageKey = `pinned:${sessionID}`

  const [pinned, setPinned] = createStore<{
    messages: PinnedMessage[]
  }>({
    messages: kv.get(storageKey, []),
  })

  const isPinned = (messageID: string) => {
    return pinned.messages.some((m) => m.messageID === messageID)
  }

  const pin = (messageID: string, note?: string) => {
    if (isPinned(messageID)) return
    
    const newPin: PinnedMessage = {
      messageID,
      sessionID,
      pinnedAt: Date.now(),
      note,
    }
    
    const updated = [...pinned.messages, newPin]
    setPinned("messages", updated)
    kv.set(storageKey, updated)
  }

  const unpin = (messageID: string) => {
    const updated = pinned.messages.filter((m) => m.messageID !== messageID)
    setPinned("messages", updated)
    kv.set(storageKey, updated)
  }

  const toggle = (messageID: string) => {
    if (isPinned(messageID)) {
      unpin(messageID)
    } else {
      pin(messageID)
    }
  }

  const updateNote = (messageID: string, note: string) => {
    const updated = pinned.messages.map((m) =>
      m.messageID === messageID ? { ...m, note } : m
    )
    setPinned("messages", updated)
    kv.set(storageKey, updated)
  }

  const clear = () => {
    setPinned("messages", [])
    kv.set(storageKey, [])
  }

  const count = createMemo(() => pinned.messages.length)
  
  const getPinnedMessageIDs = () => pinned.messages.map((m) => m.messageID)

  return {
    messages: () => pinned.messages,
    isPinned,
    pin,
    unpin,
    toggle,
    updateNote,
    clear,
    count,
    getPinnedMessageIDs,
  }
}
