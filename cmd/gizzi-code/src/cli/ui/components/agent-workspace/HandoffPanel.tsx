import { Show, createMemo, For } from "solid-js"
import { useTheme } from "@/cli/ui/ink-app/context/theme"

interface Checkpoint {
  id: string
  timestamp: string
  summary: string
  filesModified: number
}

interface HandoffPanelProps {
  checkpoints?: Checkpoint[]
  onResume?: (checkpointId: string) => void
  onDismiss?: () => void
}

const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  {
    id: "cp-001",
    timestamp: "10:23 AM",
    summary: "Refactored auth middleware",
    filesModified: 3,
  },
  {
    id: "cp-002",
    timestamp: "11:45 AM",
    summary: "Added user profile endpoints",
    filesModified: 5,
  },
  {
    id: "cp-003",
    timestamp: "2:15 PM",
    summary: "Fixed login redirect bug",
    filesModified: 2,
  },
]

export function HandoffPanel(props: HandoffPanelProps) {
  const { theme } = useTheme()
  const checkpoints = () => props.checkpoints ?? DEFAULT_CHECKPOINTS

  return (
    <box
      flexDirection="column"
      gap={1}
      padding={1}
      width={60}
    >
      <text fg={theme.accent} wrapMode="none">
        <span style={{ bold: true }}>┌─ RESUME SESSION ──────────────────────┐</span>
      </text>

      <box flexDirection="column" paddingLeft={1} paddingRight={1}>
        <text fg={theme.textMuted} wrapMode="none">
          Previous checkpoints available:
        </text>
      </box>

      <For each={checkpoints()}>
        {(cp, index) => (
          <box
            flexDirection="row"
            gap={1}
            paddingLeft={1}
            paddingRight={1}
          >
            <text fg={theme.info} wrapMode="none">
              <span style={{ bold: true }}>{index() + 1}.</span>
            </text>
            <box flexDirection="column" flexGrow={1}>
              <text fg={theme.text} wrapMode="none">
                <span style={{ bold: true }}>{cp.summary}</span>
              </text>
              <text fg={theme.textMuted} wrapMode="none">
                {cp.timestamp} • {cp.filesModified} files
              </text>
            </box>
            <Show when={props.onResume}>
              <text fg={theme.success} wrapMode="none">
                [Enter]
              </text>
            </Show>
          </box>
        )}
      </For>

      <box flexDirection="column" paddingLeft={1} paddingRight={1} gap={0}>
        <text fg={theme.border} wrapMode="none">
          {"─".repeat(39)}
        </text>
      </box>

      <box flexDirection="row" gap={2} paddingLeft={1}>
        <text fg={theme.success} wrapMode="none">
          <span style={{ bold: true }}>↵</span> Resume
        </text>
        <text fg={theme.warning} wrapMode="none">
          <span style={{ bold: true }}>n</span> New Session
        </text>
        <Show when={props.onDismiss}>
          <text fg={theme.error} wrapMode="none">
            <span style={{ bold: true }}>esc</span> Dismiss
          </text>
        </Show>
      </box>

      <text fg={theme.accent} wrapMode="none">
        <span style={{ bold: true }}>└───────────────────────────────────────┘</span>
      </text>
    </box>
  )
}
