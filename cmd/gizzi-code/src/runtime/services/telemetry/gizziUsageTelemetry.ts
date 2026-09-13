/**
 * Opt-in usage telemetry client for the gizzi-code → allternit-api
 * `POST /api/v1/analytics/gizzi-code/events` endpoint (backend:
 * cmd/allternit-api/src/analytics_routes.rs).
 *
 * OFF by default. Enable with:
 *
 *     GIZZI_TELEMETRY=1 gizzi
 *
 * Env contract (matching the crate's existing conventions):
 * - `GIZZI_TELEMETRY` is ALSO the upstream analytics kill switch
 *   (`GIZZI_TELEMETRY=off` disables everything, see
 *   src/shared/utils/privacyLevel.ts). This module turns ON only when the
 *   value is explicitly truthy ('1'/'true'/'yes'/'on') AND the global privacy
 *   level permits telemetry — so `GIZZI_TELEMETRY=off`,
 *   `GIZZI_DISABLE_TELEMETRY=1`, `DISABLE_TELEMETRY=1`,
 *   `GIZZI_DISABLE_NONESSENTIAL_TRAFFIC=1`, `DO_NOT_TRACK=1`, and
 *   `gizzi config telemetry off` all keep this client silent.
 * - Target URL: `ALLTERNIT_API_URL` (or `ALLTERNIT_API_BASE_URL`), same
 *   resolver semantics as src/runtime/services/api/allternitApi.ts. Dev
 *   falls back to the loopback gateway (ALLTERNIT_GATEWAY_BASE); production
 *   builds (NODE_ENV=production) without an explicit URL stay silent rather
 *   than phone home to a guess — the desktop shell always passes
 *   ALLTERNIT_API_URL explicitly.
 * - Auth: same as allternitApi.ts — `Authorization: Bearer $ALLTERNIT_API_TOKEN`
 *   when set (Clerk JWT in production), plus `x-allternit-user-id`
 *   (`ALLTERNIT_USER_ID`, default 'gizzi-local') which allternit-api accepts
 *   in local dev.
 *
 * What is sent (one event per session, flushed at shutdown):
 * - session id, model(s) used, tokens in/out, cost (when known),
 *   tool_calls accepted/rejected counts, and `lines_accepted`.
 * - `lines_accepted` DEFINITION (conservative): number of added (`+`) lines
 *   in patches that were actually applied to disk by the file edit/write
 *   tools (countLinesChanged call sites in src/shared/utils/diff.ts and
 *   src/cli/ui/ink-app/utils/diff.ts). A patch only reaches those call sites
 *   after the edit passed permission acceptance, so this counts accepted
 *   edit/apply lines. Whole-file creations count all their lines. Pure
 *   deletions count 0. Display-only diffs (getPatchForDisplay previews that
 *   were never applied) never count.
 * - tool_calls_accepted: file edit/write tool applies (same choke point as
 *   lines_accepted). tool_calls_rejected: permission decisions declined at
 *   the permission-logging choke points (interactive + headless).
 * - No file paths, no prompt content, no tool arguments. Only what fits the
 *   backend schema (gizzi_code_usage_events).
 *
 * Delivery: fire-and-forget with a short timeout, at most one retry, never
 * throws, never blocks exit beyond the shutdown budget (gracefulShutdown
 * races analytics flushes against a 500 ms cap).
 */

import {
  getInitialMainLoopModel,
  getMainLoopModelOverride,
  getModelUsage,
  getSessionId,
  getTotalCostUSD,
  hasUnknownModelCost,
} from '@/bootstrap/state.js'
import { ALLTERNIT_GATEWAY_BASE } from '@/shared/constants/allternitGateway'
import { isEnvTruthy } from '@/shared/utils/envUtils'
import { isTelemetryDisabled } from '@/shared/utils/privacyLevel'
import { Log } from '@/shared/util/log'

const log = Log.create({ service: 'gizziUsageTelemetry' })

/** Short deadline so a hung gateway can never stall shutdown. */
const TELEMETRY_POST_TIMEOUT_MS = 2_500

type UsageCounters = {
  toolCallsAccepted: number
  toolCallsRejected: number
  linesAccepted: number
}

const counters: UsageCounters = {
  toolCallsAccepted: 0,
  toolCallsRejected: 0,
  linesAccepted: 0,
}

let flushed = false

export function isGizziUsageTelemetryEnabled(): boolean {
  if (!isEnvTruthy(process.env.GIZZI_TELEMETRY)) return false
  if (isTelemetryDisabled()) return false
  return resolveTelemetryBaseUrl() !== undefined
}

/** Same precedence as allternitApi.ts; silent (undefined) instead of throwing
 *  in production when no explicit URL is configured. */
function resolveTelemetryBaseUrl(): string | undefined {
  const explicit = (
    process.env.ALLTERNIT_API_URL ||
    process.env.ALLTERNIT_API_BASE_URL ||
    ''
  ).trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  if (process.env.NODE_ENV === 'production') return undefined
  return ALLTERNIT_GATEWAY_BASE
}

