/**
 * Analytics service
 * Tracks events and metrics
 */

import { log } from '../../runtime/util/log.js'
import { getGlobalContext } from '../../runtime/context/global/index.js'

export interface AnalyticsEvent {
  name: string
  properties?: Record<string, unknown>
  timestamp: Date
  sessionId?: string
  userId?: string
}

export interface AnalyticsMetric {
  name: string
  value: number
  tags?: Record<string, string>
  timestamp: Date
}

type EventHandler = (event: AnalyticsEvent) => void | Promise<void>
type MetricHandler = (metric: AnalyticsMetric) => void | Promise<void>

// Event tracking
const eventHandlers: EventHandler[] = []
const metricsHandlers: MetricHandler[] = []
let sessionId: string | undefined
let userId: string | undefined

export function initializeAnalytics(opts: { sessionId?: string; userId?: string } = {}): void {
  sessionId = opts.sessionId
  userId = opts.userId
  log('info', 'Analytics initialized', { sessionId, userId })
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  const event: AnalyticsEvent = {
    name,
    properties,
    timestamp: new Date(),
    sessionId,
    userId,
  }
  
  // Async handling
  eventHandlers.forEach(handler => {
    try {
      Promise.resolve(handler(event)).catch(err => {
        log('error', 'Event handler failed', err)
      })
    } catch (err) {
      log('error', 'Event handler failed', err)
    }
  })
  
  // Console logging in debug mode
  if (getGlobalContext().debug) {
    log('debug', `[Analytics] ${name}`, properties)
  }
}

export function trackMetric(name: string, value: number, tags?: Record<string, string>): void {
  const metric: AnalyticsMetric = {
    name,
    value,
    tags,
    timestamp: new Date(),
  }
  
  metricsHandlers.forEach(handler => {
    try {
      Promise.resolve(handler(metric)).catch(err => {
        log('error', 'Metric handler failed', err)
      })
    } catch (err) {
      log('error', 'Metric handler failed', err)
    }
  })
}

export function onEvent(handler: EventHandler): () => void {
  eventHandlers.push(handler)
  return () => {
    const idx = eventHandlers.indexOf(handler)
    if (idx !== -1) eventHandlers.splice(idx, 1)
  }
}

export function onMetric(handler: MetricHandler): () => void {
  metricsHandlers.push(handler)
  return () => {
    const idx = metricsHandlers.indexOf(handler)
    if (idx !== -1) metricsHandlers.splice(idx, 1)
  }
}

// Common event types
export function trackCommandExecuted(command: string, duration: number, success: boolean): void {
  trackEvent('command.executed', {
    command,
    duration,
    success,
  })
  trackMetric('command.duration', duration, { command })
}

export function trackToolUsed(toolName: string, duration: number, success: boolean): void {
  trackEvent('tool.used', {
    tool: toolName,
    duration,
    success,
  })
  trackMetric('tool.duration', duration, { tool: toolName })
}

export function trackSessionStart(): void {
  trackEvent('session.start')
}

export function trackSessionEnd(duration: number): void {
  trackEvent('session.end', { duration })
  trackMetric('session.duration', duration)
}

export function trackError(error: Error, context?: string): void {
  trackEvent('error.occurred', {
    error: error.message,
    stack: error.stack,
    context,
  })
  trackMetric('error.count', 1, { context: context || 'unknown' })
}

export function trackFeatureFlag(flag: string, value: unknown): void {
  trackEvent('feature_flag.evaluated', { flag, value })
}

// Analytics providers
export interface AnalyticsProvider {
  name: string
  track: (event: AnalyticsEvent) => Promise<void>
  metric: (metric: AnalyticsMetric) => Promise<void>
}

const providers: AnalyticsProvider[] = []

export function registerProvider(provider: AnalyticsProvider): void {
  providers.push(provider)
  
  // Subscribe to events
  onEvent(event => provider.track(event))
  onMetric(metric => provider.metric(metric))
  
  log('info', `Registered analytics provider: ${provider.name}`)
}

export function unregisterProvider(name: string): void {
  const idx = providers.findIndex(p => p.name === name)
  if (idx !== -1) {
    providers.splice(idx, 1)
  }
}

// File-based analytics (fallback)
export function createFileAnalyticsProvider(logPath: string): AnalyticsProvider {
  return {
    name: 'file',
    track: async (event) => {
      const { writeFile, fileExists } = await import('../../runtime/util/filesystem.js')
      const line = JSON.stringify(event) + '\n'
      
      if (await fileExists(logPath)) {
        const { readFile } = await import('../../runtime/util/filesystem.js')
        const existing = await readFile(logPath)
        await writeFile(logPath, existing + line)
      } else {
        await writeFile(logPath, line)
      }
    },
    metric: async (metric) => {
      const { writeFile, fileExists } = await import('../../runtime/util/filesystem.js')
      const line = JSON.stringify({ ...metric, type: 'metric' }) + '\n'
      
      if (await fileExists(logPath)) {
        const { readFile } = await import('../../runtime/util/filesystem.js')
        const existing = await readFile(logPath)
        await writeFile(logPath, existing + line)
      } else {
        await writeFile(logPath, line)
      }
    },
  }
}

// Default export
export default {
  initializeAnalytics,
  trackEvent,
  trackMetric,
  onEvent,
  onMetric,
  trackCommandExecuted,
  trackToolUsed,
  trackSessionStart,
  trackSessionEnd,
  trackError,
  trackFeatureFlag,
  registerProvider,
  unregisterProvider,
  createFileAnalyticsProvider,
}
