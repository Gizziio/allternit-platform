import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useGIZZITheme } from "@/cli/ui/components/gizzi"
import { GIZZIBrand, GIZZICopy } from "@/shared/brand"
import { useSync } from "@/cli/ui/tui/context/sync"
import { useCommandDialog } from "@/cli/ui/tui/component/dialog-command"
import { useDialog } from "@/cli/ui/tui/ui/dialog"

interface QuickStartOption {
  title: string
  description: string
  command: string
  icon: string
}

const QUICK_START_OPTIONS: QuickStartOption[] = [
  {
    title: "Connect a provider",
    description: "Add API keys for Claude, GPT, Gemini, and more",
    command: "/connect",
    icon: "🔌",
  },
  {
    title: "Create a session",
    description: "Start a new conversation",
    command: "/new",
    icon: "💬",
  },
  {
    title: "View sessions",
    description: "Continue a previous conversation",
    command: "/sessions",
    icon: "📚",
  },
  {
    title: "Get help",
    description: "Show keyboard shortcuts and commands",
    command: "/help",
    icon: "❓",
  },
]

export function WelcomeScreen() {
  const { theme } = useTheme()
  const tone = useGIZZITheme()
  const sync = useSync()
  const command = useCommandDialog()
  const dialog = useDialog()

  const hasProviders = createMemo(() => sync.data.provider.length > 0)
  const hasSessions = createMemo(() => sync.data.session.length > 0)

  function handleOption(option: QuickStartOption) {
    // Execute the command
    if (option.command.startsWith("/")) {
      const cmd = option.command.slice(1)
      command.trigger(cmd)
    }
    dialog.clear()
  }

  return (
    <box flexDirection="column" gap={tone().space.lg} padding={tone().space.lg}>
      {/* Header */}
      <box flexDirection="column" gap={tone().space.sm} alignItems="center">
        <text fg={tone().accent}>
          <span style={{ bold: true }}>{GIZZIBrand.wordmark}</span>
        </text>
        <text fg={theme.textMuted}>{GIZZIBrand.product}</text>
      </box>

      {/* Status */}
      <box
        flexDirection="column"
        gap={tone().space.sm}
        padding={tone().space.md}
        backgroundColor={theme.backgroundPanel}
        borderStyle="single"
        borderColor={theme.border}
      >
        <text fg={theme.text}>
          <span style={{ bold: true }}>Status</span>
        </text>
        <box flexDirection="row" gap={tone().space.md}>
          <Show
            when={hasProviders()}
            fallback={
              <text fg={theme.warning}>
                <span style={{ fg: theme.error }}>●</span> No providers connected
              </text>
            }
          >
            <text fg={theme.success}>
              <span style={{ fg: theme.success }}>●</span> {String(sync.data.provider.length)} provider
              {sync.data.provider.length > 1 ? "s" : ""} connected
            </text>
          </Show>
          <Show when={hasSessions()}>
            <text fg={theme.textMuted}>|</text>
            <text fg={theme.text}>
              {String(sync.data.session.length)} session
              {sync.data.session.length > 1 ? "s" : ""}
            </text>
          </Show>
        </box>
      </box>

      {/* Quick Start */}
      <Show when={!hasProviders() || !hasSessions()}>
        <box flexDirection="column" gap={tone().space.sm}>
          <text fg={theme.text}>
            <span style={{ bold: true }}>Quick Start</span>
          </text>
          <box flexDirection="column" gap={tone().space.xs}>
            <For each={QUICK_START_OPTIONS}>
              {(option) => (
                <box
                  flexDirection="row"
                  gap={tone().space.sm}
                  padding={tone().space.sm}
                  backgroundColor={theme.backgroundElement}
                  onMouseUp={() => handleOption(option)}
                >
                  <text flexShrink={0}>{option.icon}</text>
                  <box flexDirection="column" flexGrow={1}>
                    <text fg={theme.text}>{option.title}</text>
                    <text fg={theme.textMuted} wrapMode="word">
                      {option.description}
                    </text>
                  </box>
                  <text fg={theme.textMuted}>{option.command}</text>
                </box>
              )}
            </For>
          </box>
        </box>
      </Show>

      {/* Tips */}
      <box flexDirection="column" gap={tone().space.xs}>
        <text fg={theme.textMuted}>
          <span style={{ bold: true }}>Tips:</span>
        </text>
        <text fg={theme.textMuted}>• Press Ctrl+P for the command palette</text>
        <text fg={theme.textMuted}>• Type @filename to attach files</text>
        <text fg={theme.textMuted}>• Use /undo to revert changes</text>
      </box>
    </box>
  )
}
