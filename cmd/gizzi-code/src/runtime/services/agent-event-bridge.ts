/**
 * Agent event bridge — forwards gizzi-code runtime wait-state signals into the
 * Allternit platform agent event stream so bot surfaces (web hub, iOS
 * BotStatusStore) can show waiting_approval / waiting_input / blocked while a
 * bot session is paused on a prompt.
 *
 * Event flow:
 *   1. allternit-api binds a gizzi session to an agent by sending
 *      `x-allternit-agent-id` (and `x-allternit-run-id` when a run id exists)
 *      on the requests it forwards here — `agent_chat_bridge`
 *      (cmd/allternit-api/src/v1_routes.rs) and `execute_agent_run`
 *      (cmd/allternit-api/src/agent_routes.rs). The session routes
 *      (src/runtime/server/routes/session.ts) call `bindSession` with those
 *      headers.
 *   2. `start()` (called from Server.listen, src/runtime/server/server.ts)
 *      subscribes to the internal event Bus (src/shared/bus):
 *        permission.asked    → agent.run.waiting_approval
 *                              (src/runtime/tools/guard/permission/next.ts:102)
 *        permission.replied  → agent.run.approval_resolved
 *        question.asked      → agent.run.waiting_input
 *                              (src/runtime/integrations/question/index.ts:56)
 *        question.replied /  → agent.run.approval_resolved (wait resolved; the
 *        question.rejected     four-type ingest vocabulary has no
 *                              input-resolved type, and the iOS fold treats
 *                              approval_resolved as "back to working")
 *        session.error       → agent.run.blocked
 *                              (src/runtime/session/index.ts:246) — except
 *                              MessageAbortedError, which is a user abort, not
 *                              a blocked run.
 *   3. For sessions with a binding, each mapped event is POSTed to
 *      `{apiBase}/api/v1/agents/:id/events/ingest`, which appends it to the
 *      Rails ledger that `GET /api/v1/agents/:id/events` (SSE) replays and
 *      polls (cmd/allternit-api/src/agent_routes.rs).
 *
 * Sessions without a binding (plain CLI/TUI sessions never created through
 * allternit-api) are skipped silently at debug level — the bridge is
 * strictly additive and never changes runtime behavior.
 *
 * Auth: reuses the same allternit-api client conventions as the rest of
 * gizzi-code's server-to-server calls (src/runtime/services/api/allternitApi.ts):
 * `ALLTERNIT_API_TOKEN` as a Bearer token when set, otherwise the local-dev
 * desktop-bootstrap headers (`x-allternit-user-id` +
 * `x-allternit-desktop-access-token`), which allternit-api's auth_middleware
 * accepts when its desktop shared secret matches. Ingest calls are
 * best-effort: failures are logged and never thrown back into the runtime.
 */

import { Bus } from "@/shared/bus"
import { PermissionNext } from "@/runtime/tools/guard/permission/next"
import { Question } from "@/runtime/integrations/question"
import { Session } from "@/runtime/session"
import { Log } from "@/shared/util/log"
import { apiFetch, getAllternitApiConfig } from "@/runtime/services/api/allternitApi"

export namespace AgentEventBridge {
  const log = Log.create({ service: "agent-event-bridge" })

  interface Binding {
    agentId: string
    runId?: string
  }

  /** gizzi sessionID → Allternit agent/run, populated from the
   * x-allternit-agent-id / x-allternit-run-id request headers. Process-local,
   * same lifetime posture as railsPeer's registration state. */
  const bindings = new Map<string, Binding>()

  let started = false

  /** Bind a gizzi session to its Allternit agent (and current run). Called by
   * the session routes on session create and on every message POST, so a
   * chat's per-turn run id stays current. */
  export function bindSession(sessionID: string, agentId: string, runId?: string): void {
    if (!sessionID || !agentId) return
    bindings.set(sessionID, { agentId, runId: runId || undefined })
  }

  /** Forget a session's binding (session delete). */
  export function unbindSession(sessionID: string): void {
    bindings.delete(sessionID)
  }

  /** Subscribe to the runtime bus. Idempotent — Server.listen may run more
   * than once in long-lived or test processes. */
  export function start(): void {
    if (started) return
    started = true

    Bus.subscribe(PermissionNext.Event.Asked, (event) => {
      const req = event.properties
      void emit(req.sessionID, "agent.run.waiting_approval", {
        request_id: req.id,
        permission: req.permission,
        patterns: req.patterns,
      })
    })

    Bus.subscribe(PermissionNext.Event.Replied, (event) => {
      const props = event.properties
      void emit(props.sessionID, "agent.run.approval_resolved", {
        request_id: props.requestID,
        reply: props.reply,
      })
    })

    Bus.subscribe(Question.Event.Asked, (event) => {
      const req = event.properties
      void emit(req.sessionID, "agent.run.waiting_input", {
        request_id: req.id,
        questions: req.questions.map((q) => q.header),
      })
    })

    const questionResolved = (sessionID: string, requestID: string, resolution: string) =>
      void emit(sessionID, "agent.run.approval_resolved", {
        request_id: requestID,
        resolution,
      })

    Bus.subscribe(Question.Event.Replied, (event) => {
      questionResolved(event.properties.sessionID, event.properties.requestID, "answered")
    })

    Bus.subscribe(Question.Event.Rejected, (event) => {
      questionResolved(event.properties.sessionID, event.properties.requestID, "dismissed")
    })

    Bus.subscribe(Session.Event.Error, (event) => {
      const props = event.properties
      if (!props.sessionID) return
      // User aborts are deliberate, not a blocked run.
      if (props.error?.name === "MessageAbortedError") return
      void emit(props.sessionID, "agent.run.blocked", {
        error: props.error?.name ?? "UnknownError",
        message: props.error?.message ?? "",
      })
    })

    log.info("subscribed to permission/question/session bus events")
  }

  async function emit(sessionID: string, type: string, payload: Record<string, unknown>): Promise<void> {
    const binding = bindings.get(sessionID)
    if (!binding) {
      log.debug("skipping event for unbound session", { type, sessionID })
      return
    }
    try {
      const config = getAllternitApiConfig()
      const res = await apiFetch(
        config,
        `/api/v1/agents/${encodeURIComponent(binding.agentId)}/events/ingest`,
        {
          method: "POST",
          body: JSON.stringify({
            type,
            ...(binding.runId ? { run_id: binding.runId } : {}),
            payload: { ...payload, session_id: sessionID },
          }),
        },
      )
      if (!res.ok) {
        log.warn("agent event ingest rejected", { type, sessionID, status: res.status })
      }
    } catch (error) {
      log.warn("agent event ingest failed", {
        type,
        sessionID,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
