import { For, Show, createSignal } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { useKeyboard } from "@opentui/solid"
import { useKeybind } from "@/cli/ui/ink-app/context/keybind"

type Category = "navigation" | "messages" | "session" | "general"

const SHORTCUTS: Record<Category, { key: string; description: string }[]> = {
  navigation: [
    { key: "↑ / ↓ or k / j", description: "Scroll messages" },
    { key: "gg / G", description: "Jump to top / bottom" },
    { key: "Ctrl+U / Ctrl+D", description: "Scroll half page up/down" },
    { key: "/", description: "Search messages" },
    { key: "n / N", description: "Next / previous search result" },
    { key: ":", description: "Jump to message number" },
  ],
  messages: [
    { key: "m", description: "Toggle bookmark on message" },
    { key: "y", description: "Copy first code block" },
    { key: "Space", description: "Fold/unfold message" },
    { key: "Enter", description: "Open message actions" },
    { key: "p", description: "Pin/unpin message" },
  ],
  session: [
    { key: "$", description: "View usage statistics" },
    { key: "b", description: "View bookmarks" },
    { key: "Ctrl+P", description: "Command palette" },
    { key: "Ctrl+E", description: "Export session" },
    { key: "f", description: "Show file references" },
  ],
  general: [
    { key: "?", description: "Show this help" },
    { key: "Esc / q", description: "Close dialog/quit" },
    { key: "Ctrl+C", description: "Interrupt generation" },
    { key: "Tab", description: "Focus next element" },
  ],
}

const CATEGORY_NAMES: Record<Category, string> = {
  navigation: "Navigation",
  messages: "Messages",
  session: "Session",
  general: "General",
}

export function DialogHelp() {
  const dialog = useDialog()
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const keybind = useKeybind()
  const [activeCategory, setActiveCategory] = createSignal<Category>("navigation")

  useKeyboard((evt) => {
    if (evt.name === "escape" || evt.name === "q") {
      dialog.clear()
      return
    }
    
    // Category switching with number keys
    const categories: Category[] = ["navigation", "messages", "session", "general"]
    const num = parseInt(evt.name)
    if (num >= 1 && num <= 4) {
      setActiveCategory(categories[num - 1])
      return
    }
    
    // Arrow key navigation between categories
    if (evt.name === "right") {
      const categories: Category[] = ["navigation", "messages", "session", "general"]
      const idx = categories.indexOf(activeCategory())
      setActiveCategory(categories[(idx + 1) % categories.length])
      return
    }
    if (evt.name === "left") {
      const categories: Category[] = ["navigation", "messages", "session", "general"]
      const idx = categories.indexOf(activeCategory())
      setActiveCategory(categories[(idx - 1 + categories.length) % categories.length])
      return
    }
  })

  const categories: Category[] = ["navigation", "messages", "session", "general"]

  return (
    <box
      flexDirection="column"
      width={70}
      maxHeight={40}
      padding={tone().space.md}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <span style={{ fg: theme.accent, bold: true }}>⌨️  Keyboard Shortcuts</span>
      </box>

      {/* Category Tabs */}
      <box flexDirection="row" gap={tone().space.sm} marginBottom={tone().space.md}>
        <For each={categories}>
          {(cat, idx) => (
            <box
              flexDirection="row"
              gap={tone().space.xs}
              padding={tone().space.sm}
              backgroundColor={activeCategory() === cat ? theme.backgroundElement : undefined}
              onMouseUp={() => setActiveCategory(cat)}
            >
              <text fg={activeCategory() === cat ? theme.accent : theme.textMuted}>
                {idx() + 1}
              </text>
              <text fg={activeCategory() === cat ? theme.text : theme.textMuted}>
                {CATEGORY_NAMES[cat]}
              </text>
            </box>
          )}
        </For>
      </box>

      {/* Shortcuts List */}
      <box flexDirection="column" flexGrow={1} gap={tone().space.sm}>
        <For each={SHORTCUTS[activeCategory()]}>
          {(shortcut) => (
            <box
              flexDirection="row"
              gap={tone().space.md}
              padding={tone().space.sm}
              backgroundColor={theme.backgroundElement}
            >
              <text width={20} wrapMode="none" fg={theme.accent}>
                <span style={{ bold: true }}>{shortcut.key}</span>
              </text>
              <text fg={theme.text}>{shortcut.description}</text>
            </box>
          )}
        </For>
      </box>

      {/* Footer */}
      <box flexDirection="row" gap={tone().space.md} marginTop={tone().space.sm}>
        <text fg={theme.textMuted}>Esc/q close</text>
        <text fg={theme.textMuted}>1-4 switch category</text>
        <text fg={theme.textMuted}>←→ navigate</text>
      </box>
    </box>
  )
}
