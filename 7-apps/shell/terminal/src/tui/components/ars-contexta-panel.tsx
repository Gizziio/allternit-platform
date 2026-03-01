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
  type ArsContextaOperationType 
} from "../../ui/a2r/ars-contexta-runtime"

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

const statusColors: Record<string, string> = {
  pending: "yellow",
  running: "blue",
  completed: "green",
  failed: "red",
}

const resetColor = "\x1b[0m"

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
      <div class="ars-contexta-panel" style={{ "max-height": props.maxHeight }}>
        <div class="panel-header">
          {/* @ts-ignore SolidJS JSX type mismatch */}
          <span class="header-icon">◐</span>
          {/* @ts-ignore SolidJS JSX type mismatch */}
          <span class="header-text">Ars Contexta</span>
        </div>
        
        <div class="operations-list">
          <For each={operations()}>
            {(op) => (
              <div class={`operation-item ${op.status}`}>
                <div class="operation-header">
                  {/* @ts-ignore SolidJS JSX type mismatch */}
                  <span class="operation-icon">{operationIcons[op.type]}</span>
                  {/* @ts-ignore SolidJS JSX type mismatch */}
                  <span class="operation-label">{op.label}</span>
                  {/* @ts-ignore SolidJS JSX type mismatch */}
                  <span class={`operation-status ${statusColors[op.status]}`}>
                    {op.status}{resetColor}
                  </span>
                </div>
                
                <Show when={op.detail}>
                  <div class="operation-detail">{op.detail}</div>
                </Show>
                
                <Show when={op.status === "running" && op.progress !== undefined}>
                  <div class="progress-container">
                    {/* @ts-ignore SolidJS JSX type mismatch */}
                    <span class="progress-bar">{renderProgressBar(op.progress!)}</span>
                    {/* @ts-ignore SolidJS JSX type mismatch */}
                    <span class="progress-text">{op.progress}%</span>
                  </div>
                </Show>
                
                <Show when={op.status === "completed"}>
                  <div class="operation-results">
                    <Show when={op.entityCount}>
                      {/* @ts-ignore SolidJS JSX type mismatch */}
                      <span class="result-badge entities">
                        {op.entityCount} entities
                      </span>
                    </Show>
                    <Show when={op.insightCount}>
                      {/* @ts-ignore SolidJS JSX type mismatch */}
                      <span class="result-badge insights">
                        {op.insightCount} insights
                      </span>
                    </Show>
                    <Show when={op.processingTimeMs}>
                      {/* @ts-ignore SolidJS JSX type mismatch */}
                      <span class="result-badge duration">
                        {formatDuration(op.processingTimeMs)}
                      </span>
                    </Show>
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </Show>
  )
}
