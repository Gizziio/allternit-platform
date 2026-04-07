import type { JSX } from "solid-js"
import { For, Show, createMemo } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"

type FileNode = {
  name: string
  type: "file" | "directory"
  children?: FileNode[]
}

const LAYERS: FileNode[] = [
  {
    name: "L1: Shell",
    type: "directory",
    children: [
      { name: "commands/", type: "directory" },
      { name: "tui/", type: "directory" },
    ],
  },
  {
    name: "L2: Runtime",
    type: "directory",
    children: [
      { name: "session.ts", type: "file" },
      { name: "dag.ts", type: "file" },
    ],
  },
  {
    name: "L3: UI",
    type: "directory",
    children: [
      { name: "components/", type: "directory" },
      { name: "hooks/", type: "directory" },
    ],
  },
  {
    name: "L4: Protocol",
    type: "directory",
    children: [
      { name: "mcp/", type: "directory" },
      { name: "gizzi/", type: "directory" },
    ],
  },
  {
    name: "L5: Kernel",
    type: "directory",
    children: [
      { name: "state.rs", type: "file" },
      { name: "engine.rs", type: "file" },
    ],
  },
]

interface LayerExplorerProps {
  selectedLayer?: number
  onSelectLayer?: (layer: number) => void
}

export function LayerExplorer(props: LayerExplorerProps) {
  const { theme } = useTheme()
  const selected = () => props.selectedLayer ?? 0

  const layerColor = (index: number) => {
    if (index === selected()) return theme.accent
    return theme.text
  }

  const renderNode = (node: FileNode, depth: number = 0): JSX.Element => {
    const indent = "  ".repeat(depth)
    const icon = node.type === "directory" ? "📁" : "📄"

    return (
      <>
        <text fg={theme.textMuted} wrapMode="none">
          {indent}
          <span style={{ fg: theme.text }}>{icon}</span> {node.name}
        </text>
        <Show when={node.children}>
          <For each={node.children}>
            {(child) => renderNode(child, depth + 1)}
          </For>
        </Show>
      </>
    )
  }

  return (
    <box flexDirection="column" gap={0}>
      <text fg={theme.accent} wrapMode="none">
        <span style={{ bold: true }}>┌─ LAYER EXPLORER ──────────────────────┐</span>
      </text>
      <For each={LAYERS}>
        {(layer, index) => (
          <box flexDirection="column">
            <text fg={layerColor(index())} wrapMode="none">
              <span style={{ bold: index() === selected() }}>
                {index() === selected() ? "> " : "  "}
                {layer.name}
              </span>
            </text>
            <Show when={index() === selected()}>
              <box flexDirection="column" paddingLeft={2}>
                <For each={layer.children}>
                  {(child) => (
                    <text fg={theme.textMuted} wrapMode="none">
                      {"  "}
                      <span style={{ fg: child.type === "directory" ? theme.warning : theme.text }}>
                        {child.type === "directory" ? "📁" : "📄"} {child.name}
                      </span>
                    </text>
                  )}
                </For>
              </box>
            </Show>
          </box>
        )}
      </For>
      <text fg={theme.accent} wrapMode="none">
        <span style={{ bold: true }}>└───────────────────────────────────────┘</span>
      </text>
    </box>
  )
}
