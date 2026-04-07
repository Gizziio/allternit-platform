/**
 * CLI debugging utilities
 */

import { log } from '../../runtime/util/log.js'

let debugEnabled = false
let debugLogFile: string | undefined

export function setDebugMode(enabled: boolean): void {
  debugEnabled = enabled
  log('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`)
}

export function isDebugMode(): boolean {
  return debugEnabled || process.env.DEBUG === 'true' || process.env.GIZZI_DEBUG === '1'
}

export function setDebugLogFile(path: string): void {
  debugLogFile = path
}

export function debugLog(message: string, ...args: unknown[]): void {
  if (!isDebugMode()) return
  
  const timestamp = new Date().toISOString()
  const formatted = `[${timestamp}] [DEBUG] ${message}`
  
  console.error(formatted, ...args)
  
  if (debugLogFile) {
    try {
      const fs = require('fs')
      const line = `${formatted} ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
      fs.appendFileSync(debugLogFile, line)
    } catch {
      // Ignore errors
    }
  }
}

export function logForDebugging(message: string, data?: unknown): void {
  debugLog(message, data)
  
  // Also log to runtime log for consistency
  log('debug', message, data)
}

export function createDebugger(namespace: string) {
  return {
    log: (msg: string, ...args: unknown[]) => debugLog(`[${namespace}] ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => debugLog(`[${namespace}:error] ${msg}`, ...args),
  }
}

// Assert helper
export function debugAssert(condition: boolean, message: string): void {
  if (!condition && isDebugMode()) {
    throw new Error(`Assertion failed: ${message}`)
  }
}

// Performance debugging
export function measureTiming<T>(label: string, fn: () => T): T {
  const start = performance.now()
  try {
    return fn()
  } finally {
    const duration = performance.now() - start
    if (isDebugMode() || duration > 100) {
      debugLog(`${label} took ${duration.toFixed(2)}ms`)
    }
  }
}

export async function measureTimingAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const duration = performance.now() - start
    if (isDebugMode() || duration > 100) {
      debugLog(`${label} took ${duration.toFixed(2)}ms`)
    }
  }
}

// Stack trace utilities
export function getStackTrace(): string {
  const err = new Error()
  return err.stack || ''
}

export function logStackTrace(message?: string): void {
  if (isDebugMode()) {
    debugLog(message || 'Stack trace:', '\n' + getStackTrace())
  }
}

// Initialize from environment
if (process.env.DEBUG === 'true' || process.env.GIZZI_DEBUG === '1') {
  debugEnabled = true
}

// Default export
export default {
  setDebugMode,
  isDebugMode,
  setDebugLogFile,
  debugLog,
  logForDebugging,
  createDebugger,
  debugAssert,
  measureTiming,
  measureTimingAsync,
  getStackTrace,
  logStackTrace,
}