/**
 * Count accepted lines in a structured patch: `+` lines per hunk. When a new
 * file was created (empty patch + content), every content line counts. This
 * is the canonical lines_accepted computation — countLinesChanged in
 * src/shared/utils/diff.ts (and its ink-app twin) call recordAcceptedEdit
 * with the result at the moment a patch is applied to disk.
 */
export function countLinesAccepted(
  patch: ReadonlyArray<{ lines: string[] }>,
  newFileContent?: string,
): number {
  if (patch.length === 0 && newFileContent) {
    return newFileContent.split(/\r?\n/).length
  }
  let added = 0
  for (const hunk of patch) {
    for (const line of hunk.lines) {
      if (line.startsWith('+')) added += 1
    }
  }
  return added
}

/** Called from countLinesChanged when an edit/write patch was applied. */
export function recordAcceptedEdit(linesAccepted: number): void {
  if (!isGizziUsageTelemetryEnabled()) return
  counters.toolCallsAccepted += 1
  counters.linesAccepted += Math.max(0, Math.trunc(linesAccepted))
}

/** Called from the permission-decision logging choke points on decline. */
export function recordRejectedToolCall(): void {
  if (!isGizziUsageTelemetryEnabled()) return
  counters.toolCallsRejected += 1
}

export type GizziUsageSummaryDeps = {
  sessionId: string
  models: string[]
  primaryModel: string | undefined
  promptTokens: number
  completionTokens: number
  costMicrodollars: number
}

/**
 * Assemble the session-end summary event from accumulated counters. Pure
 * with respect to the counters — all session state comes from `deps` so
 * tests can inject it.
 */
export function buildSessionSummary(
  deps: GizziUsageSummaryDeps,
): Record<string, unknown> {
  return {
    session_id: deps.sessionId,
    event_type: 'session',
    model: deps.primaryModel,
    prompt_tokens: deps.promptTokens,
    completion_tokens: deps.completionTokens,
    cost_microdollars: deps.costMicrodollars,
    tool_calls_accepted: counters.toolCallsAccepted,
    tool_calls_rejected: counters.toolCallsRejected,
    lines_accepted: counters.linesAccepted,
    metadata: {
      models_used: deps.models,
      cost_known: deps.costMicrodollars > 0,
    },
  }
}

/** Default deps read the live session state from bootstrap state. */
function defaultSummaryDeps(): GizziUsageSummaryDeps {
  const usage = getModelUsage()
  const models = Object.keys(usage)
  let promptTokens = 0
  let completionTokens = 0
  for (const model of models) {
    promptTokens += usage[model]?.inputTokens ?? 0
    completionTokens += usage[model]?.outputTokens ?? 0
  }
  const totalCostUSD = getTotalCostUSD()
  return {
    sessionId: String(getSessionId() ?? ''),
    models,
    primaryModel:
      (typeof getMainLoopModelOverride() === 'string'
        ? getMainLoopModelOverride()
        : undefined) ??
      (typeof getInitialMainLoopModel() === 'string'
        ? getInitialMainLoopModel()
        : undefined) ??
      models[0],
    promptTokens,
    completionTokens,
    costMicrodollars:
      totalCostUSD > 0 || !hasUnknownModelCost()
        ? Math.round(totalCostUSD * 1_000_000)
        : 0,
  }
}

export async function postSessionSummary(
  baseUrl: string,
  event: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const token = process.env.ALLTERNIT_API_TOKEN?.trim()
  const userId = (
    process.env.ALLTERNIT_USER_ID ||
    process.env.ALLTERNIT_API_USER_ID ||
    'gizzi-local'
  ).trim()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-allternit-user-id': userId,
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let lastError: unknown
  // At most one retry (two attempts total), per the delivery contract.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetchImpl(
        `${baseUrl}/api/v1/analytics/gizzi-code/events`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ events: [event] }),
          signal: AbortSignal.timeout(TELEMETRY_POST_TIMEOUT_MS),
        },
      )
      if (res.ok) return true
      lastError = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err
    }
  }
  log.warn('gizzi-code usage telemetry post failed', { error: lastError })
  return false
}

/**
 * Flush the session summary. Fire-and-forget from the caller's perspective:
 * resolves quickly, never throws, skips entirely when disabled or nothing
 * was recorded. Called from gracefulShutdown's bounded analytics flush.
 */
export async function flushGizziUsageTelemetry(
  deps?: GizziUsageSummaryDeps,
): Promise<void> {
  if (flushed) return
  flushed = true
  try {
    if (!isGizziUsageTelemetryEnabled()) return
    if (
      counters.toolCallsAccepted === 0 &&
      counters.toolCallsRejected === 0 &&
      counters.linesAccepted === 0
    ) {
      return
    }
    const baseUrl = resolveTelemetryBaseUrl()
    if (!baseUrl) return
    await postSessionSummary(
      baseUrl,
      buildSessionSummary(deps ?? defaultSummaryDeps()),
    )
  } catch {
    // Telemetry must never crash the CLI or block exit.
  }
}

/** Test-only reset of the module accumulator. */
export function resetGizziUsageTelemetryForTests(): void {
  counters.toolCallsAccepted = 0
  counters.toolCallsRejected = 0
  counters.linesAccepted = 0
  flushed = false
}
