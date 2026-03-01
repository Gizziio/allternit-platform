import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod/v4"
import { Log } from "@/util/log"

export namespace GuardPolicy {
  const log = Log.create({ service: "guard.policy" })

  // Thresholds from spec
  export const THRESHOLDS = {
    WARN: 0.70,
    COMPACT: 0.85,
    HANDOFF: 0.92,
  } as const

  export type GuardState = "OK" | "WARN" | "COMPACT" | "HANDOFF" | "FAILCLOSED"

  export interface GuardMetrics {
    context_ratio: number
    quota_ratio: number
    tokens_input: number
    tokens_output: number
    tokens_total: number
    context_window: number
    cost_estimate?: number
    throttle_count: number
  }

  export interface GuardContext {
    session_id: string
    run_id: string
    dag_node_id?: string
    model: string
    provider: string
    runner: string
    workspace: string
  }

  // Events
  export const Event = {
    Warn: BusEvent.define(
      "guard.warn",
      z.object({
        session_id: z.string(),
        context_ratio: z.number(),
        quota_ratio: z.number(),
        threshold: z.number(),
        timestamp: z.number(),
      })
    ),
    Compact: BusEvent.define(
      "guard.compact",
      z.object({
        session_id: z.string(),
        context_ratio: z.number(),
        quota_ratio: z.number(),
        threshold: z.number(),
        baton_path: z.string(),
        timestamp: z.number(),
      })
    ),
    Handoff: BusEvent.define(
      "guard.handoff",
      z.object({
        session_id: z.string(),
        context_ratio: z.number(),
        quota_ratio: z.number(),
        threshold: z.number(),
        baton_path: z.string(),
        target_runner: z.string(),
        timestamp: z.number(),
      })
    ),
    FailClosed: BusEvent.define(
      "guard.failclosed",
      z.object({
        session_id: z.string(),
        context_ratio: z.number(),
        quota_ratio: z.number(),
        threshold: z.number(),
        reason: z.string(),
        timestamp: z.number(),
      })
    ),
  }

  export interface GuardResult {
    state: GuardState
    action: "none" | "warn" | "compact" | "handoff" | "failclosed"
    triggered_by: "context" | "quota" | "both"
    metrics: GuardMetrics
    context: GuardContext
    baton_path?: string
    target_runner?: string
    reason?: string
  }

