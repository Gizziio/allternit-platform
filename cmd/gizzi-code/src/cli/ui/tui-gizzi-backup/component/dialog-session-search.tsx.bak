/**
 * Session Search Dialog
 * 
 * Search within the current session's messages.
 */

import { createMemo, createSignal, For, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useRouteData } from "@/cli/ui/tui/context/route"
import { DialogSelect, type DialogSelectOption } from "@/cli/ui/tui/ui/dialog-select"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"

interface SearchResult {
  messageID: string
  text: string
  role: "user" | "assistant"
  timestamp: number
  matches: { start: number; end: number }[]
}

interface DialogSessionSearchProps {
  onResultSelect?: (messageID: string) => void
}

export function DialogSessionSearch(props: DialogSessionSearchProps) {
  const { theme } = useTheme()
  const dialog = useDialog()
  const sync = useSync()
  const route = useRouteData("session")
  
  const [query, setQuery] = createSignal("")
  const [results, setResults] = createSignal<SearchResult[]>([])
  
  const sessionID = route.sessionID
  
  // Get all messages for this session
  const messages = createMemo(() => {
    const allMessages = sync.data.message || {}
    return Object.values(allMessages).filter((m: any) => m.sessionID === sessionID)
  })
  
  // Get parts for each message
  const getMessageText = (messageID: string): string => {
    const parts = sync.data.part?.[messageID] || []
    return parts
      .filter((p: any) => p.type === "text")
      .map((p: any) => p.text)
      .join(" ")
  }
  
  // Perform search
  const performSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }
    
    const lowerQuery = searchQuery.toLowerCase()
    const searchResults: SearchResult[] = []
    
    for (const message of messages() as any[]) {
      const text = getMessageText(message.id)
      if (!text) continue
      
      const lowerText = text.toLowerCase()
      const matches: { start: number; end: number }[] = []
      
      // Find all occurrences
      let pos = 0
      while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
        matches.push({ start: pos, end: pos + lowerQuery.length })
        pos += lowerQuery.length
      }
      
      if (matches.length > 0) {
        searchResults.push({
          messageID: message.id,
          text,
          role: message.role,
          timestamp: message.time?.created || 0,
          matches,
        })
      }
    }
    
    // Sort by timestamp (newest first)
    searchResults.sort((a, b) => b.timestamp - a.timestamp)
    setResults(searchResults)
  }
  
  // Format result text with highlights
  const formatResultText = (result: SearchResult, maxLength: number = 60): string => {
    const firstMatch = result.matches[0]
    const contextStart = Math.max(0, firstMatch.start - 20)
    const contextEnd = Math.min(result.text.length, firstMatch.end + 20)
    let text = result.text.slice(contextStart, contextEnd)
    
    if (contextStart > 0) text = "..." + text
    if (contextEnd < result.text.length) text = text + "..."
    
    // Truncate if too long
    if (text.length > maxLength) {
      text = text.slice(0, maxLength - 3) + "..."
    }
    
    return text
  }
  
  // Keyboard handling for search input
  useKeyboard((evt) => {
    if (evt.name === "escape") {
      dialog.clear()
      return
    }
    
    if (evt.name === "backspace") {
      const newQuery = query().slice(0, -1)
      setQuery(newQuery)
      performSearch(newQuery)
      return
    }
    
    if (evt.name.length === 1) {
      const newQuery = query() + evt.name
      setQuery(newQuery)
      performSearch(newQuery)
    }
  })
  
  const options = createMemo<DialogSelectOption<string>[]>(() => {
    const searchResults = results()
    
    if (!query().trim()) {
      return [{
        title: "Type to search...",
        value: "",
        disabled: true,
      }]
    }
    
    if (searchResults.length === 0) {
      return [{
        title: `No results for "${query()}"`,
        value: "",
        disabled: true,
      }]
    }
    
    return searchResults.map((result): DialogSelectOption<string> => ({
      title: `${result.role === "user" ? "You: " : "AI: "}${formatResultText(result)}`,
      value: result.messageID,
      description: `${result.matches.length} match${result.matches.length > 1 ? "es" : ""}`,
      category: result.role === "user" ? "Your Messages" : "AI Responses",
    }))
  })
  
  return (
    <box flexDirection="column" minWidth={80}>
      {/* Header with search input */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Search Session
        </text>
        <text fg={theme.textMuted}>
          {results().length} results
        </text>
      </box>
      
      {/* Search input */}
      <box
        flexDirection="row"
        padding={1}
        border={["bottom"]}
        borderColor={theme.border}
      >
        <text fg={theme.textMuted}>&gt; </text>
        <text fg={theme.text}>{query()}</text>
        <Show when={query().length === 0}>
          <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
            Type to search messages...
          </text>
        </Show>
      </box>
      
      {/* Results */}
      <box flexDirection="column" maxHeight={20}>
        <DialogSelect
          title=""
          placeholder=""
          options={options()}
          skipFilter={true}
          onSelect={(option) => {
            if (option.value) {
              props.onResultSelect?.(option.value)
              dialog.clear()
            }
          }}
        />
      </box>
    </box>
  )
}
