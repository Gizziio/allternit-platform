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
  apiFetch,
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

/** The rails peer name = our agent id for WIH pickup/close ownership. */
export function railsPeerAgentId(): string | null {
  return (
    process.env.ALLTERNIT_COMMRAILS_PEER_NAME ||
    process.env.ALLTERNIT_RAILS_PEER_NAME ||
    null
  )
}

// ─── WIH write-back ─────────────────────────────────────────────────────────
//
// pickup/close POSTs against /api/commrails/wihs/*. Never throw: failures
// (network, 400/403/409 with the server's error message) come back as
// {ok:false, error} for inline display in the todo panel.

export type WihMutationResult = { ok: boolean; error?: string }

async function postWihMutation(
  path: string,
  body: Record<string, unknown>,
): Promise<WihMutationResult> {
  try {
    const config = getAllternitApiConfig()
    const res = await apiFetch(config, path, {
      method: 'POST',
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let message = `HTTP ${res.status}`
      try {
        const parsed = JSON.parse(text) as { error?: string; message?: string }
        message = parsed.error ?? parsed.message ?? message
      } catch {
        // Non-JSON body — keep the status fallback.
      }
      logForDiagnosticsNoPII('info', 'rails_wih_mutation_failed', {
        path,
        status: res.status,
      })
      return { ok: false, error: `${message} (${res.status})` }
    }
    return { ok: true }
  } catch (error) {
    logForDiagnosticsNoPII('info', 'rails_wih_mutation_failed', {
      path,
      error: errorMessage(error),
    })
    return { ok: false, error: errorMessage(error) }
  }
}

/**
 * Pick up a READY node: creates a WIH owned by this peer. 409 when the node
 * is not pickup-able (already taken, not ready); error message is surfaced
 * verbatim for inline panel display.
 */
export function pickupWih(
  dagId: string,
  nodeId: string,
): Promise<WihMutationResult> {
  const agentId = railsPeerAgentId()
  if (!agentId) {
    return Promise.resolve({ ok: false, error: 'rails peer mode is off' })
  }
  return postWihMutation('/api/commrails/wihs/pickup', {
    dag_id: dagId,
    node_id: nodeId,
    agent_id: agentId,
  })
}

/**
 * Close a WIH we own (status DONE or FAILED, auto-evidence v1). 403 when
 * the WIH is owned by a different agent; 400 when evidence is empty or the
 * status is outside DONE|FAILED (the server normalizes case).
 */
export function closeWih(
  wihId: string,
  evidence: string[],
  status: 'DONE' | 'FAILED' = 'DONE',
): Promise<WihMutationResult> {
  const agentId = railsPeerAgentId()
  if (!agentId) {
    return Promise.resolve({ ok: false, error: 'rails peer mode is off' })
  }
  return postWihMutation(
    `/api/commrails/wihs/${encodeURIComponent(wihId)}/close`,
    { status, evidence, agent_id: agentId },
  )
}

// ─── Immediate refresh ──────────────────────────────────────────────────────
//
// The poller dedupes by JSON fingerprint, so after a successful mutation a
// forced re-invocation of its poll cycle picks up the new state immediately
// instead of waiting for the next 3s tick. Only one listener runs per
// process; the ref is cleared when it stops.

let activeForcedPoll: (() => Promise<void>) | null = null

/**
 * Fire an immediate refetch of the DAG view. Fire-and-forget; poll errors
 * are already swallowed downstream. No-op when no listener is running.
 */
export function refreshRailsDagNow(): void {
  const poll = activeForcedPoll
  if (!poll) return
  poll().catch(() => {
    // Same swallow semantics as the interval poll.
  })
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

  activeForcedPoll = pollOnce

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
    if (activeForcedPoll === pollOnce) {
      activeForcedPoll = null
    }
    if (pollIntervalId) {
      clearInterval(pollIntervalId)
      pollIntervalId = null
    }
  }

  // Stop polling when the process exits (the bridge also stops on unmount).
  process.once('exit', stop)

  return stop
}