  /**
   * Evaluate guard policy based on current metrics
   */
  export function evaluate(
    metrics: GuardMetrics,
    context: GuardContext,
    options?: {
      compact_pending?: boolean
      last_compact_time?: number
      min_compact_interval_ms?: number
    }
  ): GuardResult {
    const { context_ratio, quota_ratio } = metrics

    // Determine which threshold group is highest
    const max_ratio = Math.max(context_ratio, quota_ratio)
    const triggered_by = context_ratio >= quota_ratio ? "context" : "quota"

    // OK state
    if (max_ratio < THRESHOLDS.WARN) {
      return {
        state: "OK",
        action: "none",
        triggered_by,
        metrics,
        context,
      }
    }

    // WARN state (70%)
    if (max_ratio < THRESHOLDS.COMPACT) {
      // Emit warning event
      Bus.publish(Event.Warn, {
        session_id: context.session_id,
        context_ratio,
        quota_ratio,
        threshold: THRESHOLDS.WARN,
        timestamp: Date.now(),
      })

      log.info("Guard WARN triggered", {
        session_id: context.session_id,
        context_ratio: context_ratio.toFixed(2),
        quota_ratio: quota_ratio.toFixed(2),
      })

      return {
        state: "WARN",
        action: "warn",
        triggered_by,
        metrics,
        context,
      }
    }

    // COMPACT state (85%)
    if (max_ratio < THRESHOLDS.HANDOFF) {
      // Check cooldown to prevent rapid compaction
      const min_interval = options?.min_compact_interval_ms ?? 60000 // 1 minute default
      const last_compact = options?.last_compact_time ?? 0
      const now = Date.now()

      if (now - last_compact < min_interval) {
        log.info("Guard COMPACT skipped (cooldown)", {
          session_id: context.session_id,
          cooldown_remaining_ms: min_interval - (now - last_compact),
        })

        return {
          state: "COMPACT",
          action: "none", // Will retry after cooldown
          triggered_by,
          metrics,
          context,
          reason: "cooldown_active",
        }
      }

      // Emit compact event
      const baton_path = generateBatonPath(context.workspace)
      Bus.publish(Event.Compact, {
        session_id: context.session_id,
        context_ratio,
        quota_ratio,
        threshold: THRESHOLDS.COMPACT,
        baton_path,
        timestamp: now,
      })

      log.info("Guard COMPACT triggered", {
        session_id: context.session_id,
        context_ratio: context_ratio.toFixed(2),
        quota_ratio: quota_ratio.toFixed(2),
        baton_path,
      })

      return {
        state: "COMPACT",
        action: "compact",
        triggered_by,
        metrics,
        context,
        baton_path,
      }
    }

    // HANDOFF state (92%)
    // Check if we have a recent baton
    const baton_path = generateBatonPath(context.workspace)

    // Emit handoff event
    const target_runner = selectTargetRunner(context)
    Bus.publish(Event.Handoff, {
      session_id: context.session_id,
      context_ratio,
      quota_ratio,
      threshold: THRESHOLDS.HANDOFF,
      baton_path,
      target_runner,
      timestamp: Date.now(),
    })

    log.info("Guard HANDOFF triggered", {
      session_id: context.session_id,
      context_ratio: context_ratio.toFixed(2),
      quota_ratio: quota_ratio.toFixed(2),
      baton_path,
      target_runner,
    })

    return {
      state: "HANDOFF",
      action: "handoff",
      triggered_by,
      metrics,
      context,
      baton_path,
      target_runner,
    }
  }

  /**
   * Force a fail-closed state (emergency stop)
   */
  export function failClosed(
    metrics: GuardMetrics,
    context: GuardContext,
    reason: string
  ): GuardResult {
    log.error("Guard FAILCLOSED triggered", {
      session_id: context.session_id,
      reason,
      context_ratio: metrics.context_ratio.toFixed(2),
      quota_ratio: metrics.quota_ratio.toFixed(2),
    })

    Bus.publish(Event.FailClosed, {
      session_id: context.session_id,
      context_ratio: metrics.context_ratio,
      quota_ratio: metrics.quota_ratio,
      threshold: THRESHOLDS.HANDOFF,
      reason,
      timestamp: Date.now(),
    })

    return {
      state: "FAILCLOSED",
      action: "failclosed",
      triggered_by: metrics.context_ratio >= metrics.quota_ratio ? "context" : "quota",
      metrics,
      context,
      reason,
    }
  }

  function generateBatonPath(workspace: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    return `${workspace}/.a2r/compact/compact-${timestamp}.md`
  }

  function selectTargetRunner(context: GuardContext): string {
    // Simple selection logic - prefer different runner
    const runners = ["a2r_shell", "claude_code", "codex"]
    const current = context.runner
    
    // Try to find a different runner
    const alternative = runners.find(r => r !== current)
    return alternative ?? "a2r_shell"
  }

  /**
   * Calculate context ratio from token counts
   */
  export function calculateContextRatio(
    tokens_used: number,
    context_window: number
  ): number {
    if (context_window <= 0) return 0
    return Math.min(1, tokens_used / context_window)
  }

  /**
   * Calculate quota ratio from usage stats
   */
  export function calculateQuotaRatio(stats: {
    rate_limit_errors: number
    budget_used: number
    budget_cap: number
    tokens_day: number
    tokens_day_limit: number
  }): number {
    const ratios = [
      stats.rate_limit_errors > 0 ? 0.8 : 0, // Any rate limit errors = 80%
      stats.budget_cap > 0 ? stats.budget_used / stats.budget_cap : 0,
      stats.tokens_day_limit > 0 ? stats.tokens_day / stats.tokens_day_limit : 0,
    ]
    return Math.max(...ratios)
  }
}
