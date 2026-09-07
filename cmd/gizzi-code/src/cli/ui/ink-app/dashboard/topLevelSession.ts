// @ts-nocheck
/**
 * Top-level session runner for the agent dashboard.
 *
 * Dashboard sessions ARE main-session `local_agent` tasks (same plumbing as
 * Ctrl+B backgrounding) with one addition: the turn loop drains
 * `pendingMessages` between turns, so the user can send follow-ups from the
 * dashboard peek panel while the session keeps its full message history.
 *
 * Deliberately NOT built on:
 * - `startBackgroundSession` — single-shot; no follow-up turns.
 * - `completeMainSessionTask` — trims messages to the last one, which would
 *   break multi-turn peek/reply.
 *
 * In-process today; the DashboardSource interface in types.ts is the seam a
 * `gizzi serve`-backed source will implement later.
 */

import type { UUID } from 'crypto'
import {
  OUTPUT_FILE_TAG,
  STATUS_TAG,
  SUMMARY_TAG,
  TASK_ID_TAG,
  TASK_NOTIFICATION_TAG,
  TOOL_USE_ID_TAG,
} from '../constants/xml.js'
import { type QueryParams, query } from '../query.js'
import { roughTokenCountEstimation } from '../services/roughTokenEstimation.js'
import type { AppState } from '../state/AppStateStore.js'
import type { SetAppState } from '../Task.js'
import {
  drainPendingMessages,
  killAsyncAgent,
  queuePendingMessage,
} from '../tasks/LocalAgentTask/LocalAgentTask.js'
import { registerMainSessionTask } from '../tasks/LocalMainSessionTask.js'
import type { AgentDefinition } from '../tools/AgentTool/loadAgentsDir.js'
import type { Message } from '../types/message.js'
import {
  runWithAgentContext,
  type SubagentContext,
} from '../utils/agentContext.js'
import { logForDebugging } from '../utils/debug.js'
import { getGlobalConfig, saveGlobalConfig } from '../utils/config.js'
import { logError } from '../utils/log.js'
import { enqueuePendingNotification } from '../utils/messageQueueManager.js'
import { createUserMessage } from '../utils/messages.js'
import { recordSidechainTranscript } from '../utils/sessionStorage.js'
import { getTaskOutputPath } from '../utils/task/diskOutput.js'
import { updateTaskState } from '../utils/task/framework.js'

// Max recent activities to keep for display (mirrors LocalMainSessionTask)
const MAX_RECENT_ACTIVITIES = 20

type ToolActivity = {
  toolName: string
  input: Record<string, unknown>
}

type SessionRunner = {
  taskId: string
  messages: Message[]
  /** May be a promise — REPL's builders are async; awaited at turn start. */
  queryParams: Omit<QueryParams, 'messages'> | Promise<Omit<QueryParams, 'messages'>>
  getAppState: () => AppState
  setAppState: SetAppState
  abortSignal: AbortSignal
  running: boolean
  cancelRequested: boolean
}

export type TopLevelSessionRegistryEntry = {
  title: string
  directory: string
  model?: string
  permissionMode?: string
  createdAt: number
  updatedAt: number
  pinned: boolean
}

const sessionRunners = new Map<string, SessionRunner>()
const sessionRegistry = new Map<
  string,
  TopLevelSessionRegistryEntry & {
    getAppState: () => AppState
    setAppState: SetAppState
  }
>()

// taskIds currently sitting inside a canUseTool permission prompt. Flipped by
// the wrapper installed per-runner in runSessionTurns; read by the dashboard
// source to render the needs-input state.
const awaitingInput = new Set<string>()

export function isTopLevelSessionAwaitingInput(taskId: string): boolean {
  return awaitingInput.has(taskId)
}

// ---------------------------------------------------------------------------
// Pin persistence (global config, additive field — GlobalConfig is ts-nocheck)
// ---------------------------------------------------------------------------

const PIN_CONFIG_KEY = 'dashboard'

function loadPinnedIds(): Set<string> {
  try {
    const pinned = getGlobalConfig()?.[PIN_CONFIG_KEY]?.pinned
    return new Set(Array.isArray(pinned) ? pinned : [])
  } catch {
    return new Set()
  }
}

function persistPinnedIds(pinned: Set<string>): void {
  try {
    saveGlobalConfig(current => ({
      ...current,
      [PIN_CONFIG_KEY]: {
        ...current?.[PIN_CONFIG_KEY],
        pinned: [...pinned],
      },
    }))
  } catch {
    // Best-effort persistence; pinning still works in-memory.
  }
}

