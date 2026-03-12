/**
 * Agent Rate Limiter
 * 
 * Per-agent rate limiting for API calls and actions.
 * Prevents abuse and ensures fair resource usage.
 * 
 * Features:
 * - Sliding window rate limiting
 * - Per-agent limits
 * - Per-action limits
 * - Configurable windows
 * - Audit logging
 */

import { Log } from '@/shared/util/log'
import { Bus } from '@/shared/bus'
import { BusEvent } from '@/shared/bus/bus-event'
import { z } from 'zod/v4'

export namespace AgentRateLimiter {
  const log = Log.create({ service: 'agent-rate-limiter' })

  // ============================================================================
  // Types
  // ============================================================================

  export interface RateLimitConfig {
    maxRequests: number
    windowMs: number
    burstLimit?: number // Allow short bursts
  }

  export interface AgentLimitConfig {
    agentId: string
    limits: {
      [action: string]: RateLimitConfig
    }
  }

  export interface RateLimitState {
    agentId: string
    action: string
    requests: RequestRecord[]
    windowStart: number
  }

  export interface RequestRecord {
    timestamp: number
    allowed: boolean
  }

  export interface RateLimitResult {
    allowed: boolean
    remaining: number
    resetAt: number
    retryAfter?: number
    limit: number
    error?: string
  }

  // ============================================================================
  // Events
  // ============================================================================

  export const RateLimitExceeded = BusEvent.define(
    'agent.rate.limit.exceeded',
    z.object({
      agentId: z.string(),
      action: z.string(),
      limit: z.number(),
      current: z.number(),
    }),
  )

  export const RateLimitChecked = BusEvent.define(
    'agent.rate.limit.checked',
    z.object({
      agentId: z.string(),
      action: z.string(),
      allowed: z.boolean(),
      remaining: z.number(),
    }),
  )

  // ============================================================================
  // State
  // ============================================================================

  const agentConfigs = new Map<string, AgentLimitConfig>()
  const rateLimitState = new Map<string, RateLimitState>() // key: agentId:action

  // Default limits
  const defaultLimits: RateLimitConfig = {
    maxRequests: 100,
    windowMs: 60000, // 1 minute
    burstLimit: 20,
  }

  const actionLimits: Record<string, RateLimitConfig> = {
    // Communication actions
    'communicate:send': { maxRequests: 60, windowMs: 60000, burstLimit: 10 },
    'communicate:read': { maxRequests: 200, windowMs: 60000, burstLimit: 50 },
    'communicate:create_channel': { maxRequests: 10, windowMs: 60000, burstLimit: 5 },

    // Git actions
    'git:push': { maxRequests: 20, windowMs: 3600000, burstLimit: 5 }, // 20/hour
    'git:fetch': { maxRequests: 100, windowMs: 3600000, burstLimit: 20 },
    'git:bundle': { maxRequests: 10, windowMs: 3600000, burstLimit: 3 },

    // General API
    'api:read': { maxRequests: 500, windowMs: 60000, burstLimit: 100 },
    'api:write': { maxRequests: 100, windowMs: 60000, burstLimit: 20 },
  }

  // ============================================================================
  // Configuration
  // ============================================================================

  /**
   * Set rate limits for an agent
   */
  export function setAgentLimits(config: AgentLimitConfig): void {
    agentConfigs.set(config.agentId, config)
    log.info('Set agent rate limits', {
      agentId: config.agentId,
      actions: Object.keys(config.limits),
    })
  }

  /**
   * Get limits for an action
   */
  function getLimitConfig(agentId: string, action: string): RateLimitConfig {
    // Check agent-specific config first
    const agentConfig = agentConfigs.get(agentId)
    if (agentConfig && agentConfig.limits[action]) {
      return agentConfig.limits[action]
    }

    // Fall back to action-specific default
    if (actionLimits[action]) {
      return actionLimits[action]
    }

    // Fall back to global default
    return defaultLimits
  }

  // ============================================================================
  // Rate Limiting
  // ============================================================================

