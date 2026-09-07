// @ts-nocheck
/**
 * InProcessDashboardSource — DashboardSource over this process's app state.
 *
 * Rows are top-level sessions from the dashboard registry in
 * topLevelSession.ts (main-session `local_agent` tasks). The optional
 * `getMainRow` provider lets REPL inject a synthetic leader row for the main
 * session; omit it and the dashboard lists spawned sessions only.
 */

import { getCwdState } from '../bootstrap/state.js'
import type { QueryParams } from '../query.js'
import type { AppState } from '../state/AppStateStore.js'
import type { SetAppState } from '../Task.js'
import {
  getTopLevelSessionEntry,
  getTopLevelSessionMessages,
  getTopLevelSessionOrderRank,
  getTopLevelSessionRegistry,
  isTopLevelSessionAwaitingInput,
  moveTopLevelSession,
  removeTopLevelSession,
  renameTopLevelSession,
  replyToTopLevelSession,
  setTopLevelSessionPinned,
  spawnTopLevelSession,
  stopTopLevelSession,
} from './topLevelSession.js'
import type {
  DashboardPeek,
  DashboardRow,
  DashboardSessionState,
  DashboardSource,
} from './types.js'

function formatTokens(n: number | undefined): string {
  if (!n) return '0'
  if (n < 1000) return String(n)
  return `${(n / 1000).toFixed(1)}k`
}

function messageTime(message: unknown): number {
  const ts = message?.timestamp
  if (typeof ts === 'number') return ts
  if (typeof ts === 'string') {
    const parsed = Date.parse(ts)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  return 0
}

export class InProcessDashboardSource implements DashboardSource {
  constructor(private readonly opts: {
    getAppState: () => AppState
    setAppState: SetAppState
    buildQueryParams: () => Promise<Omit<QueryParams, 'messages'>>
    getMainRow?: () => DashboardRow | undefined
  }) {}

  list(): DashboardRow[] {
    const { getAppState, getMainRow } = this.opts
    const appState = getAppState()
    const rows: DashboardRow[] = []

    const mainRow = getMainRow?.()
    if (mainRow) rows.push(mainRow)

    for (const [taskId, entry] of getTopLevelSessionRegistry()) {
      const task = appState.tasks[taskId]
      const progress = task?.type === 'local_agent' ? task.progress : undefined
      const lastActivity = progress?.recentActivities?.at(-1)

      let state: DashboardSessionState = 'inactive'
      let activityLine = ''
      if (task) {
        switch (task.status) {
          case 'running':
            state = isTopLevelSessionAwaitingInput(taskId)
              ? 'needs-input'
              : 'working'
            activityLine = [
              lastActivity?.toolName,
              progress?.toolUseCount
                ? `${progress.toolUseCount} tool${progress.toolUseCount === 1 ? '' : 's'}`
                : undefined,
              `${formatTokens(progress?.tokenCount)} tok`,
            ]
              .filter(Boolean)
              .join(' · ')
            break
          case 'completed':
            state = 'completed'
            activityLine = `${formatTokens(progress?.tokenCount)} tok`
            break
          case 'failed':
          case 'killed':
            state = 'failed'
            activityLine = `${formatTokens(progress?.tokenCount)} tok`
            break
          default:
            state = 'idle'
        }
      }

      rows.push({
        id: taskId,
        source: 'in-process',
        title: entry.title,
        state,
        activityLine,
        directory: entry.directory,
        model: entry.model,
        permissionMode: entry.permissionMode,
        pinned: entry.pinned,
        createdAt: entry.createdAt,
        updatedAt: Math.max(
          entry.updatedAt,
          task?.endTime ?? 0,
          task?.startTime ?? 0,
        ),
      })
    }

    // Pinned first, then persisted explicit order, then freshness.
    rows.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      const byOrder =
        getTopLevelSessionOrderRank(a.id) - getTopLevelSessionOrderRank(b.id)
      if (byOrder !== 0) return byOrder
      return b.updatedAt - a.updatedAt
    })
    return rows
  }

  peek(id: string): DashboardPeek | undefined {
    const messages = getTopLevelSessionMessages(id, this.opts.getAppState)
    if (!messages?.length) {
      const entry = getTopLevelSessionEntry(id)
      if (!entry) return undefined
      return {
        lastResponseType: 'none',
        lastResponseText: '',
        lastActivityAt: entry.updatedAt,
      }
    }

    let lastResponseType = 'none'
    let lastResponseText = ''
    let lastActivityAt = 0
    for (const message of messages) {
      const t = messageTime(message)
      if (t) lastActivityAt = Math.max(lastActivityAt, t)
      if (message.type !== 'assistant') continue
      for (const block of message.message?.content ?? []) {
        if (block.type === 'text' && block.text) {
          lastResponseType = 'text'
          lastResponseText = block.text
        } else if (block.type === 'tool_use') {
          lastResponseType = block.name ?? 'tool'
        }
      }
    }
    if (!lastActivityAt) {
      lastActivityAt = getTopLevelSessionEntry(id)?.updatedAt ?? 0
    }
    return { lastResponseType, lastResponseText, lastActivityAt }
  }

  reply(id: string, text: string): void {
    replyToTopLevelSession(id, text)
  }

  dispatch(prompt: string, opts?: { model?: string; permissionMode?: string }): string {
    const { getAppState, setAppState, buildQueryParams } = this.opts
    const appState = getAppState()
    return spawnTopLevelSession({
      prompt,
      queryParams: buildQueryParams(),
      getAppState,
      setAppState,
      directory: getCwdState(),
      model: opts?.model ?? appState?.mainLoopModel?.alias ?? appState?.mainLoopModel?.fullName ?? undefined,
      permissionMode: opts?.permissionMode ?? appState?.toolPermissionContext?.mode,
    })
  }

  stop(id: string): void {
    stopTopLevelSession(id)
  }

  remove(id: string): void {
    removeTopLevelSession(id)
  }

  rename(id: string, title: string): void {
    renameTopLevelSession(id, title)
  }

  setPinned(id: string, pinned: boolean): void {
    setTopLevelSessionPinned(id, pinned)
  }

  move(id: string, direction: -1 | 1): void {
    moveTopLevelSession(id, direction)
  }

  messages(id: string): { role: string; text: string }[] {
    const messages = getTopLevelSessionMessages(id, this.opts.getAppState)
    if (!messages) return []
    const result: { role: string; text: string }[] = []
    for (const message of messages) {
      const role =
        message.type === 'user'
          ? 'user'
          : message.type === 'assistant'
            ? 'assistant'
            : 'system'
      const parts: string[] = []
      for (const block of message.message?.content ?? []) {
        if (block.type === 'text' && block.text) parts.push(block.text)
        else if (block.type === 'tool_use')
          parts.push(`[${block.name}] ${JSON.stringify(block.input ?? {}).slice(0, 120)}`)
        else if (block.type === 'tool_result') {
          const content = block.content
          parts.push(
            typeof content === 'string'
              ? content.slice(0, 200)
              : JSON.stringify(content).slice(0, 200),
          )
        }
      }
      const text = parts.join('\n').trim()
      if (text) result.push({ role, text })
    }
    return result
  }
}