function loadReorderIds(): string[] {
  try {
    const reorder = getGlobalConfig()?.[PIN_CONFIG_KEY]?.reorder
    return Array.isArray(reorder) ? reorder : []
  } catch {
    return []
  }
}

function persistReorderIds(order: string[]): void {
  try {
    saveGlobalConfig(current => ({
      ...current,
      [PIN_CONFIG_KEY]: {
        ...current?.[PIN_CONFIG_KEY],
        reorder: order,
      },
    }))
  } catch {
    // Best-effort persistence.
  }
}

/**
 * Move a dashboard session up/down in the persisted order. The effective
 * order is: persisted reorder entries first (array order), then registry
 * ids not in the array (insertion order). Swaps positions in that effective
 * order and persists the result.
 */
export function moveTopLevelSession(taskId: string, direction: -1 | 1): void {
  const order = loadReorderIds()
  const registryIds = [...sessionRegistry.keys()]
  const effective = [
    ...order.filter(id => sessionRegistry.has(id)),
    ...registryIds.filter(id => !order.includes(id)),
  ]
  const idx = effective.indexOf(taskId)
  const swap = idx + direction
  if (idx < 0 || swap < 0 || swap >= effective.length) return
  ;[effective[idx], effective[swap]] = [effective[swap], effective[idx]]
  persistReorderIds(effective)
}

