/**
 * Keyboard Help Overlay
 * 
 * Shows all available keyboard shortcuts in a searchable, categorized view.
 * Press '?' to open from anywhere in the TUI.
 */

import { createMemo, createSignal, For, Show, type JSX } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { useDialog } from "@/cli/ui/tui/ui/dialog"
import { useKeybind } from "@/cli/ui/tui/context/keybind"
import { Keybind } from "@/runtime/util/keybind"

interface ShortcutGroup {
  name: string
  shortcuts: Shortcut[]
}

interface Shortcut {
  keys: string
  description: string
  context?: string
}

export function HelpOverlay() {
  const { theme } = useTheme()
  const dialog = useDialog()
  const keybind = useKeybind()
  const [search, setSearch] = createSignal("")
  const [selectedGroup, setSelectedGroup] = createSignal<string | null>(null)
  
  // Define shortcut groups
  const shortcutGroups = createMemo((): ShortcutGroup[] => [
    {
      name: "Global",
      shortcuts: [
        { keys: keybind.print("session_new") || "Ctrl+N", description: "New session" },
        { keys: keybind.print("session_list") || "Ctrl+L", description: "List sessions" },
        { keys: keybind.print("model_list") || "Ctrl+M", description: "Switch model" },
        { keys: keybind.print("command_list") || "Ctrl+P", description: "Command palette" },
        { keys: keybind.print("status_view") || "Ctrl+S", description: "View status" },
        { keys: keybind.print("keyboard_shortcuts") || "Ctrl+/", description: "Show keyboard shortcuts help" },
        { keys: "Ctrl+Q", description: "Quit application" },
        { keys: "Ctrl+Z", description: "Suspend to background" },
      ],
    },
    {
      name: "Navigation",
      shortcuts: [
        { keys: "↑ / ↓", description: "Navigate messages" },
        { keys: "Page Up/Down", description: "Scroll page" },
        { keys: "Home / End", description: "Jump to first/last message" },
        { keys: keybind.print("session_child_cycle") || "Ctrl+→", description: "Next child session" },
        { keys: keybind.print("session_child_cycle_reverse") || "Ctrl+←", description: "Previous child session" },
        { keys: keybind.print("session_parent") || "Ctrl+↑", description: "Go to parent session" },
      ],
    },
    {
      name: "Messages",
      shortcuts: [
        { keys: keybind.print("session_rename") || "Ctrl+R", description: "Rename session" },
        { keys: keybind.print("session_delete") || "Ctrl+D", description: "Delete session" },
        { keys: keybind.print("messages_copy") || "Ctrl+Y", description: "Copy message" },
        { keys: keybind.print("messages_page_up") || "Page Up", description: "Scroll messages up" },
        { keys: keybind.print("messages_page_down") || "Page Down", description: "Scroll messages down" },
        { keys: keybind.print("messages_first") || "Home", description: "First message" },
        { keys: keybind.print("messages_last") || "End", description: "Last message" },
      ],
    },
    {
      name: "Input",
      shortcuts: [
        { keys: "Ctrl+A", description: "Beginning of line" },
        { keys: "Ctrl+E", description: "End of line" },
        { keys: "Ctrl+K", description: "Delete to end of line" },
        { keys: "Ctrl+U", description: "Delete to start of line" },
        { keys: "Ctrl+W", description: "Delete word backward" },
        { keys: "Alt+F", description: "Forward word" },
        { keys: "Alt+B", description: "Backward word" },
        { keys: "↑ / ↓", description: "History previous/next" },
        { keys: "Tab", description: "Autocomplete" },
      ],
    },
    {
      name: "Display",
      shortcuts: [
        { keys: keybind.print("display_thinking") || "None", description: "Toggle thinking" },
        { keys: keybind.print("display_receipts") || "None", description: "Toggle receipts" },
        { keys: keybind.print("display_cards") || "None", description: "Toggle preview cards" },
        { keys: keybind.print("sidebar_toggle") || "Ctrl+B", description: "Toggle sidebar" },
        { keys: keybind.print("scrollbar_toggle") || "None", description: "Toggle scrollbar" },
      ],
    },
  ])
  
  // Filter shortcuts based on search
  const filteredGroups = createMemo(() => {
    const query = search().toLowerCase()
    if (!query) return shortcutGroups()
    
    return shortcutGroups()
      .map((group) => ({
        ...group,
        shortcuts: group.shortcuts.filter(
          (s) =>
            s.description.toLowerCase().includes(query) ||
            s.keys.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.shortcuts.length > 0)
  })
  
  // Handle keyboard
  useKeyboard((evt) => {
    if (evt.name === "esc" || evt.name === "q") {
      dialog.clear()
      return
    }
    
    if (evt.name === "backspace") {
      setSearch((s) => s.slice(0, -1))
      return
    }
    
    if (evt.name.length === 1) {
      setSearch((s) => s + evt.name)
    }
  })
  
  return (
    <box
      flexDirection="column"
      padding={2}
      minWidth={70}
      maxWidth={90}
      borderStyle="double"
      borderColor={theme.primary}
      backgroundColor={theme.background}
    >
      {/* Header */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        marginBottom={1}
      >
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          ⌨️  Keyboard Shortcuts
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc/q to close
        </text>
      </box>
      
      {/* Search */}
      <box flexDirection="row" gap={1} marginBottom={1}>
        <text fg={theme.textMuted}>Search:</text>
        <box
          flexDirection="row"
          borderStyle="single"
          borderColor={theme.border}
          padding={1}
          flexGrow={1}
        >
          <text fg={theme.text}>{search()}</text>
          <Show when={search().length === 0}>
            <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
              Type to filter...
            </text>
          </Show>
        </box>
      </box>
      
      {/* Shortcut Groups */}
      <box flexDirection="column" flexGrow={1} overflow="scroll">
        <For each={filteredGroups()}>
          {(group) => (
            <box flexDirection="column" marginBottom={1}>
              {/* Group Header */}
              <text
                fg={theme.primary}
                attributes={TextAttributes.BOLD}
                marginBottom={1}
              >
                {group.name}
              </text>
              
              {/* Shortcuts */}
              <box flexDirection="column">
                <For each={group.shortcuts}>
                  {(shortcut) => (
                    <box
                      flexDirection="row"
                      justifyContent="space-between"
                      padding={1}
                    >
                      <text fg={theme.text}>{shortcut.description}</text>
                      <box flexDirection="row" gap={1}>
                        <text
                          fg={RGBA.fromInts(255, 255, 255)}
                          attributes={TextAttributes.BOLD}
                          bg={theme.primary}
                          padding={1}
                        >
                          {shortcut.keys}
                        </text>
                      </box>
                    </box>
                  )}
                </For>
              </box>
            </box>
          )}
        </For>
        
        <Show when={filteredGroups().length === 0}>
          <box
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            padding={2}
          >
            <text fg={theme.textMuted}>No shortcuts match "{search()}"</text>
          </box>
        </Show>
      </box>
      
      {/* Footer */}
      <box
        flexDirection="row"
        justifyContent="space-between"
        marginTop={1}
        border={["top"]}
        borderColor={theme.border}
        paddingTop={1}
      >
        <text fg={theme.textMuted}>
          Press {keybind.print("keyboard_shortcuts")} anywhere to show this help
        </text>
      </box>
    </box>
  )
}

/**
 * Hook to register the keyboard shortcuts keybinding globally
 */
export function useHelpOverlay() {
  const dialog = useDialog()
  const keybind = useKeybind()
  
  useKeyboard((evt) => {
    if (keybind.match("keyboard_shortcuts", evt)) {
      dialog.replace(() => <HelpOverlay />)
    }
  })
}
