/**
 * Ars Contexta TUI Panel Component
 *
 * Shows real-time progress of:
 * - Entity extraction
 * - Insight generation
 * - Knowledge graph operations
 *
 * WIH: GAP-78/GAP-79 TUI Integration
 */

import { createSignal, createEffect, onCleanup, For, Show } from "solid-js"
import {
  getArsContextaRuntime,
  type ArsContextaOperation,
  type ArsContextaOperationType,
} from "../../ui/gizzi/ars-contexta-runtime"

interface ArsContextaPanelProps {
  maxHeight?: number
  showCompleted?: boolean
}

const operationIcons: Record<ArsContextaOperationType, string> = {
  "entity-extraction": "◆",
  "insight-generation": "◈",
  "content-enrichment": "◇",
  "knowledge-graph-update": "◉",
}

const statusColors: Record<string, number> = {
  pending: 0xcccc00,
  running: 0x5599ff,
  completed: 0x55cc55,
  failed: 0xff5555,
}

export function ArsContextaPanel(props: ArsContextaPanelProps) {
  const runtime = getArsContextaRuntime()
  const [operations, setOperations] = createSignal<ArsContextaOperation[]>([])

  createEffect(() => {
    const unsubscribe = runtime.subscribe((ops) => {
      setOperations(props.showCompleted ? ops : ops.filter((o) => o.status !== "completed"))
    })
    onCleanup(unsubscribe)
  })

  const renderProgressBar = (progress: number) => {
    const width = 20
    const filled = Math.round((progress / 100) * width)
    const empty = width - filled
    return "█".repeat(filled) + "░".repeat(empty)
  }

  const formatDuration = (ms?: number) => {
    if (!ms) return ""
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Show when={operations().length > 0}>
      <box flexDirection="column" height={props.maxHeight}>
        <box flexDirection="row" gap={1}>
          <text>◐</text>
          <text style={{ bold: true }}>Ars Contexta</text>
        </box>

        <box flexDirection="column">
          <For each={operations()}>
            {(op) => (
              <box flexDirection="column" paddingLeft={1}>
                <box flexDirection="row" gap={1}>
                  <text>{operationIcons[op.type]}</text>
                  <text>{op.label}</text>
                  <text fg={statusColors[op.status] ?? 0xaaaaaa}>
                    {op.status}
                  </text>
                </box>

                <Show when={op.detail}>
                  <text fg={0x888888} paddingLeft={2}>{op.detail}</text>
                </Show>

                <Show when={op.status === "running" && op.progress !== undefined}>
                  <box flexDirection="row" gap={1} paddingLeft={2}>
                    <text fg={0x5599ff}>{renderProgressBar(op.progress!)}</text>
                    <text>{op.progress}%</text>
                  </box>
                </Show>

                <Show when={op.status === "completed"}>
                  <box flexDirection="row" gap={1} paddingLeft={2}>
                    <Show when={op.entityCount}>
                      <text fg={0x55cc55}>
                        {op.entityCount} entities
                      </text>
                    </Show>
                    <Show when={op.insightCount}>
                      <text fg={0x55cc55}>
                        {op.insightCount} insights
                      </text>
                    </Show>
                    <Show when={op.processingTimeMs}>
                      <text fg={0x888888}>
                        {formatDuration(op.processingTimeMs)}
                      </text>
                    </Show>
                  </box>
                </Show>
              </box>
            )}
          </For>
        </box>
      </box>
    </Show>
  )
}