/** Effective display order rank: lower sorts first. Missing = after explicit. */
export function getTopLevelSessionOrderRank(taskId: string): number {
  const idx = loadReorderIds().indexOf(taskId)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

// ---------------------------------------------------------------------------
// Spawn / reply / stop / remove / rename / pin
// ---------------------------------------------------------------------------

export function spawnTopLevelSession({
  prompt,
  queryParams,
  getAppState,
  setAppState,
  agentDefinition,
  directory,
  model,
  permissionMode,
}: {
  prompt: string
  queryParams: Omit<QueryParams, 'messages'>
  getAppState: () => AppState
  setAppState: SetAppState
  agentDefinition?: AgentDefinition
  directory: string
  model?: string
  permissionMode?: string
}): string {
  const trimmed = prompt.trim()
  const title = trimmed.split('\n')[0]!.slice(0, 60) || 'New session'
  const { taskId, abortSignal } = registerMainSessionTask(
    title,
    setAppState,
    agentDefinition,
  )

  const messages = [createUserMessage({ content: trimmed })]
  const runner: SessionRunner = {
    taskId,
    messages,
    queryParams,
    getAppState,
    setAppState,
    abortSignal,
    running: false,
    cancelRequested: false,
  }
  sessionRunners.set(taskId, runner)
  sessionRegistry.set(taskId, {
    title,
    directory,
    model,
    permissionMode,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pinned: loadPinnedIds().has(taskId),
    getAppState,
    setAppState,
  })

  // Persist the pre-conversation so TaskOutput/peek has context immediately.
  void recordSidechainTranscript(messages, taskId).catch(err =>
    logForDebugging(`dashboard session initial transcript write failed: ${err}`),
  )

  void runSessionTurns(runner)
  return taskId
}

/**
 * Send a follow-up to a dashboard session. Returns false when the session is
 * unknown (runner gone — e.g. removed or process restarted).
 */
export function replyToTopLevelSession(taskId: string, text: string): boolean {
  const runner = sessionRunners.get(taskId)
  if (!runner) return false

  if (runner.running) {
    // Turn loop drains pendingMessages between turns and appends them as
    // user messages to the authoritative messages array.
    queuePendingMessage(taskId, text, runner.setAppState)
  } else {
    const message = createUserMessage({ content: text })
    runner.messages.push(message)
    updateTaskState(taskId, runner.setAppState, task =>
      task.type === 'local_agent'
        ? { ...task, status: 'running', messages: runner.messages }
        : task,
    )
    void runSessionTurns(runner)
  }
  touchRegistry(taskId)
  return true
}

/**
 * Graceful stop: cancel the running turn (session survives, keeps history).
 * When idle, behaves like a task kill.
 */
export function stopTopLevelSession(taskId: string): void {
  const runner = sessionRunners.get(taskId)
  if (runner?.running) {
    runner.cancelRequested = true
    return
  }
  const setAppState =
    sessionRunners.get(taskId)?.setAppState ??
    sessionRegistry.get(taskId)?.setAppState
  if (setAppState) {
    killAsyncAgent(taskId, setAppState)
  }
}

/** Permanently remove a dashboard session (cancels first if running). */
export function removeTopLevelSession(taskId: string): void {
  const runner = sessionRunners.get(taskId)
  if (runner?.running) {
    runner.cancelRequested = true
  }
  const setAppState = runner?.setAppState ?? sessionRegistry.get(taskId)?.setAppState
  if (setAppState) {
    setAppState(prev => {
      if (!prev.tasks[taskId]) return prev
      const { [taskId]: _removed, ...rest } = prev.tasks
      return { ...prev, tasks: rest }
    })
  }
  sessionRunners.delete(taskId)
  sessionRegistry.delete(taskId)
  awaitingInput.delete(taskId)
  const pinned = loadPinnedIds()
  if (pinned.delete(taskId)) {
    persistPinnedIds(pinned)
  }
}

export function renameTopLevelSession(taskId: string, title: string): void {
  const entry = sessionRegistry.get(taskId)
  if (!entry) return
  entry.title = title
  entry.updatedAt = Date.now()
  updateTaskState(taskId, entry.setAppState, task =>
    task.type === 'local_agent' ? { ...task, description: title } : task,
  )
}

export function setTopLevelSessionPinned(taskId: string, pinned: boolean): void {
  const entry = sessionRegistry.get(taskId)
  if (entry) {
    entry.pinned = pinned
    entry.updatedAt = Date.now()
  }
  const pinnedIds = loadPinnedIds()
  if (pinned) {
    pinnedIds.add(taskId)
  } else {
    pinnedIds.delete(taskId)
  }
  persistPinnedIds(pinnedIds)
}

// ---------------------------------------------------------------------------
// Accessors for the dashboard source
// ---------------------------------------------------------------------------

export function getTopLevelSessionEntry(
  taskId: string,
): TopLevelSessionRegistryEntry | undefined {
  const entry = sessionRegistry.get(taskId)
  if (!entry) return undefined
  const { getAppState: _g, setAppState: _s, ...rest } = entry
  return rest
}

export function getTopLevelSessionRegistry(): Map<
  string,
  TopLevelSessionRegistryEntry
> {
  const result = new Map<string, TopLevelSessionRegistryEntry>()
  for (const [taskId, entry] of sessionRegistry) {
    const { getAppState: _g, setAppState: _s, ...rest } = entry
    result.set(taskId, rest)
  }
  return result
}

export function getTopLevelSessionMessages(
  taskId: string,
  getAppState: () => AppState,
): Message[] | undefined {
  const runner = sessionRunners.get(taskId)
  if (runner) return runner.messages
  const task = getAppState().tasks[taskId]
  if (task?.type === 'local_agent') return task.messages
  return undefined
}

export function isTopLevelSessionTask(task: unknown): boolean {
  return (
    typeof task === 'object' &&
    task !== null &&
    task.type === 'local_agent' &&
    task.agentType === 'main-session' &&
    sessionRegistry.has(task.id)
  )
}

function touchRegistry(taskId: string): void {
  const entry = sessionRegistry.get(taskId)
  if (entry) entry.updatedAt = Date.now()
}

// ---------------------------------------------------------------------------
// Turn loop
// ---------------------------------------------------------------------------

async function runSessionTurns(runner: SessionRunner): Promise<void> {
  if (runner.running) return
  runner.running = true
  runner.cancelRequested = false

  const { taskId, getAppState, setAppState } = runner
  const agentContext: SubagentContext = {
    agentId: taskId,
    agentType: 'subagent',
    subagentName: 'main-session',
    isBuiltIn: true,
  }

  await runWithAgentContext(agentContext, async () => {
    let success = true
    try {
      const queryParams = await runner.queryParams
      // Per-runner canUseTool wrap: flags needs-input while a permission
      // prompt for this session is pending so the dashboard can surface it.
      // Mutating this copy is safe — buildQueryParams is awaited once per
      // runner and each dispatch builds fresh params.
      const originalCanUseTool = queryParams.canUseTool
      queryParams.canUseTool = (...args: unknown[]) => {
        awaitingInput.add(taskId)
        try {
          return originalCanUseTool(...args)
        } finally {
          awaitingInput.delete(taskId)
        }
      }
      const recentActivities: ToolActivity[] = []
      let toolCount = 0
      let tokenCount = 0
      let lastUuid: UUID | null = runner.messages.at(-1)?.uuid ?? null
      let firstTurn = true

      while (true) {
        if (runner.cancelRequested) break

        if (!firstTurn) {
          const pending = drainPendingMessages(
            taskId,
            getAppState,
            setAppState,
          )
          if (pending.length === 0) break
          for (const text of pending) {
            const message = createUserMessage({ content: text })
            runner.messages.push(message)
            void recordSidechainTranscript(
              [message],
              taskId,
              lastUuid,
            ).catch(err =>
              logForDebugging(
                `dashboard session transcript write failed: ${err}`,
              ),
            )
            lastUuid = message.uuid
          }
        }
        firstTurn = false

        for await (const event of query({
          messages: runner.messages,
          ...queryParams,
        })) {
          if (runner.abortSignal.aborted) {
            // External kill already mutated task state; stop without
            // finalizing (mirrors startBackgroundSession's abort path).
            return
          }
          if (runner.cancelRequested) break

          if (
            event.type !== 'user' &&
            event.type !== 'assistant' &&
            event.type !== 'system'
          ) {
            continue
          }

          runner.messages.push(event)

          void recordSidechainTranscript([event], taskId, lastUuid).catch(
            err =>
              logForDebugging(
                `dashboard session transcript write failed: ${err}`,
              ),
          )
          lastUuid = event.uuid

          if (event.type === 'assistant') {
            for (const block of event.message.content) {
              if (block.type === 'text') {
                tokenCount += roughTokenCountEstimation(block.text)
              } else if (block.type === 'tool_use') {
                toolCount++
                recentActivities.push({
                  toolName: block.name,
                  input: block.input as Record<string, unknown>,
                })
                if (recentActivities.length > MAX_RECENT_ACTIVITIES) {
                  recentActivities.shift()
                }
              }
            }
          }

          setAppState(prev => {
            const task = prev.tasks[taskId]
            if (!task || task.type !== 'local_agent') return prev
            const prevProgress = task.progress
            if (
              prevProgress?.tokenCount === tokenCount &&
              prevProgress.toolUseCount === toolCount &&
              task.messages === runner.messages
            ) {
              return prev
            }
            return {
              ...prev,
              tasks: {
                ...prev.tasks,
                [taskId]: {
                  ...task,
                  progress: {
                    tokenCount,
                    toolUseCount: toolCount,
                    recentActivities:
                      prevProgress?.toolUseCount === toolCount
                        ? prevProgress.recentActivities
                        : [...recentActivities],
                  },
                  messages: runner.messages,
                },
              },
            }
          })
        }

        const morePending =
          (getAppState().tasks[taskId]?.pendingMessages?.length ?? 0) > 0
        if (!morePending) break
      }
    } catch (error) {
      logError(error)
      success = false
    } finally {
      runner.running = false
      finalizeTopLevelSession(runner, success)
    }
  })
}

function finalizeTopLevelSession(
  runner: SessionRunner,
  success: boolean,
): void {
  const { taskId, setAppState } = runner
  const cancelled = runner.cancelRequested
  awaitingInput.delete(taskId)
  let completedNaturally = false

  updateTaskState(taskId, setAppState, task => {
    if (task.type !== 'local_agent' || task.status !== 'running') {
      return task
    }
    completedNaturally = true
    task.unregisterCleanup?.()
    return {
      ...task,
      status: success ? 'completed' : 'failed',
      endTime: Date.now(),
      // Intentionally NO message trim (completeMainSessionTask keeps only the
      // last message; dashboard sessions need full history for peek/reply).
      messages: runner.messages,
      ...(cancelled ? {} : { notified: true }),
    }
  })

  touchRegistry(taskId)

  // Notify on natural completion only — a cancelled session already reflects
  // the user's own stop action.
  if (completedNaturally && !cancelled) {
    enqueueDashboardNotification(taskId, success)
  }
}

function enqueueDashboardNotification(
  taskId: string,
  success: boolean,
): void {
  const entry = sessionRegistry.get(taskId)
  const title = entry?.title ?? 'Dashboard session'
  const status = success ? 'completed' : 'failed'
  const summary = success
    ? `Dashboard session "${title}" completed`
    : `Dashboard session "${title}" failed`

  const message = `<${TASK_NOTIFICATION_TAG}>
<${TASK_ID_TAG}>${taskId}</${TASK_ID_TAG}>
<${OUTPUT_FILE_TAG}>${getTaskOutputPath(taskId)}</${OUTPUT_FILE_TAG}>
<${STATUS_TAG}>${status}</${STATUS_TAG}>
<${SUMMARY_TAG}>${summary}</${SUMMARY_TAG}>
</${TASK_NOTIFICATION_TAG}>`

  enqueuePendingNotification({ value: message, mode: 'task-notification' })
}
