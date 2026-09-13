/**
 * Rails DAG poller for gizzi-code.
 *
 * Mirrors the user's CommRails WIH DAGs (GET /api/commrails/dags?view=mine)
 * into the TUI so the Rails todo panel can render live node statuses. Same
 * shape as the inbox poller in railsPeer.ts: HTTP polling, dedupe by content
 * fingerprint, errors swallowed, gated on Rails peer mode.
 */

import { logForDiagnosticsNoPII } from 'src/shared/utils/diagLogs.js'
import { errorMessage } from 'src/shared/utils/errors.js'
import {
  apiFetchJson,
  getAllternitApiConfig,
} from '../../services/api/allternitApi.js'

export type DagNodeStatus = 'NEW' | 'READY' | 'RUNNING' | 'DONE' | 'FAILED'

export type DagNodeDto = {
  node_id: string
  parent_node_id: string | null
  title: string
  status: DagNodeStatus
  ready: boolean
  assignee: string | null
  current_wih_id: string | null
}

export type DagViewItemDto = {
  dag_id: string
  root_title: string
  nodes: DagNodeDto[]
  ready_count: number
  done_count: number
}

export type ActiveWihDto = {
  wih_id: string
  dag_id: string
  node_id: string
  agent_id: string
  status: string
}

export type DagViewDto = {
  dags: DagViewItemDto[]
  active_wihs: ActiveWihDto[]
}

const RAILS_DAG_POLL_INTERVAL_MS = 3_000

/**
 * True when this session registered as a Rails peer (peer name exported by
 * railsPeer.ts registerRailsPeer). All Rails DAG behavior is gated on this
 * so non-Rails sessions are completely unaffected.
 */
export function isRailsPeerMode(): boolean {
  return Boolean(
    process.env.ALLTERNIT_COMMRAILS_PEER_NAME ||
      process.env.ALLTERNIT_RAILS_PEER_NAME,
  )
}

/**
 * Start polling the DAG view. Calls onUpdate only when the dags/active_wihs
 * content actually changed (JSON fingerprint). Errors are logged and
 * swallowed. Returns a stop function; safe to call when peer mode is off
 * (returns a no-op stop and never polls).
 */
export function startRailsDagListener(
  onUpdate: (dto: DagViewDto) => void,
): () => void {
  if (!isRailsPeerMode()) {
    return () => {}
  }

  const config = getAllternitApiConfig()
  let lastFingerprint: string | null = null
  let pollIntervalId: ReturnType<typeof setInterval> | null = null

  async function pollOnce(): Promise<void> {
    try {
      const dto = await apiFetchJson<DagViewDto>(
        config,
        '/api/commrails/dags?view=mine',
      )
      const fingerprint = JSON.stringify([dto.dags, dto.active_wihs])
      if (fingerprint === lastFingerprint) return
      lastFingerprint = fingerprint
      onUpdate(dto)
    } catch (error) {
      logForDiagnosticsNoPII('info', 'rails_dag_poll_error', {
        error: errorMessage(error),
      })
    }
  }

  // Poll immediately, then every 3 seconds.
  pollOnce().catch(() => {
    // Next interval retries; DAG polling must never crash the host process.
  })
  pollIntervalId = setInterval(() => {
    pollOnce().catch(() => {
      // Next interval retries; DAG polling must never crash the host process.
    })
  }, RAILS_DAG_POLL_INTERVAL_MS)

  function stop(): void {
    if (pollIntervalId) {
      clearInterval(pollIntervalId)
      pollIntervalId = null
    }
  }

  // Stop polling when the process exits (the bridge also stops on unmount).
  process.once('exit', stop)

  return stop
}