  /**
   * Check if a request is allowed
   */
  export function checkRateLimit(
    agentId: string,
    action: string,
  ): RateLimitResult {
    const config = getLimitConfig(agentId, action)
    const stateKey = `${agentId}:${action}`
    const now = Date.now()
    const windowStart = now - config.windowMs

    // Get or create state
    let state = rateLimitState.get(stateKey)
    if (!state) {
      state = {
        agentId,
        action,
        requests: [],
        windowStart: now,
      }
      rateLimitState.set(stateKey, state)
    }

    // Remove old requests outside window
    state.requests = state.requests.filter((req) => req.timestamp > windowStart)

    // Count recent requests
    const recentCount = state.requests.length
    const remaining = Math.max(0, config.maxRequests - recentCount)

    // Check burst limit
    const burstWindow = now - 1000 // Last second
    const burstCount = state.requests.filter((req) => req.timestamp > burstWindow).length
    const burstRemaining = config.burstLimit ? config.burstLimit - burstCount : Infinity

    // Determine if allowed
    const allowed = recentCount < config.maxRequests && burstRemaining > 0

    // Calculate reset time
    const oldestRequest = state.requests[0]
    const resetAt = oldestRequest ? oldestRequest.timestamp + config.windowMs : now + config.windowMs

    // Record this request attempt
    state.requests.push({
      timestamp: now,
      allowed,
    })

    // Log and publish event
    Bus.publish(RateLimitChecked, {
      agentId,
      action,
      allowed,
      remaining,
    })

    if (!allowed) {
      log.warn('Rate limit exceeded', {
        agentId,
        action,
        limit: config.maxRequests,
        current: recentCount,
        windowMs: config.windowMs,
      })

      Bus.publish(RateLimitExceeded, {
        agentId,
        action,
        limit: config.maxRequests,
        current: recentCount,
      })
    }

    return {
      allowed,
      remaining,
      resetAt,
      retryAfter: allowed ? undefined : Math.ceil((resetAt - now) / 1000),
      limit: config.maxRequests,
    }
  }

  /**
   * Check and record a request (atomic)
   */
  export function checkAndRecord(
    agentId: string,
    action: string,
  ): RateLimitResult {
    const result = checkRateLimit(agentId, action)

    if (!result.allowed) {
      result.error = `Rate limit exceeded. Try again in ${result.retryAfter}s`
    }

    return result
  }

  /**
   * Get current usage for an agent/action
   */
  export function getUsage(agentId: string, action: string): {
    current: number
    limit: number
    remaining: number
    windowMs: number
  } {
    const config = getLimitConfig(agentId, action)
    const stateKey = `${agentId}:${action}`
    const state = rateLimitState.get(stateKey)
    const now = Date.now()
    const windowStart = now - config.windowMs

    if (!state) {
      return {
        current: 0,
        limit: config.maxRequests,
        remaining: config.maxRequests,
        windowMs: config.windowMs,
      }
    }

    const current = state.requests.filter((req) => req.timestamp > windowStart).length

    return {
      current,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - current),
      windowMs: config.windowMs,
    }
  }

  /**
   * Get usage for all actions for an agent
   */
  export function getAllUsage(agentId: string): Record<string, {
    current: number
    limit: number
    remaining: number
  }> {
    const usage: Record<string, { current: number; limit: number; remaining: number }> = {}

    for (const [key] of rateLimitState.entries()) {
      if (key.startsWith(`${agentId}:`)) {
        const action = key.split(':')[1]
        usage[action] = getUsage(agentId, action)
      }
    }

    return usage
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup old rate limit state
   */
  export function cleanup(): number {
    const now = Date.now()
    let removed = 0

    for (const [key, state] of rateLimitState.entries()) {
      const config = getLimitConfig(state.agentId, state.action)
      const windowStart = now - config.windowMs

      // Remove old requests
      state.requests = state.requests.filter((req) => req.timestamp > windowStart)

      // Remove state if empty
      if (state.requests.length === 0) {
        rateLimitState.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      log.debug('Cleaned up rate limit state', { count: removed })
    }

    return removed
  }

  /**
   * Clear all rate limit state (for testing)
   */
  export function clearAll(): void {
    rateLimitState.clear()
    log.info('Cleared all rate limit state')
  }

  /**
   * Reset rate limit for specific agent/action
   */
  export function reset(agentId: string, action?: string): void {
    if (action) {
      const key = `${agentId}:${action}`
      rateLimitState.delete(key)
      log.debug('Reset rate limit', { agentId, action })
    } else {
      for (const key of rateLimitState.keys()) {
        if (key.startsWith(`${agentId}:`)) {
          rateLimitState.delete(key)
        }
      }
      log.info('Reset all rate limits for agent', { agentId })
    }
  }

  // ============================================================================
  // Middleware Helper
  // ============================================================================

  /**
   * Create rate limit middleware
   */
  export function createMiddleware() {
    return async function rateLimitMiddleware(
      agentId: string,
      action: string,
    ): Promise<RateLimitResult> {
      return checkAndRecord(agentId, action)
    }
  }

  // ============================================================================
  // Start Cleanup Interval
  // ============================================================================

  // Cleanup every 5 minutes
  setInterval(() => {
    cleanup()
  }, 5 * 60 * 1000)
}
