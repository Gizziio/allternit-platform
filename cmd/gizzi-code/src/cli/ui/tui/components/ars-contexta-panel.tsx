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
import { RGBA, TextAttributes } from "@opentui/core"
import {
  getArsContextaRuntime,
  type ArsContextaOperation,
  type ArsContextaOperationType,
} from "@/cli/ui/components/gizzi/ars-contexta-runtime"

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

const statusColors: Record<string, RGBA> = {
  pending: RGBA.fromInts(204, 204, 0),
  running: RGBA.fromInts(85, 153, 255),
  completed: RGBA.fromInts(85, 204, 85),
  failed: RGBA.fromInts(255, 85, 85),
}

export function ArsContextaPanel(props: ArsContextaPanelProps) {
  const runtime = getArsContextaRuntime()
  const [operations, setOperations] = createSignal<ArsContextaOperation[]>([])

  createEffect(() => {
    const unsubscribe = runtime.subscribe((ops: ArsContextaOperation[]) => {
      setOperations(props.showCompleted ? ops : ops.filter((o: ArsContextaOperation) => o.status !== "completed"))
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
          <text attributes={TextAttributes.BOLD}>Ars Contexta</text>
        </box>

        <box flexDirection="column">
          <For each={operations()}>
            {(op) => (
              <box flexDirection="column" paddingLeft={1}>
                <box flexDirection="row" gap={1}>
                  <text>{String(operationIcons[op.type] ?? "")}</text>
                  <text>{String(op.label ?? "")}</text>
                  <text fg={statusColors[op.status] ?? RGBA.fromInts(170, 170, 170)}>
                    {String(op.status ?? "")}
                  </text>
                </box>

                <Show when={op.detail}>
                  <text fg={RGBA.fromInts(136, 136, 136)} paddingLeft={2}>{String(op.detail ?? "")}</text>
                </Show>

                <Show when={op.status === "running" && op.progress !== undefined}>
                  <box flexDirection="row" gap={1} paddingLeft={2}>
                    <text fg={RGBA.fromInts(85, 153, 255)}>{renderProgressBar(op.progress!)}</text>
                    <text>{String(op.progress ?? 0)}%</text>
                  </box>
                </Show>

                <Show when={op.status === "completed"}>
                  <box flexDirection="row" gap={1} paddingLeft={2}>
                    <Show when={op.entityCount}>
                      <text fg={RGBA.fromInts(85, 204, 85)}>
                        {String(op.entityCount ?? 0)} entities
                      </text>
                    </Show>
                    <Show when={op.insightCount}>
                      <text fg={RGBA.fromInts(85, 204, 85)}>
                        {String(op.insightCount ?? 0)} insights
                      </text>
                    </Show>
                    <Show when={op.processingTimeMs}>
                      <text fg={RGBA.fromInts(136, 136, 136)}>
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
